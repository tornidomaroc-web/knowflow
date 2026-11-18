import { X509Certificate } from 'node:crypto';

/**
 * THE ONE ROOT THE SERVER TRUSTS FOR APP STORE SIGNED DATA (iOS 1.1, item 4d).
 *
 * Apple Root CA - G3, the root of every StoreKit 2 transaction, renewal info
 * and App Store Server Notification V2 JWS. Pinned here as bytes, never
 * fetched: the chain in a JWS header is supplied by whoever sent the JWS, so
 * the only trust anchor is this constant. There is no environment variable,
 * header or argument in production code that can add another root; the
 * proofs inject their own test root only by calling the library functions
 * directly with it (scripts/verify-apple-iap.mjs), and the same proof shows
 * the routes, which pass this root alone, refuse the test chain.
 *
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer,
 * downloaded 2026-11-18. Subject CN=Apple Root CA - G3, OU=Apple
 * Certification Authority, O=Apple Inc., C=US; valid 2014-04-30 to
 * 2039-04-30. SHA-256 fingerprint
 * 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79,
 * the value Apple publishes for this root. The module refuses to load if the
 * bytes below stop hashing to it, so a one-character edit cannot silently
 * swap the anchor.
 */
const APPLE_ROOT_CA_G3_BASE64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

export const APPLE_ROOT_CA_G3_SHA256 =
  '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';

const APPLE_ROOT_CA_G3 = new X509Certificate(Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64'));
if (APPLE_ROOT_CA_G3.fingerprint256 !== APPLE_ROOT_CA_G3_SHA256) {
  throw new Error('apple-root: the pinned Apple Root CA - G3 bytes do not match the published fingerprint');
}

/** The production trust set: Apple Root CA - G3 and nothing else. */
export function appleRootCertificates(): readonly X509Certificate[] {
  return [APPLE_ROOT_CA_G3];
}
