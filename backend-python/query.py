import os
import re
import chromadb
from sentence_transformers import SentenceTransformer
from prompts import RAG_SYSTEM_PROMPT

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

def query_rag(collection_name: str, question: str, chat_history: list):
    """
    Retrieves top 5 chunks for question from ChromaDB, constructs RAG prompt,
    calls LLM, and extracts page citations.
    """
    try:
        collection = chroma_client.get_collection(name=collection_name)
    except Exception as e:
        raise ValueError(f"Document collection '{collection_name}' not found. Please upload/re-ingest document.")

    # 1. Embed question and search Chroma
    question_embedding = embedding_model.encode([question]).tolist()[0]
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=5,
        include=["documents", "metadatas", "distances"]
    )

    all_docs = results.get("documents", [[]])[0]
    all_metas = results.get("metadatas", [[]])[0]
    all_distances = results.get("distances", [[]])[0]

    if not all_docs:
        return {
            "answer": "I couldn't find relevant information in this document.",
            "citations": []
        }

    # Filter out weakly-relevant chunks. With cosine space, Chroma returns
    # distance = 1 - cosine_similarity, so lower is better. A chunk with
    # distance > 0.8 is essentially unrelated to the question and only
    # adds noise to the prompt, which is a common cause of vague or
    # off-topic RAG answers.
    RELEVANCE_DISTANCE_THRESHOLD = 0.8
    retrieved_docs, retrieved_metas = [], []
    for doc_text, meta, dist in zip(all_docs, all_metas, all_distances):
        if dist <= RELEVANCE_DISTANCE_THRESHOLD:
            retrieved_docs.append(doc_text)
            retrieved_metas.append(meta)

    # If filtering removed everything, fall back to the single best match
    # rather than returning nothing — better to try with the closest chunk
    # than to give up outright.
    if not retrieved_docs:
        retrieved_docs = [all_docs[0]]
        retrieved_metas = [all_metas[0]]

    # 2. Format context passages and build page mapping
    context_passages = []
    page_snippets = {}

    for doc_text, meta in zip(retrieved_docs, retrieved_metas):
        page_num = meta.get("page", 1)
        context_passages.append(f"[Page {page_num}]: {doc_text}")
        if page_num not in page_snippets:
            # Store up to 200 chars snippet for UI preview
            snippet = doc_text[:200].strip() + ("..." if len(doc_text) > 200 else "")
            page_snippets[page_num] = snippet

    formatted_context = "\n\n".join(context_passages)

    # 3. Format chat history (last 3 turns)
    formatted_history = ""
    if chat_history:
        history_lines = []
        for turn in chat_history[-6:]:
            role = turn.get("role", "user").capitalize()
            content = turn.get("content", "")
            history_lines.append(f"{role}: {content}")
        formatted_history = "\n".join(history_lines)
    else:
        formatted_history = "No previous context."

    # 4. Build System Prompt
    full_prompt = RAG_SYSTEM_PROMPT.format(
        context=formatted_context,
        chat_history=formatted_history,
        question=question
    )

    # 5. Call LLM (Gemini or Anthropic or Fallback)
    answer_text = generate_llm_response(full_prompt, retrieved_docs, retrieved_metas)

    # 6. Parse citations
    citations = parse_citations(answer_text, page_snippets, retrieved_metas)

    # Clean raw [Sources: ...] or [Source: ...] tag from displayed answer text
    cleaned_answer = re.sub(r"\[Source[s]?:.*?\]", "", answer_text, flags=re.IGNORECASE).strip()
    if not cleaned_answer:
        cleaned_answer = answer_text.strip()

    return {
        "answer": cleaned_answer,
        "citations": citations
    }

class LLMUnavailableError(Exception):
    """Raised when no LLM provider could successfully generate a response."""
    pass

def generate_llm_response(prompt: str, retrieved_docs: list = None, retrieved_metas: list = None) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    errors = []

    if gemini_key and gemini_key.strip() and not gemini_key.startswith("your_"):
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key.strip())
            for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    if response and response.text:
                        return response.text.strip()
                except Exception as m_err:
                    errors.append(f"Gemini/{model_name}: {m_err}")
                    print(f"[LLM] Gemini model {model_name} failed: {m_err}")
        except Exception as e:
            errors.append(f"Gemini client init: {e}")
            print(f"[LLM] Gemini client initialization error: {e}")
    else:
        errors.append("Gemini: no valid GEMINI_API_KEY set")

    if anthropic_key and anthropic_key.strip() and not anthropic_key.startswith("your_"):
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key.strip())
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text.strip()
        except Exception as e:
            errors.append(f"Anthropic: {e}")
            print(f"[LLM] Anthropic API execution error: {e}")
    else:
        errors.append("Anthropic: no valid ANTHROPIC_API_KEY set")

    # Every provider failed — this is now LOUD, not silent.
    # It bubbles up as a real 500 error with the actual reason, instead of
    # quietly returning a fake "answer" made of raw chunk text.
    error_summary = " | ".join(errors)
    print(f"[LLM] All providers failed. Reasons: {error_summary}")
    raise LLMUnavailableError(
        f"No LLM provider is currently working. Check your API keys in .env. "
        f"Details: {error_summary}"
    )

def parse_citations(answer_text: str, page_snippets: dict, retrieved_metas: list) -> list:
    cited_pages = set()

    # Search for explicit [Source: Page X] or [Sources: Page X, Page Y] pattern
    source_match = re.search(r"\[Source[s]?:\s*(.*?)\]", answer_text, re.IGNORECASE)
    if source_match:
        pages_str = source_match.group(1)
        found_nums = re.findall(r"\b\d+\b", pages_str)
        for num in found_nums:
            cited_pages.add(int(num))

    # If no explicit source tags matched, include top retrieved page metadata
    if not cited_pages and retrieved_metas:
        for meta in retrieved_metas:
            if "page" in meta:
                cited_pages.add(meta["page"])

    citations = []
    for page in sorted(list(cited_pages)):
        snippet = page_snippets.get(page, f"Excerpt from Page {page}")
        citations.append({
            "page": page,
            "snippet": snippet
        })

    return citations
