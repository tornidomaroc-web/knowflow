'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export interface DeleteMaterialLabels {
  openButton: string;
  warning: string;
  answersKept: string;
  confirmButton: string;
  cancelButton: string;
  deleting: string;
  errorNotFound: string;
  errorFailed: string;
  errorContact: string;
}

export interface DeleteMaterialControlProps {
  documentId: string;
  labels: DeleteMaterialLabels;
  /** Called once the material no longer exists, so the list can drop it. */
  onDeleted: (documentId: string) => void;
}

/**
 * Delete one material. Register #47.
 *
 * Two steps, as `DeleteAccountCard` does it: the destructive control is behind a
 * first click, and what is removed AND what is kept are both on screen before
 * the second. No typed confirmation: a single material is smaller than an
 * account, and the collapse is what keeps it from being one stray tap away.
 *
 * `/api/documents/[id]` decides everything. The browser only reports the
 * outcome, and removes the row from the list only when the server says the
 * material is gone (deleted now, or already gone: 404).
 */
export function DeleteMaterialControl({ documentId, labels, onDeleted }: DeleteMaterialControlProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
    } catch {
      setError(labels.errorFailed);
      setBusy(false);
      return;
    }

    if (response.ok) {
      onDeleted(documentId);
      return;
    }

    let code = '';
    try {
      code = (await response.json())?.error ?? '';
    } catch {
      /* fall through to the generic message */
    }

    if (code === 'NotFound') {
      // Gone already (another tab, or never this user's). Either way it should
      // not stay listed. The message stays visible until the row unmounts.
      setError(labels.errorNotFound);
      onDeleted(documentId);
      return;
    }

    // PERMANENT: a retry would fail identically, so "try again" would be false.
    setError(code === 'StorageKeyUnresolvable' ? labels.errorContact : labels.errorFailed);
    setOpen(false);
    setBusy(false);
  }

  return (
    <div>
      {!open ? (
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          {labels.openButton}
        </Button>
      ) : (
        // On the row's own `bg-surface`, where `text-danger` and
        // `text-muted-foreground` are already measured; `bg-danger-subtle` under
        // muted text is a pairing nothing in globals.css has measured.
        <div className="space-y-2 rounded-xl border border-danger-border bg-surface p-3">
          <p className="text-sm font-medium text-danger">{labels.warning}</p>
          <p className="text-xs text-muted-foreground">{labels.answersKept}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
              {busy ? labels.deleting : labels.confirmButton}
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
