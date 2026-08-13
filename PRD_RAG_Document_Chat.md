# Product Requirements Document
## DocTalk — RAG-Based Private Document Chat

**Version:** 1.0
**Author:** [Your Name]
**Date:** August 2026
**Status:** Ready for development

---

## 1. Overview

### 1.1 Problem Statement
People and small businesses have important documents — contracts, textbooks, policy manuals, research papers — but reading through 40+ pages to find one clause or fact is slow and error-prone. Generic AI chatbots either don't accept file uploads or send the data to a third-party cloud with no guarantee of privacy.

### 1.2 Solution
DocTalk lets a user upload any PDF and immediately start asking questions about it in plain English. The system retrieves only the relevant passages from the document (not the whole file) and uses an LLM to answer strictly from that content, citing the exact page and paragraph. All processing happens on infrastructure the user controls — nothing is used to train external models, and each user's documents are isolated from every other user's.

### 1.3 Target Users
- Students who need to ask questions about textbooks or lecture notes
- Small business owners reviewing contracts or vendor agreements
- Researchers who need to query long papers or reports quickly
- Anyone who wants a private alternative to pasting sensitive documents into a public chatbot

### 1.4 Success Metrics (for your resume / demo)
- End-to-end upload → first answer in under 15 seconds for a 20-page PDF
- Answers cite the correct page/paragraph at least 90% of the time on a test set of 20 questions
- Supports at least 3 concurrent document sessions per user without cross-contamination

---

## 2. Goals and Non-Goals

### 2.1 Goals
- Upload one or more PDFs and chat with them using natural language
- Every answer must be traceable to a specific location in the source document
- Support follow-up questions that reference earlier parts of the conversation
- Keep each user's documents private and isolated (basic auth + per-user storage)
- Ship a working, deployed, demoable product within 6–7 days

### 2.2 Non-Goals (explicitly out of scope for v1)
- OCR for scanned/handwritten documents (only text-based PDFs for v1)
- Multi-file cross-referencing in a single answer (v1 answers from one active document at a time)
- Real-time document editing or annotation
- Mobile native app (responsive web only)
- Payment/billing system

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|---------------|------------|
| 1 | New user | sign up and log in | my documents and chats are private to me |
| 2 | User | upload a PDF and see processing progress | I know when it's ready to query |
| 3 | User | ask a question in plain English | I get an answer without reading the whole document |
| 4 | User | see which page/paragraph an answer came from | I can verify the AI isn't making things up |
| 5 | User | ask follow-up questions | I can dig deeper without repeating context |
| 6 | User | see a list of my previously uploaded documents | I can revisit old conversations |
| 7 | User | delete a document and its chat history | I control my own data |
| 8 | User | get a clear error if I upload a non-text/scanned PDF | I'm not left waiting on something that will silently fail |

---

## 4. System Architecture

### 4.1 High-Level Flow
1. User uploads a PDF via the React frontend
2. Backend (FastAPI) extracts and cleans the text
3. Text is split into overlapping chunks (~500 tokens each, ~50 token overlap)
4. Each chunk is converted into a vector embedding
5. Embeddings + chunk text + metadata (page number, doc id) are stored in a vector database
6. When the user asks a question, the question itself is embedded and used to retrieve the top-k most similar chunks
7. Retrieved chunks + chat history + the question are sent to the LLM with a strict system prompt ("answer only from the provided context")
8. The LLM's answer is returned to the frontend along with the source page numbers, which are rendered as clickable citations

