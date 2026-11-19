import type { SpeechBridge } from './bridge';
import { parseEnd, parseStart, type SpeechLocale, type TakeEnd, type VoiceError } from './merge';

/**
 * ONE TAKE: start the plugin, pass its partial lines on, end exactly once.
 *
 * A take ends either because the student tapped stop (`stop()`, whose answer
 * carries the final text) or because the plugin ended it itself (60 s, ~3 s
 * of silence, the app left, an audio interruption, an error): it then sends
 * an `end` event. The native side sends `end` on a tap too, so `onEnd` is
 * guarded to fire once. `cancel()` ends a take whose text must NOT reach the
 * field (the language was switched mid-take, the screen was left).
 *
 * Nothing here sends anything anywhere: the only calls are to the plugin.
 */
export type Take = { ok: true; stop: () => Promise<void>; cancel: () => Promise<void> } | { ok: false; error: VoiceError };

export async function startTake(
  bridge: SpeechBridge,
  locale: SpeechLocale,
  onPartial: (text: string) => void,
  onEnd: (end: TakeEnd) => void,
): Promise<Take> {
  let done = false;
  let cancelled = false;
  const offs: Array<() => void> = [];
  const finish = (end: TakeEnd) => {
    if (done) return;
    done = true;
    offs.forEach((off) => off());
    if (!cancelled) onEnd(end);
  };
  offs.push(bridge.listen('partial', (d) => { if (!done && typeof d.text === 'string') onPartial(d.text); }));
  offs.push(bridge.listen('end', (d) => finish(parseEnd(d))));
  let started;
  try {
    started = parseStart(await bridge.call('start', { locale }));
  } catch {
    started = parseStart(null);
  }
  if (!started.started) {
    done = true;
    offs.forEach((off) => off());
    return { ok: false, error: started.error };
  }
  const stop = async () => {
    if (done) return;
    try {
      finish(parseEnd(await bridge.call('stop', {})));
    } catch {
      finish({ text: '', reason: 'error', error: 'failed' });
    }
  };
  return {
    ok: true,
    stop,
    cancel: async () => {
      cancelled = true;
      await stop();
      done = true;
      offs.forEach((off) => off());
    },
  };
}
