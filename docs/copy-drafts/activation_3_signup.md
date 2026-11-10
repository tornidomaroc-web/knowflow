# Activation fix 3: one line on the app's sign-up page (DRAFT, not shipped)

**Status: DRAFT for the owner.** Nothing here is in `src/`. PR "activation fix 3"
changes no copy.

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

## Open for the owner

1. Ship it, shorten it, or keep the page as it is?
2. App only (in the slot the web's `cta.note` uses), or on both?