### 4.2 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite + TailwindCSS | You already know React; Vite gives fast local dev |
| Backend API | Node.js + Express | Handles auth, document metadata, chat history — your MERN comfort zone |
| AI/RAG Service | Python + FastAPI | Best ecosystem for PDF parsing, embeddings, and LangChain |
| Database (app data) | MongoDB | Users, documents metadata, chat history |
| Vector Database | ChromaDB (self-hosted, free) | Stores embeddings; no external cost, runs in Docker |
| PDF Parsing | PyMuPDF (fitz) | Fast, preserves page numbers accurately |
| Chunking + Orchestration | LangChain | Handles chunking, retrieval, and prompt assembly |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local, free) OR Gemini Embedding API | Local model = zero API cost, good for a resume project |
| LLM for answers | Claude API (Anthropic) or Gemini API | Strong instruction-following for "answer only from context" |
| Auth | JWT (jsonwebtoken) + bcrypt | Standard, you already know this |
| File storage | Local disk (`/uploads`) or Firebase Storage | Firebase Storage if you want a cloud demo link |
| Containerization | Docker + docker-compose | Ties Node service + Python service + ChromaDB together |
| Deployment | Render (backend services) + Vercel (frontend) | Both have free tiers |

### 4.3 Why Two Backend Services?
Node.js (Express) handles everything that is NOT AI: user accounts, JWT auth, document metadata, chat history storage. Python (FastAPI) handles everything that IS AI: PDF parsing, chunking, embeddings, retrieval, and calling the LLM. Node calls Python's `/rag/query` endpoint internally whenever a user sends a chat message. This split mirrors how real companies architect this (a JS web layer talking to a Python ML microservice) and is a strong talking point in interviews.

### 4.4 Architecture Diagram (describe this to Claude/Antigravity to generate, or draw in Excalidraw)
```
[React Frontend]
      |
      | REST (JWT auth)
      v
[Node.js/Express API] ---- MongoDB (users, doc metadata, chat history)
      |
      | internal REST call
      v
[Python FastAPI RAG Service]
      |
      |-- PyMuPDF (parse PDF)
      |-- LangChain (chunk text)
      |-- Embedding model (MiniLM or Gemini)
      |-- ChromaDB (vector store, per-user collections)
      |-- Claude/Gemini API (generate answer from retrieved chunks)
      v
[Answer + citations] --> back to Node --> back to Frontend
```

---

## 5. Data Model (MongoDB)

### 5.1 `users` collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "passwordHash": "string",
  "createdAt": "date"
}
```

### 5.2 `documents` collection
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref users)",
  "fileName": "string",
  "filePath": "string",
  "pageCount": "number",
  "status": "enum: uploading | processing | ready | failed",
  "chromaCollectionName": "string (e.g. doc_<documentId>)",
  "createdAt": "date"
}
```

### 5.3 `chats` collection
```json
{
  "_id": "ObjectId",
  "documentId": "ObjectId (ref documents)",
  "userId": "ObjectId (ref users)",
  "messages": [
    {
      "role": "user | assistant",
      "content": "string",
      "citations": [
        { "page": "number", "snippet": "string" }
      ],
      "timestamp": "date"
    }
  ],
  "createdAt": "date"
}
```

---

## 6. API Contracts

### 6.1 Node.js/Express API (public-facing)

**POST `/api/auth/signup`**
Body: `{ name, email, password }` → Returns: `{ token, user }`

**POST `/api/auth/login`**
Body: `{ email, password }` → Returns: `{ token, user }`

**POST `/api/documents/upload`** *(multipart/form-data, auth required)*
Body: `file` (PDF) → Returns: `{ documentId, status: "processing" }`
Internally: saves file, creates `documents` record with `status: "processing"`, calls Python service's `/rag/ingest`, then updates status to `ready` or `failed`.

**GET `/api/documents`** *(auth required)*
Returns list of the logged-in user's documents with status.

**GET `/api/documents/:id/status`**
Returns: `{ status: "processing" | "ready" | "failed" }` — used by frontend to poll during processing.

**POST `/api/chat/:documentId/message`** *(auth required)*
Body: `{ message }` → Internally calls Python's `/rag/query`, saves both user message and assistant response to `chats`, returns: `{ answer, citations: [{page, snippet}] }`

