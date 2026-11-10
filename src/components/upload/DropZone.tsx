'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileText, Upload } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { ClayUploadFile } from '@/components/clay/ClayIcons';
import { FileName } from '@/components/ui/FileName';
import type { Document } from '@/types';
import { Locale, resolveLocale, useTranslation } from '@/lib/i18n';
import { fileTooLargeMessage, uploadFailureMessage, uploadLimitLabel, uploadRefusalMessage } from '@/lib/limit-messages';
import { isOverUploadLimit, parseUploadReply } from '@/lib/upload-limits';
import { fileExtension, isAllowedFileType } from '@/types';
import { expectedProcessingSeconds, processingFraction, processingStage } from '@/lib/upload-progress';
import { useAiConsent } from '@/components/ai-consent/AiConsentProvider';
import { pagesWithoutText } from '@/lib/material-text';
import { afterConsent } from '@/lib/upload-consent';

interface DropZoneProps {
  kbId: string;
  onSuccess?: (doc: Document) => void;
  /**
   * PREVIEW ONLY (`/[locale]/preview/upload`): start in the `ready` state with
   * this file shown, so the queued-file row can be looked at without an
   * upload. Nothing is sent; the real flow never passes it. `noText` and
   * `pagesNoText` (Option C) start it on that result, as an upload would.
   */
  previewFile?: { name: string; size: number; noText?: boolean; pagesNoText?: { n: number; total: number } | null; state?: PreviewState };
}

/**
 * PREVIEW ONLY (activation 5): the states the audit never rendered, frozen.
 * `processing` stands still at `elapsed` seconds (no clock runs); `failed` is
 * the reply /api/ingest sends when processing fails (`unconfirmed`);
 * `consent` holds the file while the permission sheet is open; `declined` is
 * the tile again after "Not now", with the `declined` sentence.
 */
type PreviewState = 'processing' | 'failed' | 'consent' | 'declined';
const PREVIEW_ELAPSED_MS = 12_000;

// `consent` (activation 5, cause #7): a picked file held while the AI
// permission sheet is open (src/lib/upload-consent.ts).
type UploadState = 'idle' | 'consent' | 'uploading' | 'processing' | 'ready' | 'error';

/**
 * THE UPLOAD, WITH SOMETHING MOVING THE WHOLE TIME (register #113).
 *
 * Two halves, told apart because they are different waits:
 *
 * - UPLOADING is the bytes leaving the phone. `XMLHttpRequest` is used instead
 *   of `fetch` for exactly one reason: `fetch` cannot report upload progress,
 *   and this bar is real bytes, not an animation.
 * - PROCESSING is the server converting and embedding, which reports nothing
 *   until it is done (B6 would change that). The bar here advances against
 *   the measured rate in `@/lib/upload-progress` and stops at 90% until the
 *   answer arrives, the sentence changes with the elapsed time, and past the
 *   estimate the student is told they may leave and refresh. Every sentence
 *   is in their own language.
 *
 * The refusals, the size and type checks, and the reply parsing are exactly
 * what shipped for #50 and #111; only the transport and what is shown changed.
 */
