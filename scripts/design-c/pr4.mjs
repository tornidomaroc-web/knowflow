/**
 * DESIGN "C", PR 4: ASK, THE QUIZ AND THE SUMMARY (scripts/design-c/render.mjs
 * imports this). Both sides are driven the same way, through the REAL
 * components: a question is typed into the real ChatBox and sent with its
 * real button; "Summarize" and "Quiz me" are pressed on the real material
 * card. The routes they call (/api/agent, /api/summarize, /api/quiz/generate,
 * /api/quiz/submit) are ANSWERED IN THE BROWSER by request interception with
 * the fixtures below: no request reaches a server route, nothing is
 * generated, nothing is spent, and BEFORE (main) and AFTER show the same
 * words, so a difference in a pair of renders can only be the design.
 *
 * The preview routes give no AI consent provider, so `ensure()` resolves at
 * once (AiConsentProvider's NO_PROVIDER): the sheet itself is shot on its own
 * preview (/preview/ai-consent), the one place it renders without a session.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function pr4Screens(add, { APP, SAFARI, DESK, DESKTOP }, root) {
  const LONG = JSON.parse(readFileSync(join(root, 'src', 'app', '[locale]', 'preview', 'ask', 'long.json'), 'utf8'));
  // Ask. `view=app` is AFTER's real screen (KBSelector); main does not know it
  // and renders its default (the ChatBox card), which is the same ChatBox.
  for (const [pf, ua] of [['native', APP], ['web', SAFARI]]) {
    const p = pf === 'native' ? 'app' : 'web';
    add(`ask-empty-${p}`, 'preview/ask', { platform: pf, view: 'app' }, ua, { pr4: 'ask' });
    add(`ask-long-${p}`, 'preview/ask', { platform: pf, view: 'app' }, ua, { pr4: 'ask', act: 'converse', grow: true });
    // History: the phone's drawer over the long conversation. BOTH sides now
    // (owner, 2026-11-06): main has had view=app, open and drawer since #305,
    // so BEFORE is the same screen, not main's empty history view.
    add(`ask-history-${p}`, 'preview/ask', { platform: pf, view: 'app', open: 'c2', drawer: '1' }, ua, { pr4: 'ask' });
    add(`study-idle-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'none', shot: 'todo' });
    add(`summary-loading-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'summary-loading', shot: 'todo' });
    add(`summary-error-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'summary-error', shot: 'todo' });
    add(`summary-full-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'none', shot: 'done' });
    add(`quiz-taking-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'quiz-taking', shot: 'todo' });
    add(`quiz-result-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'quiz-result', shot: 'todo' });
    add(`consent-${p}`, 'preview/ai-consent', {}, ua, { pr4: 'consent' });
  }
  // G2: the first answer alone with its five pills (a page, a page range, a
  // slide, a slide range, a file with no known page), shot as the card so
  // every label can be read.
  add('ask-sources-app', 'preview/ask', { platform: 'native', view: 'app' }, APP, { pr4: 'ask', act: 'converse', shot: 'sources' });
  add('ask-zero-app', 'preview/ask', { platform: 'native', view: 'zero' }, APP, { pr4: 'ask' });
  add('ask-noanswer-app', 'preview/ask', { platform: 'native', view: 'noanswer' }, APP, { pr4: 'ask' });
  // A desk: the history column beside the opened long conversation.
  add('ask-history-desk', 'preview/ask', { platform: 'web', view: 'app', open: 'c2' }, DESK, { view: DESKTOP, targets: false, pr4: 'ask', grow: true });
  // Finding (b), 2026-11-07: an ARABIC answer (in both locales, as a student
  // who asks in Arabic gets it) holding a short Latin group and a long one,
  // with two sourced pills, at 390 in the app and at 1280 on a desk. Main
  // draws the same words (the answer comes from LATIN below, in the browser),
  // so BEFORE shows what check 10 catches there.
  add('ask-latin-app', 'preview/ask', { platform: 'native', view: 'app' }, APP, { pr4: 'ask', act: 'latin', grow: true });
  add('ask-latin-desk', 'preview/ask', { platform: 'web', view: 'app' }, DESK, { view: DESKTOP, targets: false, pr4: 'ask', act: 'latin', grow: true });
  return LONG;
}

/**
 * Finding (b)'s answer: the owner's iPhone showed "(Aerobic Respiration)" split
 * over two lines with a lone, mirrored bracket on each. The long group is
 * longer than a phone line, so it must wrap, and still keep its brackets.
 */
export const LATIN = {
  question: 'أين يحدث التنفس الهوائي وكم جزيئة ATP ينتج؟',
  answer: 'يحدث التنفس الهوائي (Aerobic Respiration) داخل الميتوكوندريا، وتنتج جزيئة الغلوكوز الواحدة فيه نحو 30 إلى 32 جزيئة ATP [1].\n\n'
    + 'وتنتج معظم هذه الجزيئات في المرحلة الأخيرة (Oxidative phosphorylation across the inner mitochondrial membrane) كما في ملفك [2].',
  sources: [['الأحياء - الفصل 4.pdf', 0.9, [3, 4, 'page']], ['cell-respiration-notes.pdf', 0.84, [7, 7, 'page']]],
};

