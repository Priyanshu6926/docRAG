import React, { useState, useRef } from 'react';
import { UploadCloud, AlertCircle, Loader2, CheckCircle2, Shield } from 'lucide-react';
import apiClient from '../api/client';

export default function UploadDropzone({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    setError(null);

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF documents are supported in DocTalk.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds the maximum allowed 25MB limit.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to upload document. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`glass-panel p-8 md:p-10 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01] shadow-2xl shadow-cyan-500/20'
            : 'hover:border-indigo-500/50 hover:bg-slate-900/60'
        } ${uploading ? 'opacity-80 pointer-events-none' : ''}`}
        style={{ borderStyle: 'dashed', borderWidth: '2px' }}
      >
        {/* Subtle Ambient Glow inside dropzone */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/15 transition-all pointer-events-none" />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf,application/pdf"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            ) : (
              <UploadCloud className="w-8 h-8 text-indigo-400 group-hover:text-cyan-300 transition-colors" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-1 font-heading">
              {uploading ? `Ingesting & Vectorizing PDF...` : 'Drop your PDF here, or click to browse'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Supports searchable contracts, textbooks, or research papers up to 25MB.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              Isolated Vector Collection
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Page Citation Mapping
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start justify-between gap-3 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
