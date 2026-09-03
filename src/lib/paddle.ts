import { Paddle, Environment } from '@paddle/paddle-node-sdk';

/**
 * The Paddle client, with its environment driven by configuration rather than
 * by omission.
 *
 * WHY THIS CHANGED. `new Paddle(key)` with no options resolves to
 * `Environment.production` -> `https://api.paddle.com`. That default was not a
 * decision anyone recorded; it was the absence of one, and it meant there was no
 * way to exercise the cancellation path in `lib/account-deletion/paddle.ts`
 * against anything but live billing. That module's most important claim -- that
 * Paddle's cancel defaults to `next_billing_period` and returns a subscription
 * still `active`, so the END STATE must be asserted rather than the call's
 * return -- has never been executed. A sandbox is the only way to execute it
 * without taking money from a real person.
 *
 * PRODUCTION REMAINS THE DEFAULT, AND DELIBERATELY SO. Only the exact string
 * `sandbox` switches environments. An unset, empty, misspelled or unexpected
 * `PADDLE_ENV` yields production -- the behaviour every existing deployment has
 * today -- so adding this file cannot, by itself, move any traffic anywhere.
 *
 * THE KEY AND THE ENVIRONMENT MUST AGREE, AND A MISMATCH IS FATAL RATHER THAN
 * SILENT. Paddle issues environment-scoped credentials: sandbox API keys carry
 * `_sdbx`, live keys do not. The dangerous combination is not the one that
 * errors -- it is the one that half-works. A sandbox key left in a production
 * environment would make every billing call fail against live subscription ids;
 * a live key with `PADDLE_ENV=sandbox` would point real cancellations at a
 * database that has never heard of them, and `cancelUserSubscriptions` would
 * report a failure it cannot explain while a real subscription kept billing.
 * Both are configuration errors that should stop the process at import, not
 * surface later as an unexplained billing incident. This is the same principle
 * the deletion orchestrator applies to unverified state: refuse rather than
 * proceed on something that was never checked.
 */
const rawEnv = process.env.PADDLE_ENV;
const isSandbox = rawEnv === 'sandbox';
const environment = isSandbox ? Environment.sandbox : Environment.production;

const apiKey = process.env.PADDLE_API_KEY;

// Only meaningful once a key exists; an absent key is the SDK's own error to
// raise, and pre-empting it here would replace a clear message with a vaguer one.
if (apiKey) {
  const keyLooksSandbox = apiKey.includes('_sdbx');
  if (keyLooksSandbox !== isSandbox) {
    throw new Error(
      `PADDLE_ENV=${rawEnv ?? '(unset -> production)'} does not match the API key ` +
        `(key ${keyLooksSandbox ? 'is' : 'is not'} a sandbox key). Refusing to start: ` +
        `a mismatched Paddle environment fails silently at the worst possible moment.`
    );
  }
}

export const paddleClient = new Paddle(apiKey!, { environment });
