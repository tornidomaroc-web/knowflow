'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Sheet } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { AI_CONSENT_WITHDRAWN, aiConsentGrant } from '@/lib/ai-consent';
import type { useTranslation } from '@/lib/i18n';

export type AiConsentLabels = ReturnType<typeof useTranslation>['dashboard']['aiConsent'];

interface AiConsentValue {
  consented: boolean;
  /**
   * Resolves true when the student has given the permission, asking first
   * with the sheet if they have not. Every client call to a route that sends
   * content to Anthropic or Voyage AI awaits this before the request leaves.
   */
  ensure: () => Promise<boolean>;
  /** Removes the permission from the account; resolves whether it was saved. */
  withdraw: () => Promise<boolean>;
  labels: AiConsentLabels | null;
}

// Outside the dashboard (the design previews render the same components with
// fixtures) there is no account to ask for: the gate lets the click through
// and the route, which checks the account itself, is the one that refuses.
const NO_PROVIDER: AiConsentValue = {
  consented: true,
  ensure: async () => true,
  withdraw: async () => false,
  labels: null,
};

const AiConsentContext = createContext<AiConsentValue>(NO_PROVIDER);

export function useAiConsent(): AiConsentValue {
  return useContext(AiConsentContext);
}

async function saveToAccount(data: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await createClient().auth.updateUser({ data });
    return !error;
  } catch {
    return false;
  }
}

/**
 * THE ONE-TIME SHEET OF APPLE 5.1.2(i) (src/lib/ai-consent.ts).
 *
 * Mounted once, by the dashboard layout, with the permission read from the
 * account on the server. The first upload, question, summary or quiz opens
 * the sheet instead of sending anything; it names both companies and what
 * each receives, and only "I agree" writes the permission to the account and
 * lets that request leave. "Not now", the scrim and Escape all leave the
 * account as it was, and the caller shows the `declined` sentence: nothing
 * was sent. The routes refuse on their own as well, so a request that skips
 * this sheet is still refused.
 *
 * `preview` (the design preview only) opens the sheet at once unless the
 * permission is already given, and saves
 * nowhere, so it can be looked at with no session.
 */
export function AiConsentProvider({
  initialConsented,
  labels,
  privacyHref,
  preview = false,
  children,
}: {
  initialConsented: boolean;
  labels: AiConsentLabels;
  privacyHref: string;
  preview?: boolean;
  children: ReactNode;
}) {
  const [consented, setConsented] = useState(initialConsented);
  const consentedRef = useRef(initialConsented);
  const [open, setOpen] = useState(preview && !initialConsented);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const persist = useCallback(
    (data: Record<string, unknown>) => (preview ? Promise.resolve(true) : saveToAccount(data)),
    [preview],
  );

  const settle = useCallback((ok: boolean) => {
    setOpen(false);
    const resolve = pending.current;
    pending.current = null;
    resolve?.(ok);
  }, []);

  const ensure = useCallback(() => {
    if (consentedRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      // A second ask while the sheet is up supersedes the first, which is
      // answered "not given" so its caller does not wait forever.
      pending.current?.(false);
      pending.current = resolve;
      setFailed(false);
      setOpen(true);
    });
  }, []);

  const accept = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await persist(aiConsentGrant(new Date()));
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    consentedRef.current = true;
    setConsented(true);
    settle(true);
  };

  const withdraw = useCallback(async () => {
    const ok = await persist({ ...AI_CONSENT_WITHDRAWN });
    if (ok) {
      consentedRef.current = false;
      setConsented(false);
    }
    return ok;
  }, [persist]);

  return (
    <AiConsentContext.Provider value={{ consented, ensure, withdraw, labels }}>
      {children}
      <Sheet
        open={open}
        onClose={() => !busy && settle(false)}
        side="bottom"
        label={labels.title}
        className="mx-auto max-w-lg"
      >
        {open && (
          <div
            data-kf-consent-sheet="open"
            className="max-h-[85dvh] overflow-y-auto px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <h2 className="text-lg font-semibold text-foreground">{labels.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{labels.intro}</p>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              <li className="rounded-lg bg-muted px-3 py-2">{labels.anthropic}</li>
              <li className="rounded-lg bg-muted px-3 py-2">{labels.voyage}</li>
            </ul>
            <p className="mt-3 text-sm text-foreground">{labels.notSent}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.withdrawHint}{' '}
              <Link href={privacyHref} className="underline hover:text-primary">
                {labels.privacyLink}
              </Link>
            </p>
            {failed && (
              <p role="alert" className="mt-3 text-sm font-medium text-danger">
                {labels.saveFailed}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button data-kf-consent="accept" onClick={accept} disabled={busy}>
                {busy ? labels.saving : labels.accept}
              </Button>
              <Button variant="secondary" data-kf-consent="not-now" onClick={() => settle(false)} disabled={busy}>
                {labels.notNow}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </AiConsentContext.Provider>
  );
}
