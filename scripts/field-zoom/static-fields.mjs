/**
 * Guideline 4.0 (1.0 build 7): iOS zooms the web view in when a text field
 * under 16 px takes focus, and the zoom outlives the keyboard and the next
 * client-side navigation (branch diag/ipad-zoom, run 40258021621). This is the
 * SOURCE half of the gate: it reads every text-entry element in src/ that the
 * rendered half (fields.mjs) cannot reach signed out, such as the new-subject
 * form or the rename and delete-account fields that open on a tap.
 *
 * The rule, per tag:
 *   <input> of a text-like type, <textarea>, <select>: the classes it carries
 *     (inline, or through a `const` of the same file named in its className)
 *     hold an unprefixed 16 px-or-larger size (text-base and up) and no
 *     unprefixed smaller one;
 *   <Input>, <AuthField>, <PasswordField>: the className passed in holds no
 *     unprefixed size under 16 px (the component supplies 16 px itself, and
 *     its own <input> is checked by the first rule).
 * A prefixed size (md:text-sm) is desktop and allowed.
 *
 * Usage: node scripts/field-zoom/static-fields.mjs   (exit 1 on a finding)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// KF_ROOT: another checkout to read (the workflow's before job reads main's).
const ROOT = process.env.KF_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NON_TEXT = new Set(['hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'range', 'color']);
const TAG = /<(input|textarea|select|Input|AuthField|PasswordField)\b/g;
const SMALL = /^text-(xs|sm|\[(\d+(?:\.\d+)?)(px|rem)\])$/;
const BIG = /^text-(base|lg|xl|[2-9]xl|\[(\d+(?:\.\d+)?)(px|rem)\])$/;

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

// Comments blanked with spaces, so positions and line numbers stay true.
function uncomment(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[\s;{}])\/\/[^\n]*/gm, (m, lead) => lead + blank(m.slice(lead.length)));
}

// The tag's own text, up to the `>` that closes it outside any `{...}`.
function tagText(src, at) {
  let depth = 0;
  let quote = null;
  for (let i = at + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote && src[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(at, i + 1);
  }
  return src.slice(at);
}

// A `const NAME =` string of the same file: the quoted pieces up to its `;`.
function constText(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=([^;]*);`).exec(src);
  return m ? (m[1].match(/'[^']*'|"[^"]*"|`[^`]*`/g) || []).join(' ') : '';
}

const px = (num, unit) => parseFloat(num) * (unit === 'rem' ? 16 : 1);
function sizes(text) {
  const tokens = (text.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || []).join(' ').replace(/['"`]/g, ' ').split(/\s+/);
  let small = [];
  let big = [];
  for (const t of tokens) {
    if (t.includes(':')) continue;
    const s = SMALL.exec(t);
    if (s && (!s[2] || px(s[2], s[3]) < 16)) small.push(t);
    const b = BIG.exec(t);
    if (b && (!b[2] || px(b[2], b[3]) >= 16)) big.push(t);
  }
  return { small, big };
}

let findings = 0;
let checked = 0;
for (const file of files(join(ROOT, 'src'))) {
  const raw = readFileSync(file, 'utf8');
  const src = uncomment(raw);
  for (const m of src.matchAll(TAG)) {
    const tag = m[1];
    const text = tagText(src, m.index);
    const line = src.slice(0, m.index).split('\n').length;
    const where = `${relative(ROOT, file).replace(/\\/g, '/')}:${line}`;
    const type = /\btype=(?:"([^"]*)"|'([^']*)'|\{'([^']*)'\})/.exec(text);
    const literal = type && (type[1] ?? type[2] ?? type[3]);
    if (tag === 'input' && literal && NON_TEXT.has(literal)) {
      console.log(`skip ${where} <input type="${literal}"> (no keyboard, no focus zoom)`);
      continue;
    }
    const cls = /className=\{([\s\S]*?)\}\s*(?:\w+=|\{\.\.\.|\/?>)/.exec(text) || /className=("[^"]*"|'[^']*')/.exec(text);
    let classes = cls ? cls[1] : '';
    for (const id of classes.match(/\b[A-Za-z_]\w*\b/g) || []) {
      if (id !== 'cn' && id !== 'className') classes += ' ' + constText(raw, id);
    }
    const { small, big } = sizes(classes);
    checked++;
    const intrinsic = tag === tag.toLowerCase();
    const ok = intrinsic ? big.length > 0 && small.length === 0 : small.length === 0;
    const what = intrinsic ? `<${tag}${literal ? ` type="${literal}"` : ''}>` : `<${tag}>`;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${where} ${what} base size ${big.join(',') || (intrinsic ? 'none' : 'from the component')}${small.length ? `; under 16 px: ${small.join(',')}` : ''}`);
    if (!ok) findings++;
  }
}
console.log(`${checked} text-entry tags checked, ${findings} under 16 px at phone width`);
if (checked === 0) { console.log('FAIL nothing was checked: the scan is blind'); process.exit(1); }
process.exit(findings ? 1 : 0);
