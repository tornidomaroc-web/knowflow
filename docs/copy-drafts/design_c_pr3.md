# Design "C" PR 3 copy: agent drafts for the owner

**Status: ONE DRAFT, awaiting the owner.** The upload tile's drafts (`dashboard.upload.fromDevice` English, `dashboard.upload.fromDeviceDesc`) are RETIRED: the owner approved the English title and replaced the line in the review of #303, recorded in `docs/copy/ARABIC_STRINGS_app_v5.md`.

The app ships the draft below so it can be looked at, as earlier drafts did (`redesign_v1.md`, `redesign_v2.md`); the owner approves, replaces or rejects it, and the approved Arabic is then recorded as a batch under `docs/copy/`.

| Key | Arabic (draft) | English (draft) | Where and why |
|---|---|---|---|
| `dashboard.subjects.nothingToSummarise` | لا يمكن تلخيص شيء هنا: الملفات لم تنجح أو بلا نص. | Nothing here can be summarised: the files failed or have no text. | A subject card on the subjects list (src/components/dashboard/SubjectsList.tsx), in place of the ring that showed "-" (the owner's review of #303: "make it read clearly"). It shows only when every file of the subject failed or has no text, so nothing can ever be summarised and there is no honest percent (#129 (b): 0% would promise work the student can do). "لم تنجح" and "بلا نص" are the approved status words of the material card (statusError, statusNoText). |
