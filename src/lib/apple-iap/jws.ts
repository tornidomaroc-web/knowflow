import { X509Certificate, verify as verifySignature } from 'node:crypto';

/**
 * VERIFY ONE APP STORE SIGNED-DATA JWS, OFFLINE (iOS 1.1, item 4d).
 *
 * StoreKit 2 transactions, renewal info and App Store Server Notifications V2
 * all arrive as a compact JWS whose header carries the signing chain in
 * `x5c`: [leaf, intermediate, root]. The chain is SUPPLIED BY THE SENDER, so
 * nothing in it is trusted until it reaches a root the server already holds.
 * This mirrors the checks of Apple's own App Store Server Library
 * (SignedDataVerifier, online checks off), with no network call:
 *
 *   1. compact JWS of exactly three base64url parts, at most 64 KiB;
 *   2. header `alg` is ES256 and nothing else (no `none`, no HMAC: the key
 *      comes only from the certificate, so no algorithm confusion);
 *   3. `x5c` holds exactly three certificates;
 *   4. the intermediate is issued AND signed by one of `roots` (the third
 *      `x5c` entry is never consulted: only the pinned bytes are a root), and
 *      is a CA;
 *   5. the leaf is issued and signed by the intermediate, and is not a CA;
 *   6. the leaf carries Apple's receipt-signing marker OID
 *      1.2.840.113635.100.6.11.1 and the intermediate Apple's WWDR marker
 *      1.2.840.113635.100.6.2.1, as Apple's library requires;
 *   7. every certificate is valid at the payload's `signedDate` (Apple's
 *      "effective date" with online checks off), and that date is not more
 *      than five minutes in the future;
 *   8. the ES256 signature over `header.payload` verifies with the leaf's
 *      P-256 key.
 *
 * The payload is returned only when every check passes. Nothing here decides
 * what the payload is FOR (bundle, product, environment, user): that is
 * ./rules.ts, so this file stays a pure signature check.
 */

export class AppleJwsError extends Error {
  readonly code: string;
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

const MAX_JWS_BYTES = 64 * 1024;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** DER of an OBJECT IDENTIFIER (tag 06, length, base-128 arcs). */
function encodeOid(oid: string): Buffer {
  const arcs = oid.split('.').map((n) => Number(n));
  const bytes = [arcs[0] * 40 + arcs[1]];
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f];
    let rest = Math.floor(arc / 128);
    while (rest > 0) {
      chunk.unshift((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    bytes.push(...chunk);
  }
  return Buffer.from([0x06, bytes.length, ...bytes]);
}

export const APPLE_LEAF_MARKER_OID = '1.2.840.113635.100.6.11.1';
export const APPLE_INTERMEDIATE_MARKER_OID = '1.2.840.113635.100.6.2.1';
const LEAF_MARKER = encodeOid(APPLE_LEAF_MARKER_OID);
const INTERMEDIATE_MARKER = encodeOid(APPLE_INTERMEDIATE_MARKER_OID);

/**
 * Whether the certificate's DER carries this OID as an extension id. The
 * bytes `06 len arcs…` followed by the extension's next element; an extension
 * id is the only place a certificate of this shape spells these arcs, and the
 * certificate's own signature (already checked by the chain) covers every
 * byte searched.
 */
function hasExtensionOid(cert: X509Certificate, encoded: Buffer): boolean {
  return cert.raw.indexOf(encoded) !== -1;
}

function validAt(cert: X509Certificate, at: number): boolean {
  const from = Date.parse(cert.validFrom);
  const to = Date.parse(cert.validTo);
  return Number.isFinite(from) && Number.isFinite(to) && from <= at && at <= to;
}

function decodeJson(part: string, what: string): Record<string, unknown> {
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new AppleJwsError('malformed', `${what} is not a JSON object`);
}

function certificateFrom(value: unknown, which: string): X509Certificate {
  if (typeof value !== 'string' || value.length === 0) throw new AppleJwsError('malformed', `x5c ${which} is not a string`);
  try {
    return new X509Certificate(Buffer.from(value, 'base64'));
  } catch {
    throw new AppleJwsError('malformed', `x5c ${which} is not a certificate`);
  }
}

export interface VerifyOptions {
  /** Milliseconds since the epoch; the proofs fix it, the routes pass Date.now(). */
  now: number;
}

/**
 * Verify `jws` against `roots` and return its payload. Throws AppleJwsError
 * with a short code (`malformed`, `algorithm`, `chain`, `marker`, `expired-
 * certificate`, `signed-date`, `signature`) on any failure.
 */
export function verifyAppleSignedData(
  jws: unknown,
  roots: readonly X509Certificate[],
  { now }: VerifyOptions
): Record<string, unknown> {
  if (typeof jws !== 'string' || jws.length === 0) throw new AppleJwsError('malformed', 'not a string');
  if (Buffer.byteLength(jws, 'utf8') > MAX_JWS_BYTES) throw new AppleJwsError('malformed', 'too large');
  const parts = jws.split('.');
  if (parts.length !== 3 || !parts.every((p) => BASE64URL.test(p))) {
    throw new AppleJwsError('malformed', 'not a compact JWS');
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJson(headerPart, 'header');
  if (header.alg !== 'ES256') throw new AppleJwsError('algorithm', `alg ${String(header.alg)}`);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new AppleJwsError('chain', 'x5c must hold exactly three certificates');
  const leaf = certificateFrom(x5c[0], 'leaf');
  const intermediate = certificateFrom(x5c[1], 'intermediate');

  const payload = decodeJson(payloadPart, 'payload');
  const signedDate = payload.signedDate;
  if (typeof signedDate !== 'number' || !Number.isFinite(signedDate) || signedDate <= 0) {
    throw new AppleJwsError('signed-date', 'payload has no signedDate');
  }
  if (signedDate > now + FUTURE_SKEW_MS) throw new AppleJwsError('signed-date', 'signedDate is in the future');

  // 4. The intermediate must chain to a PINNED root, by issuer name and by
  // signature. x5c[2] is deliberately ignored.
  const root = roots.find((r) => intermediate.checkIssued(r) && intermediate.verify(r.publicKey));
  if (!root) throw new AppleJwsError('chain', 'intermediate is not signed by a trusted root');
  if (!intermediate.ca) throw new AppleJwsError('chain', 'intermediate is not a CA');

  // 5.
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) {
    throw new AppleJwsError('chain', 'leaf is not signed by the intermediate');
  }
  if (leaf.ca) throw new AppleJwsError('chain', 'leaf is a CA');

  // 6.
  if (!hasExtensionOid(leaf, LEAF_MARKER)) throw new AppleJwsError('marker', 'leaf lacks the App Store marker OID');
  if (!hasExtensionOid(intermediate, INTERMEDIATE_MARKER)) {
    throw new AppleJwsError('marker', 'intermediate lacks the Apple WWDR marker OID');
  }

  // 7.
  if (!validAt(root, signedDate) || !validAt(intermediate, signedDate) || !validAt(leaf, signedDate)) {
    throw new AppleJwsError('expired-certificate', 'a certificate is not valid at signedDate');
  }

  // 8.
  const key = leaf.publicKey;
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new AppleJwsError('algorithm', 'leaf key is not P-256');
  }
  const signature = Buffer.from(signaturePart, 'base64url');
  if (signature.length !== 64) throw new AppleJwsError('signature', 'ES256 signature must be 64 bytes');
  const ok = verifySignature(
    'sha256',
    Buffer.from(`${headerPart}.${payloadPart}`, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
    signature
  );
  if (!ok) throw new AppleJwsError('signature', 'signature does not verify');

  return payload;
}
