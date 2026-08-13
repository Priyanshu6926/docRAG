import React from 'react';
import { Bookmark } from 'lucide-react';

export default function CitationBadge({ citation, onClick }) {
  const pageNum = typeof citation === 'object' ? citation.page : citation;

  return (
    <button
      onClick={() => onClick && onClick(citation)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-cyan-400 hover:text-cyan-200 transition-all cursor-pointer shadow-sm hover:scale-[1.03]"
      title="Click to open source page passage snippet"
    >
      <Bookmark className="w-3 h-3 text-cyan-400" />
      <span>Page {pageNum}</span>
    </button>
  );
}
