# Billing sandbox: what order billing tests run in, and why the order is the deliverable

## The mistake this file exists to prevent

We minted one sandbox subscription with a browser checkout, spent it on the
account-deletion test, and that test cancelled it **immediately**. `canceled` is
terminal in Paddle. Every billing test after that one needed a fresh checkout.

The defect was not the deletion test. The defect was running it **first**. A
single sandbox subscription can serve almost every billing test we have, but only
if the irreversible one runs last. Ordering is the whole deliverable here.

`scratchpad/paddle-witness.cjs list` currently reports exactly one subscription,
`canceled`, `scheduledChange: null`, `currentBillingPeriod.endsAt: null`. That is
the wreckage of the mistake, and it is unusable for anything.

---

## Verified facts these rules rest on

Each of these was read from the Paddle API surface in
`node_modules/@paddle/paddle-node-sdk` (v3.7.0) or from Paddle's published docs.
None of it is inference.

**1. A scheduled cancellation is reversible.**
`PATCH /subscriptions/{id}` with body `{"scheduled_change": null}`. Paddle's
update-subscription reference: *"Change that's scheduled to be applied to a
subscription. When updating, you may only set to `null` to remove a scheduled
change."* In the SDK this is
`paddle.subscriptions.update(id, { scheduledChange: null })` — the type is
`scheduledChange?: UpdateSubscriptionScheduledChange | null`, and the SDK's
`convertToSnakeCase` preserves the null rather than stripping it, so
`{"scheduled_change": null}` genuinely reaches the wire.

**This is what makes one subscription reusable.** A period-end cancel can be
applied and undone as many times as we like.

**2. `canceled` is terminal and irreversible.**
Paddle's cancel-subscription reference: *"You can't reinstate a canceled
subscription."* There is no `subscriptions.uncancel`, and `activate()` is for
trials, not for cancelled subscriptions. Any test that reaches `canceled` has
consumed the subscription permanently.

**3. Subscriptions cannot be created directly through the API — but a checkout is
not the only way to get one.**
Paddle's subscriptions overview: *"You can't create a subscription directly.
Paddle automatically creates subscriptions for you when customers pay for
recurring items using the checkout, **or when you create and issue an invoice
using a manually-collected transaction**."*

The second path is entirely API-driven. Confirmed against the update-transaction
reference: the status *"may only be set to `billed` or `canceled`"*, and setting
it to `billed` is *"essentially issuing an invoice"* — at which point Paddle
assigns an invoice number and **creates an associated subscription**.

**4. A subscription created from an issued-but-unpaid invoice is `active`.**
It becomes `past_due` only once the payment terms elapse. Both `active` and
`past_due` are in `ENTITLED_STATUSES` in `src/lib/entitlement.ts`, so entitlement
behaves correctly on either side of that line. Choosing generous payment terms
buys a long-lived `active` subscription that nobody ever has to pay for.

**5. `subscriptions.paddle_subscription_id` is `UNIQUE`.**
From `supabase/migrations/20260414_subscriptions.sql`. A second row pointing at
the *same* Paddle subscription id is impossible at the database level.

**6. `getEntitlement` discards the read error.**
`src/lib/entitlement.ts` does `const { data } = await supabase...maybeSingle()`
and never inspects `error`. With two rows for one `user_id`, `maybeSingle()`
errors, `data` is null, and `computeTier(null, null)` returns `free` — a paying
customer is silently downgraded. This is item 72, and **it never touches Paddle
at all.**

---

## The ordering

Tiers run top to bottom. Nothing in a lower tier may run before every test above
it has passed, because lower tiers destroy what upper tiers need.

### Tier 0 — needs no Paddle subscription whatsoever

Run these first. They cost nothing and cannot consume anything, so there is no
excuse for them to be waiting on a checkout.

- **Item 72, the two-row entitlement bug.** Purely a database read.
  `getEntitlement` never calls Paddle. Produce it by inserting a second
  `subscriptions` row for the same `user_id` with a *different* (or `NULL`)
  `paddle_subscription_id`. See the note under Q4 below.
- **`computeTier` boundary cases.** An exported pure function. No client of any
  kind.
- **The swallowed Paddle error in the checkout path.**
  `src/app/api/paddle/checkout/route.ts` wraps `transactions.create` in a
  `catch` that flattens every possible failure — bad price id, rejected
  credential, network fault — into one generic 500. Force it with a deliberately
  invalid `PADDLE_PRO_PRICE_ID`. No subscription required.
- **Webhook handling.** Paddle exposes `simulations` and `simulationRuns` in the
  SDK; webhook events can be replayed without any real subscription behind them.

### Tier 1 — needs one `active` subscription, and gives it back

Every test here is reversible. Reset with
`paddle.subscriptions.update(id, { scheduledChange: null })` between runs, and
re-assert with `subscriptions.get(id)` that `scheduledChange` is null again
before starting the next one.

- **PR #106 `scheduleSubscriptionCancellation`.** Schedules a cancel at period
  end. Leaves the subscription `active` with a `scheduledChange` attached. Fully
  undoable.
- **PR #106 `readScheduledCancellation`.** Needs a scheduled change present, so
  it pairs naturally with the test above — run it while the change is attached,
  then again after the reset to confirm it returns `null`.
- **The double-click path.** Call `scheduleSubscriptionCancellation` twice
  without resetting in between. This is the one that exercises the
  catch-then-re-read arm in `scheduleAndVerify`, and it is otherwise very hard to
  trigger.
- **The two-subscription path (register #9).** Inject a stub `admin` client
  returning two ids. The second id may be a deliberately invalid one when the
  goal is to prove the `scheduled` count is honest on the failure arm.

### Tier 2 — consumes the subscription permanently

**Run last. Once this runs, the subscription is gone and the next test needs a
new one.**

- **Account deletion.** `src/lib/account-deletion/paddle.ts` calls
  `cancel(subscriptionId, { effectiveFrom: 'immediately' })` and asserts
  `status === 'canceled' && !scheduledChange`. Terminal by design and correctly
  so — the account is being destroyed, and billing to period end would charge for
  a service that no longer exists.

---

## Standing rules

1. **Never run an immediate cancel while any Tier 0 or Tier 1 test is still
   outstanding.** This is the rule that was broken.
2. **Reset, don't re-mint.** After any period-end cancel test, restore with
   `update(id, { scheduledChange: null })` and verify with `get`.
3. **Mint by invoice, not by checkout.** Create a manually-collected transaction
   and mark it `billed`. It needs `customer_id`, `address_id`, `items`, and
   `billing_details.payment_terms`. Set long payment terms so the subscription
   stays `active` rather than drifting to `past_due` mid-suite.
4. **A test that needs no Paddle subscription must never be scheduled behind one
   that does.** Most of our billing queue is Tier 0.
5. **Re-read `list` before and after every session** so the sandbox's state is
   never a matter of memory.

---

## Known unverified

- **Whether manual collection / invoicing is enabled on our sandbox account.**
  Paddle gates invoicing on live accounts; whether our sandbox permits it has not
  been tested. The cheap probe is to create a manually-collected transaction and
  leave it at `draft` — a draft creates no subscription, bills nobody, and can be
  cancelled. Only if that succeeds is rule 3 available to us.
- **Any upper bound Paddle enforces on `payment_terms`.** Not checked.
- **Whether `update` on a subscription carrying a `scheduledChange` requires the
  subscription to be `active`.** The docs do not restrict update by status, but
  we have not exercised it.
