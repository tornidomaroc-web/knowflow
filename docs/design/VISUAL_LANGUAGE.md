# The visual language for students: what was studied, and the rules that came out of it

Written 2026-09-25 on the owner's ruling: our users are young students, the
app read as windows of text, formal and cold; it must feel alive, playful and
modern while staying premium, on the warm dark base with the gold identity,
with original illustration only and none of the app's own logo drawn here.

## 1. What was studied (2026-09-25, public pages; not signed into)

| App | What it does for a young learner | What carries over |
|---|---|---|
| **Duolingo** (design hub, "core tabs refresh", the streak widget) | One idea per screen; a streak with a flame that visibly changes state; a celebration the moment something is finished; copy in one short line; a mascot for warmth (not allowed here). | The flame as a live state, not a number; a success moment; one-line copy. |
| **Brilliant** | Interactive demos instead of paragraphs; a lot of white space; colour reserved for the action; modules of one idea each. | Show the product working in the hero; sections of one idea; the accent stays on the action. |
| **Quizlet / Knowt** (from the #85 reading) | Study modes as coloured tiles; progress as "mastery" you can see; cards, not lists. | Tiles with a colour each; a ring, not a sentence, for progress. |
| **Mindgrasp / StudyFetch** (from the #85 reading) | A per-session checklist of what has been made; "never lose your place". | The study kit line, a Continue card. |
| **NotebookLM** | Sources on one side, made things on the other; suggested questions; citations you can see. | Suggested questions; citation chips. |

None of those pages could be read as a design system; what is above is the
visible behaviour, and the rules below are ours.

## 2. The rules this app follows from now on

1. **Every panel says what it is before a word is read.** A card, a section
   and an empty state carry a meaningful icon or a small original
   illustration (`src/components/illustrations`), never text alone.
2. **Numbers are pictures.** Remaining questions, uploads, a subject's
   progress: a ring or a bar with the number inside, never "7 of 10 used"
   as a sentence. The streak is a flame that is lit or not.
3. **One short line per idea.** Headlines under six words; a friendly
   Arabic line under the headline; the long explanation lives on the
   landing, not in the app.
4. **A supporting palette for warmth, one accent for action.** Gold stays
   the only colour on buttons, links and the identity. Four supporting
   tints — mint, sky, coral, violet — colour icon tiles and illustrations so
   four cards on one screen are not four gold squares. Each is defined for
   the dark and the light theme and measured on `--surface` and `--raised`.
5. **Motion is feedback, never decoration.** Press (scale 0.98), hover
   (lift 2px), enter (rise 8px + fade, staggered by 60ms), progress (the
   ring draws), success (a pop). Everything sits inside
   `@media (prefers-reduced-motion: no-preference)`; with reduced motion
   the final state is the only state. No animation runs on scroll inside
   the app, and nothing animates continuously except the lit flame's slow
   breath.
6. **Empty states invite.** An illustration, a one-line reason, one button.
7. **Fast on a mid-range phone.** Inline SVG under 2 KB each, CSS
   transforms and opacity only, no animation library, no images.
8. **Original only.** The illustrations are geometric compositions built
   from circles, rounded rectangles and strokes in the app's own tokens; no
   characters, no clip art, no drawn logo.

## 3. What each screen got (Section 7, 2026-09-25)

Home: a greeting line, the plan as rings, the streak as a flame, the path
with numbered tiles, the subjects with mini rings, an illustrated empty
state. Subjects: rings on the cards, an illustrated empty state, cards that
lift. Subject: an illustrated header, file-type tiles in the supporting
palette, a study kit that ticks. Ask: an illustrated empty conversation with
three questions to press. Upload: an illustrated drop zone and a pop when
the file is ready. Settings: an icon per section.
