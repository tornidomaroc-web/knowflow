'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAiConsent } from './AiConsentProvider';

/**
 * Settings: the permission of Apple 5.1.2(i), shown as it stands on the
 * account, with the one button that changes it. Withdrawing writes the account
 * at once; giving it again opens the same sheet as the first upload, so the
 * student reads the same disclosure every time they agree.
 */
export function AiConsentCard() {
  const { consented, ensure, withdraw, labels } = useAiConsent();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!labels) return null;

  const onWithdraw = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await withdraw();
    setFailed(!ok);
    setBusy(false);
  };

  return (
    <Card className="p-5" data-kf-consent-state={consented ? 'on' : 'off'}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="section-icon inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-subtle text-sky">
          <Sparkles className="h-4 w-4" />
        </span>
        {labels.heading}
      </h2>
      <p className="mt-3 text-sm text-foreground">{consented ? labels.stateOn : labels.stateOff}</p>
      {failed && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {labels.withdrawFailed}
        </p>
      )}
      <div className="mt-4">
        {consented ? (
          <Button variant="secondary" data-kf-consent="withdraw" onClick={onWithdraw} disabled={busy}>
            {labels.withdrawButton}
          </Button>
        ) : (
          <Button data-kf-consent="allow" onClick={() => void ensure()}>
            {labels.allowButton}
          </Button>
        )}
      </div>
    </Card>
  );
}