const QUIZ = {
  ar: [
    ['ما الذي يحدث للرابطة الثنائية في تفاعل الإضافة؟', ['تنكسر وتنضم ذرتان إلى الجزيء', 'تبقى كما هي', 'تتحول إلى رابطة ثلاثية', 'تنتقل إلى ذرة الكلور']],
    ['أي تفاعل يعطي كلوروميثان من الميثان؟', ['الإضافة', 'الاحتراق', 'الاستبدال بالكلور في الضوء', 'التبلمر']],
    ['ما الذي تبحث عنه لتعرف أن التفاعل إضافة؟', ['لون المحلول', 'رابطة ثنائية في المادة المتفاعلة', 'درجة الغليان', 'عدد ذرات الكربون']],
  ],
  en: [
    ['What happens to the double bond in an addition reaction?', ['It breaks and two atoms join the molecule', 'It stays as it is', 'It becomes a triple bond', 'It moves to the chlorine atom']],
    ['Which reaction gives chloromethane from methane?', ['Addition', 'Combustion', 'Substitution with chlorine in light', 'Polymerisation']],
    ['What tells you a reaction is an addition?', ['The colour of the solution', 'A double bond in the starting compound', 'The boiling point', 'The number of carbon atoms']],
  ],
};
// The result: question 1 right on option 0 (TRAP 1: a correct_index of 0 must
// still show as the right answer), question 2 wrong (picked 1, right 2), and
// question 3 left blank (the route reveals nothing for it).
const RESULTS = [
  { item_id: 'q1', selected_index: 0, is_correct: true, correct_index: 0 },
  { item_id: 'q2', selected_index: 1, is_correct: false, correct_index: 2 },
  { item_id: 'q3', selected_index: null, is_correct: false },
];

/**
 * The interception for one job. Returns true when it answered (or held) the
 * request. `held` keeps the requests left unanswered (the loading state).
 */
