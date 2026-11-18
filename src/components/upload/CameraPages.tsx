'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, Sheet } from '@/components/ui';
import { ClaySectionTitle } from '@/components/clay/ClaySectionTitle';
import { ClayCamera } from '@/components/clay/ClayIcons';
import { LatinText } from '@/components/ui/LatinText';
import { useAiConsent } from '@/components/ai-consent/AiConsentProvider';
import { createClient } from '@/lib/supabase/client';
import type { Document } from '@/types';
import type { Locale, useTranslation } from '@/lib/i18n';
import { uploadRefusalMessage } from '@/lib/limit-messages';
import { parseUploadReply } from '@/lib/upload-limits';
import { AI_CONSENT_REFUSAL } from '@/lib/ai-consent';
import { PAGES_UNREAD } from '@/lib/page-reader';
import {
  MAX_PAGE_PHOTOS,
  materialName,
  newBatchId,
  sendPageBatch,
  unreadPages,
  type PhotoProblem,
} from '@/lib/page-photos';

export type CameraLabels = ReturnType<typeof useTranslation>['dashboard']['upload']['camera'];

/** One page waiting to be sent: the re-encoded photo, held in memory until a 200. */
interface Page {
  id: string;
  blob: Blob | null;
  url: string;
  problem?: PhotoProblem;
}

export interface CameraPagesHandle {
  /** Opens the camera. Call it inside the tap (a file input opens only in a user activation). */
  capture: () => void;
}

type Phase = 'idle' | 'preparing' | 'consent' | 'uploading' | 'reading';

export interface CameraDone {
  doc: Document;
  unread: { n: number; problem: PhotoProblem }[];
}

/**
 * PREVIEW ONLY (`/[locale]/preview/camera`): the screen with `pages` drawn
 * pages (no photo, nothing sent), and optionally the answer that marked some
 * of them unread. The real flow never passes it.
 */
export interface CameraPreview {
  pages: number;
  problems?: Record<number, PhotoProblem>;
  message?: 'noneRead';
}

/**
 * THE CAMERA SCREEN, "صوّر صفحاتك" (the app only, from shell 2:
 * src/lib/platform.ts `cameraAllowed`). The rules are src/lib/page-photos.ts.
 *
 * A sheet over the subject page. Each tap of the camera control opens the
 * phone's camera through `<input type="file" accept="image/*"
 * capture="environment" multiple>`, no native plugin: WebKit opens the camera
 * for a capture input itself (it needs Info.plist's NSCameraUsageDescription,
 * which shell 2 declares). A shot is re-encoded at once (page-photo-encode)
 * and shown as the next page, numbered; any page can be removed; up to 10.
 *
 * "Read the pages" asks the AI permission that names photos (version 2) the
 * first time, then uploads the batch with the student's session and posts it
 * ONCE (sendPageBatch). The photos stay here until the route answers 200;
 * "Try again" uploads them again under a new batch. The sheet cannot be
 * closed while the pages are being sent or read. On a 200 the new material is
 * handed to the drop zone, which shows it as any finished upload.
 */
