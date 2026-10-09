'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Card } from '@/components/ui';
import type { useTranslation } from '@/lib/i18n';
import {
  DEFAULT_REMINDER_TIME,
  STUDY_REMINDER_ID,
  formatReminderTime,
  parseReminderTime,
  studyReminderNotification,
} from '@/lib/study-reminder';

export type StudyReminderLabels = ReturnType<typeof useTranslation>['dashboard']['studyReminder'];

type Phase = 'checking' | 'unavailable' | 'off' | 'on';

// The plugin's JavaScript is loaded only here, only in the app. On the web it
// is never imported; in an app build that predates the plugin (build 1), the
// bridge does not list it and the card does not render.
async function plugin() {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

/**
 * Settings, inside the app only: the daily study reminder
 * (`src/lib/study-reminder.ts`). Off by default. Turning it on is the only
 * thing that asks iOS for the notification permission; turning it off cancels
 * the schedule; changing the time while it is on saves the new time at once.
 * `preview` renders the card with no plugin, for the design preview and the
 * proof.
 */
export function StudyReminderCard({
  labels,
  locale,
  preview,
}: {
  labels: StudyReminderLabels;
  locale: string;
  preview?: Phase;
}) {
  const [phase, setPhase] = useState<Phase>(preview ?? 'checking');
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const words = { title: labels.notificationTitle, body: labels.notificationBody };

  // What the phone holds now. A reminder saved in the other language is saved
  // again in this one, which needs no permission (it was granted to save it).
  useEffect(() => {
    if (preview) return;
    let gone = false;
    (async () => {
      try {
        const ln = await plugin();
        if (!ln) { if (!gone) setPhase('unavailable'); return; }
        const pending = await ln.getPending();
        const mine = pending.notifications.find((n) => n.id === STUDY_REMINDER_ID);
        if (!mine) { if (!gone) setPhase('off'); return; }
        const extra = (mine.extra ?? {}) as { hour?: number; minute?: number; locale?: string };
        const hour = typeof extra.hour === 'number' ? extra.hour : 19;
        const minute = typeof extra.minute === 'number' ? extra.minute : 0;
        if (extra.locale !== locale) {
          await ln.schedule({ notifications: [studyReminderNotification(hour, minute, words, locale)] });
        }
        if (!gone) { setTime(formatReminderTime(hour, minute)); setPhase('on'); }
      } catch {
        if (!gone) setPhase('unavailable');
      }
    })();
    return () => { gone = true; };
    // `words` follows `locale`; reading the phone once per locale is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, preview]);

  const save = useCallback(async (value: string) => {
    const at = parseReminderTime(value);
    const ln = await plugin();
    if (!at || !ln) throw new Error('unavailable');
    await ln.schedule({ notifications: [studyReminderNotification(at.hour, at.minute, words, locale)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, labels]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const ln = await plugin();
      if (!ln) throw new Error('unavailable');
      // The one place the permission is asked: this tap.
      let status = (await ln.checkPermissions()).display;
      if (status !== 'granted' && status !== 'denied') status = (await ln.requestPermissions()).display;
      if (status !== 'granted') { setMessage(labels.denied); setBusy(false); return; }
      await save(time);
      setPhase('on');
    } catch {
      setMessage(labels.failed);
    }
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const ln = await plugin();
      if (!ln) throw new Error('unavailable');
      await ln.cancel({ notifications: [{ id: STUDY_REMINDER_ID }] });
      setPhase('off');
    } catch {
      setMessage(labels.failed);
    }
    setBusy(false);
  };

  const changeTime = async (value: string) => {
    if (!parseReminderTime(value)) return;
    setTime(value);
    if (phase !== 'on' || preview) return;
    setBusy(true);
    setMessage(null);
    try { await save(value); } catch { setMessage(labels.failed); }
    setBusy(false);
  };

  if (phase === 'checking' || phase === 'unavailable') return null;
  const on = phase === 'on';

  return (
    <Card className="p-5" data-kf-reminder-state={phase} data-kf-reminder-time={time}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="section-icon inline-flex h-8 w-8 items-center justify-center rounded-lg bg-coral-subtle text-coral">
          <BellRing className="h-4 w-4" />
        </span>
        {labels.heading}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">{labels.description}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span id="kf-reminder-label" className="text-sm font-medium text-foreground">{labels.toggle}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="kf-reminder-label"
          data-kf-reminder="toggle"
          disabled={busy}
          onClick={on ? turnOff : turnOn}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${on ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-surface shadow-soft transition-transform ${on ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'}`}
          />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="kf-reminder-time" className="text-sm text-foreground">{labels.timeLabel}</label>
        <input
          id="kf-reminder-time"
          type="time"
          step={60}
          dir="ltr"
          value={time}
          disabled={busy}
          data-kf-reminder="time"
          onChange={(e) => void changeTime(e.target.value)}
          className="h-11 rounded-xl border border-border bg-raised px-3 text-sm tabular-nums text-foreground"
        />
      </div>
      <p className="mt-3 text-sm text-foreground" aria-live="polite">
        {on ? labels.stateOn.replace('{time}', time) : labels.stateOff}
      </p>
      {message && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">{message}</p>
      )}
    </Card>
  );
}
