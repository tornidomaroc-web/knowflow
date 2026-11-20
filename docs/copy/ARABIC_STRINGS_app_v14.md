# Arabic copy, app v14: Sign in with Apple (PR #341)

**APPROVED by the owner 2026-11-20 ("موافق").** Five keys: `auth.appleUnfinished` and four of `dashboard.settings.deleteAccount` (`appleStep`, `appleUnconfirmed`, `appleNotRevoked`, `appleDone`). Copied byte for byte by script from the owner's approved set (`siwa_strings_approved.md`, sha256 `75db03a41d8dc2f093c771c356650f4bc3f12cd6ba167d84d6b55ca60cccf93d`), replacing the drafts of `docs/copy-drafts/siwa_v1.md` (now a pointer here). Only `appleStep` changed from the draft, in both languages.

Where they show: `auth.appleUnfinished` under the Apple button on /login and /signup in the app (shell 2 with the KnowFlowApple plugin), when the sheet or Supabase refused (Cancel in Apple's sheet shows nothing). `appleStep`: the delete card, open, for an account with an Apple identity where the plugin answers and the server holds the Apple key; it replaces the typed-email field. `appleUnconfirmed`: the same card when Apple's confirmation did not work; the typed-email field appears under it. `appleNotRevoked` with `appleDone`: the only thing on the page after a deletion of an Apple account whose Apple access was not ended (the web, or Apple did not answer); Done is a full link to the locale home. The button labels `auth.appleLogin` and `auth.appleSignup` stay as approved in public v1 (Apple's own wording); `auth.appleFailed` is retired (`scripts/verify-arabic-copy.mjs`, RETIRED) and its row stays in public v1 as the record. Every key was a DRAFT wired for review and never approved before this batch, so the "Old Arabic" column says "(new key)"; `scripts/verify-arabic-copy.mjs` asserts the new value, and `scripts/verify-apple-signin.mjs` (section 8) holds both languages to this file.

**VERIFY ON BUILD 9: the iPhone Settings path in `appleNotRevoked`** ("Settings, your name, Sign-In & Security, Sign in with Apple") is approved as wording but not yet seen on a device. Open the path on the build 9 test iPhone, in English and in Arabic; a difference is a `_fix` batch here.

English (`src/lib/i18n/locales/en.ts`):

- `auth.appleUnfinished`: Sign in with Apple did not finish. Try again.
- `dashboard.settings.deleteAccount.appleStep`: You signed in with Apple. Apple will ask you to confirm the deletion. After that, KnowFlow can no longer access your Apple Account.
- `dashboard.settings.deleteAccount.appleUnconfirmed`: Apple could not confirm it is you. Type your email address instead.
- `dashboard.settings.deleteAccount.appleNotRevoked`: Your account is deleted. To remove KnowFlow from your Apple Account too, open Settings on your iPhone, tap your name, then Sign-In & Security, then Sign in with Apple.
- `dashboard.settings.deleteAccount.appleDone`: Done

| Key | New Arabic | Old Arabic |
|---|---|---|
| `auth.appleUnfinished` | لم يكتمل تسجيل الدخول باستخدام Apple. حاول مجددًا. | (new key) |
| `dashboard.settings.deleteAccount.appleStep` | سجّلت الدخول باستخدام Apple. ستطلب منك Apple تأكيد الحذف. بعده ينتهي وصول KnowFlow إلى حساب Apple. | (new key) |
| `dashboard.settings.deleteAccount.appleUnconfirmed` | تعذّر على Apple التأكد من هويتك. اكتب بريدك الإلكتروني بدلًا من ذلك. | (new key) |
| `dashboard.settings.deleteAccount.appleNotRevoked` | تم حذف حسابك. لإزالة KnowFlow من حساب Apple أيضًا، افتح الإعدادات في iPhone، واضغط على اسمك، ثم تسجيل الدخول والأمان، ثم تسجيل الدخول باستخدام Apple. | (new key) |
| `dashboard.settings.deleteAccount.appleDone` | تم | (new key) |

## Not dictionary keys

The privacy page sentence (English only, `src/app/[locale]/(site)/privacy/page.tsx`): Apple, only if you choose Sign in with Apple in the app. Apple gives KnowFlow an email address, which can be a private address that forwards to yours, and your name the first time you sign in. When you delete your account in the app, KnowFlow asks Apple to end its access.
