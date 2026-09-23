'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { MAX_MATERIAL_FILENAME_LENGTH, splitFilename } from '@/lib/material-name';

export interface RenameMaterialLabels {
  openButton: string;
  label: string;
  hint: string;
  saveButton: string;
  cancelButton: string;
  saving: string;
  errorInvalid: string;
  errorNotFound: string;
  errorConflict: string;
  errorContact: string;
  errorFailed: string;
}

export interface RenameMaterialControlProps {
  documentId: string;
  /** The material's current filename, extension included. */
  filename: string;
  labels: RenameMaterialLabels;
  /** Called with the filename the SERVER returned, so the list shows what is stored. */
  onRenamed: (documentId: string, filename: string) => void;
  /** Called when the server says the material no longer exists. */
  onGone: (documentId: string) => void;
}

/**
 * Rename one material. Register #47.
 *
 * Two steps, as `DeleteMaterialControl` does it: a first click opens the panel,
 * the second saves. The student edits the name WITHOUT its extension, which is
 * shown beside the field and kept by the server (`@/lib/material-name`). The
 * browser decides nothing: `/api/documents/[id]` (PATCH) validates the name and
 * returns the filename it stored, and the list shows exactly that.
 */
export function RenameMaterialControl({
  documentId,
  filename,
  labels,
  onRenamed,
  onGone,
}: RenameMaterialControlProps) {
  const { stem, ext } = splitFilename(filename);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(stem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value }),
      });
    } catch {
      setError(labels.errorFailed);
      setBusy(false);
      return;
    }

    let body: { error?: string; filename?: string } | null = null;
    try {
      body = await response.json();
    } catch {
      /* fall through to the generic message */
    }

    if (response.ok && typeof body?.filename === 'string') {
      onRenamed(documentId, body.filename);
      setOpen(false);
      setBusy(false);
      return;
    }

    const code = body?.error ?? '';
    if (code === 'NotFound') {
      // Gone already. It should not stay listed; the row unmounts with it.
      setError(labels.errorNotFound);
      onGone(documentId);
      return;
    }
    if (code === 'InvalidName') {
      setError(labels.errorInvalid);
    } else if (code === 'Conflict') {
      setError(labels.errorConflict);
    } else if (code === 'PathTaken' || code === 'StorageKeyUnresolvable') {
      // PERMANENT: a retry would fail identically, so "try again" would be false.
      setError(labels.errorContact);
      setOpen(false);
    } else {
      setError(labels.errorFailed);
    }
    setBusy(false);
  }

  const inputId = `rename-${documentId}`;

  return (
    <div className={open ? 'w-full' : undefined}>
      {!open ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setValue(splitFilename(filename).stem);
            setError(null);
            setOpen(true);
          }}
        >
          {labels.openButton}
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <label htmlFor={inputId} className="block text-sm text-foreground">
            {labels.label}
          </label>
          {/* LTR on the row so the extension always sits after the name; the
              field itself is `auto`, so an Arabic name still reads right to left. */}
          <div className="flex items-center gap-2" dir="ltr">
            <Input
              id={inputId}
              dir="auto"
              autoComplete="off"
              className="flex-1"
              value={value}
              disabled={busy}
              maxLength={Math.max(1, MAX_MATERIAL_FILENAME_LENGTH - ext.length)}
              onChange={(event) => setValue(event.target.value)}
            />
            {ext ? <span className="shrink-0 text-sm text-muted-foreground">{ext}</span> : null}
          </div>
          <p className="text-xs text-muted-foreground">{labels.hint}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onSave} disabled={busy || value.trim() === ''}>
              {busy ? labels.saving : labels.saveButton}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {labels.cancelButton}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
