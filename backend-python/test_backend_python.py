import os
import tempfile
import pymupdf
from fastapi.testclient import TestClient
from main import app
from ingest import ingest_pdf, delete_collection
from query import query_rag

client = TestClient(app)

def create_sample_pdf(file_path: str):
    """Creates a sample 2-page PDF file for testing."""
    doc = pymupdf.open()
    
    # Page 1
    page1 = doc.new_page()
    page1.insert_text((50, 50), "DocTalk Technical Manual Page 1.\nChapter 1: Introduction to Private Document Chat.\nDocTalk provides privacy-first document analysis.")
    
    # Page 2
    page2 = doc.new_page()
    page2.insert_text((50, 50), "DocTalk Technical Manual Page 2.\nChapter 2: Security and Encryption Standards.\nAll vector collections are strictly isolated per user and document.")
    
    doc.save(file_path)
    doc.close()

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "DocTalk Python RAG API" in data["service"]
    print("✓ test_health_check passed")

def test_ingest_and_query_flow():
    with tempfile.TemporaryDirectory() as temp_dir:
        pdf_path = os.path.join(temp_dir, "test_document.pdf")
        create_sample_pdf(pdf_path)
        
        doc_id = "test_doc_12345"
        collection_name = f"doc_{doc_id}"
        
        # 1. Test Ingestion logic
        ingest_res = ingest_pdf(
            document_id=doc_id,
            file_path=pdf_path,
            collection_name=collection_name
        )
        assert ingest_res["status"] == "ready"
        assert ingest_res["pageCount"] == 2
        assert ingest_res["chunkCount"] >= 2
        print("✓ Ingest PDF logic passed")
        
        # 2. Test Query logic
        query_res = query_rag(
            collection_name=collection_name,
            question="What are the security and encryption standards?",
            chat_history=[]
        )
        assert "answer" in query_res
        assert isinstance(query_res["citations"], list)
        assert len(query_res["citations"]) > 0
        # Citation page should include Page 2
        pages = [c["page"] for c in query_res["citations"]]
        assert 2 in pages
        print("✓ Query RAG logic passed")
        
        # 3. Test API Ingest Endpoint
        api_ingest_res = client.post("/rag/ingest", json={
            "documentId": doc_id,
            "filePath": pdf_path,
            "collectionName": collection_name
        })
        assert api_ingest_res.status_code == 200
        assert api_ingest_res.json()["status"] == "ready"
        print("✓ API POST /rag/ingest passed")
        
        # 4. Test API Query Endpoint
        api_query_res = client.post("/rag/query", json={
            "documentId": doc_id,
            "collectionName": collection_name,
            "question": "Tell me about Chapter 1",
            "chatHistory": []
        })
        assert api_query_res.status_code == 200
        q_data = api_query_res.json()
        assert "answer" in q_data
        assert "citations" in q_data
        print("✓ API POST /rag/query passed")
        
        # 5. Test API Delete Endpoint
        api_del_res = client.delete(f"/rag/document/{doc_id}")
        assert api_del_res.status_code == 200
        assert api_del_res.json()["status"] == "deleted"
        print("✓ API DELETE /rag/document passed")

def test_scanned_pdf_error_handling():
    with tempfile.TemporaryDirectory() as temp_dir:
        empty_pdf_path = os.path.join(temp_dir, "scanned_doc.pdf")
        doc = pymupdf.open()
        doc.new_page()  # Page with no text
        doc.save(empty_pdf_path)
        doc.close()
        
        try:
            ingest_pdf("scanned_123", empty_pdf_path, "doc_scanned_123")
            assert False, "Should have raised ValueError for empty/scanned PDF"
        except ValueError as ve:
            assert "scanned or image-only PDF" in str(ve)
            print("✓ Scanned PDF detection error handling passed")

if __name__ == "__main__":
    print("Running Python Backend Test Suite...")
    test_health_check()
    test_ingest_and_query_flow()
    test_scanned_pdf_error_handling()
    print("All Python Backend Tests Passed Successfully!")
