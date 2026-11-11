/**
 * Executable proof for the sample file's committed inputs (audit cause 9,
 * docs/plans/sample-file.md): the two PDFs, the settings their embeddings are
 * made with, and, once generated, the two JSON files /api/sample will copy.
 *
 * The embeddings are computed ONCE (.github/workflows/sample-embeddings.yml)
 * and committed. They are only right while the PDF, the model and the chunker
 * are the ones production uses. This fails when any of them drifts:
 *
 * 1. data/sample-file/manifest.json holds the model, dimensions, chunk size
 *    and overlap that services/ingestion/main.py holds (VOYAGE_MODEL's
 *    default, EMBED_DIM, CHUNK_TOKENS, CHUNK_OVERLAP), read from its source.
 * 2. Each committed PDF's sha256 is the manifest's, and SHA256SUMS agrees.
 * 3. The approved text file still has its four text blocks, and its status
 *    line says APPROVED.
 * 4. THE JSON, WHEN IT EXISTS. For each language: its model, dimensions, chunk
 *    settings and pdf_sha256 equal the manifest's; chunk_index runs 0..n-1;
 *    every embedding has `dimensions` finite numbers; every chunk has a page
 *    label inside 1..2; token_count is at most the chunk size. BEFORE the JSON
 *    exists this prints "not generated yet" and passes: the files arrive in a
 *    later PR, after the keyed run. One language without the other fails.
 * 5. The workflow that holds the key is manual only and read-only.
 *
 * FORCED CASES (--plant <name>): each changes one value in memory and the
 * proof must fail; `--self-test` runs them all and fails if one passes.
 *   sha     a PDF's bytes differ from the manifest
 *   model   main.py's model differs from the manifest
 *   chunk   main.py's CHUNK_TOKENS differs
 *   overlap main.py's CHUNK_OVERLAP differs
 *   json    a generated JSON records another pdf_sha256 (uses a made-up JSON
 *           when none is committed yet)
 *
 * Tier 0: no network, no credential, no app.
 *
 * Usage: node scripts/verify-sample-file.mjs [--plant <name> | --self-test]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = resolvePath(ROOT, 'data/sample-file');
const LANGS = ['ar', 'en'];
const PLANTS = ['sha', 'model', 'chunk', 'overlap', 'json'];
const args = process.argv.slice(2);

if (args[0] === '--self-test') {
  let bad = 0;
  for (const p of PLANTS) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--plant', p], { encoding: 'utf8' });
    const caught = r.status === 1 && /FAIL/.test(r.stdout);
    console.log(`${caught ? 'ok  ' : 'MISS'} forced case "${p}" ${caught ? 'is caught' : `was NOT caught (exit ${r.status})`}: ${(r.stdout.match(/ {2}! .*/) || [''])[0].trim()}`);
    if (!caught) bad++;
  }
  const clean = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { encoding: 'utf8' });
  console.log(`${clean.status === 0 ? 'ok  ' : 'MISS'} without a forced case the proof passes (exit ${clean.status})`);
  if (clean.status !== 0) bad++;
  process.exit(bad ? 1 : 0);
}

const plant = args[0] === '--plant' ? args[1] : null;
if (plant && !PLANTS.includes(plant)) { console.log(`unknown forced case ${plant}`); process.exit(2); }

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
// A Windows checkout holds CRLF (core.autocrlf); every pattern below is written for LF.
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// 1. The manifest against main.py's source.
const manifest = JSON.parse(read('data/sample-file/manifest.json'));
const py = read('services/ingestion/main.py');
const pyValue = (re, name) => { const m = py.match(re); check(!!m, `main.py: ${name} not found`); return m ? m[1] : null; };
const fromMain = {
  model: pyValue(/^VOYAGE_MODEL = os\.environ\.get\("VOYAGE_MODEL", "([^"]+)"\)$/m, 'VOYAGE_MODEL'),
  dimensions: Number(pyValue(/^EMBED_DIM = (\d+)$/m, 'EMBED_DIM')),
  chunk_tokens: Number(pyValue(/^CHUNK_TOKENS = (\d+)$/m, 'CHUNK_TOKENS')),
  chunk_overlap: Number(pyValue(/^CHUNK_OVERLAP = (\d+)$/m, 'CHUNK_OVERLAP')),
};
if (plant === 'model') fromMain.model = 'another-model';
if (plant === 'chunk') fromMain.chunk_tokens += 1;
if (plant === 'overlap') fromMain.chunk_overlap += 1;
for (const k of Object.keys(fromMain)) check(manifest[k] === fromMain[k], `${k}: main.py has ${JSON.stringify(fromMain[k])}, data/sample-file/manifest.json has ${JSON.stringify(manifest[k])}; regenerate the embeddings`);

// 2. The PDFs.
const sums = Object.fromEntries(read('data/sample-file/SHA256SUMS').trim().split('\n').map((l) => l.trim().split(/\s+/).reverse()));
for (const lang of LANGS) {
  const name = `cell.${lang}.pdf`;
  const path = resolvePath(DATA, name);
  check(existsSync(path), `${name} is missing`);
  if (!existsSync(path)) continue;
  let bytes = readFileSync(path);
  if (plant === 'sha' && lang === 'ar') bytes = Buffer.concat([bytes, Buffer.from('\n')]);
  const digest = sha256(bytes);
  check(bytes.subarray(0, 5).toString('latin1') === '%PDF-', `${name} is not a PDF`);
  check(digest === manifest.pdf_sha256?.[lang], `${name} sha256 is ${digest}, the manifest says ${manifest.pdf_sha256?.[lang]}; the embeddings were made from another file`);
  check(sums[name] === manifest.pdf_sha256?.[lang], `SHA256SUMS and the manifest differ for ${name}`);
}

// 3. The approved text.
const approved = read('docs/copy-drafts/sample_file_cell.md');
check((approved.match(/```text\n/g) || []).length === 4, 'docs/copy-drafts/sample_file_cell.md no longer has four text blocks');
check(/\*\*Status: APPROVED by the owner 2026-11-11/.test(approved), 'docs/copy-drafts/sample_file_cell.md is not marked APPROVED by the owner 2026-11-11');

