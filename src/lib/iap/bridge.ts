import type { NativeCall } from './flow';

/**
 * THE KnowFlowStore PLUGIN, REACHED THE WAY THE REMINDER REACHES ITS PLUGIN
 * (src/components/reminder/StudyReminderCard.tsx): through the bridge the iOS
 * shell injects into every page, `window.Capacitor.nativePromise`. No
 * `@capacitor/core` import: inside the app that path is the one ios-smoke
 * proves, and on the web there is simply no bridge.
 *
 * The plugin is registered only by the iOS shell (MainViewController,
 * `registerPluginInstance`), so `isPluginAvailable('KnowFlowStore')` is false
 * on the web, in build 8 and in the Android shell (which also sends
 * `KnowFlowApp/2`): every purchase control asks this before it shows.
 */
export const IAP_PLUGIN = 'KnowFlowStore';

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
};

export function storeBridge(): NativeCall | null {
  const C = (globalThis as { Capacitor?: NativeBridge }).Capacitor;
  if (!C?.isNativePlatform?.()) return null;
  if (C.getPlatform && C.getPlatform() !== 'ios') return null;
  if (!C.isPluginAvailable?.(IAP_PLUGIN) || !C.nativePromise) return null;
  const native = C.nativePromise;
  return (method, options) => native(IAP_PLUGIN, method, options ?? {});
}
