/**
 * Classifying a failed Paddle WEBHOOK delivery. Register #72c.
 *
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/app/api/paddle/webhook/route.ts` ended in one catch that answered every
 * failure with `{ error: 'Webhook verification failed' }` and a 400. The inside
 * of that handler is careful -- a write failure returns 500 so Paddle
 * redelivers, a foreign-key violation returns 200 because the user is gone and
 * no retry brings them back -- but anything that reached the outer catch was
 * reported as a SIGNATURE problem regardless of what actually happened. That
 * sends an operator to check a webhook secret that is fine.
 *
 *
 * WHAT THE STATUS CODE ACTUALLY CONTROLS, VERIFIED FROM PADDLE'S DOCS
 * ------------------------------------------------------------------
 * Paddle's "Handle webhook delivery" page: the destination must return HTTP 200
 * within five seconds, and *any* non-200 (or a timeout) is retried on
 * exponential backoff -- 3 times within 15 minutes for sandbox, 60 times over 3
 * days for live. Paddle does NOT distinguish 4xx from 5xx; both are retried
 * identically.
 *
 * So the only decision the status code makes is 200 versus not-200: accept and
 * stop, or be redelivered. The 4xx/5xx split is DIAGNOSTIC -- it is what an
 * operator sees per attempt in Paddle's own notification log -- and this module
 * treats it that way. `redeliveryCanHelp` records the intent separately, so a
 * log line says whether waiting for the next attempt is worth anything.
 *
 * (This corrected an earlier assumption of ours that a 400 would make Paddle
 * give up and discard a paid event. It does not. The defect here is
 * misdiagnosis, not lost events, and it is written down that way rather than
 * oversold.)
 *
 *
 * THE FIVE SECOND WINDOW, AND THE MISDIAGNOSIS IT CAUSES
 * ------------------------------------------------------
 * Read from the SDK rather than assumed: `WebhooksValidator` carries
 * `MAX_VALID_TIME_DIFFERENCE = 5`, and `isValidSignature` returns false when
 * `now > ts + 5s` -- BEFORE it ever computes the HMAC. A perfectly genuine
 * delivery, signed with a perfectly correct secret, fails verification if our
 * handler takes more than five seconds to reach it. A cold start does that.
 *
 * The SDK reports that identically to a forged request: one thrown
 * `Error('[Paddle] Webhook signature verification failed')`. So the single most
 * likely real-world cause -- we were slow -- was indistinguishable from the
 * scariest one, and the old handler then labelled both "verification failed",
 * which is exactly the sentence that sends someone to rotate a working secret.
 *
 * The timestamp is in the `paddle-signature` header in the clear, so we can
 * separate them ourselves without the secret: parse `ts`, compare to now, and
 * say plainly whether this was a stale delivery or a real mismatch.
 *
 *
 * WHY A FAILED SIGNATURE IS STILL ANSWERED WITH NON-200
 * ----------------------------------------------------
 * A verification failure has two causes we CANNOT tell apart from the inside: a
 * forged request, or our own `PADDLE_WEBHOOK_SECRET` being wrong or mid-rotation.
 * Answering 200 would be right for the forgery and catastrophic for the
 * rotation: every genuine paid event during the bad-secret window would be
 * accepted and silently dropped, with Paddle believing delivery succeeded.
 *
 * So this fails TOWARD redelivery. The cost of being wrong about a forgery is
 * that Paddle retries something we will keep rejecting; the cost of being wrong
 * about a rotation is a customer who paid and got nothing. Live accounts retry
 * for three days, which is a free grace period in which fixing the secret
 * recovers every event by itself.
 */

/** From the SDK's `WebhooksValidator.MAX_VALID_TIME_DIFFERENCE`. */
export const PADDLE_SIGNATURE_MAX_AGE_SECONDS = 5;

export type WebhookFailureCode =
  | 'signature_missing'
  | 'signature_malformed'
  | 'signature_stale'
  | 'signature_invalid'
  | 'payload_unreadable'
  | 'unhandled';

/** What the `paddle-signature` header says, readable without the secret. */
export interface SignatureFacts {
  present: boolean;
  wellFormed: boolean;
  ts: number | null;
  /** now - ts, in seconds. Negative means the timestamp is in our future. */
  ageSeconds: number | null;
  /** Older than the SDK's window, so verification fails regardless of secret. */
  stale: boolean;
  /** Timestamp meaningfully ahead of our clock: skew on our side, not Paddle's. */
  clockSkewSuspected: boolean;
}

export interface ClassifiedWebhookFailure {
  code: WebhookFailureCode;
  status: number;
  /** Whether being redelivered could plausibly succeed. Paddle retries every
   *  non-200 either way; this is for the human reading the log. */
  redeliveryCanHelp: boolean;
  log: {
    code: WebhookFailureCode;
    message: string;
    signature: SignatureFacts;
    /** The one sentence that should stop a wrong investigation. */
    hint: string;
  };
}

