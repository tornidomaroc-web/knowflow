'use client';

import { useState } from 'react';

interface ActivityItem {
  id: string;
  created_at: string;
  platform: string | null;
  knowledge_bases: { name: string } | null;
}

interface RecentActivityLabels {
  noActivity: string;
  conversation: string;
  showLess: string;
  viewAll: string;
  unknownKb: string;
}

const LIMIT = 4;

export function RecentActivity({ items, labels }: { items: ActivityItem[]; labels: RecentActivityLabels }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, LIMIT);

  if (!items || items.length === 0) {
    return (
      <div className="border border-dashed border-[#1a2e1e] p-8 text-center text-[#6b7d6e] text-sm"
           style={{ fontFamily: 'var(--font-mono)' }}>
        {labels.noActivity}
      </div>
    );
  }

  return (
    <div>
      <div className="border border-[#1a2e1e]">
        {visible.map((conv, i) => (
          <div key={conv.id}
               className={`flex items-center justify-between p-4 ${i !== visible.length - 1 ? 'border-b border-[#1a2e1e]' : ''}`}>
            <div>
              <p className="text-sm text-white">{conv.knowledge_bases?.name || labels.unknownKb}</p>
              <p className="text-xs text-[#6b7d6e] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                {conv.platform?.toUpperCase()} · {new Date(conv.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            <span className="text-xs text-[#2eff8c]" style={{ fontFamily: 'var(--font-mono)' }}>
              {labels.conversation}
            </span>
          </div>
        ))}
      </div>
      {items.length > LIMIT && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-[#2eff8c] hover:opacity-70 transition-opacity"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {showAll ? labels.showLess : labels.viewAll}
          </button>
        </div>
      )}
    </div>
  );
}
