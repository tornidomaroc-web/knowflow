'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClaySpark } from '@/components/clay/ClayIcons';
import { LatinText } from '@/components/ui/LatinText';
import { keepTogether } from '@/lib/keep-together';
import { useAiConsent } from '@/components/ai-consent/AiConsentProvider';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { AI_CONSENT_REFUSAL } from '@/lib/ai-consent';
import { useTranslation, type Locale } from '@/lib/i18n';
import { purchaseLinksAllowed } from '@/lib/platform';
import { SAMPLE_SUBJECT_LIMIT, sampleAskHref } from '@/lib/sample-file';
import { isSubjectId } from '@/lib/subject-create';

/** PREVIEW ONLY (the design previews): the card frozen in one of its states, with no request. */
export type SamplePreviewState = 'adding' | 'declined' | 'failed';

/**
 * "TRY WITH A SAMPLE FILE" (audit cause 9, docs/plans/sample-file.md).
 *
 * Drawn by the home's three-steps card only while the student has no material
 * (`homeStepsFirst`). One press:
 *  - asks for the AI permission first, with the same sheet as upload, quiz and
 *    summary. "Not now" sends nothing, creates nothing, and shows the approved
 *    `declined` sentence, as the drop zone does;
 *  - then POSTs /api/sample, which creates the subject, the file and its
 *    chunks under the student's own session (no AI call, no upload counted);
 *  - then opens the new subject's Ask, where the ready question waits as a
 *    chip under the field.
 * The button is disabled from the press until the answer, and the route is
 * the real guard against a second sample.
 */
export function SampleFileButton({ locale, preview }: { locale: Locale; preview?: SamplePreviewState }) {
  const t = useTranslation(locale);
  const home = t.dashboard.home;
  const platform = usePlatform();
  const router = useRouter();
  const { ensure: ensureAiConsent } = useAiConsent();
  const [adding, setAdding] = useState(preview === 'adding');
  const [notice, setNotice] = useState<{ kind: 'declined' | 'failed' | 'limit' | 'exists'; text: string } | null>(
    preview === 'declined' ? { kind: 'declined', text: t.dashboard.aiConsent.declined }
      : preview === 'failed' ? { kind: 'failed', text: home.sampleFailed }
        : null
  );

  const limitText = (limit: unknown, tier: unknown) => {
    // The new-subject page's own sentence, tier-correct; inside the app no plan is named.
    const k = t.dashboard.newKb;
    const template = !purchaseLinksAllowed(platform) ? k.errorLimitApp : tier === 'pro' ? k.errorLimitPro : k.errorLimitFree;
    const upgrade = tier !== 'pro' && purchaseLinksAllowed(platform) ? ' ' + k.errorLimitUpgrade : '';
    return template.replace('{limit}', String(limit)) + upgrade;
  };

  const press = async () => {
    if (adding || preview) return;
    setNotice(null);
    if (!(await ensureAiConsent())) {
      setNotice({ kind: 'declined', text: t.dashboard.aiConsent.declined });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        if (isSubjectId(body.subjectId)) {
          // Stays "adding" until the Ask screen replaces this one.
          router.push(sampleAskHref(locale, body.subjectId));
          return;
        }
        setNotice({ kind: 'exists', text: home.sampleExists });
      } else if (body?.code === AI_CONSENT_REFUSAL) {
        setNotice({ kind: 'declined', text: t.dashboard.aiConsent.declined });
      } else if (body?.code === SAMPLE_SUBJECT_LIMIT) {
        setNotice({ kind: 'limit', text: limitText(body.limit, body.tier) });
      } else {
        setNotice({ kind: 'failed', text: home.sampleFailed });
      }
    } catch {
      setNotice({ kind: 'failed', text: home.sampleFailed });
    }
    setAdding(false);
  };

  return (
    <div data-kf-sample="" className="mt-4 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={press}
        disabled={adding}
        aria-busy={adding || undefined}
        data-kf-sample-button=""
        className="kf-pill pressable inline-flex min-h-[2.75rem] items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
      >
        <ClaySpark width={20} height={20} />
        {adding ? home.sampleAdding : home.sampleButton}
      </button>
      {/* "a ready question" / "سؤال جاهز" kept on one line (keep-together.ts). */}
      <p data-kf-sample-desc="" className="text-xs text-muted-foreground"><LatinText text={keepTogether(home.sampleDesc)} /></p>
      {notice && (
        <p
          data-kf-sample-notice={notice.kind}
          role={notice.kind === 'declined' ? 'status' : 'alert'}
          className={
            notice.kind === 'declined' || notice.kind === 'exists'
              ? 'text-start text-xs text-muted-foreground' /* the description's size and colour (PR #322 review) */
              : 'w-full rounded-xl border border-danger-border bg-danger-subtle px-4 py-3 text-start text-sm text-danger'
          }
        >
          <LatinText text={keepTogether(notice.text)} />
        </p>
      )}
    </div>
  );
}
