'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/Button';

interface ContactActionsLabels {
  emailButton: string;
  copyButton: string;
  copied: string;
  copyFailed: string;
}

/**
 * The two ways to reach the support address (register #19). The first is a
 * plain `mailto:` link, styled as a button, which opens whatever mail app the
 * device has. On a device with none, or with the link handler blocked, that
 * press does nothing visible, so the second way exists: copy the address, with
 * a confirmation the student can read, and a sentence for the case where the
 * clipboard itself is refused. The address is also printed in plain text on the
 * page, so a student who can do neither can still read it and type it.
 */
export function ContactActions({ email, labels }: { email: string; labels: ContactActionsLabels }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <a href={`mailto:${email}`} className={buttonVariants({ variant: 'primary' })}>
          {labels.emailButton}
        </a>
        <button type="button" onClick={copy} className={buttonVariants({ variant: 'secondary' })}>
          {labels.copyButton}
        </button>
      </div>
      {status !== 'idle' && (
        <p role="status" className={`text-sm ${status === 'copied' ? 'text-primary' : 'text-danger'}`}>
          {status === 'copied' ? labels.copied : labels.copyFailed}
        </p>
      )}
    </div>
  );
}
