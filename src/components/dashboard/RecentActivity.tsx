'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import { Badge } from '@/components/ui';

export interface ActivityItem {
  id: string;
  created_at: string;
  platform: string | null;
  knowledge_bases: { name: string } | null;
}

export interface RecentActivityLabels {
  /** "Web" in the student's language (register #121, defect 5); the enum is never printed. */
  platformWeb: string;
  noActivity: string;
  conversation: string;
  showLess: string;
  viewAll: string;
  unknownKb: string;
}

const LIMIT = 4;

export function RecentActivity({ items, labels, locale }: { items: ActivityItem[]; labels: RecentActivityLabels; locale: Locale }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, LIMIT);

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-raised p-8 text-center text-sm text-muted-foreground">
        {labels.noActivity}
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-raised">
        {visible.map((conv) => (
          <div key={conv.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {conv.knowledge_bases?.name || labels.unknownKb}
              </p>
              <p className="mt-1 text-xs text-faint" dir="auto">
                <bdi>{labels.platformWeb}</bdi> · <bdi>{formatDate(conv.created_at, locale)}</bdi>
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
            className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            {showAll ? labels.showLess : labels.viewAll}
          </button>
        </div>
      )}
    </div>
  );
}