// 4. The JSON, when it exists.
const present = LANGS.filter((l) => existsSync(resolvePath(DATA, `cell.${l}.json`)));
let jsonState = 'not generated yet';
const madeUp = (lang) => ({ lang, model: manifest.model, dimensions: manifest.dimensions, chunk_tokens: manifest.chunk_tokens, chunk_overlap: manifest.chunk_overlap, pdf_sha256: manifest.pdf_sha256[lang], chunks: [{ chunk_index: 0, content: 'x', token_count: 1, page_start: 1, page_end: 2, page_kind: 'page', embedding: Array.from({ length: manifest.dimensions }, () => 0.1) }] });
const docs = {};
if (present.length === 0 && plant === 'json') for (const l of LANGS) docs[l] = madeUp(l);
else for (const l of present) docs[l] = JSON.parse(read(`data/sample-file/cell.${l}.json`));
if (plant === 'json' && docs.ar) docs.ar.pdf_sha256 = '0'.repeat(64);
if (Object.keys(docs).length) {
  check(Object.keys(docs).length === LANGS.length, `only ${Object.keys(docs).join(', ')} is generated; both languages come from one run`);
  for (const [lang, d] of Object.entries(docs)) {
    const at = `cell.${lang}.json`;
    for (const k of ['model', 'dimensions', 'chunk_tokens', 'chunk_overlap']) check(d[k] === manifest[k], `${at}: ${k} is ${JSON.stringify(d[k])}, the manifest says ${JSON.stringify(manifest[k])}`);
    check(d.lang === lang, `${at}: lang is ${d.lang}`);
    check(d.pdf_sha256 === manifest.pdf_sha256[lang], `${at}: made from a PDF with sha256 ${d.pdf_sha256}, the committed one is ${manifest.pdf_sha256[lang]}`);
    check(Array.isArray(d.chunks) && d.chunks.length > 0, `${at}: no chunks`);
    (d.chunks || []).forEach((c, i) => {
      check(c.chunk_index === i, `${at}: chunk ${i} has chunk_index ${c.chunk_index}`);
      check(typeof c.content === 'string' && c.content.trim().length > 0, `${at}: chunk ${i} has no content`);
      check(Number.isInteger(c.token_count) && c.token_count > 0 && c.token_count <= manifest.chunk_tokens, `${at}: chunk ${i} token_count ${c.token_count}`);
      check(c.page_kind === 'page' && Number.isInteger(c.page_start) && Number.isInteger(c.page_end) && c.page_start >= 1 && c.page_end <= 2 && c.page_start <= c.page_end, `${at}: chunk ${i} page label ${c.page_start}-${c.page_end} ${c.page_kind}`);
      check(Array.isArray(c.embedding) && c.embedding.length === manifest.dimensions && c.embedding.every((n) => typeof n === 'number' && Number.isFinite(n)), `${at}: chunk ${i} embedding is not ${manifest.dimensions} finite numbers`);
    });
  }
  jsonState = present.length ? `generated (${Object.entries(docs).map(([l, d]) => `${l}: ${d.chunks?.length} chunk(s)`).join(', ')})` : 'not generated yet (a made-up JSON was checked for the forced case)';
}

// 5. The workflow that holds the key.
const wf = read('.github/workflows/sample-embeddings.yml');
const onBlock = (wf.match(/^on:\n((?: {2}.*\n|\n)+)/m) || ['', ''])[1];
check(/^ {2}workflow_dispatch:\s*$/m.test(onBlock) && !/^ {2}(push|pull_request|pull_request_target|schedule|deployment_status|workflow_run|workflow_call):/m.test(onBlock), 'sample-embeddings.yml has a trigger other than workflow_dispatch');
check(/^permissions:\n {2}contents: read\n(?! )/m.test(wf), 'sample-embeddings.yml permissions are not exactly contents: read');
check((wf.match(/secrets\./g) || []).length === 1 && /secrets\.VOYAGE_SAMPLE_KEY/.test(wf), 'sample-embeddings.yml reads a secret other than VOYAGE_SAMPLE_KEY, or reads it twice');
check(!/set -[a-z]*x|echo[^\n]*VOYAGE_API_KEY[^\n]*\$\{?VOYAGE_API_KEY/.test(wf.replace(/^\s*#.*$/gm, '')), 'sample-embeddings.yml traces or echoes the key');

if (failures.length === 0) {
  console.log(`PASS: the sample PDFs (ar ${manifest.pdf_sha256.ar.slice(0, 12)}, en ${manifest.pdf_sha256.en.slice(0, 12)}) and the settings (${manifest.model}, ${manifest.dimensions} dimensions, chunks of ${manifest.chunk_tokens} with ${manifest.chunk_overlap} overlap) are the committed ones and main.py's; embeddings: ${jsonState}; the keyed workflow is manual only and read-only.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
