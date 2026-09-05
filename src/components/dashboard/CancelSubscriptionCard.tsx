'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';

export interface CancelSubscriptionLabels {
  heading: string;
  description: string;
  keepsAccess: string;
  noRefund: string;
  canResubscribe: string;
  openButton: string;
  confirmPrompt: string;
  confirmButton: string;
  keepButton: string;
  working: string;
  done: string;
  errorFailed: string;
}

export interface CancelSubscriptionCardProps {
  labels: CancelSubscriptionLabels;
  /** Formatted date the subscription runs until, or null if unknown. */
  accessUntil: string | null;
  /** True when a cancellation is already scheduled; the card then explains
   *  rather than offers, so a second click cannot read as a second cancellation. */
  alreadyScheduled: boolean;
}

/**
 * The gentler exit. Register #70, issue #96: before this existed, a paying
 * customer who wanted to stop being billed had to delete every byte of their
 * data.
 *
 * IT IS DELIBERATELY LIGHTER THAN <DeleteAccountCard/>, AND THE ASYMMETRY IS THE
 * POINT. That card hides behind a first click AND demands the account's own
 * email typed back, because deletion is unrecoverable: no soft delete, no grace
 * period, nothing restorable. Cancelling destroys nothing and is undone by
 * resubscribing, so giving it the same ceremony would MISLABEL A REVERSIBLE ACT
 * AS AN IRREVERSIBLE ONE — and weight that is spent everywhere stops meaning
 * anything where it matters. One click to open, one to confirm, no typing.
 *
 * It is also rendered ABOVE the delete card by the settings page, so the gentler
 * exit is seen first. A customer who only wants to stop paying should never
 * reach the destructive control looking for it, which is precisely how register
 * #70 describes the product today.
 *
 * THE THREE FACTS ARE SHOWN BEFORE THE DECISION, NOT AFTER IT: access continues
 * until the paid-for period ends, the current period is not refunded, and
 * resubscribing is possible. The no-refund line is not fine print — it follows
 * from this product having no refund code at all, and the defect would not be
 * the policy but shipping the button without saying so.
 */
export function CancelSubscriptionCard({
  labels,
  accessUntil,
  alreadyScheduled,
}: CancelSubscriptionCardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch('/api/account/subscription/cancel', { method: 'POST' });
    } catch {
      setError(labels.errorFailed);
      setBusy(false);
      return;
    }

    if (response.ok) {
      // No navigation and no reload: unlike deletion, the session is still
      // valid and the page is still theirs. The card simply states what now
      // happens, and the next natural page load picks up the scheduled state
      // from Paddle.
      setDone(true);
      setOpen(false);
      setBusy(false);
      return;
    }

    setError(labels.errorFailed);
    setBusy(false);
  }

  const scheduled = alreadyScheduled || done;

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {labels.heading}
      </h2>

      {scheduled ? (
        <p className="text-sm text-foreground">
          {labels.done}
          {accessUntil ? ` ${accessUntil}` : ''}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-foreground">{labels.description}</p>
          <p className="mb-1 text-xs text-muted-foreground">
            {labels.keepsAccess}
            {accessUntil ? ` ${accessUntil}` : ''}
          </p>
          <p className="mb-1 text-xs text-muted-foreground">{labels.noRefund}</p>
          <p className="mb-4 text-xs text-muted-foreground">{labels.canResubscribe}</p>

          {error && (
            <p role="alert" className="mb-4 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          {!open ? (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {labels.openButton}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{labels.confirmPrompt}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onConfirm} disabled={busy}>
                  {busy ? labels.working : labels.confirmButton}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  {labels.keepButton}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