export function DropZone({ kbId, onSuccess, previewFile }: DropZoneProps) {
  const router = useRouter();
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = resolveLocale(params.locale);
  const t = useTranslation(safeLocale);
  const u = t.dashboard.upload;
  const ps = previewFile?.state;
  const [state, setState] = useState<UploadState>(
    !previewFile ? 'idle' : ps === 'processing' ? 'processing' : ps === 'failed' ? 'error' : ps === 'consent' ? 'consent' : ps === 'declined' ? 'idle' : 'ready'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(ps === 'failed' ? uploadRefusalMessage(safeLocale, 'unconfirmed') : null);
  // Activation 5 (cause #7): "Not now" on the permission sheet. Not a failure:
  // the tile comes back with the sentence that says nothing was sent.
  const [notice, setNotice] = useState<'declined' | null>(ps === 'declined' ? 'declined' : null);
  // #128: the file arrived and the service found no text in it.
  const [noText, setNoText] = useState(previewFile?.noText ?? false);
  // Option C: the file arrived and SOME of its pages have no text.
  const [pagesNoText, setPagesNoText] = useState<{ n: number; total: number } | null>(previewFile?.pagesNoText ?? null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(previewFile && ps !== 'declined' && ps !== 'failed' ? { name: previewFile.name, size: previewFile.size } : null);
  const [sent, setSent] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(ps === 'processing' ? 0 : null);
  const [now, setNow] = useState(ps === 'processing' ? PREVIEW_ELAPSED_MS : 0);
  // Step Redesign-2. Inside the app the control is ONE primary button that
  // opens the native picker (no drag-and-drop wording on a phone); on the web
  // the zone stays a drop target, and says "tap" rather than "click" on a
  // touch screen.
  // Design "C", PR 3 (the owner's ruling, 2026-11-05: the one-choice upload
  // sheet is an extra tap, so no sheet in 1.0): on both platforms the idle
  // control is the sheet's "a file from your device" choice as a tile on the
  // page (upload-sheet.dc.html). ONE tap opens the same picker; the checks,
  // the consent, the transport and every state after the pick are unchanged.
  // The sheet comes back in 1.1 with the scan tile beside this one.
  const buttonFirst = usePlatform() === 'native';
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    try { setTouch(window.matchMedia('(pointer: coarse)').matches); } catch { /* no matchMedia: a keyboard and a mouse */ }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ensure: ensureAiConsent, consented } = useAiConsent();

  // A one-second clock while processing, so the sentence and the bar move.
  // A preview stands still, so its picture is the same on every render.
  const frozen = Boolean(previewFile);
  useEffect(() => {
    if (state !== 'processing' || frozen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state, frozen]);

  const handleFile = async (picked: File) => {
    // #50: refused here, before anything is sent. This check, the line under the
    // drop zone and the route's own guard all read `@/lib/upload-limits`.
    if (isOverUploadLimit(picked.size)) {
      setErrorMsg(fileTooLargeMessage(safeLocale, picked.size));
      setState('error');
      return;
    }
    // #111: the picker's `accept` list does not apply to a dropped file, so the
    // route's own type rule runs here too, before anything is sent.
    const ext = fileExtension(picked.name);
    if (!isAllowedFileType(ext)) {
      setErrorMsg(uploadRefusalMessage(safeLocale, 'type', ext));
      setState('error');
      return;
    }

    // Apple 5.1.2(i): the file's text goes to Voyage AI through the ingestion
    // service, so the permission is asked before a byte leaves.
    // Activation 5 (cause #7): the picked file is HELD and shown while the
    // sheet is open; "I agree" goes on with this same file, "Not now" sends
    // nothing and releases it (src/lib/upload-consent.ts).
    setNotice(null);
    setErrorMsg(null);
    if (!consented) {
      setFile({ name: picked.name, size: picked.size });
      setState('consent');
    }
    const step = afterConsent(picked, await ensureAiConsent({ name: picked.name }));
    if (!step.send) {
      setFile(null);
      setNotice(step.notice);
      setState(step.state);
      return;
    }

    setFile({ name: step.send.name, size: step.send.size });
    setNoText(false);
    setPagesNoText(null);
    setSent(0);
    setErrorMsg(null);
    setState('uploading');

    const formData = new FormData();
    formData.append('file', step.send);
    formData.append('kb_id', kbId);
    formData.append('locale', safeLocale);

    let status = 0;
    let text = '';
    try {
      ({ status, text } = await send(formData, (bytes) => setSent(bytes), () => {
        setStartedAt(Date.now());
        setNow(Date.now());
        setState('processing');
      }));
    } catch {
      // The request itself failed (offline, a dropped connection). The browser's
      // own error text is English and says nothing a student can act on, and
      // whether the file arrived is unknown, which `uploadFailed` says.
      setErrorMsg(u.uploadFailed);
      setState('error');
      return;
    }

    // Read as text, not JSON: the platform answers some failures itself, not in
    // our JSON (`parseUploadReply`).
    const data = parseUploadReply(text);
    if (status < 200 || status >= 300 || !data?.success) {
      setErrorMsg(uploadFailureMessage(safeLocale, status, data, picked.size, u.uploadFailed));
      setState('error');
      return;
    }

    const empty = data.chunk_count === 0;
    const some = pagesWithoutText({
      status: 'ready', embedding_status: 'ready', chunk_count: data.chunk_count,
      pages_total: data.pages_total, pages_no_text: data.pages_no_text,
    });
    setNoText(empty);
    setPagesNoText(some);
    setState('ready');
    if (onSuccess) {
      onSuccess({
        id: data.document_id, kb_id: kbId, filename: picked.name,
        file_type: picked.name.split('.').pop() as any, status: 'ready',
        // #128: the ack means the service wrote `embedding_status: 'ready'` with
        // this count, so a 0 here is a file with no text, as on reload.
        markdown_content: null, chunk_count: data.chunk_count, embedding_status: 'ready', created_at: new Date().toISOString(),
        // Phase 3: a just-uploaded document has no summary yet.
        summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: false,
        // Option C: from the ack, so the new card shows its pages with no text
        // at once, as it will on reload.
        pages_total: data.pages_total ?? null, pages_no_text: data.pages_no_text ?? null,
      });
    } else {
      router.refresh(); // Refresh page data on completion
    }

    // A file with pages that have no text keeps its result on screen, with the
    // way to fix it and a button to pick the next file: a 3-second message is
    // gone before the fix line is read. Every other result clears as before.
    if (!empty && !some) setTimeout(() => setState('idle'), 3000);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const busy = state === 'uploading' || state === 'processing';
  const warn = state === 'ready' && (noText || pagesNoText !== null);
  const elapsedMs = startedAt !== null ? now - startedAt : 0;
  const stage = file ? processingStage(elapsedMs, file.size) : 'reading';
  const fraction = state === 'uploading' && file
    ? (file.size ? sent / file.size : 1)
    : state === 'processing' && file
      ? processingFraction(elapsedMs, file.size)
      : state === 'ready' ? 1 : 0;

  return (
    <div
      // Only the finished file's well picks the next file on a click (web). The
      // idle and error states carry their own control (the tile), and a held
      // file waits for the sheet's answer.
      onClick={() => !busy && state !== 'idle' && state !== 'error' && state !== 'consent' && !buttonFirst && fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      aria-busy={busy}
      // Design "C", PR 3: no dashed edge. Idle is the tile alone; a running or
      // finished upload sits in a pressed-in well; a refusal keeps a solid red
      // edge, because there the edge is the message (as the delete card's).
      // Activation 5 (the owner's review of #315): a refusal is no longer a
      // dead end. The red-edged message sits ABOVE the same control the idle
      // state shows (the tile in the app, the tile and the drop line on the
      // web), so "pick another file" has something to pick with.
      className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl text-center transition-colors [text-wrap:balance] ${
        state === 'idle' || state === 'error' ? 'p-0' : 'kf-well p-6'
      }`}
    >
      {/* Activation 5 (cause #7): the input is emptied as soon as the file is
          read, so picking the SAME file again (after "Not now", or after a
          refusal) fires a change and is handled. It used to do nothing. */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.docx,.pptx,.xlsx,.txt,.md"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (picked) handleFile(picked);
        }}
      />

      {state === 'error' && (
        <div data-kf-upload-error="" role="alert" className="w-full rounded-3xl border border-danger-border bg-danger-subtle p-6">
          <p className="text-sm font-medium text-danger">{u.error}</p>
          <p className="mt-1 text-xs text-danger">{errorMsg}</p>
          <p className="mt-2 text-xs text-muted-foreground">{u.tryAnother}</p>
        </div>
      )}

      {(state === 'idle' || state === 'error') && (
        <>
          {state === 'idle' && notice === 'declined' && (
            <p data-kf-upload-notice="declined" role="status" className="w-full text-start text-sm text-muted-foreground">
              {t.dashboard.aiConsent.declined}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            data-kf-upload="tile"
            className="kf-streak pressable flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-[1.375rem] px-4 py-3.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClayUploadFile className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span data-kf-upload-title="" className="block text-[1.0625rem] font-extrabold text-foreground">{u.fromDevice}</span>
              <span data-kf-upload-desc="" className="mt-0.5 block text-[0.8125rem] font-medium text-[color:var(--clay-streak-muted)]">{u.fromDeviceDesc}</span>
            </span>
          </button>
          {/* The web keeps its drop target: the whole zone takes a dropped file,
              and this line says so ("tap" on a touch screen). */}
          {!buttonFirst && <p className="text-sm font-medium text-foreground">{touch ? u.dropHereTouch : u.dropHere}</p>}
          <TypesLines label={u.typesLabel} size={u.sizeLine.replace('{limit}', uploadLimitLabel(safeLocale))} />
        </>
      )}

      {state === 'consent' && file && (
        <div data-kf-upload-held="" className="w-full max-w-md text-start" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <FileName name={file.name} className="text-sm font-medium text-foreground" />
              <p className="text-xs text-muted-foreground">{u.awaitingConsent}</p>
            </div>
          </div>
        </div>
      )}

      {(busy || state === 'ready') && file && (
        <div className="w-full max-w-md text-start" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
              {state === 'ready' && pagesNoText && !noText
                ? <AlertTriangle className="h-5 w-5 text-warning" />
                : state === 'ready' && !noText ? <CheckCircle2 className="pop-in h-5 w-5 text-success" /> : <FileText className={noText && state === 'ready' ? 'h-5 w-5 text-danger' : 'h-5 w-5'} />}
            </span>
            <div className="min-w-0 flex-1">
              <FileName name={file.name} className="text-sm font-medium text-foreground" />
              <p className={noText && state === 'ready' ? 'text-xs text-danger' : pagesNoText && state === 'ready' ? 'text-xs text-foreground' : 'text-xs text-muted-foreground'}>
                {state === 'uploading' && `${u.uploading} ${Math.round(fraction * 100)}%`}
                {state === 'processing' && (stage === 'reading' ? u.reading : stage === 'preparing' ? u.preparing : u.stillWorking)}
                {state === 'ready' && (noText
                  ? t.dashboard.subjectDetail.noTextLine
                  : pagesNoText
                    ? t.dashboard.subjectDetail.someNoTextLine.replace('{n}', String(pagesNoText.n)).replace('{total}', String(pagesNoText.total))
                    : u.ready)}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-faint">
              {state === 'processing' && `${Math.floor(elapsedMs / 1000)}s`}
            </span>
          </div>

          {/* The bar: real bytes while uploading; the estimate, capped at 90%,
              while processing; full once the server has answered. */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-primary transition-[width] duration-700 ease-out ${state === 'processing' ? 'animate-pulse' : ''}`}
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>

          {warn && (
            <>
              <p className="mt-2 text-xs text-muted-foreground" data-kf-text-fix="">{t.dashboard.subjectDetail.noTextFix}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                data-kf-upload="again"
                className={cn(buttonVariants({ variant: 'secondary' }), 'mt-3 min-h-11 w-full')}
              >
                <Upload className="h-4 w-4" />
                {u.uploadButton}
              </button>
            </>
          )}

          {state === 'processing' && (
            <p className="mt-2 text-xs text-muted-foreground">
              {stage === 'long'
                ? u.leaveNote
                : u.usuallyAbout.replace('{n}', String(expectedProcessingSeconds(file.size)))}
            </p>
          )}
        </div>
      )}

    </div>
  );
}

/**
 * POST the form with upload progress. Resolves with the status and the raw
 * body text (parsed by the caller); rejects only when the request itself
 * failed. `onSent` is called once the last byte has left, which is when the
 * wait becomes the server's.
 */
function send(
  body: FormData,
  onProgress: (bytes: number) => void,
  onSent: () => void
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/ingest');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    xhr.upload.onload = () => onSent();
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new Error('abort'));
    xhr.send(body);
  });
}

/**
 * The accepted types and the size limit, on two lines. The Latin list is an
 * isolated LTR run, so on /ar it never breaks the Arabic around it (the old
 * single sentence split "(حتى 4" at the parenthesis on a phone).
 */
function TypesLines({ label, size }: { label: string; size: string }) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {label}: <bdi dir="ltr">PDF, DOCX, PPTX, XLSX, TXT, MD</bdi>
      </p>
      <p className="text-xs text-muted-foreground">{size}</p>
    </>
  );
}
