# Billing sandbox: what order billing tests run in, and why the order is the deliverable

## The mistake this file exists to prevent

We minted one sandbox subscription with a browser checkout, spent it on the
account-deletion test, and that test cancelled it **immediately**. `canceled` is
terminal in Paddle. Every billing test after that one needed a fresh checkout.

The defect was not the deletion test. The defect was running it **first**. A
single sandbox subscription can serve almost every billing test we have, but only
if the irreversible one runs last. Ordering is the whole deliverable here.

`scratchpad/paddle-witness.cjs list` reported, when this was written, exactly one
subscription — `canceled`, `scheduledChange: null`,
`currentBillingPeriod.endsAt: null`. That was the wreckage of the mistake, and it
was unusable for anything. **UPDATED 2026-09-08: it now reports TWO, both
`canceled`** — that original one, and the invoice-minted
`sub_01m1yqapt1zxhjvamk4hzjmsfr` spent by Tier 2. Nothing in the sandbox is live.
Re-read `list` rather than trusting this paragraph; rule 5 exists because a
sentence like this one goes stale the moment anybody runs a test.

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

- **PR #106 `scheduleSubscriptionCancellation`. DONE 2026-09-07 — and this was
  the first time ANY line of our own code executed against Paddle.** Everything
  before it proved the SDK. Run against `sub_01m1yqapt1zxhjvamk4hzjmsfr` through
  a stub Supabase client, so no database was touched and no `subscriptions` row
  was created. Returned, by value:

  ```
  { ok: true, outcome: 'scheduled', scheduled: 1,
    effectiveAt: '2026-10-07T20:00:38.204Z' }
  ```

  Paddle then held `status=active`, `scheduledChange=cancel@2026-10-07T20:00:38.204Z`,
  `periodEnds=2026-10-07T20:00:38.204Z`. **`effectiveAt` equalled `endsAt`
  exactly**, and the `effectiveAt` our code returned is the one Paddle holds.
  Two further witnesses came free: our code issued
  `from(subscriptions).select('paddle_subscription_id').eq('user_id', …)` —
  **plural, no `.single()` or `.maybeSingle()`**, register #9's whole point — and
  the harness wrapped `cancel` so that anything but `next_billing_period` would
  throw. It never fired.
- **PR #106 `readScheduledCancellation`. DONE 2026-09-07.** Both halves, same
  run: with the change attached it returned `'2026-10-07T20:00:38.204Z'`, the
  exact value Paddle held; after `update({scheduledChange: null})` it returned
  `null`. It did not throw at any point, which is the degradation rule the module
  documents.
- **THE PREDICATE PAIR, PROVEN AGAINST ONE LIVE OBJECT — register #70 / PR #106's
  central finding, measured rather than argued.** Against the same live
  subscription carrying `status=active` and a `cancel` scheduled change:
  `verifiablyScheduledToCancel` (imported and genuinely executing) returned
  **true**; the deletion module's `verifiablyCanceled` expression returned
  **false on BOTH of its terms** — status is `active` not `canceled`, and a
  scheduled change IS attached. Reusing it here would have reported **failure on
  every success**.

  **BUT NOTE HOW THAT SECOND HALF HAD TO BE OBTAINED, because it is a real gap:**
  `verifiablyCanceled` at `src/lib/account-deletion/paddle.ts:116` is
  **module-private**. It cannot be imported, and the only exported path that
  reaches it is `cancelUserSubscriptions`, which performs an **immediate** cancel
  — terminal, Tier 2. So its expression was **transcribed** and applied to the
  live object. That is strong evidence and it is not the same thing as executing
  that function. **The predicate whose misuse PR #106 exists to prevent is not
  reachable by any test.** Exporting it is a one-line change and would close
  this.
