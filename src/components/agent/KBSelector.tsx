'use client';

import { useState } from 'react';
import type { KnowledgeBase } from '@/types';
import { ChatBox } from './ChatBox';

export function KBSelector({ kbs }: { kbs: KnowledgeBase[] }) {
  const [selectedId, setSelectedId] = useState(kbs[0]?.id || '');

  if (!kbs.length) return null;

  const selectedKb = kbs.find(k => k.id === selectedId);

  return (
    <div className="flex flex-col space-y-6 flex-1 h-full">
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {kbs.map(kb => (
          <button
            key={kb.id}
            onClick={() => setSelectedId(kb.id)}
            className={`px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest whitespace-nowrap border transition-colors ${
              selectedId === kb.id 
                ? 'bg-[var(--accent-color)] text-[#070d0a] border-[var(--accent-color)]' 
                : 'bg-[#0c1510] text-[var(--muted-color)] border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-white'
            }`}
          >
            {kb.name}
          </button>
        ))}
      </div>
      
      {selectedKb && (
        <ChatBox key={selectedKb.id} kbId={selectedKb.id} kbName={selectedKb.name} />
      )}
    </div>
  );
}
