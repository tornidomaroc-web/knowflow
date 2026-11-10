# Activation fix 3: one line on the app's sign-up page (SHIPPED)

**Status: SHIPPED** in activation fix 4 (owner-approved 2026-11-10): the app's
sign-up shows `about.subtitle`, unchanged, under the subtitle, in the slot the
web gives `cta.note`; the web is unchanged. No new key, so no new copy
approval. Proven by part 4 of `scripts/verify-activation-3.mjs`.

## Why

From activation fix 3 on, a fresh install of the iPhone app opens on sign-up.
That page says only `auth.signupTitle` + `auth.signupSubtitle`:

| | en | ar |
|---|---|---|
| title | Create Account | أنشئ حسابك |
| subtitle | Join KnowFlow today | انضم إلى KnowFlow اليوم |

On the web a second line follows (`cta.note`, the free-plan line), but inside
the app no plan may be named (Step Wording-1), so the app's first screen says
nothing about what the app does. A student who has just downloaded it sees a
form and no reason.

## Draft

Reuse an approved line instead of writing a new one: `about.subtitle`, already
in both dictionaries and already reviewed.

| | en | ar |
|---|---|---|
| line under the subtitle, app only | KnowFlow turns your notes, slides, and PDFs into clear answers, grounded in your own material, in Arabic and English. | يحوّل KnowFlow ملاحظاتك وشرائحك وملفات PDF إلى إجابات واضحة من ملفاتك أنت، بالعربية والإنجليزية. |

It names no plan, price, upgrade or free word (`scripts/lib/app-wording.mjs`).

## Decided by the owner (2026-11-10)

1. Ship it as it is.
2. App only, in the slot the web's `cta.note` uses.