- **The double-click path. DONE 2026-09-07 — and the module's own comment was
  VINDICATED, not wrong.** `scheduleSubscriptionCancellation` called twice with
  no reset in between. The comment said an already-scheduled subscription
  *"plausibly throws rather than returning cleanly"*; `plausibly` was doing real
  work there and nobody had checked. **It throws:**

  > `subscription_locked_pending_changes` — *"cannot update subscription, pending
  > scheduled changes"*

  So the **catch-then-`get()` re-read arm in `scheduleAndVerify` executed for the
  first time.** How that was established, since `scheduleAndVerify` is
  module-private: the happy path calls `cancel` only, the catch path calls
  `cancel` and then `get`. First click logged one SDK call; second click logged
  two, the second being the `get`. That is the arm's fingerprint.

  **What the customer is told, which is the part that matters commercially:**
  `{ ok: true, outcome: 'scheduled', scheduled: 1, effectiveAt: '2026-10-07T20:00:38.204Z' }`.
  A customer who clicks twice is told the cancellation is in place, **and it is**.
  Paddle, read independently afterwards, still held exactly one `cancel` change
  at the same `effectiveAt`: the second click changed nothing.

  **A nuance worth keeping:** that error says the subscription is *locked* for
  updates while a change is pending — yet `update({scheduledChange: null})` still
  clears it. Paddle special-cases removing a scheduled change, exactly as fact 1
  quotes. **The reset is the escape hatch from the lock**, which is what makes
  this whole tier repeatable.
