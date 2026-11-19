# In-app Pro, app half: strings (SUPERSEDED)

**Superseded 2026-11-18.** The owner approved a shorter set instead of these
drafts: `docs/copy/ARABIC_STRINGS_app_v12.md` holds every approved key in
Arabic and English, and `src/lib/i18n/locales/en.ts` and `ar.ts` carry it.
The strings below are the earlier drafts, kept as the record of what was
reviewed; none of them ships.

**Status was: DRAFT for the owner, 2026-11-18.** Every string below was wired into
`dashboard.iap` in `src/lib/i18n/locales/en.ts` and `ar.ts` so the screens
can be drawn and proved. None is approved until the owner says so; an approved
change is one edit here and one in each dictionary, and
`scripts/verify-iap-app.mjs` (section 11) holds both locales to the same keys
and placeholders.

Rules followed: Arabic is MSA with Western digits; no em dash in either
language; brand and platform names stay in Latin script (KnowFlow, App Store,
Apple, iPhone) and are isolated at render by `LatinText`.

## Where they appear

App shell 2 only (`KnowFlowApp/2`, `iapAllowed`), each inside an element
marked `data-kf-iap`, the only place the app's wording rule lets a purchase
word stand (`scripts/lib/app-wording.mjs`, `KF_PURCHASE_SRC`). The two R1
and R2 lines also show on the web and in build 8, as plain text, only for an
account that holds an App Store subscription.

Placeholders: `{price}` is StoreKit's own `displayPrice` in the student's
storefront and currency (never typed in code); `{n}` is read from the limits
code.

## Points for the owner

1. **"Up to" on every figure.** The 5.00 USD AI allowance per 30 days can
   refuse before a daily figure is reached, so the rows promise ceilings, not
   a daily amount.
