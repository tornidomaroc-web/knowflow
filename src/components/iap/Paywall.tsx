'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { LatinText } from '@/components/ui/LatinText';
import { ClayStar } from '@/components/clay/ClayIcons';
import { storeBridge } from '@/lib/iap/bridge';
import {
  loadProduct,
  postVerify,
  purchaseFlow,
  restoreFlow,
  type IapDeps,
  type PaywallState,
} from '@/lib/iap/flow';
import type { useTranslation } from '@/lib/i18n';

export type PaywallLabels = ReturnType<typeof useTranslation>['dashboard']['iap'];

/** What Pro gives, read from the limits code by the page (never typed here). */
export interface PaywallFigures {
  subjects: number;
  materials: number;
  questions: number;
  uploads: number;
}

export interface PaywallProps {
  labels: PaywallLabels;
  figures: PaywallFigures;
  userId: string;
  /** The server's reading: Pro from Apple, Pro from elsewhere, or not Pro. */
  pro: 'apple' | 'web' | null;
  termsHref: string;
  privacyHref: string;
  /** Design previews: a fixed state and a fixed StoreKit-shaped price, no plugin. */
  preview?: { state: PaywallState; price: string | null };
}

const BUSY: PaywallState[] = ['loading', 'purchasing', 'restoring'];
/** States after which the buy button stays (a retry is possible). */
const CAN_BUY: PaywallState[] = ['ready', 'failed', 'restore-none'];
/** States that keep Restore Purchases on screen. */
const CAN_RESTORE: PaywallState[] = ['ready', 'unavailable', 'failed', 'verify-failed', 'restore-none', 'pending', 'other-account', 'not-this-account'];

const fill = (s: string, k: string, v: string | number) => s.split(`{${k}}`).join(String(v));

/**
 * THE PAYWALL (iOS 1.1, item 4d, app half; shell 2 only, the page refuses
 * any other shell). Everything on it sits inside ONE element marked
 * `data-kf-iap`, the only place the app's wording rule lets purchase words
 * stand in shell 2 (scripts/lib/app-wording.mjs).
 *
 * The price is StoreKit's `displayPrice`, in the student's own storefront
 * and currency, never a number typed in this code: with no product (no Paid
 * Applications Agreement yet, no network, an unsupported storefront) there is
 * no price, so there is no Subscribe button either ('unavailable').
 *
 * Guideline 3.1.2 (auto-renewable subscriptions): the title, the length (a
 * month), the price per month, the auto-renew terms, and links to the Terms
 * of Use and the Privacy Policy, all on the screen where the student buys.
 */
