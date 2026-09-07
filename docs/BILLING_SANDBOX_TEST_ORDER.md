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

**EXECUTED 2026-09-07 — this is no longer read, it is run.** Two full passes
against `sub_01m1yqapt1zxhjvamk4hzjmsfr`, an invoice-minted subscription, four
reads each pass, values identical across both:

| read | value |
|---|---|
| `cancel({effectiveFrom:'next_billing_period'})` returns | `status=active  scheduledChange=cancel@2026-10-07T20:00:38.204Z` |
| `get()` after cancel | `status=active  scheduledChange=cancel@2026-10-07T20:00:38.204Z` |
| `update({scheduledChange:null})` returns | `status=active  scheduledChange=null` |
| `get()` after reset | `status=active  scheduledChange=null` |

**2 of 2 clean.** Repeatability is the load-bearing part and it is now measured,
not inferred: a loop that worked once and failed the second time would be worse
than one that never worked, because this whole ordering assumes the subscription
can be reset and handed back.

**MEASURED, AND IT IS PR #106's DESIGN ASSERTION:**
`scheduledChange.effectiveAt` equalled `currentBillingPeriod.endsAt` **exactly**
— both `2026-10-07T20:00:38.204Z`. "Period end, never immediately" has now been
executed against Paddle rather than argued from the SDK's types.

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

The second path is API-driven **only if the API key carries the right
permissions, and only as a multi-step sequence.** Confirmed against the
update-transaction reference: the status *"may only be set to `billed` or
`canceled`"*, and setting it to `billed` is *"essentially issuing an invoice"* —
at which point Paddle assigns an invoice number and **creates an associated
subscription**.

**CORRECTED 2026-09-07 BY EXECUTION.** The sentence "entirely API-driven" was
written from the docs and is wrong as an unqualified claim. See rule 3 for what
the API actually demands, and "Known unverified" for the part that is still not
proven. The correction was not free: it cost four blocked attempts against the
sandbox, each returning a different Paddle error code.

**4. A subscription created from an issued-but-unpaid invoice is `active`.**
**MEASURED 2026-09-07**, no longer read: the invoice was issued and never paid,
and Paddle minted `sub_01m1yqapt1zxhjvamk4hzjmsfr` with `status: active`,
`collectionMode: manual`, `startedAt: 2026-09-07T20:00:38.204Z` and
`currentBillingPeriod.endsAt: 2026-10-07T20:00:38.204Z` — 30 days, matching the
30-day payment terms set on the transaction.
It becomes `past_due` only once the payment terms elapse. Both `active` and
`past_due` are in `ENTITLED_STATUSES` in `src/lib/entitlement.ts`, so entitlement
behaves correctly on either side of that line. Choosing generous payment terms
buys a long-lived `active` subscription that nobody ever has to pay for.

**5. `subscriptions.paddle_subscription_id` is `UNIQUE`.**
From `supabase/migrations/20260414_subscriptions.sql`. A second row pointing at
the *same* Paddle subscription id is impossible at the database level.

**6. `getEntitlement` discarded the read error. FIXED — this fact is now
HISTORY, not a live defect.**
It *did* read `const { data } = await supabase...maybeSingle()` and never inspect
`error`. With two rows for one `user_id`, `maybeSingle()` errored, `data` was
null, and `computeTier(null, null)` returned `free` — a paying customer silently
downgraded. It never touched Paddle at all, which is why it was Tier 0.

