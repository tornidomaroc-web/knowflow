# Redesign mockups: decisions

**Approved by the owner, 2026-10-12:** the redesign direction in this folder
(#259, merged 82de20d): a native iOS feel (large titles, a clean header, a
floating tab bar with a filled gold active tab, one primary Upload button)
with a visible soft-clay depth in both themes, on the brand (warm dark
ground, gold, Rubik). The rollout is a later step and has not started.

## The rollout must fix, before it ships

1. **The home date.** The mockup reads "الأحد 12 أكتوبر", but 12 October 2026
   is a Monday. The weekday is derived from the date, never written by hand.
2. **The Ask conversation view.** The mockups show only the empty state. The
   rollout adds the conversation: the student's question, the answer, and the
   sources it came from.
3. **The full Settings page.** The mockup stops at AI processing. The rollout
   shows the whole page, including the privacy, terms and contact links and
   Delete account.
4. **The light-theme off switch.** It reads as disabled. The off state needs a
   look that is plainly a working control, still at 3:1 against its card.

## How these mockups are made

`scripts/redesign/` (kit.css, build.mjs, render.mjs) writes static pages from
fixtures and renders them in headless Chrome; `.github/workflows/redesign-mockups.yml`
audits each one (WCAG AA text in both themes, 3:1 controls, 44 pt targets,
Arabic shaping, no plan, price or free wording, shadow cost) and checks the
committed PNGs match fresh renders. Icons: Phosphor Icons 2.1.1, MIT
(`scripts/redesign/icons/LICENSE-phosphor.txt`).
