/**
 * design-c.yml: what BEFORE is built from must be a plain branch, tag or
 * commit, never shell text. The workflow_dispatch input `before_ref` reaches
 * this script through the step's env (BEFORE_REF), never through a `${{ }}`
 * inside a `run:` line; only a value that passes `isSafeRef` is written to the
 * step's output, and every later use (the checkout's `ref:`, compose.py's
 * label) reads that output.
 *
 * Accepted: a commit SHA (7 to 40 hex) or a ref name of letters, digits and
 * `. _ / -`, starting with a letter or digit, at most 100 characters, with no
 * `..`, `//`, `/.`, `@{`, no trailing `/` or `.`, and not ending in `.lock`
 * (git-check-ref-format's rules, narrowed to that character set). Everything
 * else is refused with exit 1: `;`, `$`, `(`, backtick, quote, space, newline,
 * `&`, `|`, `<`, `>`, `\`, a leading `-`.
 *
 * Usage (workflow): BEFORE_REF=... node scripts/design-c/check-before-ref.mjs
 * Proof: node scripts/verify-ci-guards.mjs
 */
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isSafeRef(v) {
  if (typeof v !== 'string' || v.length < 1 || v.length > 100) return false;
  if (/^[0-9a-f]{7,40}$/.test(v)) return true;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(v)) return false;
  if (/\.\.|\/\/|\/\.|@\{/.test(v)) return false;
  if (/[/.]$/.test(v) || /\.lock$/.test(v)) return false;
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const v = process.env.BEFORE_REF ?? '';
  if (!isSafeRef(v)) {
    console.error(`FAIL: before_ref ${JSON.stringify(v)} is not a plain branch, tag or commit SHA (letters, digits, . _ / - only; or 7-40 hex). Refused before any checkout.`);
    process.exit(1);
  }
  console.log(`ok   before_ref ${v} is a plain branch, tag or commit`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ref=${v}\n`);
}
