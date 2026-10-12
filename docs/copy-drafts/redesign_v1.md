# Redesign copy, v1: agent drafts awaiting the owner's approval (Step Redesign-2)

**Status: AGENT DRAFTS, NOT APPROVED.** Written 2026-10-12 by the agent for the
owner's approval. Live in `ar.ts` and `en.ts` so the rebuilt screens have
their words, but not in `docs/copy/`: the batch files there are the owner's
approved record. When the owner approves (or rewrites) these lines, they land
as `docs/copy/ARABIC_STRINGS_app_v2.md` and this file is retired, as
`app_wording_v1` was by #260's merge.

Arabic: Modern Standard Arabic, Western numerals, no dash.

| Key | Shown where | English | Arabic (draft) |
|---|---|---|---|
| `dashboard.upload.uploadButton` | The app's one upload control on a subject page, which opens the file picker | Upload a file | ارفع ملفًا |
| `dashboard.upload.typesLabel` | The line under it, before the isolated Latin list "PDF, DOCX, PPTX, XLSX, TXT, MD" | Accepted types | الأنواع المقبولة |
| `dashboard.upload.sizeLine` | The line under that | Up to {limit} per file | حتى {limit} للملف الواحد |
| `dashboard.upload.dropHereTouch` | The web's drop zone on a touch screen ("tap", not "click"); the Arabic is the approved `dropHere` line unchanged | Drop files here or tap to upload | اسحب ملفاتك إلى هنا أو اضغط لرفعها |
| `dashboard.agent.sources` | Over the source pills under an answer in Ask | Sources | المصادر |

Retired from use, not from the dictionary: `dashboard.upload.supported` (its
one sentence is now the two lines above).
