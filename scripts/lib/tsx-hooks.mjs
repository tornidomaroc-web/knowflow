/**
 * Module hooks that let a proof script import the app's REAL .ts and .tsx
 * files under plain `node`, with no bundler and no app running.
 *
 * - `@/…` and relative specifiers resolve to `src/**.ts`, `.tsx`, or a folder's
 *   `index.ts`, exactly as the newer proofs do inline.
 * - `.tsx` is transpiled on load with the project's own `typescript` package
 *   (`jsx: react-jsx`), which is the one dependency `--experimental-strip-types`
 *   lacks: it strips types but does not understand JSX.
 * - `next/link` is a plain `<a>`; `next/navigation` gives `usePathname` a
 *   fixed path. A proof that needs another stub passes it in `stubs`.
 *
 * Usage:
 *   import { installTsxHooks } from './lib/tsx-hooks.mjs';
 *   installTsxHooks(ROOT, { '@/lib/supabase/client': `export function createClient(){…}` });
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

const NEXT_LINK = `
import { createElement } from 'react';
export default function Link({ href, children, ...rest }) {
  const { prefetch, replace, scroll, shallow, locale, ...attrs } = rest;
  return createElement('a', { href: typeof href === 'string' ? href : String(href), ...attrs }, children);
}`;
const NEXT_NAVIGATION = `
export function usePathname() { return globalThis.__tsxHooksPathname ?? '/'; }
export function useRouter() { return { push() {}, replace() {}, refresh() {} }; }
export function useParams() { return globalThis.__tsxHooksParams ?? {}; }
export function notFound() { throw new Error('notFound'); }
export function redirect() { throw new Error('redirect'); }`;

export function installTsxHooks(ROOT, stubs = {}) {
  const require = createRequire(pathToFileURL(resolvePath(ROOT, 'package.json')).href);
  const ts = require('typescript');
  const withTs = (base) => {
    if (/\.[a-z]+$/i.test(base)) return base;
    for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return base + ext;
    // A folder module may be index.ts or index.tsx (the illustrations are the latter).
    for (const idx of ['index.ts', 'index.tsx']) if (existsSync(resolvePath(base, idx))) return resolvePath(base, idx);
    return resolvePath(base, 'index.ts');
  };
  const all = { 'next/link': NEXT_LINK, 'next/navigation': NEXT_NAVIGATION, ...stubs };

  registerHooks({
    resolve(spec, ctx, next) {
      if (spec in all) return { url: inline(all[spec]), shortCircuit: true };
      if (spec.startsWith('@/')) {
        return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
      }
      if (spec.startsWith('.') && ctx.parentURL && ctx.parentURL.startsWith('file:') && !ctx.parentURL.includes('/node_modules/')) {
        return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
      }
      // A stub is a data: URL, which has no directory to resolve 'react' from;
      // resolve its bare imports as if it lived at the project root.
      if (ctx.parentURL && ctx.parentURL.startsWith('data:')) {
        return next(spec, { ...ctx, parentURL: pathToFileURL(resolvePath(ROOT, 'package.json')).href });
      }
      return next(spec, ctx);
    },
    load(url, ctx, next) {
      if (url.startsWith('file:') && url.endsWith('.tsx')) {
        const source = readFileSync(fileURLToPath(url), 'utf8');
        const { outputText } = ts.transpileModule(source, {
          fileName: fileURLToPath(url),
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        });
        return { format: 'module', source: outputText, shortCircuit: true };
      }
      return next(url, ctx);
    },
  });
}
