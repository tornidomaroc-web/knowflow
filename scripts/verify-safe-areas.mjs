/**
 * Executable proof for register #96's correction: the iPhone safe areas are
 * real, not claimed.
 *
 * `MobileNav` has padded its bottom bar by `env(safe-area-inset-bottom)` since
 * P2, and #96 wrote that "on a notched phone the nav grows". Without
 * `viewport-fit=cover` iOS reports every inset as 0, so it did not. This holds:
 *
 *   1. The REAL viewport object (`src/lib/viewport.ts`, which
 *      `[locale]/layout.tsx` re-exports) says `viewportFit: 'cover'`, and the
 *      layout re-exports it under the name Next reads.
 *   2. Every fixed bar accounts for its inset: the mobile top bar and the
 *      marketing header for the top, the bottom tab bar for the bottom, and the
 *      dashboard canvas and the Ask screen's height for both.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-safe-areas.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

// 1. The viewport.
{
  const p = resolvePath(ROOT, 'src/lib/viewport.ts');
  check(existsSync(p), 'src/lib/viewport.ts does not exist: nothing declares viewport-fit');
  if (existsSync(p)) {
    const { viewport } = await import(pathToFileURL(p).href);
    console.error(`viewport = ${JSON.stringify(viewport)}`);
    check(viewport?.viewportFit === 'cover', `viewportFit is ${viewport?.viewportFit}, expected cover`);
    check(viewport?.width === 'device-width' && viewport?.initialScale === 1, 'width/initialScale changed');
  }
  const layout = read('src/app/[locale]/layout.tsx');
  check(/export \{ viewport \} from '@\/lib\/viewport'/.test(layout), '[locale]/layout.tsx does not re-export the viewport object');
}

// 2. The bars.
{
  const nav = read('src/components/layout/MobileNav.tsx');
  const headerTag = nav.match(/<header[\s\S]*?>/)?.[0] ?? '';
  const navTag = nav.match(/<nav[\s\S]*?>/)?.[0] ?? '';
  check(/safe-area-inset-top/.test(headerTag), 'the mobile top bar does not pad by safe-area-inset-top');
  check(/safe-area-inset-bottom/.test(navTag), 'the bottom tab bar does not pad by safe-area-inset-bottom');

  const shell = read('src/components/layout/DashboardShell.tsx');
  const mainTag = shell.match(/<main[\s\S]*?>/)?.[0] ?? '';
  check(/safe-area-inset-top/.test(mainTag) && /safe-area-inset-bottom/.test(mainTag), 'the dashboard canvas does not clear both insets');

  const ask = read('src/app/[locale]/dashboard/agent/page.tsx');
  check(/safe-area-inset-top/.test(ask) && /safe-area-inset-bottom/.test(ask), 'the Ask screen height does not subtract both insets');

  const site = read('src/components/layout/SiteHeader.tsx');
  const siteHeader = site.match(/<header[\s\S]*?>/)?.[0] ?? '';
  check(/safe-area-inset-top/.test(siteHeader), 'the marketing header does not pad by safe-area-inset-top');
}

if (failures.length === 0) {
  console.log('PASS: viewport-fit=cover is declared and every fixed bar accounts for its safe-area inset.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
