/**
 * VOICE INPUT IN ASK: the pure rules (no React, no bridge), so
 * scripts/verify-voice-input.mjs can hold them without a phone.
 *
 * THE RULE THAT MATTERS: a transcript is APPENDED to the field and NEVER sent
 * by itself. An Arabic misrecognition sent unread would spend one of the
 * day's questions on a wrong answer; the student reads the text, edits it,
 * and taps Send, which goes through the same consent, cap and counter as
 * typed text (src/app/api/agent/route.ts is unchanged).
 */

/** The recognition language a screen starts with: the UI's own. */
export const SPEECH_LOCALES = { ar: 'ar-SA', en: 'en-US' } as const;
export type SpeechLocale = (typeof SPEECH_LOCALES)[keyof typeof SPEECH_LOCALES];

export function speechLocaleFor(uiLocale: string): SpeechLocale {
  return uiLocale === 'ar' ? SPEECH_LOCALES.ar : SPEECH_LOCALES.en;
}

/**
 * The field after a take. An empty (or white-space-only) field takes the
 * take; otherwise one space joins them, unless the field already ends in
 * white space (a space or a newline the student typed is kept). A take with
 * no words changes nothing. Nothing is cut: the 4,000-character cap is the
 * server's, and its 413 puts the whole question back in the field.
 */
export function appendTranscript(field: string, take: string): string {
  const t = take.replace(/\s+/g, ' ').trim();
  if (!t) return field;
  if (!field.trim()) return t;
  return /\s$/.test(field) ? field + t : `${field} ${t}`;
}

/** The lines a take can end on, each a key of dashboard.agent.voice. */
export const VOICE_ERRORS = ['denied', 'noSpeech', 'unsupported', 'failed', 'limit'] as const;
export type VoiceError = (typeof VOICE_ERRORS)[number];

export type StartResult = { started: true; onDevice: boolean } | { started: false; error: VoiceError };

/** The plugin's answer to start(). `busy` (a take already running) reads as failed. */
export function parseStart(raw: unknown): StartResult {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (r?.started === true) return { started: true, onDevice: r.onDevice === true };
  const e = r?.error;
  const error: VoiceError = e === 'denied' || e === 'unsupported' ? e : 'failed';
  return { started: false, error };
}

/** Why a take ended: the student's tap, ~3 s of silence, 60 s, the app left, a call, or an error. */
export type EndReason = 'tap' | 'silence' | 'limit' | 'background' | 'interrupted' | 'error' | 'idle';
export type TakeEnd = { text: string; reason: EndReason; error?: 'noSpeech' | 'failed' };

const REASONS: EndReason[] = ['tap', 'silence', 'limit', 'background', 'interrupted', 'error', 'idle'];

export function parseEnd(raw: unknown): TakeEnd {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r) return { text: '', reason: 'error', error: 'failed' };
  const text = typeof r.text === 'string' ? r.text : '';
  const reason = REASONS.includes(r.reason as EndReason) ? (r.reason as EndReason) : 'error';
  const error = r.error === 'noSpeech' || r.error === 'failed' ? r.error : undefined;
  return error ? { text, reason, error } : { text, reason };
}

/**
 * What a finished take does: the text to append (maybe none) and the line
 * that shows above the field. Text heard is always kept, even when the
 * recognizer then failed; `check` asks the student to read it before sending.
 */
export function takeOutcome(end: TakeEnd): { append: string; message: 'check' | VoiceError } {
  const append = end.text.replace(/\s+/g, ' ').trim();
  if (!append) return { append: '', message: end.error === 'failed' ? 'failed' : 'noSpeech' };
  return { append, message: end.reason === 'limit' ? 'limit' : 'check' };
}

/** availability(): read for its shape only; the microphone shows once the plugin answers. */
export function parseAvailability(raw: unknown): { supported: boolean; onDevice: boolean; speech: string; mic: string } | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r || typeof r.supported !== 'boolean') return null;
  return {
    supported: r.supported,
    onDevice: r.onDevice === true,
    speech: typeof r.speech === 'string' ? r.speech : 'unknown',
    mic: typeof r.mic === 'string' ? r.mic : 'unknown',
  };
}
