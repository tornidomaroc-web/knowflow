'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import type { Document } from '@/types';
import { Locale, resolveLocale, useTranslation } from '@/lib/i18n';
import { fileTooLargeMessage, uploadFailureMessage, uploadLimitLabel, uploadRefusalMessage } from '@/lib/limit-messages';
import { isOverUploadLimit, parseUploadReply } from '@/lib/upload-limits';
import { fileExtension, isAllowedFileType } from '@/types';
import { expectedProcessingSeconds, processingFraction, processingStage } from '@/lib/upload-progress';

interface DropZoneProps {
  kbId: string;
  onSuccess?: (doc: Document) => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

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
export function DropZone({ kbId, onSuccess }: DropZoneProps) {
  const router = useRouter();
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = resolveLocale(params.locale);
  const t = useTranslation(safeLocale);
  const u = t.dashboard.upload;
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [sent, setSent] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A one-second clock while processing, so the sentence and the bar move.
  useEffect(() => {
    if (state !== 'processing') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

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

    setFile({ name: picked.name, size: picked.size });
    setSent(0);
    setErrorMsg(null);
    setState('uploading');

    const formData = new FormData();
    formData.append('file', picked);
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

    setState('ready');
    if (onSuccess) {
      onSuccess({
        id: data.document_id, kb_id: kbId, filename: picked.name,
        file_type: picked.name.split('.').pop() as any, status: 'ready',
        markdown_content: null, chunk_count: data.chunk_count, created_at: new Date().toISOString(),
        // Phase 3: a just-uploaded document has no summary yet.
        summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: false,
      });
    } else {
      router.refresh(); // Refresh page data on completion
    }

    setTimeout(() => setState('idle'), 3000);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const busy = state === 'uploading' || state === 'processing';
  const elapsedMs = startedAt ? now - startedAt : 0;
  const stage = file ? processingStage(elapsedMs, file.size) : 'reading';
  const fraction = state === 'uploading' && file
    ? (file.size ? sent / file.size : 1)
    : state === 'processing' && file
      ? processingFraction(elapsedMs, file.size)
      : state === 'ready' ? 1 : 0;

  return (
    <div
      onClick={() => !busy && fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      aria-busy={busy}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        state === 'idle'
          ? 'cursor-pointer border-border bg-surface hover:border-primary hover:bg-muted'
          : state === 'error'
            ? 'cursor-pointer border-danger-border bg-danger-subtle'
            : 'border-primary bg-primary-subtle'
      }`}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {state === 'idle' && (
        <>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">{u.dropHere}</p>
          <p className="text-xs text-muted-foreground">{u.supported.replace('{limit}', uploadLimitLabel(safeLocale))}</p>
        </>
      )}

      {(busy || state === 'ready') && file && (
        <div className="w-full max-w-md text-start" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
              {state === 'ready' ? <CheckCircle2 className="h-5 w-5 text-success" /> : <FileText className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" dir="auto">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {state === 'uploading' && `${u.uploading} ${Math.round(fraction * 100)}%`}
                {state === 'processing' && (stage === 'reading' ? u.reading : stage === 'preparing' ? u.preparing : u.stillWorking)}
                {state === 'ready' && u.ready}
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

          {state === 'processing' && (
            <p className="mt-2 text-xs text-muted-foreground">
              {stage === 'long'
                ? u.leaveNote
                : u.usuallyAbout.replace('{n}', String(expectedProcessingSeconds(file.size)))}
            </p>
          )}
        </div>
      )}

      {state === 'error' && (
        <>
          <p className="text-sm font-medium text-danger">{u.error}</p>
          <p className="mt-1 text-xs text-danger">{errorMsg}</p>
          <p className="mt-2 text-xs text-muted-foreground">{u.tryAnother}</p>
        </>
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