/**
 * Parse `paddle-signature` the same way the SDK does (`ts=...;h1=...`), without
 * verifying anything. Deliberately total: it never throws, because it runs on
 * the path that exists to explain failures.
 */
export function inspectSignatureHeader(header: string | null | undefined, nowMs: number): SignatureFacts {
  const base: SignatureFacts = {
    present: false,
    wellFormed: false,
    ts: null,
    ageSeconds: null,
    stale: false,
    clockSkewSuspected: false,
  };

  if (!header || !header.trim()) return base;

  let ts = '';
  let h1 = '';
  for (const part of header.split(';')) {
    const [key, value] = part.split('=');
    if (!value) continue;
    if (key === 'ts') ts = value;
    else if (key === 'h1') h1 = value;
  }

  const tsNum = Number.parseInt(ts, 10);
  if (!ts || !h1 || Number.isNaN(tsNum)) {
    return { ...base, present: true };
  }

  const ageSeconds = Math.round(nowMs / 1000) - tsNum;
  return {
    present: true,
    wellFormed: true,
    ts: tsNum,
    ageSeconds,
    stale: ageSeconds > PADDLE_SIGNATURE_MAX_AGE_SECONDS,
    clockSkewSuspected: ageSeconds < -PADDLE_SIGNATURE_MAX_AGE_SECONDS,
  };
}

/**
 * Both signature failures the SDK raises are plain `Error`s identified only by
 * their message: `'[Paddle] Webhook signature verification failed'` from
 * `unmarshal`, and `'[Paddle] Invalid webhook signature'` from `extractHeader`.
 * Matching on text is coupling to the SDK's wording, and it is the only handle
 * offered -- so the match is deliberately loose, and the header facts gathered
 * above, not this predicate, carry the diagnosis.
 */
function isSignatureError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /signature/i.test(message);
}

export function classifyWebhookFailure(err: unknown, signature: SignatureFacts): ClassifiedWebhookFailure {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const make = (
    code: WebhookFailureCode,
    status: number,
    redeliveryCanHelp: boolean,
    hint: string
  ): ClassifiedWebhookFailure => ({
    code,
    status,
    redeliveryCanHelp,
    log: { code, message, signature, hint },
  });

  // Nothing signed this. Paddle always signs, so this is a probe or a
  // misrouted caller, not a delivery. Redelivery is not even in play.
  if (!signature.present) {
    return make('signature_missing', 400, false,
      'No paddle-signature header. This did not come from Paddle; do not investigate the secret.');
  }

  if (!signature.wellFormed) {
    return make('signature_malformed', 400, false,
      'paddle-signature present but not parseable as ts=..;h1=... Do not investigate the secret.');
  }

  if (isSignatureError(err)) {
    // The window closed before we got here. The secret is not implicated, and
    // saying so is the entire point of this branch.
    if (signature.stale) {
      return make('signature_stale', 503, true,
        `Signature timestamp is ${signature.ageSeconds}s old and the SDK's window is ` +
        `${PADDLE_SIGNATURE_MAX_AGE_SECONDS}s, so verification fails whatever the secret is. ` +
        'Investigate handler latency (cold start) or a system clock running AHEAD, ' +
        'NOT PADDLE_WEBHOOK_SECRET.');
    }
    // There is deliberately NO branch for `clockSkewSuspected` here, and that
    // was established by running it rather than assumed: `isValidSignature`
    // rejects only `now > ts + 5`, so a timestamp in our FUTURE verifies
    // normally and never reaches this catch. The field stays on SignatureFacts
    // because it is worth seeing in every log line, but a branch keyed on it
    // would be unreachable code pretending to be a diagnosis. The skew
    // direction that DOES break verification is our clock running ahead, which
    // presents as a large positive age and is covered by `stale` above.
    // Fresh timestamp, real mismatch. Forged, or our secret is wrong; we cannot
    // tell from here, so we fail toward redelivery. See the header note.
    return make('signature_invalid', 401, true,
      'HMAC mismatch on a fresh timestamp: either a forged request or a wrong/rotated ' +
      'PADDLE_WEBHOOK_SECRET. Answered non-200 on purpose so a genuine event is redelivered ' +
      'if the secret is what is wrong.');
  }

  // The signature verified, so the body is authentic; failing to read it is our
  // problem or a Paddle change, never a caller's.
  if (err instanceof SyntaxError) {
    return make('payload_unreadable', 500, true,
      'Signature verified but the body did not parse. The payload is authentic; this is not a security event.');
  }

  return make('unhandled', 500, true,
    'Signature state above is informational: this failed after verification, for a reason not yet classified.');
}