**GET `/api/chat/:documentId`**
Returns full chat history for that document.

**DELETE `/api/documents/:id`**
Deletes document, its file, its Chroma collection, and its chat history.

### 6.2 Python FastAPI RAG Service (internal only, called by Node)

**POST `/rag/ingest`**
Body: `{ documentId, filePath }`
Steps: parse PDF with PyMuPDF → chunk with LangChain's `RecursiveCharacterTextSplitter` (chunk_size=500, overlap=50) → embed each chunk → store in a new Chroma collection named `doc_<documentId>`, with metadata `{page: n}` attached to each chunk.
Returns: `{ status: "ready", chunkCount: n }`

**POST `/rag/query`**
Body: `{ documentId, question, chatHistory }`
Steps: embed the question → retrieve top 5 most similar chunks from `doc_<documentId>` collection → build a prompt with system instructions + retrieved chunks + last 3 turns of chat history + question → call LLM → parse response → extract which chunks were actually used → return citations.
Returns: `{ answer: "string", citations: [{page, snippet}] }`

---

## 7. The Core Prompt (most important part of the whole project)

This is the system prompt sent to the LLM inside the Python service. Getting this right is what makes the project actually good instead of a toy:

```
You are a document assistant. You must answer the user's question using
ONLY the context passages provided below. Do not use any outside knowledge.

Rules:
1. If the answer is not contained in the context, say clearly:
   "I couldn't find that in this document."
2. Every claim in your answer must be traceable to one of the context
   passages. Do not infer or assume information not explicitly stated.
3. After your answer, list which page number(s) you used, in this format:
   [Sources: Page 4, Page 7]
4. Keep answers concise — 2 to 4 sentences unless the user asks for detail.
5. If the user's question is ambiguous, ask a clarifying question instead
   of guessing.

Context passages:
{retrieved_chunks_with_page_numbers}

Conversation history:
{last_3_turns}

User's question: {question}
```

Parse the `[Sources: ...]` line out of the response on the backend to build the `citations` array cleanly instead of showing raw text to the user.

---

## 8. Key Technical Decisions and Why

**Chunk size of 500 tokens with 50 token overlap** — Small enough for precise retrieval, large enough to preserve context within a chunk. The overlap prevents a sentence from being awkwardly cut in half between two chunks and losing meaning.

**Local embedding model (MiniLM) over paid API** — Keeps the project free to run and demo indefinitely, which matters if an interviewer wants to try it live. You can mention "I chose a local embedding model to keep inference cost at zero" as a deliberate engineering trade-off.

**Separate Chroma collection per document** — Prevents any chance of one user's document content leaking into another user's answers. This is a privacy guarantee you can explicitly point to in interviews.

**Two-service architecture (Node + Python)** — Shows you can integrate a JS web stack with a Python ML service via internal APIs, which is exactly how many real companies structure their AI features.

---

## 9. Day-by-Day Build Plan (7 Days)

**Day 1 — Foundation**
- Set up Node/Express backend with JWT auth (signup/login)
- Set up MongoDB connection and `users` collection
- Set up React frontend shell with login/signup pages
- Set up Python FastAPI skeleton and Docker Compose file linking Node, Python, MongoDB, and ChromaDB containers

**Day 2 — PDF ingestion pipeline**
- Build file upload endpoint in Node (multer for multipart handling)
- Build `/rag/ingest` in Python: PyMuPDF text extraction with page numbers preserved
- Implement chunking with LangChain's text splitter
- Test: confirm chunks + page metadata are correct on a sample PDF

**Day 3 — Embeddings and vector storage**
- Integrate MiniLM embedding model (or Gemini embeddings)
- Store chunks + embeddings + metadata in a per-document ChromaDB collection
- Build document status polling so frontend can show "Processing..." → "Ready"

