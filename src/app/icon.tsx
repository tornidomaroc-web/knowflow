import { ImageResponse } from 'next/og';
import { BRAND, loadBrandFont } from './_brand/brand';

/**
 * THE BROWSER TAB ICON. `/favicon.ico` was a 404 on production, which means the
 * tab, the bookmark and the Android "add to home screen" fallback all showed the
 * browser's blank-document glyph.
 *
 * GOLD TILE WITH A DARK LETTER, NOT A DARK TILE WITH A GOLD LETTER — and the
 * reason is not taste. `#14110d` is near-black, so a dark-ground icon vanishes
 * into the tab strip of any browser running a dark theme, which is most of them
 * on a phone. A gold fill with `--accent-foreground` on top is also not an
 * invention: it is the product's existing icon-tile pattern
 * (`bg-accent text-accent-foreground`), so this matches a thing that already
 * ships rather than introducing a second treatment.
 *
 * WHAT THIS DOES NOT DO, STATED SO NOBODY ASSUMES OTHERWISE: it does not create
 * a file at the literal path `/favicon.ico`. Next serves this at `/icon` with a
 * content hash and emits `<link rel="icon">` into every page's head, which is
 * what every browser released this century actually reads. A client that probes
 * the bare `/favicon.ico` path and ignores the link tag still gets a 404. Fixing
 * that needs a real `.ico` binary committed at `src/app/favicon.ico`, and a
 * hand-built ICO container is a worse thing to own than this residual.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
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
          borderRadius: 7,
          fontFamily: 'Rubik',
          fontSize: 24,
          letterSpacing: '-0.02em',
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
