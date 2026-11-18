import type { X509Certificate } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppleJwsError, verifyAppleSignedData } from './jws';
import {
  APPLE_APP_APPLE_ID,
  APPLE_BUNDLE_ID,
  UUID,
  environmentAllowed,
  isHandledNotificationType,
  periodEndFor,
  proTransactionProblem,
  readRenewalInfo,
  readTransaction,
  statusFromNotification,
  statusFromTransaction,
  type AppleStatus,
  type AppleTransaction,
} from './rules';
import { readEntitlement } from '@/lib/entitlement';

/**
 * THE TWO APPLE ENDPOINTS' LOGIC, with every dependency passed in (iOS 1.1,
 * item 4d). The routes under src/app/api/apple/ are thin: they read the
 * session and the environment and pass the PINNED Apple root
 * (./apple-root.ts). The proofs call these functions with a test root, a
 * fixed clock and a real PostgREST, and separately prove that the routes,
 * which cannot be handed a root, refuse the test chain.
 *
 * Nothing here returns user-visible text: every answer is a status and a
 * code the app maps to its own copy in the UI PR.
 */

export interface AppleDeps {
  /** Service-role client: the only writer of public.apple_subscriptions. */
  admin: SupabaseClient;
  roots: readonly X509Certificate[];
  sandboxUserIds: ReadonlySet<string>;
  now: () => number;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

const TABLE = 'apple_subscriptions';
/** Postgres foreign_key_violation: the user this event names no longer exists. */
const FK_VIOLATION = '23503';

interface AppleRow {
  product_id: string;
  environment: string;
  status: AppleStatus;
  expires_at: string | null;
  last_transaction_id: string;
  last_signed_at: string;
  last_notification_uuid: string | null;
  updated_at: string;
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/**
 * WRITE ONLY IF NEWER, the #325 shape on Apple's clock. Apple does not
 * promise delivery order, and the app may send a cached transaction older
 * than a notification already applied, so a write lands only on a row whose
 * last_signed_at is older than this one's signedDate:
 *
 *   1. UPDATE … WHERE original_transaction_id = $id AND last_signed_at < $signed
 *   2. if nothing updated and a user is known: INSERT … ON CONFLICT
 *      (original_transaction_id) DO NOTHING
 *   3. if that inserted nothing either (a row appeared meanwhile): repeat 1.
 *
 * The same signedDate again (a redelivery, a resent JWS) is not older, so it
 * changes nothing: idempotent. user_id is never part of an UPDATE, so no
 * event can move a subscription to another account.
 */
async function writeIfNewer(
  admin: SupabaseClient,
  originalTransactionId: string,
  row: AppleRow,
  insertUserId: string | null
): Promise<{ applied: boolean; error: { code?: string; message: string } | null }> {
  const updateIfOlder = () =>
    admin
      .from(TABLE)
      .update(row)
      .eq('original_transaction_id', originalTransactionId)
      .lt('last_signed_at', row.last_signed_at)
      .select('id');

  const first = await updateIfOlder();
  if (first.error) return { applied: false, error: first.error };
  if (first.data && first.data.length > 0) return { applied: true, error: null };
  if (!insertUserId) return { applied: false, error: null };

  const inserted = await admin
    .from(TABLE)
    .upsert(
      { user_id: insertUserId, original_transaction_id: originalTransactionId, ...row },
      { onConflict: 'original_transaction_id', ignoreDuplicates: true }
    )
    .select('id');
  if (inserted.error) return { applied: false, error: inserted.error };
  if (inserted.data && inserted.data.length > 0) return { applied: true, error: null };

  const second = await updateIfOlder();
  if (second.error) return { applied: false, error: second.error };
  return { applied: !!(second.data && second.data.length > 0), error: null };
}

/** The account that owns this subscription today, if a row exists. */
async function ownerOf(
  admin: SupabaseClient,
  originalTransactionId: string
): Promise<{ userId: string | null; error: { code?: string; message: string } | null }> {
  const { data, error } = await admin
    .from(TABLE)
    .select('user_id')
    .eq('original_transaction_id', originalTransactionId)
    .limit(1);
  if (error) return { userId: null, error };
  const row = (data as { user_id: string }[] | null)?.[0];
  return { userId: row ? String(row.user_id).toLowerCase() : null, error: null };
}

function verifyOrNull(jws: unknown, deps: AppleDeps): { payload: Record<string, unknown> | null; reason: string | null } {
  try {
    return { payload: verifyAppleSignedData(jws, deps.roots, { now: deps.now() }), reason: null };
  } catch (error) {
    if (error instanceof AppleJwsError) return { payload: null, reason: error.code };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// POST /api/apple/iap/verify
// ---------------------------------------------------------------------------

/**
 * The app sends the StoreKit 2 transaction it just bought or restored
 * (`Transaction.jwsRepresentation`) while signed in as `userId`.
 *
 * Granted only when, in this order: the JWS verifies to the pinned root; it
 * is the Pro product of this bundle, auto-renewable, PURCHASED; its
 * environment is Production (Sandbox only for an allowlisted account); its
 * appAccountToken is THIS account's id (the app sets it at purchase), so a
 * transaction bought by another account, or a JWS lifted from another
 * device, grants nothing; the subscription is not already another account's.
 * Then the transaction's own state is written if newer, and the answer is the
 * account's whole entitlement (Paddle or Apple), read back.
 */
export async function verifyPurchase(
  input: { signedTransaction: unknown; userId: string },
  deps: AppleDeps
): Promise<HandlerResult> {
  const userId = input.userId.toLowerCase();
  const { payload, reason } = verifyOrNull(input.signedTransaction, deps);
  if (!payload) {
    console.warn('Apple verify: transaction JWS refused', { userId, reason });
    return { status: 400, body: { error: 'unverified', reason } };
  }
  const tx = readTransaction(payload);
  if (!tx) return { status: 400, body: { error: 'unverified', reason: 'transaction-fields' } };
  const where = { userId, originalTransactionId: tx.originalTransactionId, transactionId: tx.transactionId };

  const problem = proTransactionProblem(tx);
  if (problem) {
    console.warn('Apple verify: not the Pro subscription; nothing granted', { ...where, reason: problem });
    return { status: 422, body: { error: 'not-pro-product' } };
  }
  if (!environmentAllowed(tx.environment, userId, deps.sandboxUserIds)) {
    console.warn('Apple verify: environment not allowed for this account; nothing granted', { ...where, environment: tx.environment });
    return { status: 403, body: { error: 'environment-not-allowed' } };
  }
  if (tx.appAccountToken !== userId) {
    console.warn('Apple verify: appAccountToken is not this account; nothing granted', {
      ...where,
      hasToken: tx.appAccountToken !== null,
    });
    return { status: 403, body: { error: 'not-this-account' } };
  }

  const owner = await ownerOf(deps.admin, tx.originalTransactionId);
  if (owner.error) {
    console.error('Apple verify: owner read failed', { ...where, code: owner.error.code, message: owner.error.message });
    return { status: 500, body: { error: 'write-failed' } };
  }
  if (owner.userId && owner.userId !== userId) {
    console.warn('Apple verify: this subscription already belongs to another account; nothing granted', where);
    return { status: 409, body: { error: 'other-account' } };
  }

  const now = deps.now();
  const status = statusFromTransaction(tx, now);
  const result = await writeIfNewer(deps.admin, tx.originalTransactionId, rowFor(tx, status, periodEndFor(status, tx, { gracePeriodExpiresDate: null }), null, now), userId);
  if (result.error) {
    console.error('Apple verify: write failed', { ...where, code: result.error.code, message: result.error.message });
    return { status: 500, body: { error: 'write-failed' } };
  }

  const entitlement = await readEntitlement(deps.admin, userId);
  return {
    status: 200,
    body: { applied: result.applied, tier: entitlement.tier, expiresAt: entitlement.expiresAt },
  };
}

function rowFor(
  tx: AppleTransaction,
  status: AppleStatus,
  periodEnd: number | null,
  notificationUuid: string | null,
  now: number
): AppleRow {
  return {
    product_id: tx.productId,
    environment: tx.environment,
    status,
    expires_at: iso(periodEnd),
    last_transaction_id: tx.transactionId,
    last_signed_at: new Date(tx.signedDate).toISOString(),
    last_notification_uuid: notificationUuid,
    updated_at: new Date(now).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST /api/apple/notifications (App Store Server Notifications V2)
// ---------------------------------------------------------------------------

/**
 * Apple's server tells us what happened to a subscription: bought, renewed,
 * failed to renew (grace or billing retry), expired, refunded, revoked.
 *
 * Answers: 200 for everything applied or deliberately not applied (Apple
 * stops retrying); 400 for a payload that does not verify (a forgery is not
 * worth a retry); 500 only when the database write failed, so Apple
 * redelivers (it retries a non-2xx answer).
 *
 * Unknown types, and handled types that say nothing about access, are logged
 * and acknowledged and NEVER write, so they can never grant Pro.
 */
export async function handleNotification(signedPayload: unknown, deps: AppleDeps): Promise<HandlerResult> {
  const outer = verifyOrNull(signedPayload, deps);
  if (!outer.payload) {
    console.warn('Apple notification: signedPayload refused', { reason: outer.reason });
    return { status: 400, body: { error: 'unverified', reason: outer.reason } };
  }
  const n = outer.payload;
  const type = typeof n.notificationType === 'string' ? n.notificationType : '';
  const subtype = typeof n.subtype === 'string' ? n.subtype : null;
  const notificationUuid = typeof n.notificationUUID === 'string' && UUID.test(n.notificationUUID.toLowerCase()) ? n.notificationUUID.toLowerCase() : null;
  const signedDate = n.signedDate as number; // verified finite by verifyAppleSignedData
  const data = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
  const where = { type, subtype, notificationUuid };

  if (n.version !== '2.0') {
    console.warn('Apple notification: not version 2.0; ignored', { ...where, version: n.version });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (data.bundleId !== APPLE_BUNDLE_ID) {
    console.warn('Apple notification: another bundle; ignored', { ...where, bundleId: data.bundleId });
    return { status: 200, body: { received: true, applied: false } };
  }
  const environment = data.environment;
  if (environment !== 'Production' && environment !== 'Sandbox') {
    console.warn('Apple notification: environment not handled; ignored', { ...where, environment });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (environment === 'Production' && data.appAppleId !== APPLE_APP_APPLE_ID) {
    console.warn('Apple notification: Production notification for another app id; ignored', { ...where, appAppleId: data.appAppleId });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (type === 'TEST') {
    console.log('Apple notification: TEST received', { ...where, environment });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (!isHandledNotificationType(type)) {
    console.warn('Apple notification: type not handled; logged, nothing written, nothing granted', { ...where, environment });
    return { status: 200, body: { received: true, applied: false } };
  }

  const inner = verifyOrNull(data.signedTransactionInfo, deps);
  if (!inner.payload) {
    console.warn('Apple notification: signedTransactionInfo refused', { ...where, reason: inner.reason });
    return { status: 400, body: { error: 'unverified', reason: `transaction-${inner.reason}` } };
  }
  const tx = readTransaction(inner.payload);
  if (!tx) return { status: 400, body: { error: 'unverified', reason: 'transaction-fields' } };
  let renewalPayload: Record<string, unknown> | null = null;
  if (data.signedRenewalInfo !== undefined && data.signedRenewalInfo !== null) {
    const renewal = verifyOrNull(data.signedRenewalInfo, deps);
    if (!renewal.payload) {
      console.warn('Apple notification: signedRenewalInfo refused', { ...where, reason: renewal.reason });
      return { status: 400, body: { error: 'unverified', reason: `renewal-${renewal.reason}` } };
    }
    if (renewal.payload.originalTransactionId !== tx.originalTransactionId) {
      console.warn('Apple notification: renewal info names another subscription', where);
      return { status: 400, body: { error: 'unverified', reason: 'renewal-mismatch' } };
    }
    renewalPayload = renewal.payload;
  }
  const at = { ...where, originalTransactionId: tx.originalTransactionId, transactionId: tx.transactionId, environment };

  const problem = proTransactionProblem(tx);
  if (problem) {
    console.warn('Apple notification: not the Pro subscription; nothing written', { ...at, reason: problem });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (tx.environment !== environment) {
    console.warn('Apple notification: transaction environment differs from the notification; ignored', { ...at, txEnvironment: tx.environment });
    return { status: 200, body: { received: true, applied: false } };
  }

  const status = statusFromNotification(type, subtype, data.status, tx);
  if (status === null) {
    console.log('Apple notification: says nothing about access; nothing written', at);
    return { status: 200, body: { received: true, applied: false } };
  }

  // Whose subscription: the row's owner when the row exists (user_id never
  // moves), else the appAccountToken the app set at purchase. No token and no
  // row: there is nobody to grant to, and nothing is inserted.
  const owner = await ownerOf(deps.admin, tx.originalTransactionId);
  if (owner.error) {
    console.error('Apple notification: owner read failed', { ...at, code: owner.error.code, message: owner.error.message });
    return { status: 500, body: { error: 'write-failed' } };
  }
  const token = tx.appAccountToken && UUID.test(tx.appAccountToken) ? tx.appAccountToken : null;
  const userId = owner.userId ?? token;
  if (!userId) {
    console.warn('Apple notification: no row and no appAccountToken; nothing written', at);
    return { status: 200, body: { received: true, applied: false } };
  }
  if (owner.userId && token && token !== owner.userId) {
    console.warn('Apple notification: appAccountToken differs from the row owner; applied to the row owner', at);
  }
  if (!environmentAllowed(environment, userId, deps.sandboxUserIds)) {
    console.warn('Apple notification: Sandbox for an account not on the allowlist; ignored', { ...at, userId });
    return { status: 200, body: { received: true, applied: false } };
  }

  const periodEnd = periodEndFor(status, tx, readRenewalInfo(renewalPayload));
  const row = rowFor(tx, status, periodEnd, notificationUuid, deps.now());
  // Ordered by the NOTIFICATION's signedDate, Apple's clock for the event.
  row.last_signed_at = new Date(signedDate).toISOString();

  const result = await writeIfNewer(deps.admin, tx.originalTransactionId, row, owner.userId ? null : userId);
  if (result.error && result.error.code === FK_VIOLATION) {
    console.warn('Apple notification: event for a deleted account; acknowledged without write', { ...at, userId });
    return { status: 200, body: { received: true, applied: false } };
  }
  if (result.error) {
    console.error('Apple notification: write failed; answered 500 so Apple redelivers', {
      ...at,
      code: result.error.code,
      message: result.error.message,
    });
    return { status: 500, body: { error: 'write-failed' } };
  }
  if (!result.applied) {
    console.warn('Apple notification: older than the state already applied; not applied', { ...at, signedDate });
  }
  return { status: 200, body: { received: true, applied: result.applied, state: status } };
}
