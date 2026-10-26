'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Card } from '@/components/ui';
import type { useTranslation } from '@/lib/i18n';
import {
  DEFAULT_REMINDER_TIME,
  STUDY_REMINDER_ID,
  formatReminderTime,
  formatReminderClock,
  parseReminderTime,
  studyReminderNotification,
} from '@/lib/study-reminder';

export type StudyReminderLabels = ReturnType<typeof useTranslation>['dashboard']['studyReminder'];

type Phase = 'checking' | 'unavailable' | 'off' | 'on';

type NativeBridge = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
};
type Call = (method: string, options?: object) => Promise<unknown>;

// The plugin is called through the bridge the iOS shell injects into every
// page (`window.Capacitor.nativePromise`), the exact path ios-smoke.yml's
// proof 6 exercises on the live site. The first version loaded
// `@capacitor/core` and the plugin's JavaScript on demand instead, and inside
// the app that card never appeared (ios-signed-in run 37955757461). On the
// web there is no bridge; in an app build without the plugin (build 1) the
// bridge does not list it. Either way the card does not render, and says why
// in a hidden attribute that the signed-in run reads.
function plugin(): { call: Call | null; why: string } {
  const C = (globalThis as { Capacitor?: NativeBridge }).Capacitor;
  if (!C) return { call: null, why: 'no bridge' };
  if (!C.isNativePlatform?.()) return { call: null, why: 'not native' };
  if (!C.isPluginAvailable?.('LocalNotifications')) return { call: null, why: 'plugin missing' };
  if (!C.nativePromise) return { call: null, why: 'no nativePromise' };
  const native = C.nativePromise;
  return { call: (method, options) => native('LocalNotifications', method, options ?? {}), why: '' };
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
  const [why, setWhy] = useState('');

  const words = { title: labels.notificationTitle, body: labels.notificationBody };

  // What the phone holds now. A reminder saved in the other language is saved
  // again in this one, which needs no permission (it was granted to save it).
  useEffect(() => {
    if (preview) return;
    let gone = false;
    (async () => {
      try {
        const { call: ln, why: missing } = plugin();
        if (!ln) { if (!gone) { setWhy(missing); setPhase('unavailable'); } return; }
        const pending = (await ln('getPending')) as { notifications: { id: number; extra?: unknown }[] };
        const mine = pending.notifications.find((n) => n.id === STUDY_REMINDER_ID);
        if (!mine) { if (!gone) setPhase('off'); return; }
        const extra = (mine.extra ?? {}) as { hour?: number; minute?: number; locale?: string };
        const hour = typeof extra.hour === 'number' ? extra.hour : 19;
        const minute = typeof extra.minute === 'number' ? extra.minute : 0;
        if (extra.locale !== locale) {
          await ln('schedule', { notifications: [studyReminderNotification(hour, minute, words, locale)] });
        }
        if (!gone) { setTime(formatReminderTime(hour, minute)); setPhase('on'); }
      } catch (e) {
        if (!gone) { setWhy('error: ' + String((e as Error)?.message ?? e).slice(0, 80)); setPhase('unavailable'); }
      }
    })();
    return () => { gone = true; };
    // `words` follows `locale`; reading the phone once per locale is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, preview]);

  const save = useCallback(async (value: string) => {
    const at = parseReminderTime(value);
    const ln = plugin().call;
    if (!at || !ln) throw new Error('unavailable');
    await ln('schedule', { notifications: [studyReminderNotification(at.hour, at.minute, words, locale)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, labels]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const ln = plugin().call;
      if (!ln) throw new Error('unavailable');
      // The one place the permission is asked: this tap.
      let status = ((await ln('checkPermissions')) as { display: string }).display;
      if (status !== 'granted' && status !== 'denied') status = ((await ln('requestPermissions')) as { display: string }).display;
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
      const ln = plugin().call;
      if (!ln) throw new Error('unavailable');
      await ln('cancel', { notifications: [{ id: STUDY_REMINDER_ID }] });
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

  if (phase === 'checking') return null;
  if (phase === 'unavailable') return <span hidden data-kf-reminder-state="unavailable" data-kf-reminder-why={why} />;
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
          // Step Redesign-2: the button is the 44 pt hit area; the track is the
          // span inside it, and the clay rules give the track a control boundary
          // and the thumb its own 3:1 bead (globals.css, .kf-switch-*).
          className="relative inline-flex h-11 w-16 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`kf-switch-track relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted ring-1 ring-inset ring-border'}`}
          >
            <span
              className={`kf-switch-thumb inline-block h-6 w-6 rounded-full bg-surface shadow-soft transition-transform ${on ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'}`}
            />
          </span>
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="kf-reminder-time" className="text-sm text-foreground">{labels.timeLabel}</label>
        {/*
          Step Redesign-3. A native `<input type="time">` draws its own text in
          the ENGINE's locale, not the page's: the CI render of /ar showed
          "07:00 PM" (headless Chromium is en-US), and an iPhone set to English
          does the same inside the Arabic app. No `Intl` call can reach that
          text. So the time the student reads is ours, formatted with an
          explicit locale (formatReminderClock: "7:00 م" / "7:00 pm"), and the
          real input lies over it, transparent and the same size, so a tap
          still opens the system picker and the value, the label and the
          data attribute the signed-in run sets are unchanged. Invisible as it
          is, the input is 16 px below md: iOS decides its focus zoom by the
          field's own font size (Guideline 4.0; see AuthField.tsx).
        */}
        <span className="kf-reminder-clock relative inline-flex h-11 min-w-[6.5rem] items-center justify-center rounded-xl border border-control-border bg-raised px-3 text-sm tabular-nums text-foreground">
          <span aria-hidden="true" data-kf-reminder-clock="">{formatReminderClock(time, locale === 'ar' ? 'ar' : 'en')}</span>
          <input
            id="kf-reminder-time"
            type="time"
            step={60}
            dir="ltr"
            value={time}
            disabled={busy}
            data-kf-reminder="time"
            onChange={(e) => void changeTime(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl text-base opacity-0 md:text-sm"
          />
        </span>
      </div>
      <p className="mt-3 text-sm text-foreground" aria-live="polite">
        {/* Step Redesign-2: the clock as a student reads it, "7:00 م" / "7:00 pm". */}
        {on ? labels.stateOn.replace('{time}', formatReminderClock(time, locale === 'ar' ? 'ar' : 'en')) : labels.stateOff}
      </p>
      {message && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">{message}</p>
      )}
    </Card>
  );
}
