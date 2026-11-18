/**
 * WHAT AN APP STORE TRANSACTION MAY GRANT (iOS 1.1, item 4d, server half).
 *
 * One product, one price, monthly only: KnowFlow Pro at 9.99 USD a month,
 * the same Pro the web sells through Paddle. Every rule below is pure (no
 * client, no clock beyond the `now` it is handed) so the proofs can drive it
 * directly; ./handlers.ts applies them to verified JWS payloads.
 */

/** ios/App/App.xcodeproj PRODUCT_BUNDLE_IDENTIFIER and capacitor.config appId. */
export const APPLE_BUNDLE_ID = 'com.knowflow.app';

/**
 * The ONE auto-renewable subscription product (proposed; the owner creates it
 * in App Store Connect with exactly this id, in a subscription group of its
 * own, 1 month, 9.99 USD tier). Any other product id grants nothing.
 */
export const APPLE_PRO_PRODUCT_ID = 'com.knowflow.app.pro.monthly';

/**
 * The App Store Connect app record (Apple ID 6820418649). Apple puts it in
 * every Production notification's `data.appAppleId`; Apple's own library
 * refuses a Production notification for another app on it, and so does this.
 */
export const APPLE_APP_APPLE_ID = 6820418649;

export type AppleEnvironment = 'Production' | 'Sandbox';

/**
 * The faithful states of one subscription (one `originalTransactionId`), as
 * Apple's `data.status` names them, plus `refunded` (a REFUND notification,
 * kept apart from `revoked` so a refund is visible in the row).
 */
export type AppleStatus = 'active' | 'grace_period' | 'billing_retry' | 'expired' | 'revoked' | 'refunded';

/**
 * The states that grant Pro: `active`, and `grace_period` (Apple is retrying
 * the charge and the developer chose to keep access; the row's period end is
 * then Apple's `gracePeriodExpiresDate`). `billing_retry` without grace does
 * NOT grant: Apple's guidance is that access stops when the period ends and
 * the retry has not yet succeeded.
 */
export const APPLE_ENTITLED_STATUSES: ReadonlySet<AppleStatus> = new Set<AppleStatus>(['active', 'grace_period']);

/**
 * SANDBOX IS OPT-IN PER ACCOUNT. TestFlight builds and App Review both buy in
 * Apple's Sandbox, where nothing is charged. A Sandbox transaction is honoured
 * only for a KnowFlow account listed in APPLE_IAP_SANDBOX_USER_IDS (comma-
 * separated user ids; the reviewer account and the owner's TestFlight
 * accounts), so a free Sandbox purchase can never make an ordinary account
 * Pro. Unset or empty: Sandbox is refused for everyone. `Xcode` and
 * `LocalTesting` environments are always refused.
 */
export function parseSandboxUserIds(value: string | undefined | null): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const part of (value ?? '').split(',')) {
    const id = part.trim().toLowerCase();
    if (UUID.test(id)) ids.add(id);
  }
  return ids;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function environmentAllowed(
  environment: unknown,
  userId: string,
  sandboxUserIds: ReadonlySet<string>
): environment is AppleEnvironment {
  if (environment === 'Production') return true;
  if (environment === 'Sandbox') return sandboxUserIds.has(userId.toLowerCase());
  return false;
}

/** The fields of a JWSTransactionDecodedPayload this server reads. */
export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  type: string;
  environment: string;
  inAppOwnershipType: string;
  appAccountToken: string | null;
  expiresDate: number | null;
  revocationDate: number | null;
  signedDate: number;
}

/** Read a verified transaction payload; null when a required field is missing. */
export function readTransaction(payload: Record<string, unknown>): AppleTransaction | null {
  const str = (k: string) => (typeof payload[k] === 'string' && (payload[k] as string).length > 0 ? (payload[k] as string) : null);
  const num = (k: string) => (typeof payload[k] === 'number' && Number.isFinite(payload[k]) ? (payload[k] as number) : null);
  const transactionId = str('transactionId');
  const originalTransactionId = str('originalTransactionId');
  const signedDate = num('signedDate');
  if (!transactionId || !originalTransactionId || signedDate === null) return null;
  return {
    transactionId,
    originalTransactionId,
    bundleId: str('bundleId') ?? '',
    productId: str('productId') ?? '',
    type: str('type') ?? '',
    environment: str('environment') ?? '',
    inAppOwnershipType: str('inAppOwnershipType') ?? '',
    appAccountToken: str('appAccountToken')?.toLowerCase() ?? null,
    expiresDate: num('expiresDate'),
    revocationDate: num('revocationDate'),
    signedDate,
  };
}

/**
 * Whether this transaction is the KnowFlow Pro subscription at all. Returns
 * null when it is, else a short reason for the log (no secret in it).
 * FAMILY_SHARED is refused: Pro is bought for one KnowFlow account (Family
 * Sharing stays off on the product; this is the second line behind that).
 */
