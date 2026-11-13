import { NextRequest, NextResponse } from 'next/server';
import { paddleClient } from '@/lib/paddle';
import { createClient } from '@supabase/supabase-js';
import {
  classifyWebhookFailure,
  inspectSignatureHeader,
} from '@/lib/paddle-webhook-errors';
import { verifyPaddleSignature } from '@/lib/paddle-webhook-signature';
import { describeItems, proItemsProblem } from '@/lib/paddle-pro-grant';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Statuses that grant Pro (B3, Option A). Mirrors the entitling subset on the
 * read side (src/lib/entitlement.ts) MINUS the legacy 'pro' value: we no longer
 * WRITE 'pro' — we persist Paddle's own status verbatim and let getEntitlement
 * derive the tier. 'past_due' is entitling on purpose so a single failed charge
 * doesn't lock the user out; access continues through the grace window until
 * current_period_end, which getEntitlement enforces with its expiry check.
 */
const ENTITLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Postgres `foreign_key_violation`. `subscriptions.user_id` references
 * `auth.users(id)` ON DELETE CASCADE, so this SQLSTATE means exactly one thing
 * here: the user this event belongs to no longer exists. That is TERMINAL, not
 * transient — no number of retries brings the user back — so it is acknowledged
 * with 200 and logged, never retried.
 *
 * Every OTHER write failure is transient by assumption (the database was
 * unreachable, a pool was exhausted) and MUST be retried, which means returning
 * a non-2xx so Paddle redelivers.
 */
const FK_VIOLATION = '23503';

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  paddle_customer_id: string;
  updated_at: string;
};

/**
 * WRITE ONLY IF NEWER (fix/paddle-safety). Paddle does not promise delivery
 * order: a `subscription.updated (active)` sent before a cancellation can
 * arrive after it, and the row would be put back to active. So the row's
 * `updated_at` holds the `occurred_at` of the last Paddle event applied to it
 * (nothing else reads that column: `billing-note.ts` and the deletion path
 * read status and the subscription id only), and a write lands only on a row
 * whose `updated_at` is older. No schema change: each statement below is
 * atomic on its own, and the second attempt covers a row created between
 * them by a concurrent delivery.
 *
 *   1. UPDATE ... WHERE paddle_subscription_id = $id
 *        AND (updated_at IS NULL OR updated_at < occurred_at)
 *   2. if nothing updated and we may create the row: INSERT ... ON CONFLICT
 *      (paddle_subscription_id) DO NOTHING
 *   3. if that inserted nothing either (a row appeared): repeat 1 once.
 *
 * `applied: false` means a newer event was already applied (or, without a
 * user id, there is no row to update). A redelivery of the same event has the
 * same `occurred_at`, so it is not "older" and changes nothing.
 */
async function writeIfNewer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscriptionId: string,
  row: SubscriptionRow,
  userId: string | null
): Promise<{ applied: boolean; error: { code?: string; message: string } | null }> {
  const updateIfOlder = () =>
    supabase
      .from('subscriptions')
      .update(row)
      .eq('paddle_subscription_id', subscriptionId)
      .or(`updated_at.is.null,updated_at.lt."${row.updated_at}"`)
      .select('id');

  const first = await updateIfOlder();
  if (first.error) return { applied: false, error: first.error };
  if (first.data && first.data.length > 0) return { applied: true, error: null };
  if (!userId) return { applied: false, error: null };

  // user_id (NOT NULL) comes from customData, which Paddle persists on the
  // subscription and replays on every subsequent event.
  const inserted = await supabase
    .from('subscriptions')
    .upsert(
      { user_id: userId, paddle_subscription_id: subscriptionId, ...row },
      { onConflict: 'paddle_subscription_id', ignoreDuplicates: true }
    )
    .select('id');
  if (inserted.error) return { applied: false, error: inserted.error };
  if (inserted.data && inserted.data.length > 0) return { applied: true, error: null };

  const second = await updateIfOlder();
  if (second.error) return { applied: false, error: second.error };
  return { applied: !!(second.data && second.data.length > 0), error: null };
}

