/**
 * Step Redesign-1: writes the static mockup pages (docs/design/redesign-mockups).
 * One HTML file per render: six screens, Arabic in dark and light, English
 * dark for Subjects and Settings. Fixture data only; nothing here is imported
 * by the app, and nothing is fetched.
 *
 * Icons: Phosphor Icons 2.1.1 (MIT, scripts/redesign/icons/LICENSE-phosphor.txt),
 * regular for idle, fill for active and for chips. Illustration, status-bar
 * glyphs: drawn here.
 *
 * Usage: node scripts/redesign/build.mjs OUTDIR   (prints the page list as JSON)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FONT = pathToFileURL(join(ROOT, 'docs', 'store', 'screenshots-designed', 'fonts', 'rubik', 'Rubik[wght].ttf')).href;
const out = resolve(process.argv[2] || join(ROOT, '.redesign-pages'));
const css = readFileSync(join(HERE, 'kit.css'), 'utf8').replace('FONT_URL', FONT);

const icon = (name, fill = false) =>
  readFileSync(join(HERE, 'icons', `${name}${fill ? '-fill' : ''}.svg`), 'utf8')
    .replace('<svg ', '<svg aria-hidden="true" width="24" height="24" ');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A run in the other direction, isolated: a Latin list, a file name, a formula.
const iso = (s, dir = 'auto') => `<bdi dir="${dir}">${esc(s)}</bdi>`;

// ── Drawn here: the status bar glyphs and the Ask illustration. ──
const STATUS = `<div class="glyphs">
<svg aria-hidden="true" width="19" height="12" viewBox="0 0 19 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg aria-hidden="true" width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8.5.4 10.6 10.6 0 0 0 1 3.4l1.2 1.3a9 9 0 0 1 6.3-2.5Zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3a7.1 7.1 0 0 0-9.8 0l1.2 1.3c1-.9 2.3-1.4 3.7-1.4Zm0 3.6c.5 0 1 .2 1.3.5L8.5 11.6 7.2 9.9c.3-.3.8-.5 1.3-.5Z"/></svg>
<svg aria-hidden="true" width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.45"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.2" width="2" height="4.6" rx="1" fill="currentColor" fill-opacity="0.5"/></svg>
</div>`;

const ILLUSTRATION = `<svg aria-hidden="true" width="188" height="150" viewBox="0 0 188 150">
<defs>
<linearGradient id="bk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c06c"/><stop offset="1" stop-color="#c3913a"/></linearGradient>
<linearGradient id="bk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff"/><stop offset="1" stop-color="#5f9ee0"/></linearGradient>
<linearGradient id="bk3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe3c0"/><stop offset="1" stop-color="#46b386"/></linearGradient>
<linearGradient id="bub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8ec"/><stop offset="1" stop-color="#ead9bd"/></linearGradient>
<radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="86" cy="138" rx="70" ry="9" fill="url(#sh)"/>
<rect x="26" y="104" width="120" height="28" rx="12" fill="url(#bk2)"/>
<rect x="26" y="104" width="120" height="7" rx="3.5" fill="#fff" fill-opacity="0.35"/>
<rect x="36" y="78" width="104" height="28" rx="12" fill="url(#bk3)"/>
<rect x="36" y="78" width="104" height="7" rx="3.5" fill="#fff" fill-opacity="0.35"/>
<rect x="30" y="52" width="112" height="28" rx="12" fill="url(#bk1)"/>
<rect x="30" y="52" width="112" height="7" rx="3.5" fill="#fff" fill-opacity="0.4"/>
<rect x="116" y="52" width="10" height="38" rx="3" fill="#b5462f"/>
<path d="M116 86l5-5 5 5z" fill="#14110d" fill-opacity="0.25"/>
<path d="M118 8h52a14 14 0 0 1 14 14v18a14 14 0 0 1-14 14h-30l-14 12 3-12h-11a14 14 0 0 1-14-14V22a14 14 0 0 1 14-14z" fill="url(#bub)"/>
<path d="M118 8h52a14 14 0 0 1 14 14v3H104v-3a14 14 0 0 1 14-14z" fill="#fff" fill-opacity="0.55"/>
<path d="M144 18l3.2 8.3 8.3 3.2-8.3 3.2L144 41l-3.2-8.3-8.3-3.2 8.3-3.2z" fill="#d4a548"/>
<circle cx="162" cy="22" r="3" fill="#d4a548" fill-opacity="0.7"/>
</svg>`;

// ── Fixtures. ──
const T = {
  ar: {
    tabs: ['الرئيسية', 'المواد', 'اسأل', 'الإعدادات'],
    subjects: [
      { name: 'الرياضيات', icon: 'function', tint: 'gold', files: '12 ملفًا', done: '9 ملخّصة', pct: 75 },
      { name: 'الفيزياء والكيمياء', icon: 'atom', tint: 'sky', files: '9 ملفات', done: '5 ملخّصة', pct: 55 },
      { name: 'علوم الحياة والأرض', icon: 'dna', tint: 'mint', files: '7 ملفات', done: '3 ملخّصة', pct: 40 },
      { name: 'الفلسفة', icon: 'brain', tint: 'violet', files: '5 ملفات', done: 'ملخص واحد', pct: 20 },
      { name: 'اللغة العربية', icon: 'feather', tint: 'coral', files: '3 ملفات', done: 'لم تبدأ بعد', pct: 0 },
    ],
    subjectsTitle: 'المواد', subjectsSub: 'مادة لكل مقرر، وتقدمك في كل واحدة.', newSubject: 'مادة جديدة',
  },
  en: {
    tabs: ['Home', 'Subjects', 'Ask', 'Settings'],
    subjects: [
      { name: 'Mathematics', icon: 'function', tint: 'gold', files: '12 files', done: '9 summarised', pct: 75 },
      { name: 'Physics and Chemistry', icon: 'atom', tint: 'sky', files: '9 files', done: '5 summarised', pct: 55 },
      { name: 'Life and Earth Sciences', icon: 'dna', tint: 'mint', files: '7 files', done: '3 summarised', pct: 40 },
      { name: 'Philosophy', icon: 'brain', tint: 'violet', files: '5 files', done: '1 summarised', pct: 20 },
      { name: 'Arabic Language', icon: 'feather', tint: 'coral', files: '3 files', done: 'Not started', pct: 0 },
    ],
    subjectsTitle: 'Subjects', subjectsSub: 'One subject per course, with your progress.', newSubject: 'New subject',
  },
};

const TAB_ICONS = ['house', 'books', 'chat-circle-text', 'gear'];
const tabbar = (locale, active) => `<nav class="tabbar" aria-label="tabs">${T[locale].tabs.map((label, i) =>
  `<a class="tab" href="#"${i === active ? ' aria-current="page"' : ''}>${icon(TAB_ICONS[i], i === active)}<span>${esc(label)}</span></a>`).join('')}</nav><div class="home-indicator"></div>`;

function page({ locale, theme, title, body, active, extra = '' }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${locale}" dir="${dir}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=440"><title>${esc(title)}</title><style>${css}</style></head>
<body><div class="screen"><div class="status"><span>9:41</span>${STATUS}</div><main class="scroll">${body}</main>${extra}${tabbar(locale, active)}</div></body></html>`;
}

const back = (label) => `<div class="navrow"><a class="back" href="#">${icon('caret-left')}<span>${esc(label)}</span></a></div>`;

// ── Screens. ──
function home() {
  const days = ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'];
  return `<div class="navrow"></div>
<div class="title-row"><div><h1 class="large-title">مساء الخير</h1><p class="subtitle">الأحد 12 أكتوبر، لنكمل من حيث توقفت.</p></div></div>
<section class="card mt-18">
  <div class="h-row"><span class="chip t-gold">${icon('flame', true)}</span><div><p class="t-h">5 أيام متتالية</p><p class="t-sm t-2">ذاكرت كل يوم هذا الأسبوع. حافظ على السلسلة.</p></div></div>
  <div class="between mt-14">${days.map((d, i) => `<span class="well" style="width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:600;font-size:15px;${i < 5 ? 'background:linear-gradient(180deg,var(--gold-top),var(--gold-bottom));background-color:var(--gold-bottom);color:var(--on-gold);box-shadow:inset 0 1px 0 var(--gold-hi),inset 0 -4px 7px -4px var(--gold-shade);' : i === 6 ? 'color:var(--gold-text);border:1.5px solid var(--gold);' : 'color:var(--text-2);'}">${d}</span>`).join('')}</div>
</section>
<h2 class="section-h">تابع المذاكرة</h2>
<section class="card">
  <div class="h-row"><span class="chip t-coral">${icon('file-pdf', true)}</span><div class="grow" style="flex:1;min-width:0"><p class="t-h">${iso('درس الدوال الأسية.pdf')}</p><p class="t-sm t-2">الرياضيات، ملخص واختبار جاهزان</p></div></div>
  <div class="between mt-14"><div class="bar" style="flex:1"><i style="width:60%"></i></div><span class="t-sm gold" style="font-weight:600">60%</span></div>
  <div class="grid2 mt-14"><a class="btn btn-primary btn-sm" href="#">${icon('book-open-text', true)}افتح الملخص</a><a class="btn btn-secondary btn-sm" href="#">${icon('exam')}اختبرني</a></div>
</section>
<div class="grid2 mt-14">
  <a class="tile" href="#" style="text-decoration:none;color:inherit;display:block"><span class="chip chip-sm t-gold">${icon('upload-simple', true)}</span><p class="t-h mt-10">ارفع ملفًا</p><p class="t-xs t-2">إلى أي مادة من موادك</p></a>
  <a class="tile" href="#" style="text-decoration:none;color:inherit;display:block"><span class="chip chip-sm t-sky">${icon('chat-circle-text', true)}</span><p class="t-h mt-10">اسأل</p><p class="t-xs t-2">والجواب من ملفاتك</p></a>
</div>
<h2 class="section-h">آخر نشاط</h2>
<section class="card list">
  <a class="row" href="#"><span class="chip chip-sm t-mint">${icon('check-circle', true)}</span><div class="grow"><p class="label">أنهيت اختبار الميكانيك</p><p class="detail">4 من 5، أمس</p></div></a>
  <a class="row" href="#"><span class="chip chip-sm t-gold">${icon('sparkle', true)}</span><div class="grow"><p class="label">ملخص جديد: التوالد الجنسي</p><p class="detail">علوم الحياة والأرض، الجمعة</p></div></a>
</section>`;
}

function subjects(locale) {
  const t = T[locale];
  return `<div class="navrow"></div>
<div class="title-row"><div><h1 class="large-title">${esc(t.subjectsTitle)}</h1><p class="subtitle">${esc(t.subjectsSub)}</p></div>
<a class="btn btn-primary icon-btn" href="#" aria-label="${esc(t.newSubject)}">${icon('plus')}</a></div>
<div class="mt-18">${t.subjects.map((s) => `<a class="card" href="#" style="display:block;text-decoration:none;color:inherit;padding:16px 18px">
  <div class="h-row"><span class="chip t-${s.tint}">${icon(s.icon, true)}</span><div style="flex:1;min-width:0"><p class="t-h">${esc(s.name)}</p><p class="t-sm t-2">${esc(s.files)}، ${esc(s.done)}</p></div><span class="t-sm" style="font-weight:600;${s.pct ? 'color:var(--gold-text)' : 'color:var(--text-2)'}">${s.pct}%</span><span class="caret">${icon('caret-right')}</span></div>
  <div class="bar mt-10"><i style="width:${s.pct}%"></i></div></a>`).join('').replaceAll('، ', locale === 'en' ? ', ' : '، ')}</div>`;
}

function subject() {
  const files = [
    { name: 'درس الدوال الأسية.pdf', icon: 'file-pdf', tint: 'coral', when: 'أُضيف 8 أكتوبر', pills: [['ok', 'ملخص'], ['ok', 'اختبار']] },
    { name: 'تمارين النهايات والاتصال.pdf', icon: 'file-pdf', tint: 'coral', when: 'أُضيف 6 أكتوبر', pills: [['ok', 'ملخص'], ['todo', 'بلا اختبار بعد']] },
    { name: 'سلسلة المتتاليات العددية.docx', icon: 'file-doc', tint: 'sky', when: 'الآن', pills: [['wait', 'قيد التحضير']] },
    { name: 'شرائح الحساب التكاملي.pptx', icon: 'file-ppt', tint: 'violet', when: 'أُضيف 2 أكتوبر', pills: [['ok', 'ملخص'], ['ok', 'اختبار']] },
  ];
  const pill = ([k, label]) => `<span class="pill ${k}">${icon(k === 'ok' ? 'check-circle' : k === 'wait' ? 'circle-notch' : 'clock', k === 'ok')}${esc(label)}</span>`;
  return `${back('المواد')}
<div class="title-row"><div><h1 class="large-title">الرياضيات</h1><p class="subtitle">الثانية باكالوريا، علوم فيزيائية</p></div>
<a class="btn btn-secondary icon-btn" href="#" aria-label="اسأل عن هذه المادة">${icon('chat-circle-text', true)}</a></div>
<div class="grid3 mt-14">${[['الملفات', 12], ['ملخّصة', 9], ['لها اختبار', 6]].map(([l, n]) => `<div class="tile"><p class="t-xs t-2">${l}</p><p class="num mt-6">${n}</p></div>`).join('')}</div>
<a class="btn btn-primary btn-block mt-14" href="#">${icon('upload-simple')}ارفع ملفًا</a>
<p class="t-xs t-2 mt-10" style="text-align:center">الأنواع المقبولة: ${iso('PDF, DOCX, PPTX, XLSX, TXT, MD', 'ltr')}</p>
<p class="t-xs t-2" style="text-align:center">حتى ${iso('4', 'ltr')} ميغابايت للملف الواحد</p>
<h2 class="section-h">الملفات</h2>
<section class="card list">${files.map((f) => `<a class="row" href="#" style="align-items:flex-start;padding-top:12px;padding-bottom:12px"><span class="chip t-${f.tint}">${icon(f.icon, true)}</span><div class="grow"><p class="label">${iso(f.name)}</p><p class="detail">${esc(f.when)}</p><div class="h-row mt-6" style="gap:6px">${f.pills.map(pill).join('')}</div></div></a>`).join('')}</section>`;
}

function ask() {
  const tries = ['اشرح لي خاصيات الدالة الأسية', 'ما الفرق بين النهاية والاتصال؟', 'أعطني تمرينًا عن المتتاليات مع الحل'];
  return `<div class="navrow"></div>
<div class="title-row"><h1 class="large-title">اسأل</h1>
<a class="btn btn-secondary btn-sm" href="#">${icon('function', true)}الرياضيات<span style="display:inline-flex;transform:rotate(90deg)">${icon('caret-right')}</span></a></div>
<div style="display:flex;justify-content:center;margin-top:22px">${ILLUSTRATION}</div>
<p class="t-h" style="text-align:center;font-size:20px;line-height:26px;margin-top:10px">اسأل عن ملفاتك</p>
<p class="t-sm t-2" style="text-align:center;margin:6px 24px 0">كل جواب يأتي من ملفات هذه المادة، مع الإشارة إلى مصدره.</p>
<h2 class="section-h">جرّب أن تسأل</h2>
<div style="display:grid;gap:10px">${tries.map((q) => `<a class="tile h-row" href="#" style="text-decoration:none;color:inherit;min-height:56px"><span class="chip chip-sm t-gold">${icon('sparkle', true)}</span><span class="t-body" style="flex:1">${esc(q)}</span></a>`).join('')}</div>`;
}
const composer = `<div class="overlay" style="position:absolute;left:16px;right:16px;bottom:112px;display:flex;gap:10px;align-items:center">
<label class="well" style="flex:1;display:flex;align-items:center;min-height:52px;padding:0 18px;border:1px solid var(--text-3);font-size:16px;color:var(--text-2)">اكتب سؤالك هنا</label>
<a class="btn btn-primary icon-btn" style="width:52px;height:52px" href="#" aria-label="أرسل"><span style="display:inline-flex;transform:scaleX(-1)">${icon('paper-plane-right', true)}</span></a></div>`;

function summary() {
  return `${back('الرياضيات')}
<h1 class="large-title" style="margin-top:4px">الدوال الأسية</h1>
<div class="h-row mt-10" style="gap:8px"><span class="chip chip-sm t-coral">${icon('file-pdf', true)}</span><span class="t-sm t-2" style="flex:1">${iso('درس الدوال الأسية.pdf')}</span><span class="pill ok">${icon('check-circle', true)}ملخص كامل</span></div>
<section class="card mt-14">
  <p class="t-h gold">الفكرة الأساسية</p>
  <p class="t-body mt-6">الدالة الأسية النيبيرية هي الدالة الوحيدة التي تساوي مشتقتها، وقيمتها في الصفر تساوي 1. ونكتبها ${iso('exp(x)', 'ltr')}.</p>
  <p class="t-h gold mt-14">خاصيات مهمة</p>
  <ul class="t-body mt-6" style="padding-inline-start:20px">
    <li>موجبة قطعًا على مجموعة الأعداد الحقيقية.</li>
    <li>تزايدية قطعًا، ودالتها العكسية هي اللوغاريتم النيبيري.</li>
    <li>${iso('exp(a + b) = exp(a) × exp(b)', 'ltr')}</li>
  </ul>
  <p class="t-h gold mt-14">مثال</p>
  <p class="t-body mt-6">المعادلة ${iso('exp(2x) = exp(6)', 'ltr')} حلها ${iso('x = 3', 'ltr')}، لأن الدالة تقابل.</p>
</section>`;
}
const summaryActions = `<div class="grid2 overlay" style="position:absolute;left:20px;right:20px;bottom:116px">
<a class="btn btn-primary" href="#">${icon('exam', true)}اختبرني</a><a class="btn btn-secondary" href="#">${icon('chat-circle-text')}اسأل عن الملف</a></div>`;

function settings(locale, theme) {
  const ar = locale === 'ar';
  const L = ar
    ? { title: 'الإعدادات', account: 'الحساب', signOut: 'تسجيل الخروج', prefs: 'التفضيلات', lang: 'اللغة', look: 'المظهر', dark: 'داكن', light: 'فاتح', reminder: 'تذكير المذاكرة', daily: 'ذكّرني كل يوم', time: 'الوقت', privacy: 'الخصوصية والمساعدة', ai: 'المعالجة بالذكاء الاصطناعي', aiOn: 'مسموح', policy: 'سياسة الخصوصية', terms: 'شروط الخدمة', contact: 'تواصل معنا', del: 'حذف الحساب' }
    : { title: 'Settings', account: 'Account', signOut: 'Sign out', prefs: 'Preferences', lang: 'Language', look: 'Appearance', dark: 'Dark', light: 'Light', reminder: 'Study reminder', daily: 'Remind me every day', time: 'Time', privacy: 'Privacy and help', ai: 'AI processing', aiOn: 'Allowed', policy: 'Privacy Policy', terms: 'Terms of Service', contact: 'Contact us', del: 'Delete account' };
  const caret = `<span class="caret">${icon('caret-right')}</span>`;
  return `<div class="navrow"></div>
<h1 class="large-title" style="margin-top:4px">${L.title}</h1>
<section class="card list mt-18">
  <div class="row"><span class="chip" style="border-radius:50%;background:linear-gradient(180deg,var(--gold-top),var(--gold-bottom));background-color:var(--gold-bottom);color:var(--on-gold);font-weight:700;font-size:19px">${ar ? 'س' : 'S'}</span><div class="grow"><p class="label">${L.account}</p><p class="detail">${iso('student@example.com', 'ltr')}</p></div></div>
  <a class="row" href="#"><span class="chip chip-sm t-gold">${icon('sign-out', true)}</span><span class="grow label">${L.signOut}</span>${caret}</a>
</section>
<h2 class="section-h">${L.prefs}</h2>
<section class="card">
  <p class="t-sm t-2" style="font-weight:600">${L.lang}</p>
  <div class="seg mt-6" role="radiogroup" aria-label="${L.lang}"><a href="#" role="radio" lang="ar" aria-checked="${ar}">العربية</a><a href="#" role="radio" lang="en" aria-checked="${!ar}">English</a></div>
  <p class="t-sm t-2 mt-14" style="font-weight:600">${L.look}</p>
  <div class="seg mt-6" role="radiogroup" aria-label="${L.look}"><a href="#" role="radio" aria-checked="${theme === 'dark'}">${icon('moon', theme === 'dark')}${L.dark}</a><a href="#" role="radio" aria-checked="${theme === 'light'}">${icon('sun', theme === 'light')}${L.light}</a></div>
</section>
<h2 class="section-h">${L.reminder}</h2>
<section class="card list">
  <div class="row"><span class="chip chip-sm t-coral">${icon('bell', true)}</span><span class="grow label" id="r1">${L.daily}</span><a class="switch" href="#" role="switch" aria-checked="true" aria-labelledby="r1"><span></span></a></div>
  <a class="row" href="#"><span class="chip chip-sm t-sky">${icon('clock', true)}</span><span class="grow label">${L.time}</span><span class="value">${iso('19:00', 'ltr')}</span>${caret}</a>
</section>
<h2 class="section-h">${L.privacy}</h2>
<section class="card list">
  <a class="row" href="#"><span class="chip chip-sm t-violet">${icon('sparkle', true)}</span><div class="grow"><p class="label">${L.ai}</p><p class="detail">${L.aiOn}</p></div>${caret}</a>
  <a class="row" href="#"><span class="chip chip-sm t-mint">${icon('shield-check', true)}</span><span class="grow label">${L.policy}</span>${caret}</a>
  <a class="row" href="#"><span class="chip chip-sm t-gold">${icon('file-text', true)}</span><span class="grow label">${L.terms}</span>${caret}</a>
  <a class="row" href="#"><span class="chip chip-sm t-coral">${icon('lifebuoy', true)}</span><span class="grow label">${L.contact}</span>${caret}</a>
</section>
<section class="card list mt-14"><a class="row" href="#"><span class="chip chip-sm t-coral">${icon('trash', true)}</span><span class="grow label" style="color:var(--danger)">${L.del}</span></a></section>`;
}

const pages = [];
const add = (file, p) => { pages.push({ file, ...p }); };
for (const theme of ['dark', 'light']) {
  add(`ar-${theme}-1-home`, { locale: 'ar', theme, title: 'home', body: home(), active: 0 });
  add(`ar-${theme}-2-subjects`, { locale: 'ar', theme, title: 'subjects', body: subjects('ar'), active: 1 });
  add(`ar-${theme}-3-subject`, { locale: 'ar', theme, title: 'subject', body: subject(), active: 1 });
  add(`ar-${theme}-4-ask`, { locale: 'ar', theme, title: 'ask', body: ask(), active: 2, extra: composer });
  add(`ar-${theme}-5-summary`, { locale: 'ar', theme, title: 'summary', body: summary(), active: 1, extra: summaryActions });
  add(`ar-${theme}-6-settings`, { locale: 'ar', theme, title: 'settings', body: settings('ar', theme), active: 3 });
}
add('en-dark-2-subjects', { locale: 'en', theme: 'dark', title: 'subjects', body: subjects('en'), active: 1 });
add('en-dark-6-settings', { locale: 'en', theme: 'dark', title: 'settings', body: settings('en', 'dark'), active: 3 });

mkdirSync(out, { recursive: true });
for (const p of pages) writeFileSync(join(out, `${p.file}.html`), page(p));
console.log(JSON.stringify(pages.map((p) => ({ file: p.file, locale: p.locale, theme: p.theme }))));