export function Paywall({ labels, figures, userId, pro, termsHref, privacyHref, preview }: PaywallProps) {
  const router = useRouter();
  const initial: PaywallState = preview?.state ?? (pro === 'apple' ? 'pro-apple' : pro === 'web' ? 'pro-web' : 'loading');
  const [state, setState] = useState<PaywallState>(initial);
  const [price, setPrice] = useState<string | null>(preview?.price ?? null);
  const [deps, setDeps] = useState<IapDeps | null>(null);
  const [manageFailed, setManageFailed] = useState(false);

  useEffect(() => {
    if (preview) return;
    const call = storeBridge();
    if (!call) {
      if (!pro) setState('unavailable');
      return;
    }
    const d: IapDeps = { call, verify: (jws) => postVerify(jws) };
    setDeps(d);
    if (pro) return;
    let gone = false;
    loadProduct(call).then((p) => {
      if (gone) return;
      setPrice(p?.displayPrice ?? null);
      setState(p ? 'ready' : 'unavailable');
    });
    return () => {
      gone = true;
    };
  }, [preview, pro]);

  async function run(kind: 'purchase' | 'restore') {
    if (!deps) return;
    setState(kind === 'purchase' ? 'purchasing' : 'restoring');
    const next = kind === 'purchase' ? await purchaseFlow(userId, deps) : await restoreFlow(deps);
    // A cancelled sheet is not a message: back to the offer as it was.
    setState(next === 'ready' && !price ? 'unavailable' : next);
    if (next === 'success') router.refresh();
  }

  const message: Partial<Record<PaywallState, string>> = {
    loading: labels.loading,
    unavailable: labels.unavailable,
    purchasing: labels.purchasing,
    restoring: labels.restoring,
    pending: labels.pending,
    success: labels.success,
    failed: labels.failed,
    'verify-failed': labels.verifyFailed,
    'restore-none': labels.restoreNone,
    'other-account': labels.otherAccount,
    'not-this-account': labels.notThisAccount,
  };
  const tone = (['failed', 'verify-failed', 'other-account', 'not-this-account'] as PaywallState[]).includes(state)
    ? 'text-danger'
    : state === 'success'
      ? 'text-success'
      : 'text-muted-foreground';
  const isPro = state === 'pro-apple' || state === 'pro-web' || state === 'success';
  const rows: [string, number][] = [
    [labels.rowSubjects, figures.subjects],
    [labels.rowMaterials, figures.materials],
    [labels.rowQuestions, figures.questions],
    [labels.rowUploads, figures.uploads],
  ];

  return (
    <div data-kf-iap="paywall" data-kf-paywall={state} className="mx-auto max-w-lg space-y-5 [text-wrap:pretty]">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="kf-chip inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-subtle">
          <ClayStar />
        </span>
        <div className="min-w-0">
          <h1 className="kf-title text-2xl font-bold text-foreground">
            <LatinText text={labels.title} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <LatinText text={labels.lead} />
          </p>
        </div>
      </header>

      <Card className="p-5">
        <h2 className="text-[1.0625rem] font-extrabold text-foreground">
          <LatinText text={labels.givesHeading} />
        </h2>
        <ul className="mt-3 space-y-2" data-kf-paywall-rows="">
          {rows.map(([label, n]) => (
            <li key={label} className="kf-tile flex min-h-[3rem] items-center justify-between gap-3 rounded-[1.125rem] px-4 py-2">
              <span className="text-sm font-medium text-foreground">
                <LatinText text={label} />
              </span>
              <span className="shrink-0 text-sm font-bold text-foreground" data-kf-paywall-figure={n}>
                {fill(labels.upTo, 'n', n)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {isPro ? (
        <Card className="p-5" data-kf-paywall-status="">
          <p className="text-base font-semibold text-success">
            <LatinText text={state === 'success' ? labels.success : labels.active} />
          </p>
          {state === 'pro-apple' && (
            <>
              <Button
                variant="secondary"
                data-kf-iap-manage=""
                className="mt-4 w-full"
                onClick={async () => {
                  setManageFailed(false);
                  try {
                    if (deps) await deps.call('manageSubscriptions');
                  } catch {
                    setManageFailed(true);
                  }
                }}
              >
                <LatinText text={labels.manage} />
              </Button>
              {manageFailed && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  <LatinText text={labels.manageFailed} />
                </p>
              )}
            </>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          {price && (
            <p className="text-center text-2xl font-extrabold text-foreground" data-kf-paywall-price="">
              <LatinText text={fill(labels.pricePerMonth, 'price', price)} />
            </p>
          )}
          {message[state] && (
            <p role="status" aria-live="polite" className={`mt-3 text-center text-sm font-medium ${tone}`} data-kf-paywall-message={state}>
              <LatinText text={message[state]!} />
            </p>
          )}
          {price && CAN_BUY.includes(state) && (
            <Button className="mt-4 w-full" data-kf-paywall-buy="" onClick={() => run('purchase')}>
              <LatinText text={labels.subscribe} />
            </Button>
          )}
          {BUSY.includes(state) && state !== 'loading' && (
            <Button className="mt-4 w-full" disabled aria-busy="true">
              <LatinText text={labels.subscribe} />
            </Button>
          )}
          {CAN_RESTORE.includes(state) && (
            <Button variant="ghost" className="mt-2 w-full" data-kf-paywall-restore="" onClick={() => run('restore')}>
              <LatinText text={labels.restore} />
            </Button>
          )}
          {price && (
            <p className="mt-4 text-xs leading-5 text-muted-foreground" data-kf-paywall-disclosure="">
              <LatinText text={fill(labels.disclosure, 'price', price)} />
            </p>
          )}
        </Card>
      )}

      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" data-kf-paywall-legal="">
        <Link href={termsHref} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          <LatinText text={labels.terms} />
        </Link>
        <Link href={privacyHref} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          <LatinText text={labels.privacy} />
        </Link>
      </nav>
    </div>
  );
}
