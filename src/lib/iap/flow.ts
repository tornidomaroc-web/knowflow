/**
 * IN-APP PRO, THE APP HALF: WHAT A PURCHASE OR A RESTORE BECOMES ON SCREEN
 * (iOS 1.1, item 4d; the server half is #337, `/api/apple/iap/verify`).
 *
 * Pure of React and of the network: the native plugin and `fetch` are handed
 * in (`IapDeps`), so scripts/verify-iap-app.mjs drives every path with fakes.
 *
 * THE ONE RULE THIS FILE EXISTS TO HOLD: `finish()` is called on a transaction
 * ONLY after the server answered 200 for it. Until then StoreKit keeps it
 * unfinished and hands it back (`Transaction.unfinished` and
 * `Transaction.updates`, read by the plugin's `pending`), so a purchase whose
 * verify failed, or whose app was killed between paying and verifying, is
 * verified again at the next launch (`syncPending`) instead of being lost.
 *
 * A permanent refusal (409 other-account, 403 not-this-account) also leaves the
 * transaction unfinished, as the owner's rule says. The cost, stated: such a
 * transaction is sent again at every launch and refused again (one POST per
 * launch, nothing granted, no message shown by the background sync). The
 * alternative, finishing it, would make StoreKit stop reporting a purchase
 * the student did pay for.
 */

/** The one product (src/lib/apple-iap/rules.ts, APPLE_PRO_PRODUCT_ID; same bytes). */
export const IAP_PRODUCT_ID = 'com.knowflow.app.pro.monthly';

/** The server route of #337. */
export const IAP_VERIFY_PATH = '/api/apple/iap/verify';

export type PaywallState =
  | 'loading'
  | 'unavailable'
  | 'ready'
  | 'purchasing'
  | 'pending'
  | 'success'
  | 'failed'
  | 'verify-failed'
  | 'restoring'
  | 'restore-none'
  | 'restore-failed'
  | 'other-account'
  | 'not-this-account'
  | 'pro-apple'
  | 'pro-web';

export const PAYWALL_STATES: readonly PaywallState[] = [
  'loading', 'unavailable', 'ready', 'purchasing', 'pending', 'success', 'failed', 'verify-failed',
  'restoring', 'restore-none', 'restore-failed', 'other-account', 'not-this-account', 'pro-apple', 'pro-web',
];

/** One transaction as the plugin reports it: its JWS and its id. */
export interface NativeTransaction {
  jws: string;
  transactionId: string;
}

export type PurchaseOutcome =
  | ({ outcome: 'purchased' } & NativeTransaction)
  | { outcome: 'pending' }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; message?: string };

export interface StoreProduct {
  id: string;
  /** StoreKit's own localized price ("$9.99", "9,99 €", "٣٫٦٧ ر.س."). Never computed here. */
  displayPrice: string;
}

/** The calls the plugin answers (ios/App/App/KnowFlowStore.swift). */
export type NativeCall = (method: string, options?: Record<string, unknown>) => Promise<unknown>;

/** What a POST to the verify route answered. */
export interface VerifyReply {
  status: number;
  body: { error?: string; tier?: string; applied?: boolean } | null;
}

export interface IapDeps {
  call: NativeCall;
  verify: (jws: string) => Promise<VerifyReply>;
}

/** The verify route, through the page's own session cookie (same origin). */
export async function postVerify(jws: string, fetcher: typeof fetch = fetch): Promise<VerifyReply> {
  try {
    const res = await fetcher(IAP_VERIFY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction: jws }),
      credentials: 'same-origin',
    });
    let body: VerifyReply['body'] = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

/** The price, or null when the product cannot be offered (no agreement yet, no network, not this store). */
export async function loadProduct(call: NativeCall): Promise<StoreProduct | null> {
  try {
    const reply = (await call('products', { ids: [IAP_PRODUCT_ID] })) as { products?: StoreProduct[] } | null;
    const p = reply?.products?.find((x) => x?.id === IAP_PRODUCT_ID);
    return p && typeof p.displayPrice === 'string' && p.displayPrice.trim() ? p : null;
  } catch {
    return null;
  }
}

