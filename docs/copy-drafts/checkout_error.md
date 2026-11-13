# The checkout error line: a true sentence (DRAFT, NOT APPROVED, NOT WIRED)

**Status: DRAFT for the owner, 2026-11-13.** Nothing here is in `ar.ts` or
`en.ts`, and nothing in `src/` reads this file. If approved, the two strings
replace `pricing.checkout.misconfigured` in a copy PR with a batch file in
`docs/copy/`.

## Why

The line a student reads when the checkout cannot start says the team "has
been notified". Nothing notifies anyone: `src/app/api/paddle/checkout/route.ts`
only writes a `console.error` line to the Vercel runtime log, joined to the
reference the page shows (`KF-xxxxxxxx`). The sentence promises an action that
does not happen.

Current (quoted from the dictionaries, not retyped):

| Key | en (`en.ts:125`) | ar (`ar.ts:116`) |
|---|---|---|
| `pricing.checkout.misconfigured` | Checkout is not available right now. This is a problem on our side, and our team has been notified. | الدفع غير متاح حالياً. المشكلة من جانبنا، وقد تم إبلاغ فريقنا. |

The reference label that follows it stays as it is: en `en.ts:127`
"Reference:", ar `ar.ts:118` "الرقم المرجعي:".

## Proposed

| Key | en | ar |
|---|---|---|
| `pricing.checkout.misconfigured` | Payment can't start right now. Please try again later. If it keeps happening, contact us and give the reference below. | لا يمكن بدء الدفع الآن. حاول مرة أخرى لاحقًا، وإن تكرر ذلك فراسلنا واذكر الرقم المرجعي أدناه. |

Rules held: short, plain, true. No plan, price, upgrade, subscription or
"free" word. No promise that anyone was told. It asks for the one thing that
lets the owner find the log line: the reference. Modern Standard Arabic, no
Latin word inside the Arabic sentence, no em dash.

Not changed: `pricing.checkout.unavailable` ("could not reach the payment
provider ... try again in a moment") and `pricing.checkout.failed` are true
as written.
