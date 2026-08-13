import os
import pymupdf
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb
from sentence_transformers import SentenceTransformer

# Initialize embedding model locally (all-MiniLM-L6-v2)
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
print(f"Loading local embedding model: {EMBEDDING_MODEL_NAME}...")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# Initialize persistent ChromaDB client
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

def resolve_file_path(file_path: str) -> str:
    """Helper to locate PDF across Docker container volume mounts and local dev directories."""
    if os.path.exists(file_path):
        return file_path
    
    filename = os.path.basename(file_path)
    candidates = [
        os.path.join("/app/uploads", filename),
        os.path.join("./uploads", filename),
        os.path.join("../backend-node/uploads", filename),
        os.path.join("../uploads", filename),
        os.path.join(os.path.dirname(__file__), "uploads", filename),
        os.path.join(os.path.dirname(__file__), "../backend-node/uploads", filename),
    ]
    for cand in candidates:
        if os.path.exists(cand):
            print(f"Resolved PDF file path from '{file_path}' -> '{cand}'")
            return cand
    return file_path

def ingest_pdf(document_id: str, file_path: str, collection_name: str):
    """
    Parses PDF preserving page numbers, chunks text, generates embeddings,
    and stores in ChromaDB.
    """
    target_path = resolve_file_path(file_path)
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"PDF file not found at path: {file_path}")

    doc = pymupdf.open(target_path)
    page_count = doc.page_count
    total_text = ""
    pages_data = []

    # Step 1: Extract text per page
    for i in range(page_count):
        page = doc.load_page(i)
        text = page.get_text("text") or ""
        total_text += text
        pages_data.append({"page_num": i + 1, "text": text})

    doc.close()

    # Scanned document detection check
    if len(total_text.strip()) < 30:
        raise ValueError("This looks like a scanned or image-only PDF. OCR text extraction is not supported in v1.")

    # Step 2: Chunk text per page using RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

    all_chunks = []
    all_metadatas = []
    all_ids = []

    chunk_counter = 0
    for p_data in pages_data:
        page_num = p_data["page_num"]
        p_text = p_data["text"]
        if not p_text.strip():
            continue

        page_chunks = text_splitter.split_text(p_text)
        for chunk in page_chunks:
            if not chunk.strip():
                continue
            chunk_counter += 1
            all_chunks.append(chunk)
            all_metadatas.append({
                "page": page_num,
                "document_id": document_id,
                "chunk_id": chunk_counter
            })
            all_ids.append(f"{collection_name}_chunk_{chunk_counter}")

    if not all_chunks:
        raise ValueError("No readable text chunks could be created from this PDF.")

    # Step 3: Generate embeddings
    embeddings = embedding_model.encode(all_chunks).tolist()

    # Step 4: Store in isolated Chroma collection
    # If collection exists, delete to ensure clean re-ingestion
    try:
        chroma_client.delete_collection(name=collection_name)
    except Exception:
        pass

    collection = chroma_client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    collection.add(
        documents=all_chunks,
        embeddings=embeddings,
        metadatas=all_metadatas,
        ids=all_ids
    )

    return {
        "status": "ready",
        "pageCount": page_count,
        "chunkCount": len(all_chunks)
    }

def delete_collection(collection_name: str):
    """Deletes ChromaDB collection for a document."""
    try:
        chroma_client.delete_collection(name=collection_name)
        return True
    except Exception as e:
        print(f"Collection delete notice ({collection_name}): {e}")
        return False
