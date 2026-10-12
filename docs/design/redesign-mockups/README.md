# Redesign mockups: decisions

**Approved by the owner, 2026-10-12:** the redesign direction in this folder
(#259, merged 82de20d): a native iOS feel (large titles, a clean header, a
floating tab bar with a filled gold active tab, one primary Upload button)
with a visible soft-clay depth in both themes, on the brand (warm dark
ground, gold, Rubik). The rollout is a later step and has not started.

## The rollout must fix, before it ships

**Step Redesign-2 (PR feat/redesign-2) builds the first coherent rollout:** the
shared clay tokens (`.kf-clay`, globals.css), the floating tab bar and the
app's clean header, Settings in full, the upload button, the Ask sources and
the four fixes below, each marked where it landed.

1. **The home date.** The mockup reads "الأحد 12 أكتوبر", but 12 October 2026
   is a Monday. The weekday is derived from the date, never written by hand.
   DONE in Redesign-2: `formatDayDate` (src/lib/format-date.ts), the student's
   zone from the time-zone cookie, under the greeting.
2. **The Ask conversation view.** The mockups show only the empty state. The
   rollout adds the conversation: the student's question, the answer, and the
   sources it came from. DONE in Redesign-2: MessageBubble's source pills are
   links to the material's card (`#material-<id>`), under a "Sources" line.
3. **The full Settings page.** The mockup stops at AI processing. The rollout
   shows the whole page, including the privacy, terms and contact links and
   Delete account. DONE in Redesign-2: the built set renders Settings top and
   bottom (`*-settings.png`, `*-settings-bottom.png`), with the sign-out row.
4. **The light-theme off switch.** It reads as disabled. The off state needs a
   look that is plainly a working control, still at 3:1 against its card.
   DONE in Redesign-2: a bounded track and a --muted-foreground bead (5.0:1
   on the track in light), the on state a dark bead on gold (7.1:1).

## How these mockups are made

`scripts/redesign/` (kit.css, build.mjs, render.mjs) writes static pages from
fixtures and renders them in headless Chrome; `.github/workflows/redesign-mockups.yml`
audits each one (WCAG AA text in both themes, 3:1 controls, 44 pt targets,
Arabic shaping, no plan, price or free wording, shadow cost) and checks the
committed PNGs match fresh renders. Icons: Phosphor Icons 2.1.1, MIT
(`scripts/redesign/icons/LICENSE-phosphor.txt`).

<!-- CI-Cost-1 docs-only test: this line proves a docs-only pull request starts no macOS run and still reports every required check. Removed with the test PR. -->
