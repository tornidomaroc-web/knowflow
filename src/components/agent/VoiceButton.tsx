'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ClayMic, ClayStop } from '@/components/clay/ClayIcons';
import { usePlatform, useShellVersion } from '@/components/platform/PlatformProvider';
import { speechBridge, speechShellAllowed, type SpeechBridge } from '@/lib/speech/bridge';
import { parseAvailability, speechLocaleFor, takeOutcome, SPEECH_LOCALES, type SpeechLocale, type TakeEnd, type VoiceError } from '@/lib/speech/merge';
import { startTake } from '@/lib/speech/take';
import type { useTranslation } from '@/lib/i18n';

type Labels = ReturnType<typeof useTranslation>['dashboard']['agent']['voice'];
type Phase = 'hidden' | 'idle' | 'starting' | 'recording' | 'stopping';
type Line = 'check' | VoiceError | null;

/**
 * VOICE INPUT IN ASK (iOS 1.1, big item 4e): the microphone in the composer
 * row and the line above the field.
 *
 * WHERE IT SHOWS. Only in the app, at shell 2 or later, and only when the
 * KnowFlowSpeech plugin answers (src/lib/speech/bridge.ts): never on the web,
 * in build 8, in the Android shell or in a browser with a forged user agent.
 * Nothing is drawn until after mount and until `availability` answers, so
 * the server HTML is the same for every shell (scripts/verify-voice-input.mjs
 * section 7; design-c check 22).
 *
 * WHAT A TAKE DOES. The first tap asks iOS for speech recognition, then the
 * microphone (the two system alerts carry our purpose strings). While the
 * student speaks, the words show in the line above the field, not in the
 * field, so a cancelled take leaves the field as it was. When the take ends
 * (a tap, ~3 s of silence, 60 s, the app left, a call) the text is APPENDED
 * to the field through `onTranscript` and the line asks the student to check
 * it. It is NEVER sent: Send stays the student's tap.
 */
