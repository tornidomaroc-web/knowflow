'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Document } from '@/types';

interface DropZoneProps {
  kbId: string;
  onSuccess?: (doc: Document) => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

export function DropZone({ kbId, onSuccess }: DropZoneProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 52428800) {
      setErrorMsg('File too large. Maximum size is 50MB.');
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
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');

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
            <p className="font-[family-name:var(--font-mono)] text-white">Drop files here or click to upload</p>
            <p className="text-[var(--muted-color)] text-xs font-[family-name:var(--font-sans)]">Supported: PDF, DOCX, XLSX, MP3, MP4 (Max: 50MB)</p>
          </>
        )}
        {state === 'uploading' && <p className="font-[family-name:var(--font-mono)] text-white">Uploading...</p>}
        {state === 'processing' && <p className="font-[family-name:var(--font-mono)] text-[var(--accent-color)]">Processing...</p>}
        {state === 'ready' && <p className="font-[family-name:var(--font-mono)] text-green-400">Ready ✓</p>}
        {state === 'error' && (
          <>
            <p className="font-[family-name:var(--font-mono)] text-red-500">Error</p>
            <p className="text-red-400 text-xs mt-1">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
