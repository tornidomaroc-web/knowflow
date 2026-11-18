# Arabic copy, app v12: in-app Pro, the app half (PR #338)

Approved by the owner on 2026-11-18 (22:31Z, "موافق") for PR #338: the shorter set that replaces the 34 DRAFT strings of `docs/copy-drafts/iap_app_v1.md` (now marked superseded). The English twins were approved with them. One more key, `restoreFailed` (a restore that could not reach the App Store; before it, such a restore showed the purchase's "you were not charged"), was approved the same day at 23:16Z, making 35:

- `dashboard.iap.title`: KnowFlow Pro
- `dashboard.iap.lead`: More room for your studies.
- `dashboard.iap.givesHeading`: With Pro
- `dashboard.iap.rowSubjects`: Subjects
- `dashboard.iap.rowMaterials`: Files per subject
- `dashboard.iap.rowQuestions`: Questions a day
- `dashboard.iap.rowUploads`: Uploads a day
- `dashboard.iap.upTo`: Up to {n}
- `dashboard.iap.pricePerMonth`: {price} a month
- `dashboard.iap.disclosure`: A monthly subscription at {price}, paid through your Apple Account. It renews every month automatically unless you cancel at least 24 hours before the end of the subscription month. Cancel it in your Apple Account settings.
- `dashboard.iap.subscribe`: Subscribe
- `dashboard.iap.restore`: Restore Purchases
- `dashboard.iap.terms`: Terms of Use
- `dashboard.iap.privacy`: Privacy Policy
- `dashboard.iap.loading`: Getting the price...
- `dashboard.iap.unavailable`: Buying is not available right now. Try again later.
- `dashboard.iap.purchasing`: Waiting for the App Store...
- `dashboard.iap.restoring`: Looking for your purchases...
- `dashboard.iap.pending`: Your purchase is waiting for approval. Pro starts as soon as it is approved.
- `dashboard.iap.success`: Pro is on. Thank you.
- `dashboard.iap.failed`: The purchase did not finish, and you were not charged. Try again.
- `dashboard.iap.verifyFailed`: Payment received, but Pro is not on yet. Tap Restore Purchases.
- `dashboard.iap.restoreNone`: No active subscription on this Apple Account.
- `dashboard.iap.restoreFailed`: Could not restore your purchases. Try again.
- `dashboard.iap.otherAccount`: This subscription belongs to another KnowFlow account. Sign in with that account.
- `dashboard.iap.notThisAccount`: This subscription belongs to another KnowFlow account. Sign in with that account.
- `dashboard.iap.active`: Pro is active.
- `dashboard.iap.manage`: Manage in the App Store
- `dashboard.iap.manageFailed`: The App Store could not be opened. Open iPhone Settings, then your name, then Subscriptions.
- `dashboard.iap.offerBody`: More subjects, files and questions every day.
- `dashboard.iap.offerButton`: See Pro
- `dashboard.iap.manageHeading`: Subscription
- `dashboard.iap.manageApp`: Your subscription is billed by the App Store. Manage or cancel it there.
- `dashboard.iap.manageWeb`: Your subscription is billed by the App Store. To cancel: iPhone Settings, then your name, then Subscriptions.
- `dashboard.iap.deleteNote`: Deleting your account does not cancel an App Store subscription. Cancel it first, or Apple will keep charging you.

