# Auth errors in the page's language, and the app's line after sign-up: copy (DRAFT)

**Status: DRAFT, awaiting the owner.** Nothing here is in the dictionaries or
in `docs/copy/`. The strings are wired from `src/lib/auth/auth-copy-drafts.ts`
so the pages show them now; on approval they move into `ar.ts` and `en.ts` as
`auth.errors.*` and `auth.checkInboxApp`, with one batch row each in
`docs/copy/`, and the one line in `authErrorText` (`src/lib/auth/auth-error.ts`)
and the one line on the sign-up page read the dictionary instead.

Rules held: Modern Standard Arabic, short, no Latin word inside an Arabic
sentence, no plan, upgrade, price or free word, no em dash, Western digits.

## 1. The error sentences (audit cause #8)

Where: the red box on sign-up (`src/app/[locale]/signup/page.tsx`), sign-in
(`login/page.tsx`) and the new-password page (`reset-password/page.tsx`).
Before this change each showed GoTrue's English sentence as it came, on the
Arabic pages too. The forgot-password page never showed one and is unchanged.

The key is chosen from the error's **code**, then its **class name** (errors
auth-js raises itself), then its **status** (429), then the generic sentence.
The English message text is never read.

| GoTrue code (or class / status) | Forms | Key | en | ar |
|---|---|---|---|---|
| `invalid_credentials`, `AuthInvalidCredentialsError` | sign-in | `invalidCredentials` | The email or password is not correct. | البريد الإلكتروني أو كلمة المرور غير صحيحة. |
| `email_not_confirmed` | sign-in | `emailNotConfirmed` | Your email is not confirmed yet. Open the link we sent you, then sign in. | لم تؤكد بريدك الإلكتروني بعد. افتح الرابط الذي أرسلناه إليك، ثم سجّل الدخول. |
| `weak_password`, `AuthWeakPasswordError` | sign-up, new password | `weakPassword` | This password is too weak. Choose a longer one that is harder to guess. | كلمة المرور هذه ضعيفة. اختر كلمة أطول يصعب تخمينها. |
| `same_password` | new password | `samePassword` | Choose a password different from your current one. | اختر كلمة مرور مختلفة عن كلمتك الحالية. |
| `email_address_invalid` | sign-up | `invalidEmail` | This email address cannot be used. Check it and try again. | لا يمكن استعمال هذا البريد الإلكتروني. تحقق منه وجرّب مرة أخرى. |
| `over_email_send_rate_limit` | sign-up | `emailRateLimit` | We could not send the email right now. Wait a few minutes, then try again. | لم نستطع إرسال الرسالة الآن. انتظر بضع دقائق، ثم جرّب مرة أخرى. |
| `over_request_rate_limit`, or any 429 | all three | `requestRateLimit` | Too many attempts. Wait a few minutes, then try again. | محاولات كثيرة. انتظر بضع دقائق، ثم جرّب مرة أخرى. |
| `session_not_found`, `session_expired`, `refresh_token_not_found`, `refresh_token_already_used`, `AuthSessionMissingError` | new password | `sessionMissing` | REUSED, approved `auth.resetNoSession` | REUSED, approved `auth.resetNoSession` |
| `AuthRetryableFetchError` (no answer, or 502, 503, 504), `request_timeout` | all three | `network` | We could not reach the server. Check your connection and try again. | لم نستطع الوصول إلى الخادم. تحقق من اتصالك وجرّب مرة أخرى. |
| `user_already_exists`, `email_exists`, `identity_already_exists`; any other code; a key outside the form | all three | `generic` | Something went wrong. Try again in a moment. | حدث خطأ. جرّب مرة أخرى بعد قليل. |

Why the send limit says nothing of an earlier mail: the same code comes from
the project's hourly mail cap, which is about no one, so "a link was just
sent" (the approved `auth.forgotRateLimited`) would be false there. It is not
reused for that reason.

## 2. Disclosure review: never more than before

| Case | What today's English tells | What ours tells | Verdict |
|---|---|---|---|
| Sign-in, wrong password or unknown address (`invalid_credentials`) | Nothing: one sentence for both | The same one sentence for both | Kept |
| Sign-in, `email_not_confirmed` | That the account exists and is unconfirmed. GoTrue's password grant checks the password first, so only someone holding the right password sees it (from GoTrue's grant order, not re-tested on the live project) | The same, and what to do | Kept (not increased) |
| Sign-up, `user_already_exists` / `email_exists` | "User already registered" names an existing account. With confirm-email on, GoTrue answers a confirmed address with an obfuscated user, not this code (the sign-up page's own note, `signup.go:349`), so it is reachable only if that setting changes | The generic sentence, the same as any unknown error | **Reduced** |
| Sign-up, `over_email_send_rate_limit` | "For security purposes, you can only request this after N seconds": that this address asked for a mail moments ago | "We could not send the email right now": no seconds, no earlier request | **Reduced** (it still differs from success; removing that needs a handler change, out of scope) |
| `over_request_rate_limit` | About this device's requests, not an account | The same | Kept |
| New password, `same_password` | That the typed password is the current one, to the holder of the link's session | The same | Kept |
| Weak password, invalid email, network, unknown | About the input or the connection | The same | Kept |
| Forgot-password | Never branches on the address (429 only, approved `auth.forgotRateLimited`) | Unchanged | Kept |

## 3. The app's line under the check-inbox notice (audit cause #3)

Where: the sign-up page's notice after a sign-up that waits for the mail, in
the app only (`platform === 'native'`). The web is unchanged.

| | en | ar |
|---|---|---|
| line | After you confirm from the email, come back to the app and sign in. | بعد التأكيد من الرسالة، ارجع إلى التطبيق وسجّل الدخول. |

Why it is true:

- After `signUp` succeeds in the app, `markSeenAfterSignUp` writes `kf-seen=1`
  (`src/app/[locale]/signup/page.tsx:87`, `src/lib/first-screen.ts:64-66`).
- The mail link opens in Safari (no universal links), so its session never
  reaches the app (`src/lib/first-screen.ts:52-61`).
- The app's first request goes to the dashboard; signed out, the middleware
  sends a native device holding `kf-seen=1` to sign-in
  (`src/middleware.ts:133`, `src/lib/first-screen.ts:47-50`,
  `src/lib/supabase/middleware.ts:43`). Activation 3's signed-in iOS run
  asserts it (`landing-app-seen` lands on login).
- If the app is still open, the student comes back to this same sign-up page,
  with the notice and the sign-in link under the form (`signup/page.tsx:239`).
  Either way "sign in" is the next step.

## Reused, approved strings (no change)

| Where | Key |
|---|---|
| New-password page, the link's session is gone | `auth.resetNoSession` |
| Sign-up, the two passwords differ (unchanged, checked before any request) | `auth.passwordMismatch` |
| The notice's title and sentence | `auth.checkInboxTitle`, `auth.checkInboxBody` |