export function pr4Mock(job, LONG, r, held) {
  const u = new URL(r.url());
  if (r.method() !== 'POST') return false;
  const json = (status, body, headers = {}) => r.respond({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
  if (u.pathname === '/api/agent') {
    const L = LONG[job.locale];
    const msg = JSON.parse(r.postData() || '{}').message || '';
    if (msg === LATIN.question) {
      const cites = LATIN.sources.map(([f, s, p], i) => ({ index: i + 1, document_id: `l${i + 1}`, chunk_id: `l${i + 1}`, filename: f, similarity: s, page_start: p[0], page_end: p[1], page_kind: p[2] }));
      return r.respond({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Conversation-Id': 'proof-conversation', 'X-Citations': Buffer.from(JSON.stringify(cites)).toString('base64') },
        body: LATIN.answer,
      }), true;
    }
    const first = msg === L.question;
    const files = LONG.sources[job.locale];
    // G2: each source carries its page ([start, end, kind]) or null, as the route sends it.
    const cites = (first ? files : files.slice(0, 2)).map(([f, s, p], i) => ({ index: i + 1, document_id: `o${i + 1}`, chunk_id: `o${i + 1}-${first ? 'a' : 'b'}`, filename: f, similarity: s, page_start: p ? p[0] : null, page_end: p ? p[1] : null, page_kind: p ? p[2] : null }));
    return r.respond({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'X-Conversation-Id': 'proof-conversation', 'X-Citations': Buffer.from(JSON.stringify(cites)).toString('base64') },
      body: first ? L.answer : L.otherAnswer,
    }), true;
  }
  if (u.pathname === '/api/summarize') {
    if (job.s.act === 'summary-loading') { held.push(r); return true; }
    return json(500, { error: 'proof: a temporary failure' }), true;
  }
  if (u.pathname === '/api/quiz/generate') {
    const items = QUIZ[job.locale].map(([question, options], i) => ({ id: `q${i + 1}`, quiz_id: 'qz', question, options, position: i }));
    return json(200, { quiz: { id: 'qz' }, items, is_partial: false, cached: true }), true;
  }
  if (u.pathname === '/api/quiz/submit') return json(200, { results: RESULTS, score: 1, total: 3 }), true;
  return false;
}

/** The interaction, through the real controls, before the shot. */
export async function pr4Act(tab, job, LONG) {
  const act = job.s.act;
  if (act === 'converse' || act === 'latin') {
    const L = LONG[job.locale];
    for (const [k, q] of act === 'latin' ? [[1, LATIN.question]] : [[1, L.question], [2, L.otherQuestion]]) {
      await tab.evaluate((text) => {
        const t = document.querySelector('[data-kf-composer] textarea');
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        set.call(t, text);
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }, q);
      await tab.waitForFunction(() => { const b = document.querySelector('[data-kf-composer] button'); return b && !b.disabled; }, { timeout: 10000 });
      await tab.evaluate(() => document.querySelector('[data-kf-composer] button').click());
      // Done when the k-th answer's sources are drawn (they are drawn only
      // once the answer has stopped streaming).
      await tab.waitForFunction((n) => [...document.querySelectorAll('p')].filter((p) => /^(المصادر|Sources)$/.test(p.textContent.trim())).length >= n, { timeout: 20000 }, k);
    }
    // G2: the first answer's column (its card, the "Sources" line and the pills) is the shot.
    if (job.s.shot === 'sources') {
      const ok = await tab.evaluate(() => { const a = document.querySelector('[data-kf-bubble="answer"]'); if (a) a.parentElement.setAttribute('data-kf-shot', 'sources'); return !!a; });
      if (!ok) return { act, error: 'no answer card to shoot' };
    }
    return { act };
  }
  if (job.s.pr4 !== 'study') return { act };
  const mark = await tab.evaluate(() => {
    // The card that offers "Summarize" (no summary yet) and the card that
    // shows a stored summary; the same on main and on this head.
    const cards = [...document.querySelectorAll('article[data-kf-material]')];
    const todo = cards.find((c) => c.querySelector('[data-kf-study="summary"]'));
    const done = cards.find((c) => !c.querySelector('[data-kf-study="summary"]') && c.querySelector('[data-kf-study="quiz"]'));
    if (todo) todo.setAttribute('data-kf-shot', 'todo');
    if (done) done.setAttribute('data-kf-shot', 'done');
    return { todo: !!todo, done: !!done };
  });
  if (!mark.todo || !mark.done) return { act, error: `cards not found ${JSON.stringify(mark)}` };
  const press = (sel) => tab.evaluate((s) => document.querySelector(`[data-kf-shot="todo"] ${s}`).click(), sel);
  if (act === 'summary-loading') {
    await press('[data-kf-study="summary"] button');
    await tab.waitForFunction(() => document.querySelector('[data-kf-shot="todo"] [data-kf-study="summary"] button').disabled, { timeout: 10000 });
  } else if (act === 'summary-error') {
    await press('[data-kf-study="summary"] button');
    await tab.waitForFunction(() => document.querySelector('[data-kf-shot="todo"] [data-kf-study="summary"] p'), { timeout: 10000 });
  } else if (act === 'quiz-taking' || act === 'quiz-result') {
    await press('[data-kf-study="quiz"] button');
    await tab.waitForFunction(() => document.querySelectorAll('[data-kf-shot="todo"] ol > li').length === 3, { timeout: 10000 });
    const pick = (qi, oi) => tab.evaluate((a, b) => document.querySelectorAll('[data-kf-shot="todo"] ol > li')[a].querySelectorAll('label')[b].click(), qi, oi);
    if (act === 'quiz-taking') await pick(0, 2);
    else {
      await pick(0, 0);
      await pick(1, 1);
      await tab.evaluate(() => {
        const list = document.querySelector('[data-kf-shot="todo"] ol');
        const b = [...list.parentElement.querySelectorAll('button')].pop();
        b.click();
      });
      await tab.waitForFunction(() => document.querySelector('[data-kf-shot="todo"] input[type=radio]:disabled'), { timeout: 10000 });
    }
  }
  return { act };
}

/**
 * PR 4, IN THE PAGE (every PR 4 render; a finding on AFTER fails the run).
 * Self-contained; returns { findings, measured }. The selectors fall back to
 * main's structure, so BEFORE reports what the checks catch there.
 *   1. no bubble, choice or source text clipped: nothing inside an answer
 *      card, a question bubble, a quiz choice or a source pill runs past its
 *      box, and no box scrolls sideways;
 *   2. no outline (lucide) icon and no drawn outline illustration in the
 *      parts PR 4 redrew (the Ask card and its history, the composer, the
 *      empty states, the quiz, the summary, the consent sheet);
 *   3. no dashed border, and no hairline in those parts but a field's own
 *      edge (the composer, a textarea, an input);
 *   4. the quiz result: four markers of four SHAPES for four states, the
 *      right answer of question 1 on its FIRST option (TRAP 1: index 0), the
 *      wrong pick of question 2 and the right option 3 marked, question 3
 *      unanswered with its sentence and no mark;
 *   5. what the device run (ios-signed-in.yml) reads is still there: the
 *      summary heading as a leaf whose text is exactly it, the quiz buttons
 *      by their words, the consent sheet with both company names and its
 *      accept button.
 * The owner's review of #305 (2026-11-05) adds, each proven to fail on
 * d32bd5f (the witness run of design-c.yml with before_ref=d32bd5f):
 *   6. no Ask suggestion is CUT by its list: each card is wholly inside the
 *      list's visible box or wholly outside it (scrolled away), never part;
 *   7. a subject chip that runs past the chip bar's edge has the fade on
 *      THAT edge: the bar's mask-image ends transparent on the cut side;
 *   8. a freshly opened sheet shows no keyboard focus ring: nothing inside
 *      the dialog but the dialog itself matches :focus-visible at the shot
 *      (keyRing(), after the shot, proves Tab still draws one).
 * phraseChecks() (every screen) is the fourth: a protected phrase
 * (src/lib/keep-together.ts) never spans two lines.
 * G2 (page numbers in citations) adds, proven blind-free by pageLabelPlant()
 * on every Ask screen after the shot:
 *   9. a source pill's page label ([data-kf-source-page], "p. 12", "ص 3-4",
 *      "slide 5") sits on ONE line and wholly inside its pill; and where an
 *      answer has source pills, at least one of them carries a label (the
 *      preview's sources have a page, a range, a slide and a NULL).
 *      The #307 review (2026-11-06, on bfe04a2's renders) adds, each proven
 *      to fail on a forced wrong case by pageLabelPlant():
 *      (a) a range ([data-kf-page-from] / [data-kf-page-to]) shows its two
 *          numbers in the English order, the first LEFT of the second, in
 *          both locales (bfe04a2 drew "ص 3-4" as "4-3": bidi rule W2);
 *      (b) a pill name ([data-kf-source-name]) that wraps has no line of one
 *          word ("[n]" is not a word) and no line that starts or ends with a
 *          hyphen or dash ("reactions-cheatsheet-" / "v3" on bfe04a2);
 *      (c) no "•" or "·" anywhere in a pill (bfe04a2's separator sat on the
 *          wrong side in Arabic; the label now has its own line).
 *      The owner's decision on 129235f (2026-11-06) adds:
 *      (d) the label sits where the locale's reading starts: in Arabic
 *          (<html dir="rtl">) its right edge within 2 px of the name block's
 *          right edge, in English its left edge within 2 px of the name's
 *          left edge (129235f put the Arabic label on the left).
 * Finding (b) of 2026-11-07 adds, proven blind-free by latinPlant():
 *  10. latinRules(): in a right-to-left answer, a bracketed Latin group's
 *      brackets belong to its Latin text, a short one sits on one line, and
 *      none runs out of its card (the ask-latin-* screens hold one of each).
 */
export function pr4Checks(kind, act) {
  const findings = [];
  const measured = { bubbles: 0, choices: 0, sources: 0, outlined: 0 };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const label = (el) => `${el.tagName.toLowerCase()} "${txt(el)}"`;
  // 1
  const boxes = [
    ...document.querySelectorAll('[data-kf-bubble], .kf-bubble-user, .flex.justify-start > div > .kf-card'),
    ...document.querySelectorAll('[data-kf-choice], [data-kf-shot] ol label'),
    ...document.querySelectorAll('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a'),
    ...document.querySelectorAll('[data-kf-question]'),
  ];
  for (const b of new Set(boxes)) {
    if (!vis(b)) continue;
    if (b.matches('[data-kf-choice], ol label')) measured.choices++;
    else if (b.matches('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a')) measured.sources++;
    else measured.bubbles++;
    const R = b.getBoundingClientRect();
    if (b.scrollWidth > b.clientWidth + 1) findings.push(`clipped: ${label(b)} scrolls sideways (${b.scrollWidth} > ${b.clientWidth})`);
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.data.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width === 0) continue;
        if (r.left < R.left - 1 || r.right > R.right + 1 || r.top < R.top - 1 || r.bottom > R.bottom + 1) { findings.push(`clipped: text "${n.data.trim().slice(0, 30)}" runs out of ${label(b)}`); break; }
      }
    }
  }
  // 2 and 3
  const PARTS = kind === 'ask'
    ? '[data-kf-ask-card], [data-kf-thread], [data-kf-composer], [data-kf-history], [data-kf-ask-zero], [data-kf-ask-empty], main'
    : kind === 'consent' ? '[data-kf-consent-sheet]'
    : '[data-kf-shot]';
  const roots = [...document.querySelectorAll(PARTS)].filter(vis);
  const inParts = (el) => roots.some((r) => r === el || r.contains(el));
  const outline = roots.flatMap((r) => [...r.querySelectorAll('svg.lucide, [data-illustration]')]).filter((x) => !x.closest('aside, nav.kf-tabbar, .kf-topbar'));
  measured.outlined = new Set(outline).size;
  if (outline.length) findings.push(`outline icon(s): ${[...new Set(outline.map((x) => x.getAttribute('data-illustration') || [...x.classList].find((c) => c.startsWith('lucide-') && c !== 'lucide') || 'lucide'))].join(', ')}`);
  const transparent = (c) => /rgba\([^)]*,\s*0\)$/.test(c) || c === 'transparent';
  const FIELD = 'input, select, textarea, .kf-composer';
  let dashed = 0, hair = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el) || !inParts(el) || el.closest('aside, nav.kf-tabbar, .kf-topbar')) continue;
    const cs = getComputedStyle(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((x) => parseFloat(cs[`border${x}Width`]) > 0 && cs[`border${x}Style`] !== 'none' && !transparent(cs[`border${x}Color`]));
    if (!sides.length) continue;
    if (sides.some((x) => cs[`border${x}Style`] === 'dashed') && dashed++ < 6) findings.push(`dashed border on ${label(el)}`);
    else if (!el.matches(FIELD) && hair++ < 6) findings.push(`hairline (${sides.map((x) => `${x.toLowerCase()} ${cs[`border${x}Width`]}`).join(', ')}) on ${label(el)}`);
  }
  // 4
  if (act === 'quiz-result') {
    const items = [...document.querySelectorAll('[data-kf-shot] ol > li')];
    const states = items.map((li) => [...li.querySelectorAll('label')].map((l) => l.getAttribute('data-kf-choice')));
    measured.quiz = states;
    const want = [['right', 'idle', 'idle', 'idle'], ['idle', 'wrong', 'right', 'idle'], ['idle', 'idle', 'idle', 'idle']];
    if (JSON.stringify(states) !== JSON.stringify(want)) findings.push(`quiz result states ${JSON.stringify(states)}, want ${JSON.stringify(want)} (q1 right on option 0, q2 wrong 1 right 2, q3 blank)`);
    const shapes = {};
    for (const l of document.querySelectorAll('[data-kf-shot] [data-kf-choice]')) {
      const svg = l.querySelector('svg');
      shapes[l.getAttribute('data-kf-choice')] = svg ? [...svg.children].map((c) => c.tagName).join('+') + (svg.querySelector('path') ? ':' + svg.querySelector('path').getAttribute('d') : '') : null;
    }
    measured.markers = Object.keys(shapes);
    const distinct = new Set(Object.values(shapes));
    if (Object.values(shapes).some((v) => !v) || distinct.size !== Object.keys(shapes).length) findings.push(`quiz markers do not differ by shape: ${JSON.stringify(shapes)}`);
    // The blank question keeps its own sentence under the question (a second line of text in its card).
    if (!items[2] || items[2].querySelectorAll(':scope > p').length < 2) findings.push('quiz result: the blank question lost its sentence');
  }
  if (act === 'quiz-taking') {
    const states = [...document.querySelectorAll('[data-kf-shot] ol > li:first-child label')].map((l) => l.getAttribute('data-kf-choice'));
    measured.quiz = states;
    if (JSON.stringify(states) !== JSON.stringify(['idle', 'idle', 'picked', 'idle'])) findings.push(`quiz taking: question 1 states ${JSON.stringify(states)}, want option 3 picked`);
  }
  // 6. Ask suggestions, never cut by the list.
  for (const c of document.querySelectorAll('[data-kf-suggestion]')) {
    if (!vis(c)) continue;
    measured.suggestions = (measured.suggestions || 0) + 1;
    let box = c.parentElement;
    while (box && !/(auto|scroll|hidden)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (!box) continue;
    const B = box.getBoundingClientRect(), R = c.getBoundingClientRect();
    const top = Math.max(B.top, 0), bottom = Math.min(B.bottom, window.innerHeight);
    const inside = R.top >= top - 0.5 && R.bottom <= bottom + 0.5;
    const outside = R.bottom <= top + 0.5 || R.top >= bottom - 0.5;
    if (inside) measured.suggestionsWhole = (measured.suggestionsWhole || 0) + 1;
    if (!inside && !outside) findings.push(`a suggestion is cut by its list: ${label(c)} (${R.top.toFixed(0)}-${R.bottom.toFixed(0)} in ${top.toFixed(0)}-${bottom.toFixed(0)})`);
  }
  // 7. Chips cut at the bar's edge carry the fade there. The bar is read by
  // structure on d32bd5f (no marker): a sideways-scrolling row of pressed buttons.
  const bars = new Set([...document.querySelectorAll('[data-kf-chips]'), ...[...document.querySelectorAll('button[aria-pressed]')].map((b) => b.parentElement).filter((r) => /(auto|scroll)/.test(getComputedStyle(r).overflowX))]);
  for (const bar of bars) {
    if (!vis(bar)) continue;
    measured.chipBars = (measured.chipBars || 0) + 1;
    const B = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const mask = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : (cs.webkitMaskImage || 'none');
    const stops = mask === 'none' ? [] : (mask.match(/rgba?\([^)]*\)/g) || []);
    const clear = (c) => /rgba\([^)]*,\s*0\)/.test(c || '');
    const reversed = /to left/.test(mask);
    const fadeLeft = clear(reversed ? stops[stops.length - 1] : stops[0]);
    const fadeRight = clear(reversed ? stops[0] : stops[stops.length - 1]);
    for (const chip of bar.querySelectorAll('button')) {
      const R = chip.getBoundingClientRect();
      const cutLeft = R.left < B.left - 0.5 && R.right > B.left;
      const cutRight = R.right > B.right + 0.5 && R.left < B.right;
      if (cutLeft || cutRight) measured.chipsCut = (measured.chipsCut || 0) + 1;
      if ((cutLeft && !fadeLeft) || (cutRight && !fadeRight)) findings.push(`a chip is cut at the bar's ${cutLeft ? 'left' : 'right'} edge with no fade there: ${label(chip)} (mask ${mask.slice(0, 60)})`);
    }
  }
  // 8. A freshly opened sheet: no focus ring on a control.
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.closest('[aria-hidden="true"]') === null && vis(d));
  if (dlg) {
    const a = document.activeElement;
    measured.sheetFocus = a ? (a === dlg ? 'the dialog' : label(a)) : null;
    if (a && a !== dlg && dlg.contains(a) && a.matches(':focus-visible')) findings.push(`a freshly opened sheet shows a focus ring on ${label(a)}`);
  }
  // 9. G2: page labels, one line, inside their pill (the same rule as pageLabelPlant()).
  if (kind === 'ask') {
    const pills = [...document.querySelectorAll('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a')].filter(vis);
    const labels = [...document.querySelectorAll('[data-kf-source-page]')].filter(vis);
    measured.pageLabels = labels.length;
    measured.pageLabelTexts = labels.map((l) => (l.textContent || '').replace(/\s+/g, ' ').trim());
    measured.unlabelledSources = pills.filter((p) => !p.querySelector('[data-kf-source-page]')).length;
    for (const l of labels) {
      const pill = l.closest('[data-kf-source], .kf-pill');
      const P = pill.getBoundingClientRect(), L = l.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(l);
      const lines = [];
      for (const r of range.getClientRects()) {
        if (!(r.width > 0 && r.height > 0)) continue;
        const mid = (r.top + r.bottom) / 2;
        if (!lines.some((x) => mid >= x.top && mid <= x.bottom)) lines.push({ top: r.top, bottom: r.bottom });
      }
      if (lines.length > 1) findings.push(`a page label wraps onto ${lines.length} lines: "${txt(l)}" in ${label(pill)}`);
      if (L.left < P.left - 1 || L.right > P.right + 1 || L.top < P.top - 1 || L.bottom > P.bottom + 1 || l.scrollWidth > l.clientWidth + 1) findings.push(`a page label is clipped by its pill: "${txt(l)}" (${L.left.toFixed(0)}-${L.right.toFixed(0)} in ${P.left.toFixed(0)}-${P.right.toFixed(0)})`);
    }
    if (pills.length && !labels.length) findings.push(`${pills.length} source pill(s) and no page label on any (G2)`);
    // (a)-(c): g2Rules(), defined in the page by render.mjs first (one copy, shared with pageLabelPlant()).
    const g2 = window.g2Rules();
    measured.ranges = g2.ranges;
    measured.nameLines = g2.nameLines;
    measured.labelEdgeGaps = g2.edgeGaps;
    for (const f of g2.findings) findings.push(f);
    // 10. Finding (b): bracketed Latin groups in a right-to-left answer (latinRules(), defined in the page by render.mjs).
    const lat = window.latinRules();
    measured.latinGroups = lat.groups;
    if (act === 'latin' && lat.groups.length < 2) findings.push(`the Latin-group answer shows ${lat.groups.length} group(s), want 2 (check 10 would be blind)`);
    for (const f of lat.findings) findings.push(f);
  }
  // 5. The device run's own selectors.
  if (kind === 'study') {
    if (act === 'none' && document.querySelector('[data-kf-shot="done"]')) {
      const leaf = [...document.querySelectorAll('h1,h2,h3,h4,p,span,div')].filter((x) => x.children.length === 0 && /^(SUMMARY|Summary|الملخّص|الملخص|ملخص)$/.test((x.innerText || '').trim()));
      measured.summaryLeaf = leaf.length;
      // The device run's step reads English; capture_steps.py's SUMMARY adds the Arabic with its shadda.
      if (!leaf.length) findings.push('device run: no summary heading leaf (ios-signed-in step "summary", capture_steps.py SUMMARY)');
      if (![...document.querySelectorAll('button')].some((x) => /Quiz me on this material|اختبرني في هذا الملف/.test(x.innerText || ''))) findings.push('device run: no quiz button (step "quiz-open")');
    }
    if (act === 'quiz-taking' && ![...document.querySelectorAll('button')].some((x) => /Check my answers|صحّح إجاباتي/.test(x.innerText || ''))) findings.push('device run: no "Check my answers" button (step "quiz")');
  }
  if (kind === 'consent') {
    const d = document.querySelector('[data-kf-consent-sheet=open]');
    const names = d ? ['Anthropic', 'Voyage AI'].filter((n) => (d.innerText || '').includes(n)) : [];
    measured.consentNames = names;
    if (!d || names.length !== 2 || !d.querySelector('[data-kf-consent=accept]')) findings.push(`device run: the consent sheet must name Anthropic and Voyage AI and carry its accept button (${names.join(', ')})`);
  }
  return { findings, measured };
}