export function proTransactionProblem(tx: AppleTransaction): string | null {
  if (tx.bundleId !== APPLE_BUNDLE_ID) return `bundle ${tx.bundleId || '(none)'} is not ${APPLE_BUNDLE_ID}`;
  if (tx.productId !== APPLE_PRO_PRODUCT_ID) return `product ${tx.productId || '(none)'} is not the Pro product`;
  if (tx.type !== 'Auto-Renewable Subscription') return `type ${tx.type || '(none)'} is not an auto-renewable subscription`;
  if (tx.inAppOwnershipType !== 'PURCHASED') return `ownership ${tx.inAppOwnershipType || '(none)'} is not PURCHASED`;
  return null;
}

/** The fields of a JWSRenewalInfoDecodedPayload this server reads. */
export interface AppleRenewalInfo {
  gracePeriodExpiresDate: number | null;
}

export function readRenewalInfo(payload: Record<string, unknown> | null): AppleRenewalInfo {
  const g = payload?.gracePeriodExpiresDate;
  return { gracePeriodExpiresDate: typeof g === 'number' && Number.isFinite(g) ? g : null };
}

/** Apple's `data.status` (App Store Server Notifications V2, and Get All Subscription Statuses). */
const STATUS_CODES: Record<number, AppleStatus> = {
  1: 'active',
  2: 'expired',
  3: 'billing_retry',
  4: 'grace_period',
  5: 'revoked',
};

/**
 * NOTIFICATION TYPES THIS SERVER APPLIES, and the state each implies when
 * Apple's `data.status` is absent. Every other type (CONSUMPTION_REQUEST,
 * EXTERNAL_PURCHASE_TOKEN, ONE_TIME_CHARGE, METADATA_UPDATE, MIGRATION,
 * PRICE_CHANGE, RESCIND_CONSENT, TEST, and any type Apple adds later) is
 * logged and acknowledged and NEVER writes, so an unknown type can never
 * grant Pro.
 *
 * `null` here means "the type itself says nothing about access" (a renewal
 * preference changed, a price increase was consented to, a refund was
 * declined): the row is written only when Apple's `data.status` names the
 * state.
 */
const TYPE_STATUS: Record<string, AppleStatus | null | ((subtype: string | null) => AppleStatus)> = {
  SUBSCRIBED: 'active',
  DID_RENEW: 'active',
  OFFER_REDEEMED: 'active',
  RENEWAL_EXTENDED: 'active',
  REFUND_REVERSED: 'active',
  DID_FAIL_TO_RENEW: (subtype) => (subtype === 'GRACE_PERIOD' ? 'grace_period' : 'billing_retry'),
  GRACE_PERIOD_EXPIRED: 'billing_retry',
  EXPIRED: 'expired',
  REFUND: 'refunded',
  REVOKE: 'revoked',
  DID_CHANGE_RENEWAL_STATUS: null,
  DID_CHANGE_RENEWAL_PREF: null,
  PRICE_INCREASE: null,
  RENEWAL_EXTENSION: null,
  REFUND_DECLINED: null,
};

export function isHandledNotificationType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(TYPE_STATUS, type);
}

/**
 * The state a verified notification puts the subscription in, or null when
 * it says nothing about access (nothing is written then).
 *
 * Precedence: a transaction carrying `revocationDate` is revoked (REFUND says
 * `refunded`), whatever else is said; then Apple's own `data.status`; then
 * the type's implied state. An unhandled type returns null before any of it.
 */
export function statusFromNotification(
  type: string,
  subtype: string | null,
  dataStatus: unknown,
  tx: AppleTransaction
): AppleStatus | null {
  if (!isHandledNotificationType(type)) return null;
  if (tx.revocationDate !== null) return type === 'REFUND' ? 'refunded' : 'revoked';
  if (type === 'REFUND') return 'refunded';
  if (typeof dataStatus === 'number' && STATUS_CODES[dataStatus]) return STATUS_CODES[dataStatus];
  const implied = TYPE_STATUS[type];
  if (typeof implied === 'function') return implied(subtype);
  return implied ?? null;
}

/**
 * The state of a transaction the APP sent (POST /api/apple/iap/verify), read
 * from the transaction alone: revoked when Apple revoked it, active while it
 * has not expired, expired after. Grace and billing retry are learned only
 * from notifications, which carry renewal info.
 */
export function statusFromTransaction(tx: AppleTransaction, now: number): AppleStatus {
  if (tx.revocationDate !== null) return 'revoked';
  if (tx.expiresDate !== null && tx.expiresDate > now) return 'active';
  return 'expired';
}

/**
 * The instant access ends for this state: the grace period's end while in
 * grace (falling back to the transaction's expiry), else the transaction's
 * expiry. Null only for a transaction with no expiry at all, which can never
 * grant (the table's check refuses an entitled row without one).
 */
export function periodEndFor(status: AppleStatus, tx: AppleTransaction, renewal: AppleRenewalInfo): number | null {
  if (status === 'grace_period') return renewal.gracePeriodExpiresDate ?? tx.expiresDate;
  return tx.expiresDate;
}
