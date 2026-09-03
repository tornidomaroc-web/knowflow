'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';

export interface DeleteAccountLabels {
  heading: string;
  description: string;
  permanentWarning: string;
  whatIsRemoved: string;
  billingNote: string;
  openButton: string;
  confirmPrompt: string;
  confirmPlaceholder: string;
  confirmButton: string;
  cancelButton: string;
  deleting: string;
  errorMismatch: string;
  errorFailed: string;
  errorBillingCanceled: string;
}

export interface DeleteAccountCardProps {
  labels: DeleteAccountLabels;
  /** Where to send the browser once the account no longer exists. */
  homeHref: string;
}

/**
 * The account-deletion affordance. Register #61(b); Apple 5.1.1(v) and Google
 * Play both require an in-app path.
 *
 * THE TYPED EMAIL IS NOT VALIDATED HERE, DELIBERATELY. `/api/account` compares
 * it server-side against the session's own address, and duplicating that rule in
 * the browser would create a second place for it to drift. The client's job is
 * to collect the gesture, not to decide whether it was correct.
 *
 * The confirmation is collapsed behind a first click so the destructive control
 * is never one stray tap away, and the permanence warning is shown BEFORE the
 * input rather than beside the final button, where it would arrive after the
 * decision has already been made.
 */
export function DeleteAccountCard({ labels, homeHref }: DeleteAccountCardProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed }),
      });
    } catch {
      setError(labels.errorFailed);
      setBusy(false);
      return;
    }

    if (response.ok) {
      // The session is dead the moment the auth user is gone. A full navigation
      // (not a router push) discards the client cache and lets middleware see
      // the now-invalid cookie.
      window.location.assign(homeHref);
      return;
    }

    let code = '';
    try {
      code = (await response.json())?.error ?? '';
    } catch {
      /* fall through to the generic message */
    }

    // The billing-cancelled-account-intact state is NOT a retryable failure and
    // must never be presented as one: retrying would attempt to cancel an
    // already-cancelled subscription while the account still stands. The control
    // is left disabled behind this message on purpose.
    if (code === 'BillingCanceledAccountIntact') {
      setError(labels.errorBillingCanceled);
      setOpen(false);
      setBusy(false);
      return;
    }

    setError(code === 'ConfirmationMismatch' ? labels.errorMismatch : labels.errorFailed);
    setBusy(false);
  }

  return (
    <Card className="border-red-200 p-6">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-red-600">
        {labels.heading}
      </h2>

      <p className="mb-2 text-sm text-foreground">{labels.description}</p>
      <p className="mb-2 text-sm font-medium text-red-600">{labels.permanentWarning}</p>
      <p className="mb-1 text-xs text-muted-foreground">{labels.whatIsRemoved}</p>
      <p className="mb-4 text-xs text-muted-foreground">{labels.billingNote}</p>

      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {labels.openButton}
        </Button>
      ) : (
        <div className="space-y-3">
          <label htmlFor="confirm-email" className="block text-sm text-foreground">
            {labels.confirmPrompt}
          </label>
          <Input
            id="confirm-email"
            type="email"
            autoComplete="off"
            inputMode="email"
            dir="ltr"
            className="text-start"
            placeholder={labels.confirmPlaceholder}
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={onConfirm} disabled={busy || typed.trim() === ''}>
              {busy ? labels.deleting : labels.confirmButton}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
            >
              {labels.cancelButton}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
