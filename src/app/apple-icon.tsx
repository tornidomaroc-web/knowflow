import { ImageResponse } from 'next/og';
import { BRAND, loadBrandFont } from './_brand/brand';

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
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const fontData = await loadBrandFont();

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
          color: BRAND.onGold,
          fontFamily: 'Rubik',
          fontSize: 122,
          letterSpacing: '-0.025em',
        }}
      >
        K
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Rubik', data: fontData, style: 'normal', weight: 700 }],
    },
  );
}
