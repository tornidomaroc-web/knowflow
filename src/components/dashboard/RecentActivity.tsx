'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui';

export interface ActivityItem {
  id: string;
  created_at: string;
  platform: string | null;
  knowledge_bases: { name: string } | null;
}

export interface RecentActivityLabels {
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
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        {labels.noActivity}
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {visible.map((conv) => (
          <div key={conv.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {conv.knowledge_bases?.name || labels.unknownKb}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {conv.platform?.toUpperCase()} · {new Date(conv.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            <Badge className="shrink-0">{labels.conversation}</Badge>
          </div>
        ))}
      </div>
      {items.length > LIMIT && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
          >
            {showAll ? labels.showLess : labels.viewAll}
          </button>
        </div>
      )}
    </div>
  );
}
