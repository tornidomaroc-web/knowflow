/**
 * THE DAILY STUDY REMINDER (STORE_PATH.md S3(a), Apple guideline 4.2).
 *
 * A local notification scheduled on the phone by `@capacitor/local-notifications`:
 * no server, no push certificate, no APNs, and nothing about it leaves the
 * device. It exists only in the iOS app (`studyReminderAllowed` below, read
 * from the request's platform marker, and the card also checks that the app
 * build carries the plugin), it is OFF until the student turns it on, and the
 * notification permission is asked only at that tap, never at launch.
 *
 * The phone is the only record: the card reads the pending notification back
 * (`getPending`) to show whether the reminder is on and at what time. Nothing
 * is stored on the account, so a reinstall starts with it off.
 */
import type { Platform } from '@/lib/platform';

/** One fixed id: turning the reminder off cancels exactly this one. */
export const STUDY_REMINDER_ID = 7001;

export const DEFAULT_REMINDER_TIME = '19:00';

export function studyReminderAllowed(platform: Platform): boolean {
  return platform === 'native';
}

/** "HH:MM" from an `<input type="time">`, or null when it is not a time. */
export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * The one notification, repeating every day at hour:minute (the plugin turns
 * `schedule.on` into a repeating calendar trigger). Its words are the
 * student's language at the moment it was saved; the card saves it again when
 * Settings is opened in the other language.
 */
export function studyReminderNotification(
  hour: number,
  minute: number,
  words: { title: string; body: string },
  locale: string,
) {
  return {
    id: STUDY_REMINDER_ID,
    title: words.title,
    body: words.body,
    schedule: { on: { hour, minute }, allowWhileIdle: true },
    extra: { kind: 'study-reminder', hour, minute, locale },
  };
}