Where they show: the app only, from shell 2 (`KnowFlowApp/2`, `iapAllowed`), each inside an element marked `data-kf-iap` (`scripts/lib/app-wording.mjs`); the paywall (`src/components/iap/Paywall.tsx`), its Settings and refusal entry points, and the App Store management lines R1 and R2 (`src/components/iap/AppStoreManage.tsx`). R1 (`manageHeading`, `manageApp` or `manageWeb`, `manage`, `manageFailed`) and R2 (`deleteNote`) also show on the web and in build 8, as plain text, only for an account that holds an App Store subscription. `{price}` is StoreKit's own `displayPrice` (never typed in code), drawn as one isolate by `PriceText`; `{n}` is a Western-digit figure read from the limits code. Every key was a DRAFT wired for review before this batch and was never approved, so the "Old Arabic" column says "(new key)"; the proof asserts the new value only. `otherAccount` and `notThisAccount` carry the same approved sentence.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.iap.title` | KnowFlow الاحترافي | (new key) |
| `dashboard.iap.lead` | مساحة أكبر لدراستك. | (new key) |
| `dashboard.iap.givesHeading` | مع الاحترافي | (new key) |
| `dashboard.iap.rowSubjects` | المواد | (new key) |
| `dashboard.iap.rowMaterials` | ملفات كل مادة | (new key) |
| `dashboard.iap.rowQuestions` | الأسئلة يوميًا | (new key) |
| `dashboard.iap.rowUploads` | رفع الملفات يوميًا | (new key) |
| `dashboard.iap.upTo` | حتى {n} | (new key, carries {n}) |
| `dashboard.iap.pricePerMonth` | {price} شهريًا | (new key, carries {price}) |
| `dashboard.iap.disclosure` | اشتراك شهري بسعر {price}، يُدفع من حساب Apple. يتجدد كل شهر تلقائيًا ما لم تلغه قبل نهاية شهر الاشتراك بـ24 ساعة على الأقل. تلغيه من إعدادات حساب Apple. | (new key, carries {price}) |
| `dashboard.iap.subscribe` | اشترك | (new key) |
| `dashboard.iap.restore` | استعادة المشتريات | (new key) |
| `dashboard.iap.terms` | شروط الاستخدام | (new key) |
| `dashboard.iap.privacy` | سياسة الخصوصية | (new key) |
| `dashboard.iap.loading` | جارٍ جلب السعر... | (new key) |
| `dashboard.iap.unavailable` | الشراء غير متاح الآن. حاول لاحقًا. | (new key) |
| `dashboard.iap.purchasing` | بانتظار App Store... | (new key) |
| `dashboard.iap.restoring` | نبحث عن مشترياتك... | (new key) |
| `dashboard.iap.pending` | الشراء ينتظر الموافقة. يبدأ الاحترافي فور قبوله. | (new key) |
| `dashboard.iap.success` | تم تفعيل الاحترافي. شكرًا لك. | (new key) |
| `dashboard.iap.failed` | لم يكتمل الشراء، ولم يُخصم أي مبلغ. حاول مجددًا. | (new key) |
| `dashboard.iap.verifyFailed` | دُفع المبلغ، لكن الاحترافي لم يُفعَّل بعد. اضغط «استعادة المشتريات». | (new key) |
| `dashboard.iap.restoreNone` | لا يوجد اشتراك نشط في حساب Apple هذا. | (new key) |
| `dashboard.iap.restoreFailed` | تعذّرت استعادة المشتريات. حاول مجددًا. | (new key) |
| `dashboard.iap.otherAccount` | هذا الاشتراك يخص حساب KnowFlow آخر. سجّل الدخول به. | (new key) |
| `dashboard.iap.notThisAccount` | هذا الاشتراك يخص حساب KnowFlow آخر. سجّل الدخول به. | (new key) |
| `dashboard.iap.active` | الاحترافي مفعّل. | (new key) |
| `dashboard.iap.manage` | الإدارة في App Store | (new key) |
| `dashboard.iap.manageFailed` | تعذّر فتح App Store. افتح إعدادات iPhone، ثم اسمك، ثم الاشتراكات. | (new key) |
| `dashboard.iap.offerBody` | مواد وملفات وأسئلة أكثر كل يوم. | (new key) |
| `dashboard.iap.offerButton` | اطّلع على الاحترافي | (new key) |
| `dashboard.iap.manageHeading` | الاشتراك | (new key) |
| `dashboard.iap.manageApp` | يُدفع اشتراكك عبر App Store، ومن هناك تديره أو تلغيه. | (new key) |
| `dashboard.iap.manageWeb` | يُدفع اشتراكك عبر App Store. لإلغائه: إعدادات iPhone، ثم اسمك، ثم الاشتراكات. | (new key) |
| `dashboard.iap.deleteNote` | حذف حسابك لا يلغي اشتراك App Store. ألغه أولًا، وإلا فستستمر Apple في الخصم. | (new key) |
