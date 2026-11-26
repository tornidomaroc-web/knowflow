'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Input } from '@/components/ui';
import { useSingleFlight } from '@/lib/use-single-flight';
import { ClayBin } from '@/components/clay/ClayIcons';
import { ClaySectionTitle } from '@/components/clay/ClaySectionTitle';
import { useIap } from '@/components/iap/IapProvider';
import { LatinText } from '@/components/ui/LatinText';
import { appleBridge, confirmDeletionWithApple, type AppleBridge } from '@/lib/auth/apple-bridge';
import { keepTogetherApple } from '@/lib/keep-together';

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
  /**
   * Shown when deletion stopped because a subscription exists that this app
   * cannot cancel. PERMANENT until the customer cancels it where they bought it,
   * so the copy must not say "try again" -- retrying fails identically forever.
   */
  errorSubscriptionElsewhere: string;
  /** Sign in with Apple (item 4f): the Apple step, its fallback, the not-revoked line and its link. */
  appleStep: string;
  appleUnconfirmed: string;
  appleNotRevoked: string;
  appleDone: string;
}

export interface DeleteAccountCardProps {
  labels: DeleteAccountLabels;
  /** Where to send the browser once the account no longer exists. */
  homeHref: string;
  /**
   * Step Wording-1: the billing line is shown only when deletion would cancel
   * a subscription (src/lib/subscription/billing-note.ts). Required, so no
   * caller can forget it; an account without one never reads the word.
   */
  showBillingNote: boolean;
  /**
   * R2 (Apple 5.1.1(v); #337): deleting the account does not cancel an App
   * Store subscription. The page hands the line in only while Apple may still
   * bill this account (src/components/iap/AppStoreManage.tsx).
   */
  appleNote?: ReactNode;
  /**
   * Sign in with Apple (item 4f). `appleAccount`: the session has an Apple
   * identity (settings reads `user.identities`). `appleConfirm`: the server
   * holds the Apple key, so it can take a fresh Apple authorization in place
   * of the typed email. Both false or absent: the card is exactly today's.
   */
  appleAccount?: boolean;
  appleConfirm?: boolean;
  /** Design previews only (preview/settings): open, or an Apple state, without a click. */
  previewState?: 'open' | 'apple-fallback' | 'apple-done';
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
export function DeleteAccountCard({ labels, homeHref, showBillingNote, appleNote, appleAccount = false, appleConfirm = false, previewState }: DeleteAccountCardProps) {
  const [open, setOpen] = useState(previewState === 'open' || previewState === 'apple-fallback');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(previewState === 'apple-fallback' ? labels.appleUnconfirmed : null);
  // Sign in with Apple (item 4f; the owner's addition to the study): an Apple
  // account in the app confirms with one more Apple sheet instead of typing
  // its (often private relay) address. Chosen after mount, only where the
  // KnowFlowApple plugin answers and the server can take it. Any failure
  // falls back to the typed email for good on this card.
  const [apple, setApple] = useState<AppleBridge | null>(null);
  const [fellBack, setFellBack] = useState(previewState === 'apple-fallback');
  const [notRevoked, setNotRevoked] = useState(previewState === 'apple-done');
  useEffect(() => {
    if (appleAccount && appleConfirm) setApple(appleBridge());
  }, [appleAccount, appleConfirm]);
  // After the deletion (the not-revoked notice): the notice is the ONLY thing
  // on the page. It is drawn in place on the server and the first paint, then
  // moved to the end of the signed-in shell (`.kf-clay`, so the clay surfaces
  // still apply), where globals.css hides every other child of the shell: the
  // settings cards, the support row, the top bar and the tab bar of an
  // account that no longer exists.
  const doneAnchor = useRef<HTMLDivElement>(null);
  const [donePage, setDonePage] = useState<Element | null>(null);
  useEffect(() => {
    if (notRevoked) setDonePage(doneAnchor.current?.closest('.kf-clay') ?? document.body);
  }, [notRevoked]);
  const appleWay = apple !== null && !fellBack;
  // Shell 2 (the IapProvider is mounted only there): the billing line is
  // purchase management, so it is marked data-kf-iap. Elsewhere: unchanged.
  const iapMarked = useIap() ? { 'data-kf-iap': 'billing' } : {};

  function appleFallback() {
    setFellBack(true);
    setError(labels.appleUnconfirmed);
    setBusy(false);
  }

  // Item 4j: one press, one request (src/lib/single-flight.ts); `busy` is
  // React state and cannot stop a second press that lands before it commits.
  const once = useSingleFlight();
  const onConfirm = once(confirmUnguarded);
  async function confirmUnguarded() {
    setBusy(true);
    setError(null);

    let body: string;
    if (appleWay && apple) {
      const sheet = await confirmDeletionWithApple(apple);
      if ('reason' in sheet) {
        // Cancel in Apple's sheet: nothing happened and nothing is said.
        if (sheet.reason === 'canceled') setBusy(false);
        else appleFallback();
        return;
      }
      body = JSON.stringify({ appleAuthorizationCode: sheet.code, appleNonce: sheet.nonce });
    } else {
      body = JSON.stringify({ confirmEmail: typed });
    }

    let response: Response;
    try {
      response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch {
      setError(labels.errorFailed);
      setBusy(false);
      return;
    }

    if (response.ok) {
      // An Apple account whose Apple access was not ended (the web, or Apple
      // did not answer) is told how to end it on the iPhone before leaving.
      if (appleAccount) {
        let outcome = '';
        try {
          outcome = (await response.json())?.appleRevoke ?? '';
        } catch {
          /* the account is gone either way */
        }
        if (outcome !== 'revoked') {
          setNotRevoked(true);
          setBusy(false);
          return;
        }
      }
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

    // The billing-cancelled-account-intact state IS retryable, and the control
    // stays live on purpose. This reverses an earlier reading of this branch.
    //
    // MEASURED 2026-09-04 against a real Paddle sandbox subscription that had
    // genuinely been cancelled: `cancelUserSubscriptions` returns
    // `{ ok: true, outcome: 'canceled', canceled: 1 }` on the second pass, and
    // `canceledAt` does not move -- nothing is cancelled twice. Paddle throws
    // `subscription_update_when_canceled`, `cancelAndVerify` catches it, re-reads,
    // and `verifiablyCanceled` accepts the end state. Steps 1 and 2 are
    // idempotent (an empty prefix sweeps to `deleted: 0`; the waitlist delete
    // removes zero rows without error), and step 4 is a bare retry of
    // `deleteUser`: transient failure and it completes, persistent failure and it
    // fails again harmlessly.
    //
    // So retrying costs the user nothing on any path and completes the deletion
    // on at least one. The panel is collapsed so the destructive control is not
    // left armed under an error, but the button remains enabled -- the user must
    // be able to finish what they asked for.
    // PERMANENT, NOT TRANSIENT. Billing this app cannot reach will be just as
    // unreachable on the next attempt, so the retry advice that is right for
    // every other failure here is wrong for this one. The panel closes and the
    // customer is told what to do and where, because they hold the only control
    // that clears it. Nothing was deleted and nothing was changed.
    if (code === 'SubscriptionNotCancellableHere') {
      setError(labels.errorSubscriptionElsewhere);
      setOpen(false);
      setBusy(false);
      return;
    }

    if (code === 'BillingCanceledAccountIntact') {
      setError(labels.errorBillingCanceled);
      setOpen(false);
      setBusy(false);
      return;
    }

    // Apple could not confirm (another Apple ID, an expired code, Apple not
    // answering): nothing was deleted; the typed email takes over.
    if (code === 'AppleConfirmationFailed') {
      appleFallback();
      return;
    }

    setError(code === 'ConfirmationMismatch' ? labels.errorMismatch : labels.errorFailed);
    setBusy(false);
  }

  if (notRevoked) {
    // A normal clay card: the deletion is done, so no red destructive frame.
    const page = (
      <div data-kf-apple-done-page="" className="flex min-h-screen items-center justify-center bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-foreground">
        <Card data-kf-apple-done-card="" className="w-full max-w-md p-5">
          <p data-kf-apple-not-revoked="" className="mb-4 text-sm text-foreground [text-wrap:pretty]">
            <LatinText text={keepTogetherApple(labels.appleNotRevoked)} />
          </p>
          {/* A full navigation, not a router push: the session is dead. */}
          <a href={homeHref} className="pressable inline-flex min-h-[2.75rem] items-center rounded-full bg-foreground px-5 text-sm font-bold text-background">
            {labels.appleDone}
          </a>
        </Card>
      </div>
    );
    return donePage ? createPortal(page, donePage) : <div ref={doneAnchor}>{page}</div>;
  }

  return (
    // Design "C", PR 3: the clay card KEEPS its red border (globals.css: the
    // edge is the message) and takes the clay bin and the section title.
    <Card data-kf-delete-card="" className="border-danger-border p-5">
      <ClaySectionTitle icon={<ClayBin />} className="mb-4 text-danger">
        {labels.heading}
      </ClaySectionTitle>

      <p className="mb-2 text-sm text-foreground">{labels.description}</p>
      <p className="mb-2 text-sm font-medium text-danger">{labels.permanentWarning}</p>
      <p className="mb-1 text-xs text-muted-foreground">{labels.whatIsRemoved}</p>
      {showBillingNote ? <p className="mb-4 text-xs text-muted-foreground" {...iapMarked}>{labels.billingNote}</p> : null}
      {appleNote ?? null}

      {error && (
        <p
          role="alert"
          // The Apple line is balanced (no word alone on its last line) and is a block of its own, the card's
          // 1rem away from the muted list above it (the owner's render review of #341); every other error is drawn exactly as before.
          className={error === labels.appleUnconfirmed ? 'mb-4 mt-4 text-sm font-medium text-danger [text-wrap:pretty]' : 'mb-4 text-sm font-medium text-danger'}
          {...(error === labels.appleUnconfirmed ? { 'data-kf-apple-unconfirmed': '' } : {})}
        >
          {error === labels.appleUnconfirmed ? <LatinText text={keepTogetherApple(error)} /> : error}
        </p>
      )}

      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {labels.openButton}
        </Button>
      ) : (
        // The Apple step is a block of its own, the card's 1rem away from the muted list (margins collapse
        // with its mb-1), in the card's body size and weight; the email path is drawn exactly as before.
        <div className={appleWay ? 'mt-4 space-y-3' : 'space-y-3'}>
          {appleWay ? (
            <p data-kf-apple-step="" className="text-sm text-foreground [text-wrap:pretty]">
              <LatinText text={keepTogetherApple(labels.appleStep)} />
            </p>
          ) : (
            <>
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
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={onConfirm} disabled={busy || (!appleWay && typed.trim() === '')}>
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
