import express from 'express';
import axios from 'axios';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// POST /api/chat/:documentId/message
router.post('/:documentId/message', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }

    // Verify document ownership & status
    const doc = await Document.findOne({ _id: documentId, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    if (doc.status !== 'ready') {
      return res.status(400).json({
        error: `Document is not ready for chat. Current status: ${doc.status}`
      });
    }

    // Retrieve or initialize Chat document
    let chat = await Chat.findOne({ documentId: doc._id, userId: req.user._id });
    if (!chat) {
      chat = await Chat.create({
        documentId: doc._id,
        userId: req.user._id,
        messages: []
      });
    }

    // Extract last 3 turns (6 messages max: 3 user + 3 assistant)
    const historyTurns = chat.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Call Python RAG service
    let ragResult;
    try {
      const response = await axios.post(`${PYTHON_SERVICE_URL}/rag/query`, {
        documentId: doc._id.toString(),
        collectionName: doc.chromaCollectionName,
        question: message.trim(),
        chatHistory: historyTurns
      }, { timeout: 60000 });

      ragResult = response.data;
    } catch (pyErr) {
      console.error('Python query service error:', pyErr.response?.data || pyErr.message);
      const detail = pyErr.response?.data?.detail || 'Error communicating with RAG query service';
      return res.status(500).json({ error: detail });
    }

    const answer = ragResult.answer || "I couldn't find an answer in this document.";
    const citations = ragResult.citations || [];

    // Push user & assistant messages to MongoDB
    chat.messages.push({
      role: 'user',
      content: message.trim(),
      citations: [],
      timestamp: new Date()
    });

    chat.messages.push({
      role: 'assistant',
      content: answer,
      citations,
      timestamp: new Date()
    });

    await chat.save();

    res.json({
      answer,
      citations,
      messages: chat.messages
    });
  } catch (error) {
    console.error('Chat message processing error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// GET /api/chat/:documentId
router.get('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findOne({ _id: documentId, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    let chat = await Chat.findOne({ documentId: doc._id, userId: req.user._id });
    if (!chat) {
      chat = { documentId: doc._id, messages: [] };
    }

    res.json({
      documentId: doc._id,
      fileName: doc.fileName,
      status: doc.status,
      messages: chat.messages
    });
  } catch (error) {
    console.error('Fetch chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;
