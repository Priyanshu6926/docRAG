import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  Bookmark,
  Sparkles,
  X,
  Bot,
  Copy,
  Check
} from 'lucide-react';
import apiClient from '../api/client';
import ChatBubble from '../components/ChatBubble';

export default function Chat() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatAndDoc = useCallback(async () => {
    try {
      const chatRes = await apiClient.get(`/chat/${documentId}`);
      setMessages(chatRes.data.messages || []);
      setDocument({
        fileName: chatRes.data.fileName,
        status: chatRes.data.status
      });
    } catch {
      alert('Failed to load chat session.');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  }, [documentId, navigate]);

  useEffect(() => {
    fetchChatAndDoc();
  }, [fetchChatAndDoc]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const userQuery = inputMessage.trim();
    setInputMessage('');

    // Optimistically append user message
    const tempUserMsg = {
      role: 'user',
      content: userQuery,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const response = await apiClient.post(`/chat/${documentId}/message`, {
        message: userQuery
      });

      if (response.data && response.data.messages) {
        setMessages(response.data.messages);
      }
    } catch (err) {
      const errDetail = err.response?.data?.error || 'Failed to generate answer. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${errDetail}`,
          citations: [],
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleCitationClick = (citation) => {
    setActiveSnippet(citation);
  };

  const copySnippet = () => {
    const text = typeof activeSnippet === 'object' ? activeSnippet.snippet : activeSnippet;
    navigator.clipboard.writeText(text);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-[#07090e] text-slate-100 overflow-hidden relative">
      
      {/* Top Header Bar */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/documents')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Documents</span>
          </button>

          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm line-clamp-1 font-heading">
                {document?.fileName || 'Document Chat'}
              </h1>
              <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Isolated vector index active
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-6">
          
          {/* Scrollable Messages Thread */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 space-y-2 flex-col">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-xs font-mono">Restoring chat history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 glass-panel my-auto max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 shadow-lg">
                  <Bot className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-heading">Ask DocTalk anything about this PDF</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Answers strictly retrieve passage context with exact page citations.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full text-xs">
                  <button
                    onClick={() => setInputMessage('Summarize the key sections of this document.')}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 text-slate-300 transition-all text-left cursor-pointer"
                  >
                    "Summarize the key sections of this document."
                  </button>
                  <button
                    onClick={() => setInputMessage('What are the main dates, obligations, or requirements mentioned?')}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 text-slate-300 transition-all text-left cursor-pointer"
                  >
                    "What are the main dates or obligations?"
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <ChatBubble
                  key={index}
                  message={msg}
                  onCitationClick={handleCitationClick}
                />
              ))
            )}

            {sending && (
              <div className="flex gap-3 mb-6 items-center text-slate-400 text-xs font-mono pl-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <span>Retrieving vector passages & generating page-cited answer...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Query Input Form */}
          <div className="pt-4 border-t border-slate-800/80">
            <form onSubmit={handleSendMessage} className="relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question about this PDF..."
                disabled={sending}
                className="w-full pl-5 pr-14 py-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sending}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white cursor-pointer transition-all disabled:opacity-40 shadow-md shadow-indigo-600/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Source Snippet Slide-Over Inspector Drawer */}
        {activeSnippet && (
          <div className="w-80 md:w-96 border-l border-slate-800 bg-slate-950/95 backdrop-blur-2xl p-6 flex flex-col justify-between shadow-2xl z-30 transition-all">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs font-heading">
                  <Bookmark className="w-4 h-4 text-cyan-400" />
                  <span>Source Passage Metadata</span>
                </div>
                <button
                  onClick={() => setActiveSnippet(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-block px-3 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Page {typeof activeSnippet === 'object' ? activeSnippet.page : activeSnippet}
                  </span>
                  <button
                    onClick={copySnippet}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    {snippetCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{snippetCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Retrieved Vector Text Passage:
                </h4>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-96 overflow-y-auto shadow-inner">
                  {typeof activeSnippet === 'object' && activeSnippet.snippet
                    ? activeSnippet.snippet
                    : 'Source text passage from retrieved vector embedding chunk.'}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Verified strict context chunk
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