/**
 * G2, CHECK 9'S FORCED WRONG CASES (run AFTER the shot on every Ask screen).
 * Self-contained. With a style tag it makes every page label (a) wrap, by
 * giving it a 2-character box that may break, and (b) clipped, by narrowing
 * its pill (2rem) below the label's width with the overflow hidden; each time it
 * applies check 9's own rule, and the tag is removed. Every label must be
 * flagged both times; one that is not makes the check blind, which fails the
 * run. A screen with no label reports labels 0 and no finding.
 */
export function pageLabelPlant() {
  const read = () => {
    let wraps = 0, clipped = 0;
    const labels = [...document.querySelectorAll('[data-kf-source-page]')].filter((l) => l.getBoundingClientRect().width > 0);
    for (const l of labels) {
      const pill = l.closest('[data-kf-source], .kf-pill');
      const P = pill.getBoundingClientRect(), L = l.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(l);
      const lines = [];
      for (const r of range.getClientRects()) {
        if (!(r.width > 0 && r.height > 0)) continue;
        const mid = (r.top + r.bottom) / 2;
        if (!lines.some((x) => mid >= x.top && mid <= x.bottom)) lines.push({ top: r.top, bottom: r.bottom });
      }
      if (lines.length > 1) wraps++;
      if (L.left < P.left - 1 || L.right > P.right + 1 || L.top < P.top - 1 || L.bottom > P.bottom + 1 || l.scrollWidth > l.clientWidth + 1) clipped++;
    }
    return { labels: labels.length, wraps, clipped };
  };
  const force = (css) => {
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
    try { return read(); } finally { tag.remove(); }
  };
  const clean = read();
  const wrap = force('[data-kf-source-page] { white-space: normal !important; width: 2ch !important; overflow-wrap: anywhere !important; }');
  // 2rem, not bfe04a2's 4.5rem: with the label on its own line under the name, a 4.5rem pill still holds it.
  const clip = force('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a { max-width: 2rem !important; overflow: hidden !important; }');
  const n = clean.labels;
  // (a) bfe04a2's shape on every range: the isolate removed and an Arabic word
  //     before the numbers ("ص 3-4" as plain text, dir="auto"), which the bidi
  //     algorithm draws "4-3"; restored after the read.
  const ranges = [...document.querySelectorAll('[data-kf-page-from][data-kf-page-to]')].filter((l) => l.getBoundingClientRect().width > 0);
  const before = window.g2Rules();
  const saved = ranges.map((l) => [l, [...l.childNodes], l.getAttribute('dir')]);
  for (const l of ranges) { l.setAttribute('dir', 'auto'); l.textContent = `ص ${l.dataset.kfPageFrom}-${l.dataset.kfPageTo}`; }
  let order;
  try { order = window.g2Rules(); } finally { for (const [l, kids, dir] of saved) { l.replaceChildren(...kids); if (dir === null) l.removeAttribute('dir'); else l.setAttribute('dir', dir); } }
  // (b) every name forced to its narrowest box: each word on a line of its own.
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-source-name] { width: min-content !important; }';
  document.head.appendChild(tag);
  let narrow;
  try { narrow = window.g2Rules(); } finally { tag.remove(); }
  // (c) a "•" appended to every pill.
  const pills = [...document.querySelectorAll('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a')].filter((p) => p.getBoundingClientRect().width > 0);
  const dots = pills.map((p) => p.appendChild(Object.assign(document.createElement('span'), { textContent: ' •' })));
  let dotted;
  try { dotted = window.g2Rules(); } finally { for (const d of dots) d.remove(); }
  // (d) each label pushed to the edge where reading ENDS (129235f's Arabic shape).
  const side = document.createElement('style');
  side.textContent = 'html[dir="rtl"] [data-kf-source-page] { align-self: flex-start !important; } html:not([dir="rtl"]) [data-kf-source-page] { align-self: flex-end !important; }';
  document.head.appendChild(side);
  let flipped;
  try { flipped = window.g2Rules(); } finally { side.remove(); }
  const after = window.g2Rules();
  const blind = (n > 0 && (wrap.wraps !== n || clip.clipped !== n))
    || order.reversed !== ranges.length || narrow.badNames !== narrow.names || dotted.dotted !== pills.length
    || flipped.offEdge !== flipped.edges
    || after.findings.length !== before.findings.length;
  return {
    labels: n, wrapCaught: wrap.wraps, clipCaught: clip.clipped,
    ranges: ranges.length, orderCaught: order.reversed,
    names: narrow.names, oneWordCaught: narrow.badNames,
    pills: pills.length, bulletCaught: dotted.dotted,
    edges: flipped.edges, edgeCaught: flipped.offEdge,
    finding: blind ? `the page-label check is blind: ${n} label(s), forced wrap flagged ${wrap.wraps}, forced clip flagged ${clip.clipped}; ${ranges.length} range(s), reversed flagged ${order.reversed}; ${narrow.names} name(s), one-word lines flagged ${narrow.badNames}; ${pills.length} pill(s), "•" flagged ${dotted.dotted}; ${flipped.edges} label edge(s), flipped flagged ${flipped.offEdge}; ${before.findings.length} finding(s) before forcing, ${after.findings.length} after restoring` : null,
  };
}

