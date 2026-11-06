# Arabic copy, app v7: the page or slide on a source pill (G2)

Approved by Abo Jad on 2026-11-06 for PR #307, from the agent drafts in `docs/copy-drafts/g2_citation_pages.md` (now retired), with ONE change: `sourceSlides` drops the article, "الشرائح {from}-{to}" becomes "شرائح {from}-{to}", to match "ص {from}-{to}". The other three are approved as drafted. English twins approved as drafted: "p. {n}", "pp. {from}-{to}", "slide {n}", "slides {from}-{to}".

Shown in Ask, on each source pill under an answer, after the file's name, only when the cited chunk's page is known (a PDF or a .pptx uploaded after the G2 migration); a file with no known page shows its name alone (src/components/agent/MessageBubble.tsx, src/lib/citation-pages.ts). `{n}`, `{from}` and `{to}` are Western digits. The label names a position, not a count, so no plural form applies.
All four keys are NEW (added by #307), so the "Old Arabic" column says so; the proof asserts the new value only.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.agent.sourcePage` | ص {n} | (new key, carries {n}) |
| `dashboard.agent.sourcePages` | ص {from}-{to} | (new key, carries {from} and {to}) |
| `dashboard.agent.sourceSlide` | شريحة {n} | (new key, carries {n}) |
| `dashboard.agent.sourceSlides` | شرائح {from}-{to} | (new key, carries {from} and {to}) |
