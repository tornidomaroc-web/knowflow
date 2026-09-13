import { ImageResponse } from 'next/og';
import { SITE_URL } from '@/lib/site';
import { BRAND, loadBrandFont } from './_brand/brand';

/**
 * THE LINK PREVIEW. This file exists because `twitter:card` already claimed
 * `summary_large_image` while no `og:image` existed anywhere in the product, so
 * every share of tryknowflow.com — and the one that matters is a WhatsApp
 * message to ten students — rendered as bare blue text with no picture at all.
 * A card type that promises a large image and supplies none is worse than
 * claiming nothing, because the consumer reserves the space and then shows a
 * blank.
 *
 * WHY THIS IS GENERATED CODE AND NOT A DESIGNED PNG. A committed image is a
 * second source of truth for the palette that no build step can check, and it
 * cannot be diffed. Rendering it from `BRAND` means the card is wrong only if
 * the tokens are wrong. What this cannot do is art direction: if Abo Jad wants
 * an illustrated or photographic card, that is a designer's PNG and this file
 * should be deleted rather than argued with.
 *
 * WHY THERE IS NOT ONE CARD PER LOCALE, WHICH IS THE OBVIOUS THING TO DO.
 * The card carries NO SENTENCE — only the wordmark, a rule, and the domain, all
 * of which are Latin on /ar exactly as they are on /en (the live wordmark is
 * `Know<span>Flow</span>` in both). That is a decision about risk, not about
 * effort. Arabic in Satori needs the shaped, bidi-ordered run to come out right
 * with no browser to do the shaping, and there is no way to witness that from
 * here before the link is sent. The localised words already reach the preview
 * through `og:title` and `og:description`, which ARE per-locale and which
 * WhatsApp renders as real text beside this image — so the Arabic student loses
 * nothing readable, and the card cannot break in a way nobody saw.
 *
 * 1200x630 is the standard large-card size; WhatsApp, X and LinkedIn all accept it.
 */
export const alt = 'KnowFlow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const fontData = await loadBrandFont();

  // The metadata everywhere else in the app is built from SITE_URL, so the card
  // is too rather than hardcoding the host a second time. On a Vercel preview
  // this renders whatever NEXT_PUBLIC_SITE_URL is set to there, which is the
  // correct behaviour and also the tell that the value is being read at all.
  const domain = SITE_URL.replace(/^https?:\/\//, '');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BRAND.ground,
          fontFamily: 'Rubik',
        }}
      >
        {/* The single accent, as a band rather than a glow. At the ~200px width a
            WhatsApp thumbnail gets, the band is what still reads as KnowFlow
            after the wordmark has stopped being legible. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 16,
            backgroundColor: BRAND.gold,
          }}
        />

        <div style={{ display: 'flex', fontSize: 148, letterSpacing: '-0.025em', lineHeight: 1 }}>
          <span style={{ color: BRAND.text }}>Know</span>
          <span style={{ color: BRAND.gold }}>Flow</span>
        </div>

        <div
          style={{
            width: 112,
            height: 5,
            backgroundColor: BRAND.gold,
            marginTop: 44,
            marginBottom: 40,
          }}
        />

        <div style={{ display: 'flex', fontSize: 38, letterSpacing: '0.1em', color: BRAND.textMuted }}>
          {domain}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Rubik', data: fontData, style: 'normal', weight: 700 }],
    },
  );
}