2. **Pro figures printed.** `limit-messages.ts` records an older rule not to
   print Pro daily figures (they were abuse ceilings, register #80). This
   paste asked for numbers read from the limits code, so 50 / 200 / 25 / 20
   are printed; confirm, or choose words without numbers (as /pricing does).
3. **`pro-web` says only "Pro is active on this account."** No word about
   where it was bought, no buy button.
4. **`verifyFailed` tells the truth that the App Store took the payment.**
   The transaction stays unfinished and is verified again at the next launch.

| Key | Where | en | ar |
|---|---|---|---|
| `title` | Paywall title; Settings offer card title | KnowFlow Pro | KnowFlow الاحترافي |
| `lead` | Paywall, under the title | More room for every course you study. | مساحة أكبر لكل مادة تدرسها. |
| `givesHeading` | Paywall, heading of the four rows | With Pro | مع الاحترافي |
| `rowSubjects` | Paywall row label (figure: PRO_LIMITS.knowledge_bases) | Subjects | المواد |
| `rowMaterials` | Paywall row label (figure: PRO_LIMITS.documents) | Files in each subject | الملفات في كل مادة |
| `rowQuestions` | Paywall row label (figure: DAILY_CAPS.pro.query) | Questions a day | الأسئلة يوميًا |
| `rowUploads` | Paywall row label (figure: DAILY_CAPS.pro.upload) | Uploads a day | الملفات المرفوعة يوميًا |
| `upTo` | Paywall row value; {n} from the limits code | Up to {n} | حتى {n} |
| `pricePerMonth` | Paywall price line; {price} is StoreKit displayPrice | {price} a month | {price} شهريًا |
| `disclosure` | Paywall, Apple 3.1.2 auto-renew disclosure; {price} is StoreKit displayPrice | Pro is a monthly subscription at {price} a month. Payment is charged to your Apple Account when you confirm. It renews automatically each month unless you turn off auto-renew at least 24 hours before the end of the current month. You can manage or cancel it in your Apple Account settings. | الاحترافي اشتراك شهري بسعر {price} شهريًا. يُخصم المبلغ من حساب Apple عند التأكيد. يتجدد الاشتراك تلقائيًا كل شهر ما لم توقف التجديد التلقائي قبل نهاية الشهر الحالي بـ24 ساعة على الأقل. يمكنك إدارته أو إلغاؤه من إعدادات حساب Apple. |
| `subscribe` | Paywall buy button | Subscribe | اشترك |
| `restore` | Paywall Restore Purchases button | Restore Purchases | استعادة المشتريات |
| `terms` | Paywall link to /terms | Terms of Use | شروط الاستخدام |
| `privacy` | Paywall link to /privacy | Privacy Policy | سياسة الخصوصية |
| `loading` | Paywall state: loading the product | Getting the price from the App Store. | جارٍ جلب السعر من App Store. |
| `unavailable` | Paywall state: no product (agreement not active, storefront, network) | Pro cannot be bought here right now. Please try again later. | لا يمكن شراء الاحترافي هنا حاليًا. يرجى المحاولة لاحقًا. |
| `purchasing` | Paywall state: the App Store sheet is open | Waiting for the App Store. | بانتظار App Store. |
| `restoring` | Paywall state: Restore running | Looking for your purchases in the App Store. | جارٍ البحث عن مشترياتك في App Store. |
| `pending` | Paywall state: Ask to Buy / pending | Your purchase is waiting for approval. Pro starts as soon as it is approved. | عملية الشراء بانتظار الموافقة. يبدأ الاحترافي فور الموافقة عليها. |
| `success` | Paywall state: Pro on | Pro is on. Thank you for supporting KnowFlow. | تم تفعيل الاحترافي. شكرًا لدعمك KnowFlow. |
| `failed` | Paywall state: StoreKit failed (not charged) | The purchase did not go through and you were not charged. You can try again. | لم تكتمل عملية الشراء ولم يُخصم منك أي مبلغ. يمكنك المحاولة مجددًا. |
| `verifyFailed` | Paywall state: paid, server verify not 200 yet (retried at next launch) | The App Store took your payment, but Pro is not on yet. KnowFlow will try again the next time you open the app, or you can tap Restore Purchases. | تلقّى App Store الدفعة، لكن الاحترافي لم يُفعَّل بعد. سيحاول KnowFlow مجددًا حين تفتح التطبيق في المرة القادمة، أو اضغط «استعادة المشتريات». |
| `restoreNone` | Paywall state: Restore found nothing live | No active Pro subscription was found for this Apple Account. | لم يُعثر على اشتراك احترافي نشط في حساب Apple هذا. |
| `otherAccount` | Paywall state: server 409 other-account | This App Store subscription is already linked to another KnowFlow account. Sign in with that account to use it. | اشتراك App Store هذا مرتبط بحساب آخر في KnowFlow. سجّل الدخول بذلك الحساب لاستخدامه. |
| `notThisAccount` | Paywall state: server 403 not-this-account | This App Store subscription was bought while signed in to another KnowFlow account. Sign in with that account to use it. | اشتُري اشتراك App Store هذا أثناء تسجيل الدخول بحساب آخر في KnowFlow. سجّل الدخول بذلك الحساب لاستخدامه. |
| `active` | Paywall: already Pro (Apple or web, status only) | Pro is active on this account. | الاحترافي مفعّل في هذا الحساب. |
| `manage` | Button: StoreKit showManageSubscriptions (paywall, Settings R1, delete card R2) | Manage in the App Store | الإدارة في App Store |
| `manageFailed` | Under the Manage button when the sheet cannot open | The App Store could not be opened. Open Settings on your iPhone, tap your name, then Subscriptions. | تعذّر فتح App Store. افتح الإعدادات في iPhone، واضغط على اسمك، ثم الاشتراكات. |
| `offerBody` | Settings offer card body (shell 2, free) | More subjects, more files and more questions each day. | مواد أكثر وملفات أكثر وأسئلة أكثر كل يوم. |
| `offerButton` | Settings offer card button; button under daily-limit and AI-allowance refusals | See Pro | اطّلع على الاحترافي |
| `manageHeading` | R1 card heading (Apple-only Pro, Settings) | Subscription | الاشتراك |
| `manageApp` | R1 card text in the app (with the Manage button) | Your Pro subscription is billed by the App Store. Manage or cancel it there. | يُدفع اشتراكك الاحترافي عبر App Store. يمكنك إدارته أو إلغاؤه من هناك. |
| `manageWeb` | R1 card text on the web and build 8 (no button) | Your Pro subscription is billed by the App Store. To manage or cancel it, open Settings on your iPhone, tap your name, then Subscriptions. | يُدفع اشتراكك الاحترافي عبر App Store. لإدارته أو إلغائه، افتح الإعدادات في iPhone، واضغط على اسمك، ثم الاشتراكات. |
| `deleteNote` | R2 line in the delete card while Apple may bill | Deleting your account does not cancel an App Store subscription. Cancel it in the App Store first, or Apple will keep charging you. | حذف حسابك لا يلغي اشتراك App Store. ألغِه من App Store أولًا، وإلا فستواصل Apple الخصم منك. |
