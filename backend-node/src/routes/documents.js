import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are supported!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// POST /api/documents/upload
router.post('/upload', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error uploading file' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a PDF file to upload' });
    }

    try {
      const fileName = req.file.originalname;
      const filePath = path.resolve(req.file.path);
      const fileSize = req.file.size;

      const docId = new mongoose.Types.ObjectId();
      const collectionName = `doc_${docId.toString()}`;

      // Create document in DB with status "processing" and exact collection name
      const doc = await Document.create({
        _id: docId,
        userId: req.user._id,
        fileName,
        filePath,
        fileSize,
        status: 'processing',
        chromaCollectionName: collectionName
      });

      // Trigger ingestion asynchronously
      triggerPythonIngestion(doc._id, filePath, collectionName);

      res.status(202).json({
        documentId: doc._id,
        fileName: doc.fileName,
        status: 'processing',
        message: 'File uploaded successfully and processing started'
      });
    } catch (error) {
      console.error('Upload handling error:', error);
      res.status(500).json({ error: 'Failed to record document metadata' });
    }
  });
});

// Helper to communicate with Python RAG service
async function triggerPythonIngestion(documentId, filePath, collectionName) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/rag/ingest`, {
      documentId: documentId.toString(),
      filePath,
      collectionName
    }, { timeout: 120000 });

    if (response.data && response.data.status === 'ready') {
      await Document.findByIdAndUpdate(documentId, {
        status: 'ready',
        pageCount: response.data.pageCount || 0,
        errorMessage: ''
      });
    } else {
      await Document.findByIdAndUpdate(documentId, {
        status: 'failed',
        errorMessage: response.data.errorMessage || 'Failed to parse and embed PDF'
      });
    }
  } catch (error) {
    console.error(`Python ingestion error for doc ${documentId}:`, error.response?.data || error.message);
    const errorMsg = error.response?.data?.detail || error.message || 'Python RAG service unreachable or ingestion failed';
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      errorMessage: errorMsg
    });
  }
}

// GET /api/documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-filePath');

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch user documents' });
  }
});

// GET /api/documents/:id/status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      documentId: doc._id,
      fileName: doc.fileName,
      status: doc.status,
      pageCount: doc.pageCount,
      errorMessage: doc.errorMessage
    });
  } catch (error) {
    console.error('Get doc status error:', error);
    res.status(500).json({ error: 'Failed to fetch document status' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    // Call Python backend to remove vector collection
    try {
      await axios.delete(`${PYTHON_SERVICE_URL}/rag/document/${doc._id}`);
    } catch (pyErr) {
      console.warn('Python vector collection deletion warning:', pyErr.message);
    }

    // Unlink local file
    if (fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (fErr) {
        console.warn('Local file unlink warning:', fErr.message);
      }
    }

    // Remove chat history and document entry
    await Chat.deleteMany({ documentId: doc._id });
    await Document.findByIdAndDelete(doc._id);

    res.json({ message: 'Document and chat history deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
