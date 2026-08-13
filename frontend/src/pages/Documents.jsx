import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  Trash2,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PlusCircle,
  BookOpen
} from 'lucide-react';
import apiClient from '../api/client';
import UploadDropzone from '../components/UploadDropzone';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('doctalk_user') || '{}');

  const fetchDocuments = async () => {
    try {
      const response = await apiClient.get('/documents');
      setDocuments(response.data);
    } catch {
      setError('Failed to load document list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll status for any document that is currently in "processing" or "uploading"
  useEffect(() => {
    const hasProcessing = documents.some(
      (doc) => doc.status === 'processing' || doc.status === 'uploading'
    );

    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  const handleLogout = () => {
    localStorage.removeItem('doctalk_token');
    localStorage.removeItem('doctalk_user');
    navigate('/login');
  };

  const handleDelete = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document and its chat history?')) return;

    setDeletingId(docId);
    try {
      await apiClient.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 pb-16 relative">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight font-heading">DocTalk</h1>
              <p className="text-[11px] text-slate-400 font-mono">Private Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{user.name || 'User'}</p>
              <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-300 hover:text-red-400 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
          </div>
        )}
        
        {/* Upload Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-heading">
              <PlusCircle className="w-5 h-5 text-cyan-400" />
              Upload Document for RAG Ingestion
            </h2>
          </div>
          <UploadDropzone onUploadSuccess={() => fetchDocuments()} />
        </section>

        {/* Document Library Grid */}
        <section>
          <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white font-heading">
                Your Document Library
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold badge-indigo">
                {documents.length} File{documents.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="glass-panel p-16 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
              <p className="text-sm font-medium">Loading your private vector index...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="glass-panel p-16 text-center text-slate-400 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-200 mb-1 font-heading">No documents uploaded yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload a PDF document above to extract text passages into an isolated vector index and query it with page-level citations.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  onClick={() => doc.status === 'ready' && navigate(`/chat/${doc._id}`)}
                  className={`glass-panel p-5 relative flex flex-col justify-between transition-all group ${
                    doc.status === 'ready' ? 'cursor-pointer glass-panel-hover' : 'opacity-90'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon + Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>

                      {/* Status Badges */}
                      {doc.status === 'ready' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-emerald">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready ({doc.pageCount} Pages)
                        </span>
                      )}

                      {doc.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-amber animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Processing...
                        </span>
                      )}

                      {doc.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                    </div>

                    {/* Document Title */}
                    <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1 group-hover:text-cyan-300 transition-colors">
                      {doc.fileName}
                    </h3>

                    {doc.errorMessage ? (
                      <p className="text-xs text-red-400 mt-1 line-clamp-2">{doc.errorMessage}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        {formatFileSize(doc.fileSize)} • Added {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    {doc.status === 'ready' ? (
                      <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Open Document Chat →
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {doc.status === 'processing' ? 'Vectorizing chunks...' : 'Unavailable'}
                      </span>
                    )}

                    <button
                      onClick={(e) => handleDelete(doc._id, e)}
                      disabled={deletingId === doc._id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      {deletingId === doc._id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
