# Arabic copy, app v1: the three strings the app shows instead of plan wording (Step Wording-1)

Approved by Abo Jad on 2026-10-12, by the merge of #260 (62a9a1a), as written in the agent drafts of `docs/copy-drafts/app_wording_v1.md` (retired by this batch). English: "Create account" / "You've reached your limit of {limit} subjects." / "Your account and preferences."
All three keys are NEW (they did not exist before #260), so the "Old Arabic" column says so; the proof asserts the new value only.
Shown inside the iOS app only: the site header and about page button, the new-subject refusal for every tier, and the Settings subtitle (src/lib/platform.ts, PlatformText).

| Key | New Arabic | Old Arabic |
|---|---|---|
| `nav.createAccount` | أنشئ حسابًا | (new key) |
| `dashboard.newKb.errorLimitApp` | وصلت إلى الحد الأقصى لعدد المواد في حسابك: {limit}. | (new key, carries {limit}) |
| `dashboard.settings.subtitleApp` | حسابك وتفضيلاتك. | (new key) |
