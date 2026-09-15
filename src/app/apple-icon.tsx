import { ImageResponse } from 'next/og';
import { BRAND } from './_brand/brand';
import { markDataUri } from './_brand/mark';

/**
 * THE 180px HOME-SCREEN ICON. `/apple-touch-icon.png` was a 404, so "Add to
 * Home Screen" on iOS produced a screenshot of the page shrunk to an illegible
 * tile. 180x180 is the size iOS asks for and the one every other size is scaled
 * from, so shipping the single largest is the whole job.
 *
 * THIS ALSO COVERS ANDROID, WHICH IS NOT OBVIOUS AND IS THE REASON IT IS WORTH
 * SHIPPING WITHOUT A MANIFEST. Chrome on Android prefers the icons declared in a
 * web app manifest — and there is deliberately no manifest here (out of scope,
 * and a manifest with no service worker and no start_url discipline invites an
 * install prompt for something that is not yet an app). With no manifest, Chrome
 * falls back to the largest declared `<link rel="icon">` / `apple-touch-icon`,
 * which is this one. Android is the Phase-8 primary target, so the fallback path
 * is the path that matters most.
 *
 * FULL BLEED, NO CORNER RADIUS, AND NO TRANSPARENCY — ALL THREE ON PURPOSE. iOS
 * applies its own mask and its own shine; a pre-rounded icon gets rounded twice
 * and shows dark corner slivers, and a transparent one is composited onto black.
 * The 32px tab icon next door IS rounded because nothing rounds it for us.
 *
 * THIS TILE CARRIES THE MARK; THE TAB ICON NEXT DOOR KEEPS THE LETTER K, AND THE
 * SPLIT IS MEASURED RATHER THAN STYLISTIC. A 32px favicon is shown at 16 in a
 * tab strip. That leaves roughly 14 pixels of ink, in which two elements need a
 * gap of 12 to 14 units of the artwork's 100 to stay apart — three quarters of
 * the mark's own arm width, which is a chasm rather than a gap. At the sizes
 * THIS file is seen at, the same measurement gives a floor of 4 units. So the
 * mark works here and does not work there, and the product carries two marks by
 * decision rather than by drift.
 *
 * THE 125px SIZE IS DERIVED AND NOT PICKED. iOS masks this tile with a rounded
 * superellipse, so art near the corners is cut. The artwork keeps all ink inside
 * a centred 80x80 of its 100x100 box, and its farthest point sits 56.57 units
 * from centre; at 125px that is a 141.4px diameter inside a 180px tile, which
 * clears the circle iOS leaves usable. Bigger than 125 starts pushing the
 * chevron's feet into the mask. The resulting ink is 100px tall — a little more
 * present than the 86px the K measured, which is right for a mark rather than a
 * letterform.
 *
 * THERE IS NO FONT ON THIS ROUTE ANY MORE, AND THAT IS A REAL SIMPLIFICATION.
 * With the K gone there is no text, and Satori renders this tree with no `fonts`
 * option at all — verified byte-identical output with and without. That deletes
 * the `process.cwd()` read `loadBrandFont` performs, so the warning in
 * `brand.ts` about these routes having to stay prerendered for that read to be
 * safe no longer applies to this one. `icon.tsx` and the share card still carry
 * type and still carry the font.
 *
 * A GREEN BUILD PROVES NOTHING ABOUT THIS IMAGE. Satori drops SVG it cannot
 * handle silently — `tsc` passes, the route prerenders, and a blank gold tile
 * ships. The artwork's constraints, and the check that a dropped SVG really is
 * byte-identical to an empty tile, are recorded in `_brand/mark.ts`.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Derived above, not chosen. See "THE 125px SIZE IS DERIVED AND NOT PICKED". */
const MARK_PX = 125;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BRAND.gold,
        }}
      >
        {/* The colour is interpolated from BRAND rather than carried in the
            artwork, so the palette has one source. `--accent-foreground` is the
            token that exists for exactly this: what sits on the gold fill. */}
        <img src={markDataUri(BRAND.onGold)} width={MARK_PX} height={MARK_PX} alt="" />
      </div>
    ),
    size,
  );
}