**Day 4 — Retrieval and LLM integration**
- Build `/rag/query` in Python: embed question, retrieve top-5 chunks
- Write and test the system prompt from Section 7
- Integrate Claude or Gemini API call, parse out the `[Sources: ...]` line

**Day 5 — Chat interface**
- Build chat UI in React (message bubbles, citations shown as small page badges)
- Wire up Node's `/api/chat/:documentId/message` to call Python and save to MongoDB
- Implement chat history loading when reopening a document

**Day 6 — Document management + polish**
- Document list page (upload new, view status, delete)
- Handle edge cases: scanned PDFs (no extractable text) → show clear error
- Add loading states, error toasts, and a clean empty state for new users

**Day 7 — Docker, deployment, and demo prep**
- Finalize `docker-compose.yml` so the whole stack runs with one command
- Deploy Node + Python services to Render, frontend to Vercel
- Write README with setup instructions, architecture diagram, and a demo GIF
- Prepare 3–4 test questions on a sample document (e.g. a rental agreement) for your demo

---

## 10. Folder Structure

```
doctalk/
├── docker-compose.yml
├── README.md
├── frontend/                  (React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Documents.jsx
│   │   │   └── Chat.jsx
│   │   ├── components/
│   │   │   ├── UploadDropzone.jsx
│   │   │   ├── ChatBubble.jsx
│   │   │   └── CitationBadge.jsx
│   │   └── api/client.js
│   └── package.json
├── backend-node/               (Express)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── documents.js
│   │   │   └── chat.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Document.js
│   │   │   └── Chat.js
│   │   ├── middleware/auth.js
│   │   └── server.js
│   ├── Dockerfile
│   └── package.json
└── backend-python/              (FastAPI RAG service)
    ├── main.py
    ├── ingest.py
    ├── query.py
    ├── prompts.py
    ├── requirements.txt
    └── Dockerfile
```

---

## 11. Environment Variables

```
# Node backend
MONGO_URI=
JWT_SECRET=
PYTHON_SERVICE_URL=http://python-rag:8000

# Python backend
ANTHROPIC_API_KEY=
CHROMA_HOST=chromadb
CHROMA_PORT=8000
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

---

## 12. Risks and Edge Cases to Handle

| Risk | Mitigation |
|---|---|
| User uploads a scanned/image-only PDF | Detect zero extractable text after PyMuPDF parse; return a clear "This looks like a scanned document — OCR isn't supported yet" error |
| Very large PDF (200+ pages) | Cap upload size (e.g. 20MB) and show estimated processing time |
| LLM hallucinates beyond provided context | Strict system prompt + instruct it to say "I couldn't find that" explicitly; test this with adversarial questions |
| Two users' data mixing | Separate Chroma collection per document, always scoped by `userId` check on every API route |
| Empty or malformed question | Basic frontend validation before sending to backend |

---

## 13. Stretch Goals (only if the core is done early)

- Support multi-document chat (query across all of a user's documents at once)
- Highlight the exact retrieved sentence in a PDF viewer, not just cite the page number
- Add a "confidence score" showing how closely the retrieved chunks matched the question
- Export a chat conversation as a PDF summary

---

## 14. How to Use This PRD with an AI Coding Agent

When feeding this into an AI coding tool, work in this order rather than asking for everything at once:
1. Give it Sections 4 (Architecture), 5 (Data Model), and 10 (Folder Structure) first, and ask it to scaffold the project structure and Docker Compose file.
2. Then give it Section 6 (API Contracts) and ask it to build the Node.js routes one at a time (auth first, then documents, then chat).
3. Then give it Section 7 (Core Prompt) and Section 6.2 (Python endpoints) and ask it to build the ingestion pipeline, then the query pipeline separately — test each in isolation with a sample PDF before connecting them.
4. Finally give it the frontend pages one at a time, wiring each to the already-tested backend.

Building it in this order — backend data flow proven first, UI last — will save you from debugging a fully connected system all at once.
