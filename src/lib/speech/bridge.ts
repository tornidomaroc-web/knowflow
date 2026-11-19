/**
 * THE KnowFlowSpeech PLUGIN, REACHED THE WAY KnowFlowStore IS
 * (src/lib/iap/bridge.ts): through the bridge the iOS shell injects into
 * every page, `window.Capacitor`. No `@capacitor/core` import.
 *
 * VOICE INPUT IN ASK (iOS 1.1, big item 4e). The plugin
 * (ios/App/App/KnowFlowSpeech.swift) turns the student's speech into text
 * with Apple's SFSpeechRecognizer, on the phone wherever the phone can, and
 * hands the page TEXT only: `partial` lines while the student speaks, the
 * final text at the end. No audio reaches this page or any server.
 *
 * THE DOUBLE GATE, LIKE IN-APP PRO. The shell version alone is not enough:
 * the Android shell also sends `KnowFlowApp/2` and has no recognizer, and a
 * build 9 cut before this change also says `KnowFlowApp/2` but has neither
 * the plugin nor the two purpose strings, and iOS ends an app that touches
 * the microphone without NSMicrophoneUsageDescription. The plugin is
 * registered only by the iOS shell that carries those strings
 * (MainViewController), so `isPluginAvailable('KnowFlowSpeech')` proves
 * both. A forged `KnowFlowApp/2` in a browser has no `window.Capacitor`.
 */
export const SPEECH_PLUGIN = 'KnowFlowSpeech';

/** The first shell that may show the microphone (the camera's and in-app Pro's build 9). */
export const SPEECH_SHELL_VERSION = 2;

/** Whether this shell may show the microphone: shell 2 on. Never the web (0) or build 8 (1). */
export function speechShellAllowed(shellVersion: number): boolean {
  return Number.isInteger(shellVersion) && shellVersion >= SPEECH_SHELL_VERSION;
}

export type SpeechMethod = 'availability' | 'start' | 'stop' | 'openSettings';
export type SpeechEvent = 'partial' | 'end';

export type SpeechBridge = {
  call: (method: SpeechMethod, options?: object) => Promise<unknown>;
  /** Returns the function that removes the listener. */
  listen: (event: SpeechEvent, cb: (data: Record<string, unknown>) => void) => () => void;
};

type Handle = { remove?: () => unknown } | Promise<{ remove?: () => unknown }> | undefined;

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
  addListener?: (plugin: string, event: string, cb: (data: unknown) => void) => Handle;
};

export function speechBridge(): SpeechBridge | null {
  const C = (globalThis as { Capacitor?: NativeBridge }).Capacitor;
  if (!C?.isNativePlatform?.()) return null;
  if (!C.getPlatform || C.getPlatform() !== 'ios') return null;
  if (!C.isPluginAvailable?.(SPEECH_PLUGIN) || !C.nativePromise || !C.addListener) return null;
  const native = C.nativePromise;
  const add = C.addListener;
  return {
    call: (method, options) => native(SPEECH_PLUGIN, method, options ?? {}),
    listen: (event, cb) => {
      const handle = add(SPEECH_PLUGIN, event, (d) => cb(d && typeof d === 'object' ? (d as Record<string, unknown>) : {}));
      return () => {
        // Capacitor's bridge answers with the handle itself; a promise is
        // allowed for, and removed once it resolves.
        if (handle && typeof (handle as { remove?: unknown }).remove === 'function') (handle as { remove: () => unknown }).remove();
        else Promise.resolve(handle).then((h) => h?.remove?.()).catch(() => {});
      };
    },
  };
}