/**
 * One transaction to the server, and `finish` only on 200. Returns the state
 * the answer means. A 200 whose tier is not Pro (an expired subscription
 * restored) is still finished: the server has recorded it.
 */
export async function verifyThenFinish(tx: NativeTransaction, deps: IapDeps): Promise<PaywallState> {
  const reply = await deps.verify(tx.jws);
  if (reply.status === 200) {
    try {
      await deps.call('finish', { transactionId: tx.transactionId });
    } catch {
      // Unfinished is safe: StoreKit hands it back and the next sync finishes it.
    }
    return reply.body?.tier === 'pro' ? 'success' : 'restore-none';
  }
  if (reply.status === 409 && reply.body?.error === 'other-account') return 'other-account';
  if (reply.status === 403 && reply.body?.error === 'not-this-account') return 'not-this-account';
  // 0 (no network), 401, 403 environment-not-allowed, 400, 422, 500: the App
  // Store took the payment and Pro is not on yet. Unfinished, so it is retried.
  return 'verify-failed';
}

/** Subscribe. `userId` becomes the transaction's appAccountToken, which the server requires. */
export async function purchaseFlow(userId: string, deps: IapDeps): Promise<PaywallState> {
  let r: PurchaseOutcome;
  try {
    r = (await deps.call('purchase', { productId: IAP_PRODUCT_ID, appAccountToken: userId })) as PurchaseOutcome;
  } catch {
    return 'failed';
  }
  switch (r?.outcome) {
    case 'purchased':
      if (typeof r.jws !== 'string' || !r.jws || typeof r.transactionId !== 'string') return 'verify-failed';
      return verifyThenFinish(r, deps);
    case 'pending':
      return 'pending';
    case 'cancelled':
      return 'ready';
    default:
      return 'failed';
  }
}

/** Restore Purchases: AppStore.sync, then every current Pro entitlement to the server. */
export async function restoreFlow(deps: IapDeps): Promise<PaywallState> {
  let txs: NativeTransaction[];
  try {
    const reply = (await deps.call('restore')) as { transactions?: NativeTransaction[] } | null;
    txs = (reply?.transactions ?? []).filter((t) => typeof t?.jws === 'string' && t.jws);
  } catch {
    // Its own state: 'failed' is the purchase's ("you were not charged"), wrong after a restore.
    return 'restore-failed';
  }
  if (!txs.length) return 'restore-none';
  // The most telling answer wins: Pro on, else the account mismatch, else none.
  const results: PaywallState[] = [];
  for (const tx of txs) results.push(await verifyThenFinish(tx, deps));
  for (const s of ['success', 'other-account', 'not-this-account', 'verify-failed'] as PaywallState[]) {
    if (results.includes(s)) return s;
  }
  return 'restore-none';
}

/**
 * At every app launch (IapSync, in the dashboard of shell 2): the
 * transactions StoreKit holds unfinished or delivered since (renewals,
 * Ask to Buy approvals, a purchase made on another device), each verified and
 * finished on 200. Returns whether any of them made the account Pro, so the
 * page can refresh. Never throws, shows nothing.
 */
export async function syncPending(deps: IapDeps): Promise<boolean> {
  let txs: NativeTransaction[] = [];
  try {
    const reply = (await deps.call('pending')) as { transactions?: NativeTransaction[] } | null;
    txs = (reply?.transactions ?? []).filter((t) => typeof t?.jws === 'string' && t.jws);
  } catch {
    return false;
  }
  let pro = false;
  for (const tx of txs) {
    if ((await verifyThenFinish(tx, deps)) === 'success') pro = true;
  }
  return pro;
}
