# The camera screen, "صوّر صفحاتك" (DRAFT, NOT APPROVED, WIRED FOR REVIEW)

**Status: DRAFT for the owner, 2026-11-18.** Every line below is wired into
the app so it can be looked at in the renders, and stays a draft until the
owner approves it at review. An approved change is one edit here and one in
`src/lib/i18n/locales/{ar,en}.ts` (or the file named on the row).

Two lines are NOT drafts: `camera.title` and `camera.desc` in Arabic are the
camera tile of the approved upload-sheet artboard (`upload-sheet.dc.html`),
as the owner's prompt quotes them. Their English twins are drafts. The file
tile reuses the approved `dashboard.upload.fromDevice` and `fromDeviceDesc`.

Rules held by `scripts/verify-camera-screen.mjs`: Modern Standard Arabic; no
em or en dash; no price, plan, upgrade, subscription or "free" word in either
language; Western digits only; the placeholders of each pair the same;
"صوّر صفحاتك" never split across lines (it is rendered `white-space: nowrap`).

## Where each line appears

The app only, from shell 2 (`KnowFlowApp/2`). The web and build 8 show none of
them.

| key | ar | en | where |
|---|---|---|---|
| `dashboard.upload.camera.addMaterial` | أضف مادة | Add a material | the subject page's upload button, and the upload sheet's title |
| `dashboard.upload.camera.title` | صوّر صفحاتك (approved) | Photograph your pages | the camera tile; the camera screen's title |
| `dashboard.upload.camera.desc` | صوّر صفحات الكتاب أو الدفتر، ونقرأ نصّها. (approved) | Photograph pages of a book or notebook, and we read their text. | under the camera tile |
| `dashboard.upload.camera.hint` | صفحة واحدة في كل صورة، حتى {max} صفحات. | One page per photo, up to {max} pages. | under the screen's title |
| `dashboard.upload.camera.firstPage` | صوّر الصفحة الأولى | Photograph the first page | the screen's big tile, no page yet |
| `dashboard.upload.camera.addPage` | أضف صفحة | Add a page | the cell after the last page |
| `dashboard.upload.camera.count` | {n} من {max} | {n} of {max} | under the pages |
| `dashboard.upload.camera.page` | الصفحة {n} | Page {n} | the list of pages not read (same words as the material's heading, docs/copy-drafts/page_reader.md) |
| `dashboard.upload.camera.removePage` | احذف الصفحة {n} | Remove page {n} | the × on a page (spoken, not shown) |
| `dashboard.upload.camera.full` | بلغت {max} صفحات. اقرأها أولًا، ثم صوّر الباقي. | That is {max} pages. Read these first, then photograph the rest. | at ten pages |
| `dashboard.upload.camera.read` | اقرأ الصفحات | Read the pages | the send button |
| `dashboard.upload.camera.preparing` | نجهّز الصورة… | Preparing the photo… | while a shot is re-encoded |
| `dashboard.upload.camera.uploading` | نرسل الصفحات… {n} من {total} | Sending the pages… {n} of {total} | while the photos upload |
| `dashboard.upload.camera.reading` | نقرأ الصفحات… | Reading the pages… | while /api/page-read works |
| `dashboard.upload.camera.readingNote` | قد يستغرق هذا دقيقة. أبقِ هذه الشاشة مفتوحة. | This can take a minute. Keep this screen open. | under it |
| `dashboard.upload.camera.photoUnreadable` | لم نتمكن من فتح هذه الصورة. صوّر الصفحة مرة أخرى. | We could not open this photo. Photograph the page again. | a shot the phone could not decode or re-encode |
| `dashboard.upload.camera.uploadFailed` | لم تصل الصور. تحقّق من اتصالك ثم أعد المحاولة. | The photos did not arrive. Check your connection and try again. | both upload attempts failed |
| `dashboard.upload.camera.unconfirmed` | لم نتمكن من التأكد من قراءة الصفحات. حدّث الصفحة لترى إن وصلت المادة، وأعد المحاولة إن لم تصل. | We could not confirm that the pages were read. Refresh to see whether the material arrived, and try again if it did not. | the request left and no answer came (or an answer that is not ours) |
| `dashboard.upload.camera.noneRead` | لم نتمكن من قراءة أي صفحة، ولم نحفظ شيئًا. صوّر الصفحات في ضوء أوضح ثم أعد المحاولة. | We could not read any page, so nothing was saved. Photograph the pages in better light and try again. | 422 `pages-unread` |
| `dashboard.upload.camera.someUnread` | حفظنا المادة دون هذه الصفحات: | Saved without these pages: | 200 with some photos not read, above the list |
| `dashboard.upload.camera.problemOpen` | لم نتمكن من فتح الصورة. | The photo could not be opened. | `photo-heic`, `photo-type`, `photo-unreadable`, `photo-too-large`, `photo-too-many-pixels`, `photo-odd-shape` |
| `dashboard.upload.camera.problemNoText` | لم نجد فيها نصًا. | No text was found on it. | `read-empty` |
| `dashboard.upload.camera.problemTooLong` | نصّها أطول مما نقرؤه في صورة واحدة. | Its text is too long to read in one photo. | `read-cut-off` |
| `dashboard.upload.camera.problemNotRead` | لم تكتمل قراءتها. صوّرها مرة أخرى. | It was not read. Photograph it again. | `photo-missing`, `read-timeout`, `read-failed`, `read-refused`, any other |
| `dashboard.upload.camera.retry` | أعد المحاولة | Try again | the send button after a failure (the photos are kept) |
| `dashboard.upload.camera.close` | إغلاق | Close | the screen's second button |
| `dashboard.upload.camera.defaultName` | صفحات مصوّرة | Photographed pages | the new material's name, followed by the date (`صفحات مصوّرة 2026-11-18.md`) |

## Reused, not new

The other answers of /api/page-read already carry their own sentence in the
student's language, fit for the app (no plan or upgrade wording there), and
the screen shows it as sent: 429 (the AI allowance, `dashboard.aiAllowance.used`,
and the daily upload limit), 503 (`TEMPORARILY_UNAVAILABLE`), 403 (the
subject's material limit), 422 `too-much-text`, 400, 401, 404 and 500
(`uploadRefusalMessage`). 403 `ai_consent_required` shows the approved
`dashboard.aiConsent.declined`.

## The permission (consent version 2)

`AI_CONSENT_VERSION` stays 1 for every route but /api/page-read, which
requires 2. The sheet opened by the first "Read the pages" is the approved
sheet with ONE more line, after the Anthropic line:

| key | ar | en |
|---|---|---|
| `dashboard.aiConsent.photos` | وعندما تصوّر صفحاتك، تتلقى شركة Anthropic الصور أيضًا لتقرأ نصّها. | When you photograph your pages, Anthropic also receives the photos, to read their text. |

## Outside the screen

| where | text |
|---|---|
| iOS camera prompt, `NSCameraUsageDescription`, en (Info.plist and en.lproj) | KnowFlow uses the camera only when you photograph pages of your book or notebook, so it can read their text. |
| iOS camera prompt, ar (ar.lproj) | يستعمل KnowFlow الكاميرا فقط عندما تصوّر صفحات كتابك أو دفترك، ليقرأ نصّها. |
| privacy policy, after "Anthropic and Voyage AI receive the text…" (English only, as the page is) | **If you photograph pages in the app, Anthropic also receives those photos, to read their text.** KnowFlow deletes each photo from its storage once it has been read, and asks your permission for photos before the first one is sent. |

Arabic notes: MSA; نصّها with the shadda as in the approved line; أولًا and
شيئًا with the tanween as ar.ts writes it elsewhere; the counted noun after
{max} is the plural صفحات, right for 10.
