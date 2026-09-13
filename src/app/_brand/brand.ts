/**
 * THE ONLY PLACE THE BRAND EXISTS OUTSIDE CSS.
 *
 * `src/app/globals.css` is the source of truth for every colour in the product,
 * but the three images below this folder are rendered by Satori (`next/og`),
 * which has no stylesheet and no CSS variables — it takes literal values. These
 * constants are therefore a HAND COPY of the `[data-theme="dark"]` block, and a
 * hand copy is a thing that goes stale. Anyone changing the palette must change
 * it in both places; there is no check that will catch it, which is exactly why
 * it is written down here rather than inlined three times.
 *
 * WHY DARK-AND-GOLD AND NOT THE EMERALD THE LANDING PAGE STILL SHOWS. The rule
 * is in globals.css and it is not a preference: "ONE ACCENT: gold… Green and red
 * are STATE ONLY and never identity, so nothing in the chrome may use them to
 * mean 'KnowFlow'." A link preview and a home-screen icon are chrome. The
 * landing page is still on the Phase-2 emerald `:root` values, so until the
 * global theme flip lands (register #93, open decision (a)) the card is one step
 * ahead of the page it links to. That mismatch is deliberate and named, not an
 * oversight: the alternative is shipping an emerald identity that the same
 * stylesheet forbids and that would have to be redrawn the moment the flip lands.
 */
export const BRAND = {
  /** --background on [data-theme="dark"] — warm near-black, hue ~35° at very low saturation. */
  ground: '#14110d',
  /** --accent — the single accent. ~8:1 on the ground both ways, so it works as fill AND as text. */
  gold: '#d4a548',
  /** --accent-foreground — what sits ON the gold fill. Same value as the ground by design. */
  onGold: '#14110d',
  /** --foreground — text level 1. */
  text: '#f5f0e8',
  /** --muted-foreground — text level 2 (~6.4:1 on the ground, AA body). */
  textMuted: '#a39684',
} as const;

/**
 * Rubik Bold, the site's own face, as a 28 KB static TTF.
 *
 * THREE THINGS ABOUT THIS FILE ARE DELIBERATE AND EACH ONE IS A TRAP AVOIDED.
 *
 * (1) IT IS STATIC, NOT VARIABLE. Google ships Rubik only as `Rubik[wght].ttf`,
 *     a variable font whose DEFAULT INSTANCE IS wght 300 — Light. Satori does
 *     not instance variable axes; it renders the default. Handing it the
 *     upstream file would have quietly produced a Light wordmark next to a site
 *     whose wordmark is `font-bold`. This was pinned at wght 700 with
 *     fontTools' `varLib.instancer` (usWeightClass 700, subfamily "Bold") and
 *     then subset to 82 Latin characters.
 *
 * (2) IT CARRIES NO ARABIC, ON PURPOSE. The upstream face has 89 Arabic glyphs
 *     and they were dropped, because none of these three images contains a word
 *     of Arabic — see the note in `opengraph-image.tsx` for why the card is
 *     locale-neutral rather than translated.
 *
 * (3) IT IS READ OFF DISK AND NOT FETCHED, AND THE OBVIOUS PATTERN IS THE WRONG
 *     ONE HERE. Next's own documentation loads a local font for `ImageResponse`
 *     with `fetch(new URL('./x.ttf', import.meta.url))`. THAT PATTERN FAILS THE
 *     BUILD in this app, and it fails in a way worth recording because it looks
 *     like the blessed answer: webpack rewrites the URL to the asset's PUBLIC
 *     path, so Node is handed the bare string
 *     `/_next/static/media/Rubik-Bold-latin-subset.<hash>.ttf` and throws
 *     `ERR_INVALID_URL` — a relative URL has no base to resolve against in a
 *     Node prerender. (It works in the docs because that example runs on the
 *     edge runtime, where relative fetches resolve against the deployment.)
 *     These three routes are PRERENDERED AT BUILD TIME — the build output must
 *     show them as `○ (Static)`, and if that ever changes to `ƒ (Dynamic)` this
 *     read moves into a lambda where `process.cwd()` and output-file-tracing
 *     stop being on our side. Check the route table before making them dynamic.
 *
 * Licensed SIL OFL 1.1; `OFL.txt` sits beside it because redistribution requires
 * the licence to travel with the font.
 */
export async function loadBrandFont(): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  return readFile(join(process.cwd(), 'src/app/_brand/Rubik-Bold-latin-subset.ttf'));
}
