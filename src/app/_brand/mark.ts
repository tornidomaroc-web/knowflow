/**
 * THE MARK, AND WHY IT IS GEOMETRY IN A MODULE RATHER THAN AN `.svg` FILE.
 *
 * The obvious shape for this is a committed `mark.svg` plus a loader that reads
 * it the way `loadBrandFont` reads the font. That was the first plan and it was
 * wrong, for a reason worth writing down so it is not re-proposed: the in-app
 * mark is a CLIENT component, and a client component cannot read the
 * filesystem. A `.svg` on disk can feed the generators below and nothing else,
 * so the app would end up with the same two shapes transcribed a second time
 * into JSX — a HAND COPY OF GEOMETRY, which is precisely the failure
 * `brand.ts` already names for the palette and which no check would catch.
 *
 * As a module the geometry exists once and both consumers read it:
 *
 *   - the `next/og` image routes build an SVG string and hand it to Satori as a
 *     data URI, with a LITERAL colour interpolated from `BRAND`;
 *   - the in-app component (not yet written — it lands with the landing pass)
 *     renders `MARK_PATHS` inline as JSX with `fill="currentColor"`, and CSS
 *     resolves it per theme, so one geometry serves dark and light.
 *
 * `currentColor` MUST NEVER REACH SATORI. It does not resolve there; the fill
 * is dropped and the shape renders as nothing. That is the whole reason the
 * colour is a parameter on the functions below rather than a value in the
 * artwork. It is also why this file, and not a `.svg`, is the source: a file
 * handed over by a designer carries whatever colour they drew with, and the
 * artwork this replaced arrived carrying two.
 *
 * SECOND CONSEQUENCE OF THE SAME CHOICE, AND THE BETTER ONE: there is no
 * `process.cwd()` read anywhere in the mark's path. The warning in `brand.ts`
 * about the font read depending on these routes staying prerendered does not
 * apply here at all. The mark cannot break by a route going dynamic.
 *
 * WHAT THE TWO PATHS ARE. An upward chevron of constant arm width, and a
 * diamond floating above its apex. Both are straight-line polygons at
 * essentially the same angle — the chevron arms run at 46.40 degrees from
 * horizontal and the diamond edges at 45.00 — so the two elements share an
 * angular language rather than contrasting one; the 1.4-degree difference is
 * sub-pixel at every size this ships at.
 *
 * THE NUMBERS THIS DRAWING WAS HELD TO, AND WHERE THEY CAME FROM. They are not
 * taste. They were measured by rendering bars and discs of known separation
 * through THIS pipeline at the sizes these images are actually looked at:
 *
 *   ink bbox        x[10..90] y[10..90] — the centred 80x80 safe box, 10 units
 *                   clear on every side, verified centred not merely inside.
 *   separation      10.00 units between the two elements. The measured floor is
 *                   4 units for a gap that returns 90% to the ground at the
 *                   binding surfaces (a 60px icon, and the share card seen at a
 *                   200px messaging thumbnail); 6 was the drawn-to floor.
 *   arm width       14.48 units. Anything renders solid from 4 units up.
 *   farthest ink    56.57 units from centre, so at the 125px size used below
 *                   the artwork spans a 141.4px diameter inside a 180px tile —
 *                   inside the circle iOS's mask leaves usable.
 *
 * A GREEN BUILD IS NOT EVIDENCE FOR ANY OF THIS. Satori drops SVG it cannot
 * handle silently: `tsc` passes, the route prerenders, and a blank gold tile
 * ships. Proven, not assumed — an SVG whose only content is an unresolvable
 * external reference renders BYTE-IDENTICAL to an empty tile. So the artwork
 * carries none of: `<style>` blocks, `class` attributes, `currentColor`,
 * `<use>`, `<image>`, `<text>`, external references of any kind, filters,
 * masks, clip-paths, gradients, patterns, opacity, or the `stroke` attribute.
 * Filled paths only. If this geometry is ever replaced, re-run that check
 * rather than trusting the check suite, which cannot see this failure.
 *
 * THE TAB ICON DELIBERATELY DOES NOT USE THIS. `icon.tsx` keeps the letter K.
 * A 32px favicon is shown at 16 in a tab strip, which leaves about 14 pixels of
 * ink and would demand a gap of 12 to 14 units — three quarters of the arm
 * width — to keep two elements apart. The K is a letterform drawn for that
 * size and measurably beats the mark there. The product therefore carries two
 * marks, and that is a written decision rather than drift.
 */

/** The artwork's own coordinate space. Every number above is in these units. */
export const MARK_VIEWBOX = '0 0 100 100';

/**
 * The geometry, and the only copy of it. Index 0 is the chevron, index 1 the
 * diamond. Consumed as `d` attributes — by the string builder below for
 * Satori, and directly as JSX `<path d={...}>` by the in-app component.
 */
export const MARK_PATHS = [
  'M 10 90 L 50 48 L 90 90 L 70 90 L 50 69 L 30 90 Z',
  'M 50 10 L 64 24 L 50 38 L 36 24 Z',
] as const;

/**
 * The mark as a standalone SVG document in one flat colour.
 *
 * `fill` is required rather than defaulted on purpose: there is no correct
 * default. On the gold tile it is `BRAND.onGold`; on the dark share card it
 * would be `BRAND.gold`. A default would be one of those two silently winning
 * on the other surface.
 */
export function markSvg(fill: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">` +
    MARK_PATHS.map((d) => `<path fill="${fill}" d="${d}"/>`).join('') +
    `</svg>`
  );
}

/**
 * The same thing base64'd into a data URI, which is the form Satori accepts as
 * an `<img src>`.
 *
 * NODE ONLY — it uses `Buffer`, so it belongs to the three prerendered image
 * routes and must not be pulled into a client component. The in-app mark reads
 * `MARK_PATHS` and renders inline SVG instead; it needs no encoding step and it
 * needs `currentColor`, which this function must never be asked to carry.
 */
export function markDataUri(fill: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(markSvg(fill)).toString('base64')}`;
}