export const CameraPages = forwardRef<CameraPagesHandle, {
  open: boolean;
  onClose: () => void;
  kbId: string;
  locale: Locale;
  labels: CameraLabels;
  /** The sentence after "Not now" on the permission sheet (`aiConsent.declined`). */
  declined: string;
  onDone: (done: CameraDone) => void;
  preview?: CameraPreview;
}>(function CameraPages({ open, onClose, kbId, locale, labels, declined, onDone, preview }, ref) {
  const [pages, setPages] = useState<Page[]>(() => (preview ? previewPages(preview) : []));
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(preview?.message === 'noneRead' ? labels.noneRead : null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ensure } = useAiConsent();
  const busy = phase === 'uploading' || phase === 'reading' || phase === 'consent';
  const full = pages.length >= MAX_PAGE_PHOTOS;

  useImperativeHandle(ref, () => ({ capture: () => inputRef.current?.click() }), []);

  // The object URLs of the thumbnails are freed when a page goes and when the
  // screen goes.
  const urls = useRef(new Set<string>());
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const addPhotos = useCallback(async (files: File[]) => {
    const room = MAX_PAGE_PHOTOS - pages.length;
    if (room <= 0) return;
    setMessage(null);
    setPhase('preparing');
    const { reencodePagePhoto } = await import('@/lib/page-photo-encode');
    const added: Page[] = [];
    let failed = false;
    for (const f of files.slice(0, room)) {
      try {
        const { blob } = await reencodePagePhoto(f);
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        added.push({ id: newBatchId(), blob, url });
      } catch {
        failed = true;
      }
    }
    setPages((prev) => [...prev, ...added].slice(0, MAX_PAGE_PHOTOS));
    setPhase('idle');
    if (failed) setMessage(labels.photoUnreadable);
  }, [pages.length, labels.photoUnreadable]);

  const remove = (id: string) => {
    setPages((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone && urls.current.has(gone.url)) {
        URL.revokeObjectURL(gone.url);
        urls.current.delete(gone.url);
      }
      return prev.filter((p) => p.id !== id);
    });
    setMessage(null);
  };

  const send = async () => {
    if (preview || pages.length === 0 || busy) return;
    const photos = pages.map((p) => p.blob).filter((b): b is Blob => b !== null);
    setMessage(null);
    setPages((prev) => prev.map((p) => ({ ...p, problem: undefined })));

    // Apple 5.1.2(i): the permission that names photos, before a byte leaves.
    setPhase('consent');
    if (!(await ensure(null, { photos: true }))) {
      setPhase('idle');
      setMessage(declined);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      setPhase('idle');
      setMessage(uploadRefusalMessage(locale, 'session'));
      return;
    }
    const name = materialName(labels.defaultName, new Date());
    setPhase('uploading');
    setProgress({ done: 0, total: photos.length });
    const result = await sendPageBatch(photos, {
      userId,
      newBatchId,
      upload: async (key, photo) => {
        const { error } = await supabase.storage.from('documents').upload(key, photo, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
      },
      remove: async (keys) => {
        await supabase.storage.from('documents').remove(keys);
      },
      read: async (keys) => {
        const res = await fetch('/api/page-read', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kb_id: kbId, keys, name, locale }),
        });
        return { status: res.status, text: await res.text() };
      },
      onProgress: (p) => {
        if (p.stage === 'uploading') setProgress({ done: p.done, total: p.total });
        else setPhase('reading');
      },
    });
    setProgress(null);
    setPhase('idle');

    if (result.kind === 'upload-failed') return setMessage(labels.uploadFailed);
    if (result.kind === 'unconfirmed') return setMessage(labels.unconfirmed);

    const reply = parseUploadReply(result.text) as (Record<string, unknown> & { success?: boolean; error?: string; code?: string }) | null;
    const marked = unreadPages(reply?.photos);
    if (result.status >= 200 && result.status < 300 && reply?.success) {
      const doc = reply as unknown as { document_id: string; chunk_count: number; pages_total?: number | null; pages_no_text?: number | null };
      onDone({
        doc: {
          id: doc.document_id, kb_id: kbId, filename: `${name}.md`, file_type: 'md', status: 'ready',
          markdown_content: null, chunk_count: doc.chunk_count, embedding_status: 'ready', created_at: new Date().toISOString(),
          summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: false,
          pages_total: doc.pages_total ?? null, pages_no_text: doc.pages_no_text ?? null,
        } as Document,
        unread: marked,
      });
      // Sent and read: the photos are let go.
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current.clear();
      setPages([]);
      return;
    }

    // Not saved. The photos stay, each marked with what the route said of it.
    if (marked.length > 0) {
      const byN = new Map(marked.map((m) => [m.n, m.problem]));
      setPages((prev) => prev.map((p, i) => ({ ...p, problem: byN.get(i + 1) })));
    }
    if (result.status === 422 && reply?.code === PAGES_UNREAD) return setMessage(labels.noneRead);
    if (result.status === 403 && reply?.code === AI_CONSENT_REFUSAL) return setMessage(declined);
    // 400, 401, 403, 404, 422 (too much text), 429, 500, 503: the route's own
    // sentence, already in the student's language and fit for the app.
    setMessage(typeof reply?.error === 'string' && reply.error ? reply.error : labels.unconfirmed);
  };

  const problemText = (p: PhotoProblem) =>
    p === 'open' ? labels.problemOpen : p === 'no-text' ? labels.problemNoText : p === 'too-long' ? labels.problemTooLong : labels.problemNotRead;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        data-kf-camera-input=""
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) void addPhotos(files);
        }}
      />
      <Sheet
        open={open && phase !== 'consent'}
        onClose={() => !busy && phase !== 'preparing' && onClose()}
        side="bottom"
        label={labels.title}
        initialFocus="panel"
        className="kf-clay mx-auto max-w-lg rounded-t-[1.75rem]"
      >
        {open && (
          <div
            data-kf-camera-sheet="open"
            data-kf-camera-pages={pages.length}
            className="max-h-[92dvh] overflow-y-auto px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [text-wrap:pretty]"
          >
            <ClaySectionTitle icon={<ClayCamera width={30} height={30} />}>
              <span data-kf-camera-title="" className={locale === 'ar' ? 'whitespace-nowrap' : undefined}>{labels.title}</span>
            </ClaySectionTitle>
            <p className="mt-2 text-sm text-muted-foreground [text-wrap:balance]">
              {labels.hint.replace('{max}', String(MAX_PAGE_PHOTOS))}
            </p>

            {pages.length === 0 ? (
              <button
                type="button"
                data-kf-camera="first"
                onClick={() => inputRef.current?.click()}
                disabled={phase === 'preparing'}
                className="kf-streak pressable mt-4 flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-[1.375rem] px-4 py-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ClayCamera width={44} height={44} />
                <span className="text-[1.0625rem] font-extrabold text-foreground">
                  {phase === 'preparing' ? labels.preparing : labels.firstPage}
                </span>
              </button>
            ) : (
              <ol data-kf-camera-grid="" className="mt-4 grid grid-cols-3 gap-3">
                {pages.map((p, i) => (
                  <li key={p.id} data-kf-camera-page={i + 1} className="min-w-0">
                    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface ${p.problem ? 'ring-2 ring-danger' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimise */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        data-kf-camera-remove={i + 1}
                        aria-label={labels.removePage.replace('{n}', String(i + 1))}
                        onClick={() => remove(p.id)}
                        disabled={busy}
                        className="absolute end-0 top-0 inline-flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                        </span>
                      </button>
                    </div>
                    {p.problem && (
                      <p data-kf-camera-problem={i + 1} className="mt-1 text-xs text-danger">{problemText(p.problem)}</p>
                    )}
                  </li>
                ))}
                {!full && (
                  <li>
                    <button
                      type="button"
                      data-kf-camera="add"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy || phase === 'preparing'}
                      className="kf-well pressable flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ClayCamera width={32} height={32} />
                      <span className="text-xs font-bold text-foreground">{phase === 'preparing' ? labels.preparing : labels.addPage}</span>
                    </button>
                  </li>
                )}
              </ol>
            )}

            <p data-kf-camera-count="" className="mt-3 text-xs tabular-nums text-muted-foreground">
              {labels.count.replace('{n}', String(pages.length)).replace('{max}', String(MAX_PAGE_PHOTOS))}
            </p>
            {full && (
              <p data-kf-camera-full="" className="mt-1 text-xs text-muted-foreground">{labels.full.replace('{max}', String(MAX_PAGE_PHOTOS))}</p>
            )}

            {message && (
              <p role="alert" data-kf-camera-message="" className="mt-3 rounded-2xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
                <LatinText text={message} />
              </p>
            )}

            {(phase === 'uploading' || phase === 'reading') && (
              <div role="status" aria-live="polite" className="mt-3">
                <p className="text-sm font-medium text-foreground">
                  {phase === 'uploading' && progress
                    ? labels.uploading.replace('{n}', String(progress.done)).replace('{total}', String(progress.total))
                    : labels.reading}
                </p>
                {phase === 'reading' && <p className="mt-1 text-xs text-muted-foreground">{labels.readingNote}</p>}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
                  <div
                    className={`h-full rounded-full bg-primary transition-[width] duration-700 ease-out ${phase === 'reading' ? 'animate-pulse' : ''}`}
                    style={{ width: phase === 'reading' ? '90%' : `${progress ? Math.round((progress.done / Math.max(1, progress.total)) * 80) : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button data-kf-camera="read" onClick={send} disabled={pages.length === 0 || busy || phase === 'preparing'}>
                {message && pages.length > 0 && !busy ? labels.retry : labels.read}
              </Button>
              <Button variant="secondary" data-kf-camera="close" onClick={onClose} disabled={busy || phase === 'preparing'}>
                {labels.close}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
});

/** PREVIEW ONLY: drawn pages (paper, a heading bar and lines), no photo. */
function previewPages(p: CameraPreview): Page[] {
  return Array.from({ length: Math.min(p.pages, MAX_PAGE_PHOTOS) }, (_, i) => {
    const lines = Array.from({ length: 9 }, (_, k) => `<rect x="14" y="${46 + k * 14}" width="${92 - ((k * 17 + i * 11) % 34)}" height="5" rx="2.5" fill="#bfb29d"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#efe7da"/><rect x="8" y="8" width="104" height="144" rx="4" fill="#fbf8f2"/><rect x="14" y="20" width="${50 + (i * 7) % 30}" height="9" rx="4.5" fill="#d9a441"/>${lines}</svg>`;
    return { id: `preview-${i}`, blob: null, url: `data:image/svg+xml,${encodeURIComponent(svg)}`, problem: p.problems?.[i + 1] };
  });
}

