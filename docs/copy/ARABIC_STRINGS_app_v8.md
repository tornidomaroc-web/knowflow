# Arabic copy, app v8: the held file under the AI permission sheet (activation 5)

Approved by the owner on 2026-11-10 for PR #315, exactly as drafted in `docs/copy-drafts/activation_5.md` (now marked shipped). English twin approved as drafted: "Kept here until you answer. Nothing is sent yet."

Shown in the drop zone, under the picked file's name, while the AI permission sheet is open (src/components/upload/DropZone.tsx). The key is NEW (added by #315), so the "Old Arabic" column says so; the proof asserts the new value only.

The same approval covers the upload-pause sentence (draft 1 in the drafts file). It is not a dictionary key: like every other limit sentence it lives in `src/lib/limit-messages.ts` (`UPLOAD_FAILURES_HEAD`): en "Many of your uploads did not finish today, so uploading is paused.", ar "لم يكتمل رفع عدد من ملفاتك اليوم، لذا توقف الرفع مؤقتًا.", followed by the existing reset clause. `scripts/verify-activation-5.mjs` holds its text.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.awaitingConsent` | محفوظ هنا حتى تجيب. لم يُرسَل شيء بعد. | (new key) |
