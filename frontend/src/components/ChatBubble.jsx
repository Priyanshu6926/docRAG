import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Sparkles, Copy, Check } from 'lucide-react';
import CitationBadge from './CitationBadge';

export default function ChatBubble({ message, onCitationClick }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
          <Bot className="w-5 h-5" />
        </div>
      )}

      <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 transition-all relative group ${
        isUser
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-lg shadow-indigo-600/20'
          : 'glass-panel text-slate-100 rounded-bl-none border border-slate-700/60'
      }`}>
        <div className="flex items-center justify-between gap-4 mb-2 text-[11px] opacity-75 font-mono">
          <span className="font-semibold text-slate-300">{isUser ? 'You' : 'DocTalk AI'}</span>
          <div className="flex items-center gap-2">
            <span>{new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {!isUser && (
              <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Copy answer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        <div className="prose prose-invert max-w-none leading-relaxed text-sm">
          {isUser ? (
            <p className="whitespace-pre-wrap text-white font-medium">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Citations Row */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 font-heading">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Source Passages:
            </span>
            {message.citations.map((cit, idx) => (
              <CitationBadge key={idx} citation={cit} onClick={onCitationClick} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 shrink-0 shadow-md">
          <User className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
