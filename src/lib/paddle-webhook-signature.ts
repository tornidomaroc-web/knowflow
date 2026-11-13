import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Paddle's webhook signature, checked in CONSTANT TIME (fix/paddle-safety).
 *
 * WHY THIS EXISTS. The SDK's `webhooks.unmarshal` (v3.7.0,
 * `notifications/helpers/webhooks-validator.js`) compares the expected HMAC
 * with the received one using `computedHash === headers.h1`. A string `===`
 * returns at the first differing character, so its time depends on how much
 * of a forged signature is right. This check runs FIRST and refuses every
 * wrong signature through `timingSafeEqual`; the SDK's own comparison is then
 * only ever reached with a signature that is already known to be right, so
 * it leaks nothing.
 *
 * WHAT IS KEPT EXACTLY AS THE SDK DOES IT:
 * - the signed payload is `${ts}:${rawBody}`, over the RAW body as received
 *   (the caller passes `request.text()`, never a re-serialised object);
 * - HMAC-SHA256 with the destination's secret key, hex-encoded;
 * - the window: refused when `now > (ts + 5) * 1000`. The same five seconds
 *   the SDK uses, so this cannot refuse what the SDK would accept, and a
 *   future timestamp is not refused (the SDK does not refuse it either).
 *
 * WHAT IS ADDED:
 * - every `h1` in the header is tried (Paddle may send more than one while a
 *   secret is rotated; the SDK keeps only the last);
 * - each `h1` must be 64 hex characters, and its decoded length must equal
 *   the expected digest's before `timingSafeEqual` is called (which throws on
 *   unequal lengths). A malformed `h1` is simply not a match.
 *
 * Returns false for anything but a fresh, correctly signed body. It never
 * throws, so the caller decides the failure path (paddle-webhook-errors.ts).
 */
export const SIGNATURE_WINDOW_SECONDS = 5;

export function verifyPaddleSignature(
  rawBody: string,
  secret: string | undefined,
  header: string | null,
  nowMs: number
): boolean {
  if (!secret || !header) return false;

  let ts = '';
  const received: string[] = [];
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'h1' && value) received.push(value);
  }
  if (!/^\d+$/.test(ts) || received.length === 0) return false;
  if (nowMs > (Number(ts) + SIGNATURE_WINDOW_SECONDS) * 1000) return false;

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest();
  let match = false;
  for (const h1 of received) {
    if (!/^[0-9a-f]{64}$/i.test(h1)) continue;
    const got = Buffer.from(h1, 'hex');
    if (got.length !== expected.length) continue;
    // No early exit across several h1 values either: each one that is
    // well-formed is compared in full.
    if (timingSafeEqual(got, expected)) match = true;
  }
  return match;
}