/**
 * Check 9 (a)-(c), IN THE PAGE (render.mjs defines it as window.g2Rules before
 * pr4Checks() and pageLabelPlant() run). Returns the findings and the counts
 * the forced cases compare against.
 *   (a) each range's two numbers: the first's left edge left of the second's;
 *   (b) each pill name, its characters grouped into visual lines: when it
 *       wraps, every line has two words or more ("[n]" not counted) and no
 *       line starts or ends with a hyphen or dash;
 *   (c) no "•" or "·" in any pill's text.
 */
export function g2Rules() {
  const findings = [];
  const vis = (el) => el.getBoundingClientRect().width > 0;
  const short = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 40);
  const charRect = (node, i) => {
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + 1);
    return [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0) || null;
  };
  // (a)
  let reversed = 0;
  const ranges = [];
  for (const l of [...document.querySelectorAll('[data-kf-page-from][data-kf-page-to]')].filter(vis)) {
    const from = l.dataset.kfPageFrom, to = l.dataset.kfPageTo, want = `${from}-${to}`;
    let a = null, b = null;
    const tw = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n && !a; n = tw.nextNode()) {
      const at = n.data.indexOf(want);
      if (at >= 0) { a = charRect(n, at); b = charRect(n, at + from.length + 1); }
    }
    const ok = !!(a && b) && a.left < b.left;
    ranges.push(`${short(l.textContent)}: ${a && b ? (ok ? `${from} left of ${to}` : `${to} left of ${from}`) : 'numbers not found'}`);
    if (!ok) { reversed++; findings.push(`a page range reads backwards on screen: "${short(l.textContent)}" shows ${to} before ${from}`); }
  }
  // (b)
  let names = 0, badNames = 0;
  const nameLines = [];
  for (const el of [...document.querySelectorAll('[data-kf-source-name]')].filter(vis)) {
    names++;
    const lines = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      for (let i = 0; i < n.data.length; i++) {
        const rc = charRect(n, i);
        if (!rc) { if (lines.length) lines[lines.length - 1].s += n.data[i]; continue; }
        const mid = (rc.top + rc.bottom) / 2;
        let line = lines.find((x) => mid >= x.top && mid <= x.bottom);
        if (!line) { line = { top: rc.top, bottom: rc.bottom, s: '' }; lines.push(line); }
        line.s += n.data[i];
      }
    }
    const texts = lines.sort((x, y) => x.top - y.top).map((x) => x.s.replace(/\s+/g, ' ').trim());
    nameLines.push(texts.join(' / '));
    if (texts.length < 2) continue;
    const bad = texts.filter((t) => t.split(' ').filter((w) => w && !/^\[\d+\]$/.test(w)).length < 2 || /^[-‐‑–—]|[-‐‑–—]$/.test(t));
    if (bad.length) { badNames++; findings.push(`a source name wraps badly: ${texts.map((t) => `"${t}"`).join(' / ')}`); }
  }
  // (c)
  let dotted = 0;
  for (const p of [...document.querySelectorAll('[data-kf-source], .flex.flex-wrap[dir="ltr"] > a')].filter(vis)) {
    if (/[•·]/.test(p.textContent || '')) { dotted++; findings.push(`a "•" in a source pill: "${short(p.textContent)}"`); }
  }
  // (d)
  let edges = 0, offEdge = 0;
  const edgeGaps = [];
  const rtl = document.documentElement.dir === 'rtl';
  for (const l of [...document.querySelectorAll('[data-kf-source-page]')].filter(vis)) {
    const nm = l.parentElement && l.parentElement.querySelector('[data-kf-source-name]');
    if (!nm) continue;
    edges++;
    const L = l.getBoundingClientRect(), N = nm.getBoundingClientRect();
    const gap = rtl ? Math.abs(L.right - N.right) : Math.abs(L.left - N.left);
    edgeGaps.push(Math.round(gap * 10) / 10);
    if (gap > 2) { offEdge++; findings.push(`a page label is ${gap.toFixed(1)} px off the name's ${rtl ? 'right' : 'left'} edge (the reading start): "${short(l.textContent)}"`); }
  }
  return { findings, reversed, ranges, names, badNames, nameLines, dotted, edges, offEdge, edgeGaps };
}

