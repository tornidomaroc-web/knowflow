# App wording, v1: agent drafts awaiting the owner's approval (Step Wording-1)

**Status: AGENT DRAFTS, NOT APPROVED.** Written 2026-10-12 by the agent for the
owner's approval. Live in `ar.ts` and `en.ts` so the app stops naming a plan,
but not in `docs/copy/`: the batch files there are the owner's approved
record, and `scripts/verify-arabic-copy.mjs` asserts them. When the owner
approves (or rewrites) these lines, they land as a batch file
`docs/copy/ARABIC_STRINGS_app_v1.md` and this file is retired.

Arabic: Modern Standard Arabic, Western numerals, no dash.

| Key | Shown where | English | Arabic (draft) |
|---|---|---|---|
| `nav.createAccount` | The app's site header button and the about page button, instead of "Start free" / "ابدأ مجانًا" | Create account | أنشئ حسابًا |
| `dashboard.newKb.errorLimitApp` | The app's refusal when a new subject is over the cap, for every tier, instead of the free plan's and the Pro line | You've reached your limit of {limit} subjects. | وصلت إلى الحد الأقصى لعدد المواد في حسابك: {limit}. |
| `dashboard.settings.subtitleApp` | The app's Settings subtitle, instead of "Your account, plan and preferences." / "حسابك وباقتك وتفضيلاتك." | Your account and preferences. | حسابك وتفضيلاتك. |

English-only app variants (the legal pages are written in English in both
locales today; their Arabic is a separate, older gap):

| Page | Web text (unchanged) | App text (new) |
|---|---|---|
| Privacy, how we use it | "...against the limits of your plan." | "...against your account's limits." |
| Privacy, Paddle | "takes the payment if you subscribe to Pro. Paddle is the seller of record..." | "processes any payment made for a KnowFlow account, as the seller of record, and collects the payment details directly, so we never see a card. Nothing is paid inside this app." |
| Privacy, deleting | "...and immediately cancels any active subscription." | "...and stops any recurring payment the account has." |
| Terms, heading | Payment Terms | Payments |
| Terms, body | "Subscriptions to our Pro plan are billed on a monthly basis..." | "Nothing is sold or charged inside this app. Any payment made for a KnowFlow account is governed by the terms shown when it is made." |
| Refund, sections 1 to 4 | The free plan, Pro through Paddle, cancelling, billing contact | "Nothing to refund in this app. Nothing is sold or charged inside this app, so there is nothing to refund here." and "For any question about your account, contact: (support address)" |
