'use client';

import { useEffect, useRef, useState } from 'react';
import { reviewBridge, type ReviewBridge } from '@/lib/review/bridge';
import { deviceStorage, readReview, writeReview, type ReviewStorage } from '@/lib/review/store';
import { decide, markAsked, type ReviewMoment, type ReviewReason } from '@/lib/review/rules';

/**
 * THE ONE PLACE THE APP ASKS APPLE FOR A RATING (iOS 1.1, big item 4h): the
 * quiz result screen, through `useReviewTrigger` in QuizSection. Nothing is
 * drawn. The quiz root carries the reading as an inert attribute,
 * `data-kf-review="<reason>"`, for CI (ios-signed-in reads `too-new` on its
 * fresh simulator, PR 2).
 *
 * The sequence (reviewAtResult), every step able to stop it:
 *   1. the plugin answers with the app version (else `unavailable`);
 *   2. the record is read and this result counted and written FIRST (the
 *      rules: src/lib/review/rules.ts); most results stop here with a reason;
 *   3. a 2 s wait after the result has drawn: the end of a sequence, not the
 *      direct answer to the Submit tap (Apple's own sample asks from a
 *      completed-task screen a tap leads to);
 *   4. the screen is still this quiz's result (else nothing, no reading);
 *   5. the live checks, read again just before the call (liveChecksPass):
 *      the page is visible and focused, no sheet, dialog, paywall or camera
 *      is open, no text field has the keyboard (else `busy`);
 *   6. the record is read again and the rules run again without counting
 *      (another screen may have asked, a refusal may have landed);
 *   7. the ask is written (this version, today) and read back; only a held
 *      write lets the call go, so the app can be held to once per version;
 *   8. request(). Apple decides whether a sheet shows and says nothing back.
 *
 * No handler reaches this: the hook runs the sequence from an effect, keyed
 * on the quiz phase. CI's simulators run Debug builds, where StoreKit shows
 * the sheet on every call; the tenure rule keeps every CI run (and App
 * Review's fresh install) at `too-new`, so no call is made there.
 */
export const REVIEW_DELAY_MS = 2000;

/** A sheet, dialog, paywall or camera screen on top: no ask. */
export const OPEN_SURFACES = '[data-kf-consent-sheet="open"], [data-kf-paywall], [data-kf-camera-sheet], dialog[open], [aria-modal="true"]';

export type TriggerReason = ReviewReason | 'unavailable' | 'busy';

/** Inputs that take no keyboard; any other focused input does. */
const NO_KEYBOARD = new Set(['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);

type LiveDoc = {
  visibilityState?: string;
  hasFocus?: () => boolean;
  querySelectorAll?: (sel: string) => ArrayLike<{ closest?: (sel: string) => unknown }>;
  activeElement?: { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null;
};

/**
 * The live checks. A CLOSED Sheet (src/components/ui/Sheet.tsx) keeps its
 * panel, with aria-modal, inside an aria-hidden wrapper, so an
 * `[aria-modal="true"]` counts as open only when no aria-hidden ancestor
 * holds it: the dashboard always mounts the consent sheet, closed.
 */
export function liveChecksPass(d: LiveDoc | null | undefined): boolean {
  if (!d) return false;
  if (d.visibilityState !== 'visible') return false;
  if (typeof d.hasFocus !== 'function' || !d.hasFocus()) return false;
  const open = d.querySelectorAll ? Array.from(d.querySelectorAll(OPEN_SURFACES)) : [];
  if (open.some((el) => !el.closest?.('[aria-hidden="true"]'))) return false;
  const a = d.activeElement;
  if (a) {
    const tag = String(a.tagName ?? '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return false;
    if (tag === 'INPUT' && !NO_KEYBOARD.has(String(a.getAttribute?.('type') ?? 'text').toLowerCase())) return false;
    if (a.isContentEditable) return false;
  }
  return true;
}

export type TriggerDeps = {
  bridge: ReviewBridge;
  /** This device's record store (src/lib/review/store.ts, deviceStorage()). */
  local: ReviewStorage | null;
  moment: ReviewMoment;
  now: () => Date;
  wait: (ms: number) => Promise<void>;
  /** Still mounted and still this quiz's result. */
  stillHere: () => boolean;
  live: () => boolean;
  /** Told once this result is written to the record. */
  counted?: () => void;
};

/** The sequence above. Resolves the reading, or null when the screen left. */
export async function reviewAtResult(d: TriggerDeps): Promise<TriggerReason | null> {
  const info = await d.bridge.available();
  if (!d.stillHere()) return null;
  if (!info.available || !info.version) return 'unavailable';
  const version = info.version;

  const first = readReview(d.local, d.now());
  if (!first) return 'storage';
  const d1 = decide(first.fresh ? null : first.state, d.moment, d.now(), version);
  if (!first.fresh && !writeReview(d.local, d1.next)) return 'storage';
  d.counted?.();
  if (!d1.ask) return d1.reason;

  await d.wait(REVIEW_DELAY_MS);
  if (!d.stillHere()) return null;
  if (!d.live()) return 'busy';

  const again = readReview(d.local, d.now());
  if (!again || again.fresh) return 'storage';
  const d2 = decide(again.state, d.moment, d.now(), version, { count: false });
  if (!d2.ask) return d2.reason;
  if (!writeReview(d.local, markAsked(again.state, version, d.now()))) return 'storage';
  const held = readReview(d.local, d.now());
  if (!held || held.fresh || held.state.askedVersion !== version) return 'storage';

  try {
    await d.bridge.request();
  } catch {
    // Apple's call returns nothing either way; the ask is already recorded.
  }
  return 'ask';
}

/**
 * The quiz result's hook. Returns the reading for `data-kf-review`, or null
 * (the web, build 8, any shell without the plugin: nothing runs, nothing is
 * stored, the attribute is absent).
 */
export function useReviewTrigger(phase: string, score: number, total: number): TriggerReason | null {
  const [reason, setReason] = useState<TriggerReason | null>(null);
  const phaseRef = useRef(phase);
  const counted = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'result') {
      counted.current = false;
      setReason(null);
      return;
    }
    if (counted.current) return;
    const bridge = reviewBridge();
    if (!bridge) return;
    let alive = true;
    let wrote = false;
    const timers: number[] = [];
    void reviewAtResult({
      bridge,
      local: deviceStorage(),
      moment: { score, total },
      now: () => new Date(),
      wait: (ms) => new Promise<void>((done) => { timers.push(window.setTimeout(done, ms)); }),
      stillHere: () => alive && phaseRef.current === 'result',
      live: () => liveChecksPass(typeof document === 'undefined' ? null : document),
      counted: () => { wrote = true; counted.current = true; },
    }).then((r) => {
      if (alive && r) setReason(r);
    });
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      // Torn down before this result was written (a remount): it may run again.
      if (!wrote) counted.current = false;
    };
  }, [phase, score, total]);

  return reason;
}