/**
 * CHECK 10, IN THE PAGE (finding (b), 2026-11-07; render.mjs defines it as
 * window.latinRules). In every answer card that reads right to left, each
 * bracketed group whose inside has a Latin letter and no Arabic letter, no
 * bracket and no "[n]" (the rule of src/lib/latin-groups.ts, re-read from the
 * TEXT, so main's plain text is read the same way):
 *   (a) its "(" is on the line of its first letter and LEFT of it, and its
 *       ")" on the line of its last letter and RIGHT of it: the brackets
 *       belong to the Latin text. On main they belong to the Arabic and are
 *       drawn mirrored; unsplit that still LOOKS right, but a line break
 *       inside the group leaves "inner)" / "(mitochondrial", a lone bracket
 *       facing the wrong way on each line (the iPhone's shape);
 *   (b) a group of at most 30 characters inside its brackets is on ONE line;
 *   (c) no character of a group lies outside its card (check 1 also reads
 *       the card's sideways scroll).
 */
export function latinRules() {
  const findings = [];
  const groups = [];
  const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/, LAT = /[A-Za-zÀ-ɏ]/;
  const charRect = (node, i) => {
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + 1);
    return [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0) || null;
  };
  const sameLine = (a, b) => !!(a && b) && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < Math.min(a.height, b.height) / 2;
  for (const card of document.querySelectorAll('[data-kf-bubble="answer"]')) {
    if (!(card.getBoundingClientRect().width > 0) || !card.matches(':dir(rtl)')) continue;
    const C = card.getBoundingClientRect();
    for (const block of card.querySelectorAll('p, li, h1, h2, h3')) {
      if (block.querySelector('p, li')) continue;
      const nodes = [];
      let text = '';
      const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) { nodes.push({ n, start: text.length }); text += n.data; }
      const at = (i) => { let k = nodes.length - 1; while (k > 0 && nodes[k].start > i) k--; return charRect(nodes[k].n, i - nodes[k].start); };
      for (const m of text.matchAll(/\(([^()[\]\n]+)\)/g)) {
        const inner = m[1];
        if (!LAT.test(inner) || RTL.test(inner)) continue;
        const i0 = m.index, i1 = m.index + m[0].length - 1;
        const first = i0 + 1 + (inner.length - inner.trimStart().length), last = i1 - 1 - (inner.length - inner.trimEnd().length);
        const open = at(i0), close = at(i1), a = at(first), z = at(last);
        const rects = [];
        for (let i = i0; i <= i1; i++) { const r = at(i); if (r) rects.push(r); }
        const lines = [];
        for (const r of rects) if (!lines.some((l) => sameLine(l, r))) lines.push(r);
        const short = inner.length <= 30;
        const g = { text: m[0], short, lines: lines.length, ok: true };
        const openOk = sameLine(open, a) && open.right <= a.left + 1;
        const closeOk = sameLine(close, z) && close.left >= z.right - 1;
        if (!openOk || !closeOk) {
          g.ok = false;
          g.bracket = true;
          findings.push(`the brackets of "${m[0].slice(0, 40)}" belong to the Arabic, not to the Latin text (drawn mirrored; a line break inside leaves a lone bracket on each line): ${openOk ? '' : `"(" is ${sameLine(open, a) ? 'right of' : 'not on the line of'} "${text[first]}"`}${!openOk && !closeOk ? ', ' : ''}${closeOk ? '' : `")" is ${sameLine(close, z) ? 'left of' : 'not on the line of'} "${text[last]}"`}`);
        }
        if (short && lines.length > 1) { g.ok = false; g.split = true; findings.push(`a short Latin group splits across ${lines.length} lines: "${m[0]}"`); }
        if (rects.some((r) => r.left < C.left - 1 || r.right > C.right + 1)) { g.ok = false; g.clipped = true; findings.push(`a Latin group runs out of its card: "${m[0].slice(0, 40)}"`); }
        groups.push(g);
      }
    }
  }
  return { findings, groups };
}

