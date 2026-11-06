# G2 copy: the page or slide on a source pill (DRAFTS)

**Status: DRAFTS, awaiting the owner.** Written by the agent for G2 (page or
slide numbers in every citation). They are in the dictionaries so the pill can
render, but they are NOT approved: no batch file under `docs/copy/` holds them,
so `verify-arabic-copy` asserts nothing about them yet. When the owner approves
(or rewrites) them, they land as a batch file there and this file is retired.

Where they show: under an answer in Ask, on each source pill, after the file's
name, only when the cited chunk's page is known (a PDF or a .pptx uploaded after
the G2 migration). A file with no known page shows its name alone, as today.
`{n}`, `{from}` and `{to}` are filled with Western digits. The label names a
POSITION, not a count, so no plural rule applies: only "one page" versus "a
range" changes the words.

| Key | Arabic draft | English draft | Example on a pill |
|---|---|---|---|
| `dashboard.agent.sourcePage` | ص {n} | p. {n} | `[1] ملخص الفصل 7 · ص 12` / `[1] Chapter 7 summary · p. 12` |
| `dashboard.agent.sourcePages` | ص {from}-{to} | pp. {from}-{to} | `· ص 3-4` / `· pp. 3-4` |
| `dashboard.agent.sourceSlide` | شريحة {n} | slide {n} | `· شريحة 5` / `· slide 5` |
| `dashboard.agent.sourceSlides` | الشرائح {from}-{to} | slides {from}-{to} | `· الشرائح 5-6` / `· slides 5-6` |

Notes for the decision:
- "ص" is the usual short form of صفحة in Arabic references ("ص 12"); a range
  keeps the same "ص" rather than "ص ص" or "الصفحات". If the owner prefers the
  full word on the phone, the drafts become "صفحة {n}" and "الصفحات {from}-{to}".
- The range uses a plain hyphen, as the English does, and the label is its own
  right-to-left run inside the left-to-right pill row, so "ص 3-4" reads ص first.
- The page is the PDF's own page (the number a PDF viewer shows), not the number
  printed on the page. For a book whose printed numbers start later (a cover,
  a preface), the two differ.
