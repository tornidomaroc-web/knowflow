# Arabic copy, app v9: auth errors in the page's language, and the app's line after sign-up (#317)

Approved by the owner on 2026-11-10 for PR #317, as SHORTER copy that replaces the drafts in `docs/copy-drafts/auth_errors.md` (now marked shipped). The English twins were approved with them:

- `auth.errors.invalidCredentials`: The email or password is incorrect.
- `auth.errors.emailNotConfirmed`: Your email is not confirmed yet. Open the confirmation link, then sign in.
- `auth.errors.weakPassword`: Weak password. Choose a longer one.
- `auth.errors.samePassword`: Choose a new password.
- `auth.errors.invalidEmail`: This email is not valid. Check it.
- `auth.errors.emailRateLimit`: Could not send the email. Try again in a few minutes.
- `auth.errors.requestRateLimit`: Too many attempts. Try again in a few minutes.
- `auth.errors.network`: Could not connect. Check your internet.
- `auth.errors.generic`: Something went wrong. Try again.
- `auth.checkInboxApp` (app only): After confirming, come back to the app and sign in.

`auth.errors.*` is shown in the red box on sign-up, sign-in and the new-password page, chosen from the error's code by `src/lib/auth/auth-error.ts` (the `sessionMissing` key reuses the approved `auth.resetNoSession`, unchanged). `auth.checkInboxApp` is shown in the app only, under the check-inbox notice after sign-up (`src/app/[locale]/signup/page.tsx`). Every key is NEW (added by #317), so the "Old Arabic" column says so; the proof asserts the new value only.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `auth.errors.invalidCredentials` | البريد أو كلمة المرور غير صحيحة. | (new key) |
| `auth.errors.emailNotConfirmed` | لم تؤكد بريدك بعد. افتح رابط التأكيد ثم ادخل. | (new key) |
| `auth.errors.weakPassword` | كلمة المرور ضعيفة. اختر كلمة أطول. | (new key) |
| `auth.errors.samePassword` | اختر كلمة مرور جديدة. | (new key) |
| `auth.errors.invalidEmail` | هذا البريد غير صالح. تحقق منه. | (new key) |
| `auth.errors.emailRateLimit` | تعذّر إرسال الرسالة. حاول بعد دقائق. | (new key) |
| `auth.errors.requestRateLimit` | محاولات كثيرة. حاول بعد دقائق. | (new key) |
| `auth.errors.network` | تعذّر الاتصال. تحقق من الإنترنت. | (new key) |
| `auth.errors.generic` | حدث خطأ. حاول مرة أخرى. | (new key) |
| `auth.checkInboxApp` | بعد التأكيد، عد إلى التطبيق وادخل. | (new key) |
