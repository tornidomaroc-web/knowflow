'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { MAX_MATERIAL_FILENAME_LENGTH, splitFilename } from '@/lib/material-name';
import { fileNameDirection } from '@/lib/file-name-display';

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
 * The open panel: the field, the extension beside it, the hint and the two
 * buttons. Exported on its own so the proof and the design preview can render
 * it in its editing state, which the control reaches only after a click.
 *
 * DIRECTION (register #124). The field is an `<input>`, so its text cannot be
 * split into isolates the way a label's can, and its value must stay exactly
 * what the student types: no control character is ever inserted. So the field
 * keeps `dir="auto"`, the browser's own rule, under which the caret, the
 * selection and the typing order follow the first strong letter of what is in
 * it, as they do in every native text field. What this component decides is
 * the ROW: its direction is the name's, so the extension badge sits AFTER the
 * name in reading order, at the left of an Arabic name and at the right of a
 * Latin one, and the badge itself is `ltr` so it reads ".pdf", never "pdf.".
 * That is the same order FileName gives the stored name on the card above.
 */
export function RenameMaterialFields({
  inputId,
  value,
  ext,
  busy,
  labels,
  onChange,
  onSave,
  onCancel,
}: {
  inputId: string;
  value: string;
  ext: string;
  busy: boolean;
  labels: RenameMaterialLabels;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <label htmlFor={inputId} className="block text-sm text-foreground">
        {labels.label}
      </label>
      <div className="flex items-center gap-2" dir={fileNameDirection(value)} data-rename-row="">
        <Input
          id={inputId}
          dir="auto"
          autoComplete="off"
          className="flex-1"
          value={value}
          disabled={busy}
          maxLength={Math.max(1, MAX_MATERIAL_FILENAME_LENGTH - ext.length)}
          onChange={(event) => onChange(event.target.value)}
        />
        {ext ? (
          <span dir="ltr" className="shrink-0 text-sm text-muted-foreground">
            {ext}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{labels.hint}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={busy || value.trim() === ''}>
          {busy ? labels.saving : labels.saveButton}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          {labels.cancelButton}
        </Button>
      </div>
    </div>
  );
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
          className="w-full"
          onClick={() => {
            setValue(splitFilename(filename).stem);
            setError(null);
            setOpen(true);
          }}
        >
          {labels.openButton}
        </Button>
      ) : (
        <RenameMaterialFields
          inputId={inputId}
          value={value}
          ext={ext}
          busy={busy}
          labels={labels}
          onChange={setValue}
          onSave={onSave}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
