/**
 * Step Store-Fix-3: the app's Arabic wording stems for text that came out of
 * OCR (scripts/store-shots/ocr_scan.py).
 *
 * `exact`: the Arabic rules of kfWording (scripts/lib/app-wording.mjs), as the
 * app's probe runs them.
 *
 * `dotBlind`: the same stems, from the same source text, with every letter
 * folded to the shape it shares with the letters that differ from it only by
 * dots (ب ت ث ن ي ى ئ, ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق, and ة to
 * ه), in the OCR text and in the patterns alike. Tesseract's Arabic model
 * drops and moves dots: a planted مجاني was read as محانى (ocr-proof run
 * 38651347103), which the exact stem مجان does not match. Folding only makes
 * the check stricter; a word that shares a stem's shape fails too, and the
 * owner judges it.
 *
 * Usage: node scripts/store-shots/arabic-stems.mjs < text   -> {"exact": [...], "dotBlind": [...]}
 */
import { KF_WORDING_SRC, kfWording } from '../lib/app-wording.mjs';

const ARABIC = /[؀-ۿ]/;
const m = /var A=(\[\[[\s\S]*?\]\]);/.exec(KF_WORDING_SRC);
if (!m) throw new Error('the Arabic rules (var A=[...]) are not in KF_WORDING_SRC');
// eslint-disable-next-line no-new-func
const RULES = new Function(`return ${m[1]};`)();

const FOLD = { 'ت': 'ب', 'ث': 'ب', 'ن': 'ب', 'ي': 'ب', 'ى': 'ب', 'ئ': 'ب', 'ج': 'ح', 'خ': 'ح', 'ذ': 'د', 'ز': 'ر', 'ش': 'س', 'ض': 'ص', 'ظ': 'ط', 'غ': 'ع', 'ق': 'ف', 'ة': 'ه', 'آ': 'ا', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا', 'ؤ': 'و' };
const fold = (s) => s.replace(/[ً-ٰٟـ‎‏]/g, '').replace(/[؀-ۿ]/g, (c) => FOLD[c] || c);
// The class [^ء-ي] (any non-letter) keeps its range: every folded letter stays inside it.
const RANGE = 'ء-ي';
const FOLDED = new Function(`return ${fold(m[1].split(RANGE).join('\u0001')).split('\u0001').join(RANGE)};`)();

export function exact(text) {
  return kfWording(text).filter((h) => ARABIC.test(h));
}

export function dotBlind(text) {
  const t = fold(text);
  return FOLDED.map(([, re], i) => (re.test(t) ? RULES[i][0] : null)).filter(Boolean);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  let t = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (t += d)).on('end', () => console.log(JSON.stringify({ exact: exact(t), dotBlind: dotBlind(t) })));
}
