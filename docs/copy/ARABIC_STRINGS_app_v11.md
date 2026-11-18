# Arabic copy, app v11: the camera screen "صوّر صفحاتك" (PR #336)

Approved by the owner on 2026-11-18 for PR #336, as drafted in `docs/copy-drafts/camera_screen.md` (now marked approved), with ONE change: `dashboard.upload.camera.unconfirmed` says "حدّث الشاشة" instead of "حدّث الصفحة", because the student refreshes the app screen, not a page of the book. The English twins were approved with them, and the English of that key became "Refresh the screen to see whether the material arrived, and try again if it did not.":

- `dashboard.upload.camera.addMaterial`: Add a material
- `dashboard.upload.camera.title`: Photograph your pages
- `dashboard.upload.camera.desc`: Snap a book or notebook and we read the text.
- `dashboard.upload.camera.hint`: One page per photo, up to {max} pages.
- `dashboard.upload.camera.firstPage`: Photograph the first page
- `dashboard.upload.camera.addPage`: Add a page
- `dashboard.upload.camera.count`: {n} of {max}
- `dashboard.upload.camera.page`: Page {n}
- `dashboard.upload.camera.removePage`: Remove page {n}
- `dashboard.upload.camera.full`: That is {max} pages. Read these first, then photograph the rest.
- `dashboard.upload.camera.read`: Read the pages
- `dashboard.upload.camera.preparing`: Preparing the photo…
- `dashboard.upload.camera.uploading`: Sending the pages… {n} of {total}
- `dashboard.upload.camera.reading`: Reading the pages…
- `dashboard.upload.camera.readingNote`: This can take a minute. Keep this screen open.
- `dashboard.upload.camera.photoUnreadable`: We could not open this photo. Photograph the page again.
- `dashboard.upload.camera.uploadFailed`: The photos did not arrive. Check your connection and try again.
- `dashboard.upload.camera.unconfirmed`: We could not confirm that the pages were read. Refresh the screen to see whether the material arrived, and try again if it did not.
- `dashboard.upload.camera.noneRead`: We could not read any page, so nothing was saved. Photograph the pages in better light and try again.
- `dashboard.upload.camera.someUnread`: Saved without these pages:
- `dashboard.upload.camera.problemOpen`: The photo could not be opened.
- `dashboard.upload.camera.problemNoText`: No text was found on it.
- `dashboard.upload.camera.problemTooLong`: Its text is too long to read in one photo.
- `dashboard.upload.camera.problemNotRead`: Not read. Take it again.
- `dashboard.upload.camera.retry`: Try again
- `dashboard.upload.camera.close`: Close
- `dashboard.upload.camera.defaultName`: Photographed pages
- `dashboard.aiConsent.photos`: When you photograph your pages, Anthropic also receives the photos, to read their text.

Where they show: the app only, from shell 2 (`KnowFlowApp/2`); the web and shell 1 show none of them. The 27 `dashboard.upload.camera.*` keys are the two-tile upload sheet, the camera screen and its notices (`src/components/upload/CameraPages.tsx`, `src/components/upload/DropZone.tsx`); `dashboard.aiConsent.photos` is the one extra line of the permission sheet that /api/page-read (consent version 2) requires. `{max}`, `{n}` and `{total}` are Western digits. Every key is NEW (added by #336), so the "Old Arabic" column says so; the proof asserts the new value only. No plan, price, upgrade or "free" wording.

Approved with them, outside the dictionaries (not rows here, as no key holds them):

- the iOS camera prompt, `NSCameraUsageDescription`: en (Info.plist and en.lproj) "KnowFlow uses the camera only when you photograph pages of your book or notebook, so it can read their text."; ar (ar.lproj) "يستعمل KnowFlow الكاميرا فقط عندما تصوّر صفحات كتابك أو دفترك، ليقرأ نصّها."
- the privacy policy sentence (English only, as the page is): "If you photograph pages in the app, Anthropic also receives those photos, to read their text. KnowFlow deletes each photo from its storage once it has been read, and asks your permission for photos before the first one is sent."

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.camera.addMaterial` | أضف مادة | (new key) |
| `dashboard.upload.camera.title` | صوّر صفحاتك | (new key) |
| `dashboard.upload.camera.desc` | صوّر صفحات الكتاب أو الدفتر، ونقرأ نصّها. | (new key) |
| `dashboard.upload.camera.hint` | صفحة واحدة في كل صورة، حتى {max} صفحات. | (new key, carries {max}) |
| `dashboard.upload.camera.firstPage` | صوّر الصفحة الأولى | (new key) |
| `dashboard.upload.camera.addPage` | أضف صفحة | (new key) |
| `dashboard.upload.camera.count` | {n} من {max} | (new key, carries {n} and {max}) |
| `dashboard.upload.camera.page` | الصفحة {n} | (new key, carries {n}) |
| `dashboard.upload.camera.removePage` | احذف الصفحة {n} | (new key, carries {n}) |
| `dashboard.upload.camera.full` | بلغت {max} صفحات. اقرأها أولًا، ثم صوّر الباقي. | (new key, carries {max}) |
| `dashboard.upload.camera.read` | اقرأ الصفحات | (new key) |
| `dashboard.upload.camera.preparing` | نجهّز الصورة… | (new key) |
| `dashboard.upload.camera.uploading` | نرسل الصفحات… {n} من {total} | (new key, carries {n} and {total}) |
| `dashboard.upload.camera.reading` | نقرأ الصفحات… | (new key) |
| `dashboard.upload.camera.readingNote` | قد يستغرق هذا دقيقة. أبقِ هذه الشاشة مفتوحة. | (new key) |
| `dashboard.upload.camera.photoUnreadable` | لم نتمكن من فتح هذه الصورة. صوّر الصفحة مرة أخرى. | (new key) |
| `dashboard.upload.camera.uploadFailed` | لم تصل الصور. تحقّق من اتصالك ثم أعد المحاولة. | (new key) |
| `dashboard.upload.camera.unconfirmed` | لم نتمكن من التأكد من قراءة الصفحات. حدّث الشاشة لترى إن وصلت المادة، وأعد المحاولة إن لم تصل. | (new key) |
| `dashboard.upload.camera.noneRead` | لم نتمكن من قراءة أي صفحة، ولم نحفظ شيئًا. صوّر الصفحات في ضوء أوضح ثم أعد المحاولة. | (new key) |
| `dashboard.upload.camera.someUnread` | حفظنا المادة دون هذه الصفحات: | (new key) |
| `dashboard.upload.camera.problemOpen` | لم نتمكن من فتح الصورة. | (new key) |
| `dashboard.upload.camera.problemNoText` | لم نجد فيها نصًا. | (new key) |
| `dashboard.upload.camera.problemTooLong` | نصّها أطول مما نقرؤه في صورة واحدة. | (new key) |
| `dashboard.upload.camera.problemNotRead` | لم تكتمل قراءتها. صوّرها مرة أخرى. | (new key) |
| `dashboard.upload.camera.retry` | أعد المحاولة | (new key) |
| `dashboard.upload.camera.close` | إغلاق | (new key) |
| `dashboard.upload.camera.defaultName` | صفحات مصوّرة | (new key) |
| `dashboard.aiConsent.photos` | وعندما تصوّر صفحاتك، تتلقى شركة Anthropic الصور أيضًا لتقرأ نصّها. | (new key) |