export async function POST(request: NextRequest) {
  // Read WITHOUT the secret and before anything can throw, so the failure path
  // can say whether the timestamp was stale. See paddle-webhook-errors.ts: a
  // slow handler fails verification with a perfectly correct secret, and that
  // was indistinguishable from a forgery.
  const signature = request.headers.get('paddle-signature');
  const signatureFacts = inspectSignatureHeader(signature, Date.now());

  try {
    // Both of these used to sit OUTSIDE the try. An unset SUPABASE_URL or a
    // failed body read threw past every handler here, producing a framework 500
    // with nothing of ours in the log.
    const supabase = getSupabaseAdmin();
    const rawBody = await request.text();

    // Constant time first (paddle-webhook-signature.ts). A wrong signature
    // stops here, with the SDK's own message, so classifyWebhookFailure reads
    // it exactly as before; the SDK's string compare below then only ever
    // sees a signature already proven right.
    if (!verifyPaddleSignature(rawBody, process.env.PADDLE_WEBHOOK_SECRET, signature, Date.now())) {
      throw new Error('[Paddle] Webhook signature verification failed');
    }

    const event = await paddleClient.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET!,
      signature ?? ''
    );

    // Logged on every failure below: `notificationId` is the handle
    // `paddle.notifications.replay()` takes, which is how a lost event is
    // recovered without us storing anything ourselves.
    const eventIds = { eventId: event.eventId, notificationId: event.notificationId };

    switch (event.eventType) {
      // One faithful sync for every subscription lifecycle event. Rather than
      // branching per event, we mirror Paddle's current status + period end
      // into our row and let getEntitlement decide the tier (Option A). This is
      // more robust than per-event logic: a transition we don't special-case
      // still lands correctly, and a missed 'created' self-heals on the next
      // 'updated'. The shared block also gives us discriminated-union narrowing
      // on event.data across all these cases.
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.trialing':
      case 'subscription.past_due':
      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.canceled': {
        const sub = event.data;
        const status = sub.status; // faithful Paddle status, not the legacy 'pro'
        const periodEnd = sub.currentBillingPeriod?.endsAt ?? null;
        const userId = sub.customData?.user_id ?? null;
        const entitling = ENTITLING_STATUSES.has(status);
        const where = { ...eventIds, subscriptionId: sub.id, eventType: event.eventType, status };

        // ONLY THE PRO PRICE, ONCE (fix/paddle-safety; paddle-pro-grant.ts).
        // A non-entitling status (canceled, paused) is never refused here: it
        // can only take Pro away, whatever was bought.
        if (entitling) {
          const proPriceId = process.env.PADDLE_PRO_PRICE_ID;
          if (!proPriceId) {
            // Fail closed, and 500 so Paddle redelivers once it is set: a
            // paying student must not be lost, nor anything granted unchecked.
            console.error('Paddle webhook: PADDLE_PRO_PRICE_ID is not set; refusing to grant Pro unchecked', where);
            return NextResponse.json({ error: 'pro price not configured' }, { status: 500 });
          }
          const problem = proItemsProblem(sub.items, proPriceId);
          if (problem) {
            // Acknowledged (200): redelivery cannot change what was bought.
            // This log line is the only record, so it names everything.
            console.error('Paddle webhook: not the Pro price at quantity 1; Pro not granted, row not written', {
              ...where,
              userId,
              reason: problem,
              items: describeItems(sub.items ?? []),
            });
            return NextResponse.json({ received: true, granted: false });
          }
        }

        // HARD OBLIGATION (registered after S1): it must be impossible to persist
        // an entitling row without a known expiry. If Paddle ever hands us an
        // entitling status with no current_period_end, refuse the write and 400
        // so it is retried and surfaced — never write a Pro row that would grant
        // unbounded access. A paying user briefly resolving to free is the safe,
        // self-correcting failure; an expiry-less Pro row is not.
        if (entitling && !periodEnd) {
          console.error(
            'Paddle webhook: refusing entitling subscription row without current_period_end',
            where
          );
          return NextResponse.json(
            { error: 'Entitling subscription missing current_period_end' },
            { status: 400 }
          );
        }

        // The ordering guard reads Paddle's own time for the event.
        const occurredAt = event.occurredAt;
        if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
          console.error('Paddle webhook: event without a readable occurred_at; not applied', { ...where, occurredAt });
          return NextResponse.json({ error: 'event without occurred_at' }, { status: 400 });
        }

        const row: SubscriptionRow = {
          status,
          current_period_end: periodEnd,
          paddle_customer_id: sub.customerId,
          updated_at: new Date(Date.parse(occurredAt)).toISOString(),
        };

        // Upsert-if-newer keyed on the UNIQUE paddle_subscription_id. Without
        // customData (not expected for subscriptions we create) only an
        // existing row is updated: user_id is NOT NULL, so a row we cannot
        // attribute is never inserted.
        const result = await writeIfNewer(supabase, sub.id, row, userId);

        // The result of this write was once discarded. A failure then returned
        // 200, Paddle recorded successful delivery, and the row silently kept
        // a stale status FOREVER. Paddle does not redeliver an event it
        // believes was accepted.
        if (result.error && result.error.code !== FK_VIOLATION) {
          console.error('Paddle webhook: subscription write failed', {
            ...where,
            code: result.error.code,
            message: result.error.message,
            hint: 'Answered 500 so Paddle redelivers. If attempts are exhausted, replay with paddle.notifications.replay(notificationId).',
          });
          return NextResponse.json(
            { error: 'subscription write failed' },
            { status: 500 }
          );
        }

        if (result.error) {
          // FK_VIOLATION: the user is gone. Acknowledge so Paddle stops
          // redelivering, and log loudly — this is the only record that a
          // billing event outlived its account.
          console.warn(
            'Paddle webhook: event for a deleted user; acknowledged without write',
            { ...where, userId }
          );
        } else if (!result.applied && status === 'canceled') {
          // A cancellation ALWAYS ends Pro. `canceled` is terminal in Paddle,
          // so even when a later-stamped event was applied first, the row
          // takes the cancellation; updated_at is left as it is, so the guard
          // still refuses anything older than what was already applied.
          const { error: cancelError } = await supabase
            .from('subscriptions')
            .update({ status, current_period_end: periodEnd, paddle_customer_id: sub.customerId })
            .eq('paddle_subscription_id', sub.id)
            .select('id');
          if (cancelError) {
            console.error('Paddle webhook: cancellation write failed', {
              ...where,
              code: cancelError.code,
              message: cancelError.message,
              hint: 'Answered 500 so Paddle redelivers.',
            });
            return NextResponse.json({ error: 'subscription write failed' }, { status: 500 });
          }
        } else if (!result.applied) {
          // Either a newer event was already applied to this row, or (no
          // custom_data) there is no row for this subscription to update:
          // register #87's zero-row case, now at least on the record.
          console.warn('Paddle webhook: not applied: an older event than the one already applied, or no row to update without custom_data', {
            ...where,
            occurredAt,
            hasUserId: !!userId,
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const failure = classifyWebhookFailure(error, signatureFacts);
    console.error('Paddle webhook failed', failure.log);
    return NextResponse.json(
      { error: failure.code, redeliveryCanHelp: failure.redeliveryCanHelp },
      { status: failure.status }
    );
  }
}