export function VoiceButton({ uiLocale, labels, onTranscript, lineSlot, resetKey }: {
  uiLocale: string;
  labels: Labels;
  onTranscript: (take: string) => void;
  /** Where the line above the field is drawn (an empty element ChatBox keeps above the row). */
  lineSlot: RefObject<HTMLElement | null>;
  /** Changes when a message is sent: the last take's line is cleared. */
  resetKey?: number;
}) {
  const platform = usePlatform();
  const shell = useShellVersion();
  const [bridge, setBridge] = useState<SpeechBridge | null>(null);
  const [phase, setPhase] = useState<Phase>('hidden');
  const [lang, setLang] = useState<SpeechLocale>(() => speechLocaleFor(uiLocale));
  const [partial, setPartial] = useState('');
  const [line, setLine] = useState<Line>(null);
  const [seconds, setSeconds] = useState(0);
  const take = useRef<{ stop: () => Promise<void>; cancel: () => Promise<void> } | null>(null);

  // After mount only: the shell the server read, then the plugin itself.
  useEffect(() => {
    if (platform !== 'native' || !speechShellAllowed(shell)) return;
    const b = speechBridge();
    if (!b) return;
    let live = true;
    b.call('availability', { locale: speechLocaleFor(uiLocale) })
      .then((raw) => {
        if (live && parseAvailability(raw)) {
          setBridge(b);
          setPhase('idle');
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [platform, shell, uiLocale]);

  // Leaving the screen mid-take: the take is cancelled, nothing reaches a field.
  useEffect(() => () => {
    take.current?.cancel();
    take.current = null;
  }, []);

  // A question was sent: the last take's line has done its job.
  useEffect(() => {
    setLine(null);
  }, [resetKey]);

  // The seconds counter while listening (the plugin itself stops at 60 s).
  useEffect(() => {
    if (phase !== 'recording') return;
    setSeconds(0);
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const onEnd = useCallback((end: TakeEnd) => {
    take.current = null;
    setPartial('');
    setPhase('idle');
    const out = takeOutcome(end);
    if (out.append) onTranscript(out.append);
    setLine(out.message);
  }, [onTranscript]);

  const begin = useCallback(async (locale: SpeechLocale) => {
    if (!bridge) return;
    setLine(null);
    setPartial('');
    setPhase('starting');
    const t = await startTake(bridge, locale, setPartial, onEnd);
    if ('error' in t) {
      setPhase('idle');
      setLine(t.error);
      return;
    }
    take.current = t;
    setPhase('recording');
  }, [bridge, onEnd]);

  const press = () => {
    if (phase === 'idle') void begin(lang);
    else if (phase === 'recording' && take.current) {
      setPhase('stopping');
      void take.current.stop();
    }
  };

  // The language chip: the next take's language; mid-take, the take is
  // dropped (its words were heard in the wrong language) and a new one starts.
  const switchLang = async () => {
    const next: SpeechLocale = lang === SPEECH_LOCALES.ar ? SPEECH_LOCALES.en : SPEECH_LOCALES.ar;
    setLang(next);
    if (phase === 'recording' && take.current) {
      const t = take.current;
      take.current = null;
      setPhase('stopping');
      await t.cancel();
      void begin(next);
    } else {
      setLine(null);
    }
  };

  if (phase === 'hidden' || !bridge) return null;
  const listening = phase === 'recording' || phase === 'stopping';
  const busy = phase === 'starting' || phase === 'stopping';
  const langName = lang === SPEECH_LOCALES.ar ? labels.langAr : labels.langEn;
  const showChip = listening || line === 'unsupported';
  const slot = lineSlot.current;

  const lineView = (listening || line) && slot ? createPortal(
    <div
      data-kf-voice-line=""
      data-kf-voice-message={listening ? 'listening' : line ?? undefined}
      role="status"
      aria-live="polite"
      className="mb-2 flex flex-col gap-1 rounded-2xl bg-background px-3 py-2 text-sm text-foreground"
    >
      <p data-kf-voice-text="" className="[text-wrap:pretty]">
        {listening ? labels.listening : line ? labels[line] : null}
        {listening && <span className="ms-2 whitespace-nowrap font-semibold tabular-nums text-muted-foreground" data-kf-voice-seconds="">{labels.seconds.replace('{n}', String(seconds))}</span>}
      </p>
      {listening && partial && (
        <p data-kf-voice-partial="" dir="auto" className="line-clamp-3 text-muted-foreground">{partial}</p>
      )}
      {/* The control on its own row BELOW the message, at the reading start
          (right in Arabic, left in English): the message keeps the full
          width (the owner's review of PR #340: at 360 the denied sentence
          wrapped six lines beside Open Settings). Last in the line, so it
          stays put while a partial line grows above it (the composer is
          pinned to the bottom and grows upward). Design-c check 28. */}
      {(showChip || (line === 'denied' && !listening)) && (
        <div data-kf-voice-controls="" className="flex flex-wrap justify-start gap-2 pt-1">
          {showChip && (
            <button
              type="button"
              onClick={switchLang}
              disabled={busy}
              data-kf-voice-lang={lang}
              className="kf-pill pressable inline-flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-full px-4 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {langName}
            </button>
          )}
          {line === 'denied' && !listening && (
            <button
              type="button"
              onClick={() => { void bridge.call('openSettings').catch(() => {}); }}
              data-kf-voice-settings=""
              className="kf-pill pressable inline-flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-full px-4 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.openSettings}
            </button>
          )}
        </div>
      )}
    </div>,
    slot,
  ) : null;

  return (
    <>
      {lineView}
      <button
        type="button"
        onClick={press}
        disabled={busy}
        aria-label={listening ? labels.stop : labels.start}
        aria-pressed={listening}
        data-kf-voice="mic"
        data-kf-voice-state={phase}
        className={`kf-button pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${listening ? 'ring-2 ring-primary motion-safe:animate-pulse' : ''}`}
      >
        {listening ? <ClayStop /> : <ClayMic />}
      </button>
    </>
  );
}
