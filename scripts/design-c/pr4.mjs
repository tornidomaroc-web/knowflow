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
    // History: AFTER opens the phone's drawer over the long conversation;
    // main has no history with data, so its history view (the empty list).
    add(`ask-history-${p}`, 'preview/ask', { platform: pf, view: 'app', open: 'c2', drawer: '1' }, ua, { pr4: 'ask', beforeQ: { platform: pf, view: 'history' } });
    add(`study-idle-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'none', shot: 'todo' });
    add(`summary-loading-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'summary-loading', shot: 'todo' });
    add(`summary-error-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'summary-error', shot: 'todo' });
    add(`summary-full-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'none', shot: 'done' });
    add(`quiz-taking-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'quiz-taking', shot: 'todo' });
    add(`quiz-result-${p}`, 'preview/subject', { platform: pf }, ua, { pr4: 'study', act: 'quiz-result', shot: 'todo' });
    add(`consent-${p}`, 'preview/ai-consent', {}, ua, { pr4: 'consent' });
  }
  add('ask-zero-app', 'preview/ask', { platform: 'native', view: 'zero' }, APP, { pr4: 'ask' });
  add('ask-noanswer-app', 'preview/ask', { platform: 'native', view: 'noanswer' }, APP, { pr4: 'ask' });
  // A desk: the history column beside the opened long conversation.
  add('ask-history-desk', 'preview/ask', { platform: 'web', view: 'app', open: 'c2' }, DESK, { view: DESKTOP, targets: false, pr4: 'ask', grow: true, beforeQ: { platform: 'web', view: 'history' } });
  return LONG;
}

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
    const first = msg === L.question;
    const files = LONG.sources[job.locale];
    const cites = (first ? files : files.slice(0, 2)).map(([f, s], i) => ({ index: i + 1, document_id: `o${i + 1}`, chunk_id: `o${i + 1}-${first ? 'a' : 'b'}`, filename: f, similarity: s }));
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
  if (act === 'converse') {
    const L = LONG[job.locale];
    for (const [k, q] of [[1, L.question], [2, L.otherQuestion]]) {
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