- **The two-subscription path (register #9). DONE 2026-09-07 — and it turns the
  `CancelFailed` defect from a code-reading claim into executed evidence.** Stub
  returning the real id first and a deliberately invalid one second. Returned,
  verbatim:

  ```
  { ok: false,
    reason: 'cancel failed (Invalid request.) and state could not be re-read
             (Invalid request.) for sub_01knowflowbogus000000000000',
    scheduled: 1 }
  ```

  **The `scheduled` count is honest**, and the partial success is **real, not
  merely reported**: Paddle read independently held
  `scheduledChange=cancel@2026-10-07T20:00:38.204Z` on the first subscription
  while the call reported `ok: false`.

  **THE DEFECT, DEMONSTRATED — AND THEN FIXED THE SAME DAY. THE SEQUENCE BELOW IS
  THE POINT; IT IS WRITTEN AS HISTORY BECAUSE THE ORDER IN WHICH THESE FACTS
  ARRIVED IS WORTH MORE THAN THE END STATE.**

  **(1) WHAT WAS MEASURED, 2026-09-07.**
  `POST /api/account/subscription/cancel` was asserted against its own source: it
  branched on `cancelScheduleFailed(result)`, it **logged**
  `scheduled=${result.scheduled}` for an operator, and it returned
  `{ error: 'CancelFailed' }` — a body that was checked and did **not** carry
  `scheduled`. The card then rendered `labels.errorFailed`:

  > en — *"That did not work and nothing was changed. You can try again."*
  > ar — *"لم تنجح العملية ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى."*

  **(2) THE CUSTOMER-FACING FALSEHOOD THAT PRODUCED.** With `scheduled: 1` and
  Paddle genuinely holding `scheduledChange=cancel@2026-10-07T20:00:38.204Z` on
  the first subscription, the customer was told **nothing changed** while one of
  their subscriptions was on its way out. The library computed the honest number
  and the route threw it away.

  **(3) AND THE LOOP STOPPED AT THE FIRST FAILURE**, proven by a control with two
  bogus ids that touched nothing real: `scheduled: 0`, and the **second id was
  never attempted** — only one `cancel`/`get` pair was issued. For a user with
  **three** subscriptions whose second failed, the third was never attempted,
  kept billing, and the customer was told nothing had changed. **The blast radius
  grew with the number of subscriptions a user owned**, which is exactly the
  population register #9 is about.

  **(4) THE OWNER RULED THAT THE LOOP CONTINUES.** The customer's goal is to stop
  being billed, and stopping early leaves live subscriptions drawing money from
  someone who explicitly asked to stop — the worst outcome available. There is no
  opposing risk to weigh against it: every id in that list is the customer's own
  subscription, read with `.eq('user_id', userId)`, and they asked for all of
  them to end, so continuing cannot cancel anything they did not ask to cancel.
  Attempt every one, collect the failures, report the truth about what was
  scheduled and what was not.

  **(5) FIXED IN `8262dd7`, inside PR #106, PROVEN BY EXECUTION ON BOTH CASES.**
  The failure arm now carries `failed`, `total` and `effectiveAt`; the route
  sends a stable code plus the counts and a short support reference, keeping the
  reason string — which carries Paddle subscription ids — in the log, following
  `paddle-errors.ts` (#109) and `paddle-webhook-errors.ts` (#110). Executed:

  - **all fail** → `{ ok: false, scheduled: 0, failed: 2, total: 2 }`, and **all
    four SDK calls were issued** — the second id IS attempted now, which is the
    ruling executed. Code `CancelFailed`, and *"nothing was changed"* is shown,
    which is **true** in that case.
  - **partial** → `{ ok: false, scheduled: 1, failed: 1, total: 2 }` against a
    real scheduled change. Code `CancelPartial`, and the customer reads *"Only
    part of it worked. 1 of 2 subscriptions are now set to end, but 1 could not
    be cancelled and is still billing. Please try again to cancel the rest. If it
    fails again, contact support with the reference below."* — with an Arabic
    equivalent, and no placeholder left unfilled in either language.

  **(6) THE DEAD-ID CONSEQUENCE, WHICH IS WHY THE COPY ESCALATES.** A permanently
  invalid id in a customer's rows makes **every** retry report partial, forever.
  That is why the string does not merely say "try again": it says try again **and
  contact support with the reference**, so a customer cannot be looped
  indefinitely by an id that will never succeed.

  **WHERE THIS CODE LIVES.** All of it — `src/lib/subscription/cancel.ts`, the
  route and the card — is on **PR #106's branch (`feat/70-cancel-subscription`)
  and NOT on `main`**. A reader on `main` will not find `cancel.ts` there at all.
  Everything in this entry describes code that has not yet merged.

### Tier 2 — consumes the subscription permanently

**Run last. Once this runs, the subscription is gone and the next test needs a
new one.**

- **Account deletion. EXECUTED 2026-09-08 — and it ran to answer a DIFFERENT
  question than the one this tier was written for.** `src/lib/account-deletion/paddle.ts`
  calls `cancel(subscriptionId, { effectiveFrom: 'immediately' })` and asserts
  `status === 'canceled' && !scheduledChange`. Terminal by design and correctly
  so — the account is being destroyed, and billing to period end would charge for
  a service that no longer exists.

  **THE SEQUENCE, AS HISTORY, BECAUSE THE WRONG STEP IS THE INSTRUCTIVE ONE.**

  **(1) THE INFERENCE.** PR #106 shipped a period-end cancel, which made a state
  reachable that had never existed before: a subscription carrying a pending
  `scheduledChange`. Account deletion demands `status === 'canceled' &&
  !scheduledChange`. Earlier the same day we had **measured** Paddle throwing
  `subscription_locked_pending_changes` — *"cannot update subscription, pending
  scheduled changes"* — when a cancel was issued against an already-scheduled
  subscription. The reading was that a customer who cancels and then deletes
  their account would hit the same lock, fail the predicate on both terms, and be
  **unable to delete their account** — which is an Apple **5.1.1(v)** hard
  requirement. It was recorded as **INFERRED, not measured**: the lock had been
  observed for `next_billing_period`, never for `immediately`.

  **(2) THE MEASUREMENT OVERTURNED IT.** A cancel was scheduled through our own
  shipped code, then `cancelUserSubscriptions` was called against that exact
  state. `cancel(id, { effectiveFrom: 'immediately' })` **RESOLVED**:

  ```
  { call: 'cancel', effectiveFrom: 'immediately', outcome: 'RESOLVED',
    status: 'canceled', scheduled: null }
  ```

  **An immediate cancel OVERRIDES a pending scheduled change.** It is not a
  conflicting update, so the lock does not apply: Paddle cleared
  `scheduledChange` and set `canceled` in one step. The catch-then-re-read arm
  never executed — no `get()` was issued — so `cancelAndVerify` took its happy
  path. `cancelUserSubscriptions` returned
  `{ ok: true, outcome: 'canceled', canceled: 1 }`, so deletion proceeds past the
  irreversible boundary to `auth.admin.deleteUser` and the account deletes
  normally (**HTTP 200**, never the 409 or the 500). **There is no defect, and
  Apple 5.1.1(v) is not at risk.** The inference generalised a lock measured on
  one call shape to a call with different semantics.

  **(3) SO TIER 2 IS NOW EXECUTED IN SUBSTANCE**, though it was reached
  sideways: the immediate cancel, issued **through our own deletion code**
  against a real subscription, consuming it. That is exactly what this tier
  specifies, and it passed.

  **(4) `verifiablyCanceled` IS NOW EXPORTED, AND BOTH ITS CASES ARE REAL
  EXECUTIONS.** It was module-private, so Tier 1 could only **transcribe** its
  expression to show it returns **false** on a period-end success state. It is
  exported as of this work and returned **true** here against a genuinely
  `canceled` subscription — both terms true. The last transcription in this arc
  is gone.

  **(5) THE SANDBOX NOW HOLDS TWO CANCELED SUBSCRIPTIONS AND NOTHING LIVE.**
  `sub_01m1yqapt1zxhjvamk4hzjmsfr` (invoice-minted, spent here) and
  `sub_01m1mrte7wdpfewsbvmbztkwwg` (the older checkout-minted one). **Every
  further billing experiment now costs the full re-mint sequence in rule 3** —
  an API-created customer, an address with real postal detail, a draft, and two
  updates. Budget it before planning one; it is no longer a free precondition.

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
- **INVOICE NUMBERS ARE GENERATED, JUST NOT SYNCHRONOUSLY. Resolved 2026-09-07
  from outside the run.** The `billed` response carried `invoiceNumber: null` and
  `invoiceId: null`, which looked like it contradicted fact 3's quotation of
  Paddle's reference. It does not. Paddle subsequently emailed a real invoice for
  this transaction, **numbered `125643-10002`**, with the subject prefixed
  `[TEST]`. So fact 3 is correct and the original observation was right about the
  **moment**, not about the **field**: the number is assigned asynchronously and
  is simply absent from the immediate create response. **Do not conclude that
  invoice numbers are absent.** Anyone who needs one must re-read the transaction
  (or wait for the notification) rather than trust the create response. The
  invoice is deliberately left **unopened and unpaid** — paying it would move the
  subscription off the clean reset state that Tier 1 depends on.
- **THE SANDBOX OBJECTS ARE TEST DATA. Do not mistake either customer for a live
  one.** `ctm_01m1ynnm32kjrw80m8dggxry5y` — named *"KNOWFLOW TIER1 TEST - sandbox
  only"* — was created by API for the invoice path and carries an `example.com`
  address; its address `add_01m1ypjxntjwhjff94bf5y68ag` holds a placeholder
  Casablanca postal address. `ctm_01m1mrp2tw9xh6dymcccmkpdcr` is older, was
  created by a **browser checkout**, and carries a **real personal mailbox** — it
  is the customer behind the `canceled` subscription, and Paddle **rejected** it
  for manual collection (`transaction_customer_not_suitable_for_collection_mode`),
  so it is not on the billed transaction. **Unverified:** the `[TEST]` invoice
  mail reached a real inbox even though the billed transaction belongs to the
  `example.com` customer; the likely explanation is that Paddle routes sandbox
  notifications to the **account owner** rather than to the customer on the
  transaction, but that was not tested and must not be written down as fact.
- **The sandbox API host is `sandbox-api.paddle.com`, NOT
  `api.sandbox.paddle.com`.** The latter does not resolve, and the `ENOTFOUND`
  it produces looks exactly like "the sandbox is unreachable" or "the network is
  blocked" — which would send someone to a browser checkout for no reason. Read
  the SDK's own `Environment` constants rather than guessing the hostname.
- **Any upper bound Paddle enforces on `payment_terms`.** Not checked.
- **Whether `update` on a subscription carrying a `scheduledChange` requires the
  subscription to be `active`.** The docs do not restrict update by status, but
  we have not exercised it.
