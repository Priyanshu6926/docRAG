import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import authRoutes from './src/routes/auth.js';
import documentRoutes from './src/routes/documents.js';
import chatRoutes from './src/routes/chat.js';
import User from './src/models/User.js';
import Document from './src/models/Document.js';
import Chat from './src/models/Chat.js';

const TEST_PORT = 5005;
const TEST_MONGO_URI = 'mongodb://localhost:27017/doctalk_test';
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

let server;

async function setupServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/chat', chatRoutes);

  await mongoose.connect(TEST_MONGO_URI);
  await User.deleteMany({});
  await Document.deleteMany({});
  await Chat.deleteMany({});

  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`Test Express server running on port ${TEST_PORT}`);
      resolve();
    });
  });
}

async function runTests() {
  await setupServer();

  let token = '';
  let documentId = '';

  try {
    // 1. Test Signup
    console.log('Testing /api/auth/signup...');
    const signupRes = await fetch(`${TEST_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Runner',
        email: 'testrunner@example.com',
        password: 'password123'
      })
    });
    const signupData = await signupRes.json();
    if (signupRes.status !== 201 || !signupData.token) {
      throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
    }
    console.log('✓ Signup test passed');

    // 2. Test Login
    console.log('Testing /api/auth/login...');
    const loginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testrunner@example.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    token = loginData.token;
    console.log('✓ Login test passed');

    // 3. Test GET /api/auth/me
    console.log('Testing /api/auth/me...');
    const meRes = await fetch(`${TEST_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    if (meRes.status !== 200 || meData.user.email !== 'testrunner@example.com') {
      throw new Error(`Auth me failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ Auth me test passed');

    // 4. Test Document Creation & Listing
    console.log('Testing Document database model & endpoints...');
    const user = await User.findOne({ email: 'testrunner@example.com' });
    const dummyPath = path.resolve('uploads/test_sample.pdf');
    fs.writeFileSync(dummyPath, '%PDF-1.4 Dummy PDF Content for Testing');

    const doc = await Document.create({
      userId: user._id,
      fileName: 'test_sample.pdf',
      filePath: dummyPath,
      fileSize: 1024,
      status: 'ready',
      pageCount: 2,
      chromaCollectionName: 'doc_test_collection'
    });
    documentId = doc._id.toString();

    const docsRes = await fetch(`${TEST_BASE_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const docsData = await docsRes.json();
    if (docsRes.status !== 200 || docsData.length === 0) {
      throw new Error(`Get documents failed: ${JSON.stringify(docsData)}`);
    }
    console.log('✓ Get documents list test passed');

    // 5. Test Document Status Endpoint
    console.log('Testing GET /api/documents/:id/status...');
    const statusRes = await fetch(`${TEST_BASE_URL}/api/documents/${documentId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const statusData = await statusRes.json();
    if (statusRes.status !== 200 || statusData.status !== 'ready') {
      throw new Error(`Get document status failed: ${JSON.stringify(statusData)}`);
    }
    console.log('✓ Document status test passed');

    // 6. Test GET Chat History
    console.log('Testing GET /api/chat/:documentId...');
    const chatRes = await fetch(`${TEST_BASE_URL}/api/chat/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const chatData = await chatRes.json();
    if (chatRes.status !== 200 || !Array.isArray(chatData.messages)) {
      throw new Error(`Get chat history failed: ${JSON.stringify(chatData)}`);
    }
    console.log('✓ Get chat history test passed');

    // 7. Test Delete Document Endpoint
    console.log('Testing DELETE /api/documents/:id...');
    const delRes = await fetch(`${TEST_BASE_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const delData = await delRes.json();
    if (delRes.status !== 200) {
      throw new Error(`Delete document failed: ${JSON.stringify(delData)}`);
    }
    console.log('✓ Delete document test passed');

    console.log('\n======================================');
    console.log('All Node Backend Tests Passed Successfully!');
    console.log('======================================\n');
  } catch (err) {
    console.error('Node Backend Test Failure:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    server.close();
  }
}

runTests();