/**
 * CHECK 10'S FORCED WRONG CASES (run AFTER the shot on every Ask screen with
 * a group). (a) main's shape: every isolate unwrapped back to plain text, so
 * the bidi algorithm gives the brackets to the Arabic, as on the iPhone;
 * every group must be flagged. (b) every short group forced into its
 * narrowest box, a word per line; every short group must be flagged as
 * split. Each is undone after its read. A check that misses one is blind.
 */
export function latinPlant() {
  const isolates = [...document.querySelectorAll('[data-kf-latin-group]')].filter((x) => x.getBoundingClientRect().width > 0);
  const before = window.latinRules();
  const swaps = isolates.map((b) => { const t = document.createTextNode(b.textContent); b.replaceWith(t); return [t, b]; });
  let plain;
  try { plain = window.latinRules(); } finally { for (const [t, b] of swaps) t.replaceWith(b); }
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-latin-group="short"] { width: min-content !important; }';
  document.head.appendChild(tag);
  let narrow;
  try { narrow = window.latinRules(); } finally { tag.remove(); }
  const after = window.latinRules();
  const shorts = isolates.filter((b) => b.dataset.kfLatinGroup === 'short').length;
  const mirroredCaught = plain.groups.filter((g) => g.bracket).length;
  const splitCaught = narrow.groups.filter((g) => g.split).length;
  const blind = mirroredCaught !== isolates.length || splitCaught !== shorts || after.findings.length !== before.findings.length;
  return {
    isolates: isolates.length, mirroredCaught, shorts, splitCaught,
    finding: blind ? `the Latin-group check is blind: ${isolates.length} isolate(s), unwrapped flagged ${mirroredCaught}; ${shorts} short, forced split flagged ${splitCaught}; ${before.findings.length} finding(s) before forcing, ${after.findings.length} after` : null,
  };
}

