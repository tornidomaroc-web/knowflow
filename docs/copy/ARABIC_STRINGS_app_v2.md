# Arabic copy, app v2: the upload button, its two lines, the touch drop zone and the Ask sources (Step Redesign-3)

Approved by Abo Jad on 2026-10-13, final by the merge of the Step Redesign-3 PR, as written in the agent drafts of `docs/copy-drafts/redesign_v1.md` (whose five rows this batch retires). English: "Upload a file" / "Accepted types" / "Up to {limit} per file" / "Drop files here or tap to upload" / "Sources".
All five keys are NEW (added by #261, Step Redesign-2), so the "Old Arabic" column says so; the proof asserts the new value only.
Shown: the app's one upload control on a subject page and the two lines under it (src/components/upload/DropZone.tsx); the web's drop zone on a touch screen, web only, the Arabic the approved `dropHere` line unchanged; the line over the source pills under an answer in Ask (src/components/agent/MessageBubble.tsx).

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.uploadButton` | ارفع ملفًا | (new key) |
| `dashboard.upload.typesLabel` | الأنواع المقبولة | (new key) |
| `dashboard.upload.sizeLine` | حتى {limit} للملف الواحد | (new key, carries {limit}) |
| `dashboard.upload.dropHereTouch` | اسحب ملفاتك إلى هنا أو اضغط لرفعها | (new key) |
| `dashboard.agent.sources` | المصادر | (new key) |