**Closed by [#108](https://github.com/tornidomaroc-web/knowflow/pull/108)
(`4e52171`).** `.maybeSingle()` is gone; `readEntitlement` reads
`.eq('user_id', userId)` with no row-count assumption, checks `error` **before**
`data`, and resolves through a pure `entitlementFromRows` that takes the furthest
`current_period_end` among entitling rows. 15/15 cases against a real Postgres
and PostgREST. Register **#72** is PARTIALLY CLOSED — the read half fixed, the
`UNIQUE(user_id)` constraint REFUSED, with register **#9** closed alongside it.
Corrected here because this document is read as a plan, and a plan that
describes deleted code sends someone to reproduce a bug that no longer exists.

---

## The ordering

Tiers run top to bottom. Nothing in a lower tier may run before every test above
it has passed, because lower tiers destroy what upper tiers need.

### Tier 0 — needs no Paddle subscription whatsoever

Run these first. They cost nothing and cannot consume anything, so there is no
excuse for them to be waiting on a checkout.

- ~~**Item 72, the two-row entitlement bug.**~~ **DONE — shipped in #108,
  2026-09-06.** Was: purely a database read; `getEntitlement` never calls Paddle;
  reproduce by inserting a second `subscriptions` row for the same `user_id` with
  a different (or `NULL`) `paddle_subscription_id`. Kept rather than deleted
  because the reproduction recipe is still how the two-row case is built for any
  future test. See fact 6.
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
3. **Mint by invoice, not by checkout — but it is NOT one call, and NOT free of
   account setup.** Create a manually-collected transaction and bring it to
   `billed`. It needs `customer_id`, `address_id`, `items`, and
   `billing_details.payment_terms`. Set long payment terms so the subscription
   stays `active` rather than drifting to `past_due` mid-suite.

   **The four things this rule got wrong, each corrected by an executed Paddle
   error on 2026-09-07. Read them before planning a session around this path.**

   **(a) IT IS AT LEAST TWO UPDATES, NEVER ONE.** Paddle validates the status
   transition against the **pre-update** state, so you cannot attach the missing
   fields and bill in the same call.
   `update({ customerId, status: 'billed' })` on a `draft` returns:

   > `bad_request` — *"transaction needs to have ready status"*

   The sequence is: `update({ customerId, addressId })` → transaction becomes
   `ready` → `update({ status: 'billed' })`.

   **(b) IT IS NOT PURELY API-DRIVEN WITHOUT AN `Addresses` GRANT.** A billed
   transaction needs an `address_id`, and a Paddle API key does not necessarily
   have permission to make one. Ours did not:

   > `forbidden` — *"not authorized to create customer-address"*
   > `forbidden` — *"not authorized to read customer-address"*

   Both verbs were denied, so no existing address could be reused either. This
   is a **credential scope** problem and is fixed in the Paddle dashboard
   (Developer Tools → Authentication → API keys → permissions), not in code.
   Check it **before** planning a session around this path: a draft that
   succeeds tells you nothing about whether you can finish.

   **(c) THE CUSTOMER MUST BE SUITABLE FOR MANUAL COLLECTION.** A customer
   created by an earlier **checkout** was rejected:

   > `transaction_customer_not_suitable_for_collection_mode` —
   > *"Customer entity must be suitable for the transactions current collection mode"*

   A customer created through `customers.create` was accepted. Do not expect to
   reuse the customer from a previous checkout-minted subscription.

   **(d) THE ADDRESS MUST ALSO BE SUITABLE, AND "SUITABLE" MEANS A REAL POSTAL
   ADDRESS. ESTABLISHED BY EXECUTION 2026-09-07 — both halves.**

   **Refused.** An address carrying only `countryCode: 'MA'` and a `description`:

   > `transaction_address_not_suitable_for_collection_mode` —
   > *"Address entity must be suitable for the transactions current collection mode"*

   **Accepted.** The *same* address, completed in place with
   `addresses.update(customerId, addressId, ...)` — `firstLine`, `city`,
   `postalCode`, `region` alongside the country. The attach then returned `ready`
   immediately, and `status: 'billed'` succeeded on the next call.

   An invoice has to be addressed somewhere, and a bare country is nowhere. Give
   the address real postal detail before attaching it. Note the fix is an
   `update` on the existing address, not a second `create` — Paddle is happy to
   complete one in place, which keeps the sandbox object count flat.
4. **A test that needs no Paddle subscription must never be scheduled behind one
   that does.** Most of our billing queue is Tier 0.
5. **Re-read `list` before and after every session** so the sandbox's state is
   never a matter of memory.

---

## Known unverified

- ~~**Whether manual collection / invoicing is enabled on our sandbox
  account.**~~ **ANSWERED 2026-09-07: IT IS ENABLED.** A `status: 'billed'` call
  was reached and succeeded, minting **`sub_01m1yqapt1zxhjvamk4hzjmsfr`** —
  `active`, `collectionMode: manual`, period end `2026-10-07T20:00:38.204Z`. The
  full sequence, end to end and with no browser checkout anywhere in it:
  `transactions.create` (manual, draft) → `customers.create` →
  `addresses.create` + `addresses.update` (full postal detail) →
  `transactions.update({customerId, addressId})` → `ready` →
  `transactions.update({status:'billed'})` → Paddle mints the subscription.
  **Rule 3 is real and available.** Keep the caution that replaced this entry
  though: the draft probe alone never answered this, and a future account or key
  can fail at any of the four gates in rule 3 without the draft noticing.
- ~~**What makes an address "suitable" for manual collection.**~~ **ANSWERED —
  see rule 3(d).** Full postal detail, not a bare country.
- **Whether `subscriptions.update` REQUIRES the subscription to be `active`.
  STILL OPEN, and deliberately not rounded up.** The 2026-09-07 loop called
  `update({scheduledChange:null})` twice and both succeeded — but the
  subscription was `active` on both occasions, so what was shown is that update
  **works while** active, never that active is **required**. Settling it needs a
  non-`active` subscription carrying a scheduled change, which we do not have and
  cannot cheaply manufacture (`past_due` arrives only when the payment terms
  elapse). Treat the reset as proven for the `active` case only.
- **OBSERVED BUT NOT MEASURED: the billed response carried `invoiceNumber: null`
  and `invoiceId: null`.** Fact 3 above, quoting Paddle's reference, says setting
  the status to `billed` is *"essentially issuing an invoice"* and assigns an
  invoice number. The subscription was minted regardless, so nothing downstream
  depended on it. **Only the immediate response was read** — whether those fields
  populate asynchronously was never checked, so this is recorded as an
  observation and explicitly NOT as a correction to fact 3. Anyone who needs the
  invoice number should re-read the transaction rather than trust the create
  response.
- **The sandbox API host is `sandbox-api.paddle.com`, NOT
  `api.sandbox.paddle.com`.** The latter does not resolve, and the `ENOTFOUND`
  it produces looks exactly like "the sandbox is unreachable" or "the network is
  blocked" — which would send someone to a browser checkout for no reason. Read
  the SDK's own `Environment` constants rather than guessing the hostname.
- **Any upper bound Paddle enforces on `payment_terms`.** Not checked.
- **Whether `update` on a subscription carrying a `scheduledChange` requires the
  subscription to be `active`.** The docs do not restrict update by status, but
  we have not exercised it.
