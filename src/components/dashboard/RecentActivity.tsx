'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import { Badge } from '@/components/ui';
import { UserName } from '@/components/ui/UserName';

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
      // Design "C" (the owner's review, 2026-11-04): a clay inset, pressed in,
      // with no border, like the list's tiles above it have none.
      <div data-kf-activity-empty className="kf-well rounded-2xl p-8 text-center text-sm text-muted-foreground">
        {labels.noActivity}
      </div>
    );
  }

  return (
    <div>
      {/* Design "C" (the owner's review of PR #299, 2026-11-04): no hairline
          box and no dividers; each conversation is a small clay tile, the rows
          separated by spacing. */}
      <ul data-kf-activity className="space-y-2.5">
        {visible.map((conv) => (
          <li key={conv.id} className="kf-tile flex items-center justify-between gap-4 rounded-2xl bg-raised px-4 py-3.5">
            <div className="min-w-0">
              <UserName as="p" className="truncate text-sm font-medium text-foreground">
                {conv.knowledge_bases?.name || labels.unknownKb}
              </UserName>
              <p className="mt-1 text-xs text-faint" dir="auto">
                {/* U+00A0 before the dot, so a wrapped line never starts with it. */}
                <bdi>{labels.platformWeb}</bdi>{' · '}<bdi>{formatDate(conv.created_at, locale)}</bdi>
              </p>
            </div>
            <Badge className="shrink-0">{labels.conversation}</Badge>
          </li>
        ))}
      </ul>
      {items.length > LIMIT && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setShowAll((v) => !v)}
            // 44 pt tall (the design-c render found it 20 pt: the full home is
            // the first render to list more than LIMIT conversations).
            className="inline-flex min-h-[2.75rem] items-center px-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            {showAll ? labels.showLess : labels.viewAll}
          </button>
        </div>
      )}
    </div>
  );
}