/** The protected phrases, read from src/lib/keep-together.ts (one list). */
export function keepTogetherList(root) {
  const src = readFileSync(join(root, 'src', 'lib', 'keep-together.ts'), 'utf8');
  const m = /KEEP_TOGETHER = \[([^\]]*)\]/.exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

/**
 * EVERY SCREEN: no protected phrase spans two lines. Self-contained; per
 * text block (the nearest non-inline ancestor), the phrase's words may be
 * joined by a space or a no-break space; a phrase inside a longer word
 * ("بالذكاء الاصطناعي") is read too.
 */
export function phraseChecks(list) {
  const findings = [];
  let read = 0;
  if (!list.length) return { findings: ['no protected phrase list'], read };
  const re = new RegExp(list.map((p) => p.split(' ').join('[ \u00A0]+')).join('|'), 'g');
  const blocks = new Map();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, script, style, noscript, .sr-only, [hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    let b = el;
    while (b !== document.body && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
    blocks.set(b, [...(blocks.get(b) || []), n]);
  }
  for (const [b, nodes] of blocks) {
    let text = '';
    const at = [];
    for (const n of nodes) { at.push({ n, start: text.length }); text += n.data; }
    const locate = (i) => { let k = at.length - 1; while (k > 0 && at[k].start > i) k--; return [at[k].n, i - at[k].start]; };
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      read++;
      const range = document.createRange();
      range.setStart(...locate(m.index));
      const [en, eo] = locate(m.index + m[0].length - 1);
      range.setEnd(en, eo + 1);
      const lines = [];
      for (const r of range.getClientRects()) {
        if (!(r.width > 0 && r.height > 0)) continue;
        const mid = (r.top + r.bottom) / 2;
        const l = lines.find((x) => mid >= x.top && mid <= x.bottom);
        if (l) { l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); } else lines.push({ top: r.top, bottom: r.bottom });
      }
      if (lines.length > 1) findings.push(`the phrase "${m[0].replace(/\u00A0/g, ' ')}" splits across ${lines.length} lines in ${b.tagName.toLowerCase()} "${b.textContent.trim().slice(0, 40)}"`);
    }
  }
  return { findings, read };
}

/** After the shot, on a sheet: Tab reaches a control inside it and draws a focus ring (keyboard use keeps its ring). */
export async function keyRing(tab) {
  await tab.keyboard.press('Tab');
  return tab.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.closest('[aria-hidden="true"]') === null);
    const a = document.activeElement;
    if (!d || !a || !d.contains(a) || a === d) return { ok: false, on: a ? a.tagName : null };
    const cs = getComputedStyle(a);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow) && cs.boxShadow !== 'none';
    return { ok: a.matches(':focus-visible') && ring, on: `${a.tagName.toLowerCase()} "${(a.textContent || '').trim().slice(0, 30)}"`, shadow: cs.boxShadow.slice(0, 60) };
  });
}
