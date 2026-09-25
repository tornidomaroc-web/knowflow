# The signed-in screens: what fills them, and why

Register **#85** carries the owner's one reservation on the accepted design:
*the signed-in pages read as empty and too simple to be a paid product*. New
in-app features were approved to fill them, and the list was never written
down. This file is that list, written 2026-09-25, in three parts: what the
leading study apps put on the same three screens, what KnowFlow builds now
from data it already has, and what waits for the owner because it needs a
migration, a paid call, or data the app does not collect.

Everything in part 3 stops here. Nothing in this file is a price, a limit or a
promise to a student; the copy that ships is in the dictionaries.

## 1. What the leading apps show (read 2026-09-25)

Read from the public product pages and one independent review; none of the
apps were signed into, and marketing pages describe features more than
screens, which is said here so it is not mistaken for a UI audit.

| App | The subject / library screen | The material screen | The ask screen | Progress |
|---|---|---|---|---|
| **StudyFetch** ("Spark.E") | Courses hold materials; a study plan says "what comes next" and "what you've already covered". | Notes, flashcards, quizzes, tests, an arcade of game-style drills, all generated from one upload. | A tutor that answers from the uploaded material ("what did the professor say about mitosis?"), voice mode, diagram reading. | Study plan, cram mode, coverage. |
| **Turbo AI** (was Turbolearn) | A library of materials; drag-and-drop upload with a "Generating study materials…" state. | Tabs: notes (editable, Docs-style), flashcards, quiz, chat. "Practice until it clicks": fill-in-the-blank, multiple choice, open-ended. | Chat over the material, offered after the notes. | Not described. |
| **Knowt** | Classes hold notes and sets; one-click Quizlet import. | Learn mode (multiple choice, true/false, fill in the blank, flashcards), spaced repetition, matching game, practice test. | Not central. | Learn-mode mastery. |
| **Mindgrasp** | One *session* per lecture, chapter or exam topic. | Tabs: notes, summary, flashcards, quizzes, chat. | 24/7 tutor over the session. | **Per-session progress and a session checklist of what has been generated**; "never lose your place". |
| **NotebookLM** | A notebook holds up to ~50 sources. | Sources on one side, a studio of generated artifacts (notes, guides, flashcards, quizzes, audio, mind map) on the other. | Chat with paragraph-level citations and suggested questions. | None. |

What repeats across all five, and is therefore the bar a paying student
measures KnowFlow against:

1. **A material is a set of things made from it, shown together.** Every app
   shows, on the material, what has been generated (notes, cards, quiz) and
   what has not. KnowFlow generates a summary and a quiz per material and
   shows neither on the subject screen until a section is opened.
2. **The library says how far along each unit is.** Mindgrasp's per-session
   checklist and StudyFetch's coverage are the same idea: a subject card that
   says "8 materials, 6 summarised, 3 quizzed" instead of a name and a date.
3. **The ask screen never starts blank.** Suggested questions built from the
   material, and citations on every answer. KnowFlow has the citations
   (`MessageBubble`); it starts with "Start typing to ask questions."
4. **Retrieval practice with scheduling** (flashcards, spaced repetition,
   learn modes) is the one feature every app has and KnowFlow lacks. It is
   Phase 6 and needs tables.

## 2. What KnowFlow builds now (this change; no migration, no paid call, existing data)

Every item reads rows the app already writes, through the existing RLS
policies, from the existing server and client pages.

### 2.1 Subjects: a card that says how far along the course is

`SubjectsList` shows, per subject: the language chip; **materials**,
**summarised**, **quizzed** counts with a progress bar of summarised over
materials (the same measure the home uses, ruled for #85); **last activity**
(the newest conversation in that subject, or the newest material, or the
creation date); and two quick actions, **Ask** (the Ask screen with that
subject preselected) and **Add material**. A subject with no materials says
so on the card and its only action is Add material.

Data: `documents (kb_id, status, summary_generated_at)`, `quizzes
(document_id)` joined through the documents' ids, `conversations (kb_id,
created_at)`. Three reads in one `Promise.all`, all scoped by RLS.

### 2.2 Subject detail: a header that counts, materials as study cards

The subject page gets a header strip: **materials · summarised · quizzed ·
still processing**, and an **Ask about this subject** button. Each material
becomes a card with: the file type and chunk count as before; the status as a
chip (ready / processing / error, in the student's language rather than the
raw enum); a **study checklist** with two items, Summary and Quiz, each ticked
when it exists for the current language, unticked otherwise, so the student
sees at a glance what is left to make; then the existing Summary and Quiz
sections, unchanged.

Data: the page already loads the subject's documents; it adds one read of
`quizzes (document_id, lang)` for those ids.

### 2.3 Ask: a first screen with something to press

When a conversation is empty, the Ask screen shows **suggested questions**
built on the client from the subject's material names, in the student's
language, three at a time: *"What are the main ideas in ‹material›?"*,
*"Explain the hardest concept in ‹subject› simply."*, *"Give me an example
that tests ‹material›."* Pressing one sends it as the student's own message
through the unchanged `/api/agent` path, which counts against the same daily
cap and costs the same as a typed question. Nothing is sent until pressed.

The Ask screen also accepts **`?kb=‹id›`**, so the subject cards' Ask buttons
open the right subject.

### 2.4 Home: pick up where you left off

The home's plan and path stay. Under them, when there is at least one
conversation, a **Continue** card shows the most recent conversation's subject
and date and opens Ask on that subject. Data: the `conversations` read the
home already makes.

## 3. What waits for the owner (spec only; each needs a migration, a paid call or new data)

| Feature | Why it stops here | What it needs |
|---|---|---|
| **Flashcards with spaced repetition** (the one feature every competitor has) | Phase 6; new tables (`cards`, `reviews`, an SM-2 schedule); a paid generation call per material. | Owner's go on Phase 6 (register #82 asked whether it is held). |
| **Quiz score history and mastery per material** | `quiz_attempts` was dropped by ruling (#33); a per-material score needs a table and a decision to keep attempts. | A migration and a reversal of #33. |
| **Notes a student writes on a material** | A new column or table. | A migration. |
| **Exam dates and a study plan** ("what comes next") | New data the app does not collect; a table; a scheduler. | A migration and a design for the plan. |
| **Practice questions of other kinds** (fill-in-the-blank, open-ended, matching) | A second generation prompt per material; a paid call; new columns on `quiz_items` for the kind. | A migration and a cost line. |
| **Audio overview / podcast of a material** | A paid speech call per material; storage. | A provider, a price, a bucket. |
| **Mind map of a subject** | A paid call over all materials; a stored artifact. | A price and a table. |
| **Re-generate a summary or quiz** | Ruled out (#26, generate-once); reopening it is a cost decision. | The owner's ruling. |
| **Streak goals and reminders** | Push needs the native shell (Phase 8); a goal is a column. | Phase 8 and a migration. |
| **Sharing a subject with a classmate** | A table for membership, RLS changes, an invitation flow. | A migration and a security review. |

## 4. How to judge part 2

On the Vercel preview, `/[locale]/preview/subjects` and
`/[locale]/preview/subject` render the real components in the real chrome
with literal data, in both locales and both themes, at phone width; the Ask
screen's suggested questions are proven by `scripts/verify-signed-in-features.mjs`
against the real builder and rendered components. The question to ask of each
screen is the owner's: does it read as something a student would pay for?
