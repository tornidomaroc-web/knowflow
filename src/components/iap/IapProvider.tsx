'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { storeBridge } from '@/lib/iap/bridge';
import { postVerify, syncPending, type NativeCall } from '@/lib/iap/flow';

/**
 * IN-APP PRO'S CONTEXT (iOS 1.1, item 4d). Mounted by the dashboard layout
 * ONLY when `iapAllowed(shell)` (src/lib/platform.ts): shell 2 on, never the
 * web or build 8, so those two render exactly the tree they rendered before.
 *
 * `offer`: the account is not Pro, so an entry point may show. `userId`
 * becomes the purchase's appAccountToken.
 *
 * Inside, every purchase control ALSO needs the native plugin
 * (`useStore()`), read after mount: the server cannot know whether this web
 * view has it (the Android shell sends `KnowFlowApp/2` and has none), so
 * nothing purchase-related is in the server markup; it appears once the
 * plugin answers.
 */
interface IapContextValue {
  userId: string;
  offer: boolean;
  locale: string;
  /** The refusal button's words (dashboard.iap.offerButton), so no refusal surface has to carry them. */
  offerLabel: string;
  /** Design previews only: render as if the plugin were present. */
  preview?: boolean;
}

const IapContext = createContext<IapContextValue | null>(null);

export function IapProvider({ userId, offer, locale, offerLabel, preview, children }: IapContextValue & { children: ReactNode }) {
  return (
    <IapContext.Provider value={{ userId, offer, locale, offerLabel, preview }}>
      {!preview && <IapSync />}
      {children}
    </IapContext.Provider>
  );
}

export function useIap(): IapContextValue | null {
  return useContext(IapContext);
}

/** The plugin's call, or null: always null on the server and before mount. */
export function useStore(): { call: NativeCall | null; ready: boolean } {
  const [state, setState] = useState<{ call: NativeCall | null; ready: boolean }>({ call: null, ready: false });
  useEffect(() => {
    setState({ call: storeBridge(), ready: true });
  }, []);
  return state;
}

/**
 * Transaction.updates and Transaction.unfinished, verified at launch: the
 * plugin's listener (started when the shell loads it) keeps what StoreKit
 * delivered; this asks for it once per dashboard load, verifies each with the
 * server and finishes it on 200 only (src/lib/iap/flow.ts). Renders nothing.
 */
function IapSync() {
  const router = useRouter();
  useEffect(() => {
    const call = storeBridge();
    if (!call) return;
    let gone = false;
    syncPending({ call, verify: (jws) => postVerify(jws) }).then((pro) => {
      if (pro && !gone) router.refresh();
    });
    return () => {
      gone = true;
    };
  }, [router]);
  return null;
}
