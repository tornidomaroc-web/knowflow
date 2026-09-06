/**
 * Classifying a failed Paddle call into something a user can act on and
 * something an operator can debug. Register #72b.
 *
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /api/paddle/checkout` used to wrap the whole handler in one `catch` that
 * logged `error` and returned `{ error: 'Internal Server Error' }` with a 500,
 * for every possible cause. A wrong `PADDLE_PRO_PRICE_ID`, a rejected API
 * credential and a dropped TCP connection were one indistinguishable outcome on
 * the screen AND, because the log line carried no code and no status, nearly
 * indistinguishable in the logs too.
 *
 * That is the same defect class the ingestion path already fixed in
 * `src/app/api/ingest/route.ts` (register #54), where nothing recording an
 * upstream status code let a credential outage run for nine days. This applies
 * the lesson to billing, which is the one path where the failure costs money.
 *
 *
 * THE SHAPES ARE MEASURED, NOT ASSUMED
 * ------------------------------------
 * Every rule below was written against error objects captured from the real
 * Paddle sandbox, not from the documentation:
 *
 *   bad price id        ApiError type='request_error' code='transaction_price_not_found'
 *                       detail='One or more provided price_ids could not be found, provided: pri_...'
 *   rejected credential ApiError type='request_error' code='authentication_malformed'
 *   transport failure   TypeError('fetch failed')  -- NOT an ApiError at all
 *
 * NOTE THE TRAP: both API errors carry the SAME `type`, `request_error`. A
 * classifier keyed on `type` would collapse a broken credential and a broken
 * price id back into one bucket, which is the bug being fixed. `code` is the
 * discriminator; `type` is not.
 *
 *
 * WHERE THE LINE IS DRAWN BETWEEN SCREEN AND LOG
 * ----------------------------------------------
 * The browser gets a STABLE MACHINE CODE and a short reference id. It never
 * gets Paddle's prose.
 *
 * Two reasons, and neither is squeamishness. First, Paddle's detail is useless
 * to the person reading it: a student cannot act on "One or more provided
 * price_ids could not be found, provided: pri_01j...". Second, it is a live
 * operational signal. `authentication_malformed` announces that our billing
 * credential is currently broken, which is exactly the thing not to publish to
 * anonymous callers, and the price-id detail names an internal identifier and
 * confirms it is misconfigured.
 *
 * What the user actually needs is narrower than the cause: IS THIS MINE TO
 * RETRY? That is one bit, and it is what `retryable` carries.
 *
 * The reference id is the bridge across the line. The operator's problem was
 * never that the screen said too little; it was that a user report could not be
 * joined to a log line. A user quoting `KF-3f9a2c11` lets the operator find the
 * exact failure, with Paddle's full detail and documentation link attached.
 *
 *
 * WHY A CODE AND NOT A SENTENCE
 * -----------------------------
 * The app is bilingual and the route is not. The old handler sent the literal
 * English string 'Internal Server Error' to the browser, and
 * `pricing/page.tsx` rendered it verbatim, so an Arabic user was shown English
 * prose from an API. Returning a code and translating it at the render site is
 * what makes the Arabic and English paths equally served rather than one being
 * the default and the other an afterthought.
 */

/**
 * What the browser is told. Stable strings: they are translation keys and a
 * client contract, so renaming one is a breaking change.
 *
 * - `checkout_misconfigured` -- our setup is wrong (bad price id, rejected or
 *   missing credential, malformed request). Retrying changes nothing; the
 *   operator has to fix something.
 * - `checkout_unavailable` -- the payment provider could not be reached or
 *   asked us to back off. Retrying is reasonable.
 */
export type CheckoutFailureCode = 'checkout_misconfigured' | 'checkout_unavailable';

/** Never serialised to the browser. This is the operator's half. */
export interface CheckoutFailureLog {
  kind: 'paddle_api_error' | 'transport' | 'unknown';
  message: string;
  paddleCode?: string;
  paddleType?: string;
  detail?: string;
  documentationUrl?: string;
  retryAfter?: number | null;
}

export interface ClassifiedCheckoutFailure {
  code: CheckoutFailureCode;
  status: number;
  retryable: boolean;
  log: CheckoutFailureLog;
}

/**
 * Paddle codes that mean "not your request, try again". Everything else that
 * reached Paddle and came back an error is treated as OUR misconfiguration,
 * which is the right default: a 4xx from Paddle means Paddle understood us and
 * said no, and a caller retrying cannot fix that.
 */
const TRANSIENT_PADDLE_CODES = new Set([
  'too_many_requests',
  'internal_error',
  'service_unavailable',
  'timeout',
  'bad_gateway',
]);

/**
 * Recognise a Paddle `ApiError` by SHAPE rather than with `instanceof`.
 *
 * `instanceof` compares constructor identity, which silently fails when two
 * copies of the SDK end up in the module graph (a hoisting difference, a
 * transitive version, a bundler splitting server and edge). It would fail OPEN
 * here, quietly reclassifying every Paddle API error as a transport failure and
 * telling the user to retry a broken credential forever. The three fields below
 * appear together on nothing else the SDK throws, and duck-typing keeps this
 * module free of any runtime dependency, so it can be tested on its own.
 */
function isPaddleApiError(
  err: unknown
): err is { code: string; type: string; detail: string; documentationUrl?: string; retryAfter?: number | null; message?: string } {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return typeof e.code === 'string' && typeof e.type === 'string' && typeof e.detail === 'string';
}

/**
 * A short, human-quotable reference. Not a security boundary and not unique
 * across all time; it only has to be findable in a log alongside a timestamp,
 * and short enough to read aloud to support.
 */
export function newCheckoutReference(): string {
  return 'KF-' + Math.random().toString(16).slice(2, 10);
}

/**
 * Turn whatever was thrown into the two halves: what to say, and what to record.
 */
export function classifyCheckoutFailure(err: unknown): ClassifiedCheckoutFailure {
  if (isPaddleApiError(err)) {
    const transient =
      TRANSIENT_PADDLE_CODES.has(err.code) ||
      (typeof err.retryAfter === 'number' && err.retryAfter > 0);

    return {
      code: transient ? 'checkout_unavailable' : 'checkout_misconfigured',
      // 503 when the provider asked us to wait; 500 when our own configuration
      // is what Paddle rejected. Both are server faults, and neither is the 4xx
      // that would tell a caller their request was wrong: it was not.
      status: transient ? 503 : 500,
      retryable: transient,
      log: {
        kind: 'paddle_api_error',
        message: typeof err.message === 'string' ? err.message : err.detail,
        paddleCode: err.code,
        paddleType: err.type,
        detail: err.detail,
        documentationUrl: err.documentationUrl,
        retryAfter: err.retryAfter ?? null,
      },
    };
  }

  // Never reached Paddle, or Paddle answered with something unparseable. The
  // credential is NOT implicated, so this must not be reported as a
  // misconfiguration; that would send an operator to rotate a working key.
  const isError = err instanceof Error;
  const message = isError ? err.message : String(err);
  const looksTransport =
    isError && (err.name === 'TypeError' || /fetch failed|network|ECONN|ETIMEDOUT|ENOTFOUND|socket/i.test(message));

  return {
    code: 'checkout_unavailable',
    status: 503,
    retryable: true,
    log: {
      kind: looksTransport ? 'transport' : 'unknown',
      message: `${isError ? err.name : typeof err}: ${message}`,
    },
  };
}
