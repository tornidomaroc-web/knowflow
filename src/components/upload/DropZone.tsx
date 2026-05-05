'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Document } from '@/types';
import { Locale, locales, useTranslation } from '@/lib/i18n';

interface DropZoneProps {
  kbId: string;
  onSuccess?: (doc: Document) => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

export function DropZone({ kbId, onSuccess }: DropZoneProps) {
  const router = useRouter();
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  const t = useTranslation(safeLocale);
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 52428800) {
      setErrorMsg(t.dashboard.upload.fileTooBig);
      setState('error');
      return;
    }

    setState('uploading');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('kb_id', kbId);

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      setState('processing');

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t.dashboard.upload.uploadFailed);

      setState('ready');
      if (onSuccess) {
        onSuccess({
          id: data.document_id, kb_id: kbId, filename: file.name,
          file_type: file.name.split('.').pop() as any, status: 'ready',
          markdown_content: null, chunk_count: data.chunk_count, created_at: new Date().toISOString()
        });
      } else {
        router.refresh(); // Refresh page data on completion
      }

      setTimeout(() => setState('idle'), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
      setState('error');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
        state === 'idle' ? 'border-[var(--border-color)] hover:border-[var(--accent-color)]' : 'border-[var(--accent-color)]'
      } bg-[#0c1510] relative`}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.xlsx,.mp3,.mp4" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <div className="flex flex-col items-center justify-center space-y-4">
        {state === 'idle' && (
          <>
            <p className="font-[family-name:var(--font-mono)] text-white">{t.dashboard.upload.dropHere}</p>
            <p className="text-[var(--muted-color)] text-xs font-[family-name:var(--font-sans)]">{t.dashboard.upload.supported}</p>
          </>
        )}
        {state === 'uploading' && <p className="font-[family-name:var(--font-mono)] text-white">{t.dashboard.upload.uploading}</p>}
        {state === 'processing' && <p className="font-[family-name:var(--font-mono)] text-[var(--accent-color)]">{t.dashboard.upload.processing}</p>}
        {state === 'ready' && <p className="font-[family-name:var(--font-mono)] text-green-400">{t.dashboard.upload.ready}</p>}
        {state === 'error' && (
          <>
            <p className="font-[family-name:var(--font-mono)] text-red-500">{t.dashboard.upload.error}</p>
            <p className="text-red-400 text-xs mt-1">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
