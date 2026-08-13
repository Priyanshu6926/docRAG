import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

from ingest import ingest_pdf, delete_collection
from query import query_rag

app = FastAPI(
    title="DocTalk RAG Microservice",
    description="Python FastAPI service handling PDF parsing, vector embedding, ChromaDB storage, and RAG retrieval",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    documentId: str
    filePath: str
    collectionName: str

class ChatTurn(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    documentId: str
    collectionName: str
    question: str
    chatHistory: Optional[List[ChatTurn]] = []

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DocTalk Python RAG API",
        "chroma_dir": os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    }

@app.post("/rag/ingest")
def handle_ingest(req: IngestRequest):
    try:
        result = ingest_pdf(
            document_id=req.documentId,
            file_path=req.filePath,
            collection_name=req.collectionName
        )
        return result
    except ValueError as ve:
        return {
            "status": "failed",
            "errorMessage": str(ve)
        }
    except Exception as e:
        print(f"Error during ingestion: {e}")
        return {
            "status": "failed",
            "errorMessage": f"Ingestion error: {str(e)}"
        }

@app.post("/rag/query")
def handle_query(req: QueryRequest):
    try:
        history_list = [turn.model_dump() for turn in req.chatHistory] if req.chatHistory else []
        result = query_rag(
            collection_name=req.collectionName,
            question=req.question,
            chat_history=history_list
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        print(f"Error during RAG query: {e}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.delete("/rag/document/{document_id}")
def handle_delete(document_id: str):
    collection_name = f"doc_{document_id}"
    success = delete_collection(collection_name)
    return {"status": "deleted" if success else "not_found", "collection": collection_name}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
