# Sign in with Apple (big item 4f, PR 1): strings (DRAFTS)

**Status: DRAFTS for the owner's review.** Written in the short imperative
voice of the approved voice set (docs/copy/ARABIC_STRINGS_app_v13.md: "Try
again", "حاول مجددًا"). Modern Standard Arabic, no em dash, Western numerals,
no purchase word. They are wired in the code as written here, and
`scripts/verify-apple-signin.mjs` holds `en.ts` and `ar.ts` to this table
byte for byte. Once the owner approves them, they move to a batch under
`docs/copy/` the way app v13 did, and this file says so.

The two button labels stay as approved in public v1: `auth.appleLogin`
("Sign in with Apple") and `auth.appleSignup` ("Continue with Apple"). They
are Apple's own required wording.

`auth.appleFailed` is RETIRED (its "could not open" was the web OAuth
wording; in the app the Apple sheet always opens). `auth.appleUnfinished`
takes its place. The retired row stays in public v1 as the owner's record.

## The table

| Key | English | Arabic |
|---|---|---|
| `auth.appleUnfinished` | Sign in with Apple did not finish. Try again. | لم يكتمل تسجيل الدخول باستخدام Apple. حاول مجددًا. |
| `dashboard.settings.deleteAccount.appleStep` | You signed in with Apple. Confirm with Apple when it asks. This also ends KnowFlow's access to your Apple Account. | سجّلت الدخول باستخدام Apple. أكّد عبر Apple عندما يطلب منك ذلك. ينهي هذا أيضًا وصول KnowFlow إلى حساب Apple. |
| `dashboard.settings.deleteAccount.appleUnconfirmed` | Apple could not confirm it is you. Type your email address instead. | تعذّر على Apple التأكد من هويتك. اكتب بريدك الإلكتروني بدلًا من ذلك. |
| `dashboard.settings.deleteAccount.appleNotRevoked` | Your account is deleted. To remove KnowFlow from your Apple Account too, open Settings on your iPhone, tap your name, then Sign-In & Security, then Sign in with Apple. | تم حذف حسابك. لإزالة KnowFlow من حساب Apple أيضًا، افتح الإعدادات في iPhone، واضغط على اسمك، ثم تسجيل الدخول والأمان، ثم تسجيل الدخول باستخدام Apple. |
| `dashboard.settings.deleteAccount.appleDone` | Done | تم |

## Where each one shows

- `auth.appleUnfinished`: under the Apple button on /login and /signup (the
  app, shell 2 with the KnowFlowApple plugin), when the sheet or Supabase
  refused. A tap on Cancel in Apple's sheet shows nothing.
- `appleStep`: the delete card, open, for an account with an Apple identity,
  in the app where the plugin answers and the server holds the Apple key.
  It replaces the typed-email field: the student confirms in Apple's sheet.
- `appleUnconfirmed`: the same card when Apple's confirmation did not work
  (another Apple ID in the sheet, an expired code, the server could not
  reach Apple). The typed-email field appears under it.
- `appleNotRevoked`: after a deletion of an Apple account whose Apple access
  was not ended (deleted on the web, or Apple did not answer). Shown in the
  card with `appleDone`, a link to the home page.

## VERIFY ON BUILD 9

**The iPhone Settings path in `appleNotRevoked` is NOT verified.** It is
written from iOS 17 and later as remembered ("Settings, your name, Sign-In &
Security, Sign in with Apple"; Arabic: "الإعدادات، اسمك، تسجيل الدخول
والأمان، تسجيل الدخول باستخدام Apple"). The study's draft (D3) left out
"Sign-In & Security". Open the path on the build 9 test iPhone, in English
and in Arabic, and correct both lines before approval.

## The privacy page (English only, src/app/[locale]/(site)/privacy/page.tsx)

- Apple, only if you choose Sign in with Apple in the app. Apple gives KnowFlow an email address, which can be a private address that forwards to yours, and your name the first time you sign in. When you delete your account in the app, KnowFlow asks Apple to end its access.
