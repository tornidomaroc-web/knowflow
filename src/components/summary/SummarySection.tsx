'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';

// Only the fields this section needs from a document. The subject page already
// fetches these via `select('*')`, so a cached summary renders with NO API call
// and NO cost — generation is user-initiated only.
interface SummaryDoc {
  id: string;
  status: string;
  summary: string | null;
  summary_is_partial: boolean;
}

export function SummarySection({ doc }: { doc: SummaryDoc }) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  const s = useTranslation(safeLocale).dashboard.summary;

  // Seed from the row we already have. `summary` truthy = a real generated
  // summary (the route never persists an empty one), so this cleanly separates
  // "has a summary" from "none yet".
  const [summary, setSummary] = useState<string | null>(doc.summary);
  const [isPartial, setIsPartial] = useState<boolean>(doc.summary_is_partial ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id }),
      });

      if (!res.ok) {
        // Map each contract status to calm, honest Arabic/English copy. 429 stays
        // number-free (tier-agnostic; never implies unlimited). 5xx/502 are
        // temporary and the button re-enables so the student can retry — we do
        // NOT claim the retry is free (a failed generation may already have used
        // a daily credit; see register #24).
        const msg =
          res.status === 401 ? s.errors.session :
          res.status === 404 ? s.errors.notFound :
          res.status === 409 ? s.errors.processing :
          res.status === 422 ? s.errors.notEnoughText :
          res.status === 429 ? s.errors.limit :
          s.errors.temporary; // 500 / 502 / 503 / anything else — retryable
        setError(msg);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setSummary(data.summary);
      setIsPartial(Boolean(data.is_partial));
    } catch {
      setError(s.errors.connection);
    }
    setIsLoading(false);
  };

  // A generated/cached summary is shown as-is. There is deliberately NO
  // regenerate/refresh action (register #26) — an existing summary is final.
  if (summary) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-background p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {s.heading}
        </h3>
        {isPartial && (
          <p className="mb-3 rounded-lg bg-primary-subtle px-3 py-2 text-xs text-primary">
            {s.partialNotice}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{summary}</p>
      </div>
    );
  }

  // Only a fully-processed material has usable text; for anything else the route
  // returns 409, so we don't offer generation until it's ready.
  if (doc.status !== 'ready') return null;

  // No summary yet → explicit, user-initiated generation only (protects the daily
  // cap; never auto-generates on page open).
  return (
    <div className="mt-3">
      <button
        onClick={generate}
        disabled={isLoading}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        {isLoading ? s.generating : s.generate}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
