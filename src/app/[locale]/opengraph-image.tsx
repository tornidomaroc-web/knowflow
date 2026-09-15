import { ImageResponse } from 'next/og';
import { SITE_URL } from '@/lib/site';
import { locales } from '@/lib/i18n';
import { BRAND, loadBrandFont } from '../_brand/brand';
import { markDataUri } from '../_brand/mark';

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
 * The card carries NO SENTENCE — only the mark, the wordmark, a rule, and the
 * domain; the mark is wordless and the rest are Latin on /ar exactly as they
 * are on /en (the live wordmark is `Know<span>Flow</span>` in both). That is a
 * decision about risk, not about effort. Arabic in Satori needs the shaped,
 * bidi-ordered run to come out right with no browser to do the shaping, and
 * there is no way to witness that from here before the link is sent. The
 * localised words already reach the preview through `og:title` and
 * `og:description`, which ARE per-locale and which WhatsApp renders as real
 * text beside this image — so the Arabic student loses nothing readable, and
 * the card cannot break in a way nobody saw.
 *
 * 1200x630 is the standard large-card size; WhatsApp, X and LinkedIn all accept it.
 *
 * WHY THIS FILE SITS UNDER `[locale]/` AND NOT AT THE ROOT OF `app/`, WHICH IS
 * WHERE IT STARTED AND WHERE THE DOCUMENTATION PUTS IT. `og:image` must be an
 * ABSOLUTE url, and Next builds it from `metadataBase` — which this app sets in
 * `[locale]/layout.tsx` and nowhere else, because that layout IS the root layout
 * (there is no `app/layout.tsx`). At the root of `app/` the convention also
 * applied to `/_not-found`, which renders OUTSIDE `[locale]` and therefore has
 * no metadataBase, so the build emitted
 * `<meta property="og:image" content="http://localhost:3000/opengraph-image…">`
 * into the shipped 404 page. Caught by grepping the built HTML for `localhost`,
 * not by review. Moving the file one segment down scopes it to the routes that
 * have a base; the 404 page goes back to carrying no card at all, which is
 * correct for a page nobody should be sharing. `icon` and `apple-icon` stay at
 * the root on purpose — their hrefs are relative, so they never needed a base,
 * and keeping them there is what gives them clean `/icon` and `/apple-icon` URLs
 * instead of per-locale ones.
 */
export const alt = 'KnowFlow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * THE MARK ON THIS CARD, AND WHY BOTH ITS NUMBERS AND ITS COLOUR ARE DERIVED.
 *
 * THE SIZE IS NOT PICKED. Rubik's `sCapHeight` is 700 of 1000 units per em, so
 * the wordmark's cap height at `fontSize: 148` is 103.60px. The artwork keeps
 * all its ink inside 80 of its 100 units, so a 129px box puts the mark's ink at
 * 103.2px — THE MARK'S INK HEIGHT IS THE WORDMARK'S CAP HEIGHT. The margin is
 * 31 rather than 44 because the artwork already carries 12.9px of its own
 * margin (its 10-unit safe border at this size), and 44 is this card's existing
 * rhythm — the rule's `marginTop`. Change `fontSize: 148` and both numbers are
 * wrong; they are derived from it.
 *
 * THE COLOUR IS A RULE RATHER THAN A CHOICE, AND GOLD WAS ARGUED FOR AND LOST.
 * `markSvg` requires `fill` and refuses a default because there is no correct
 * one: the mark has NO COLOUR OF ITS OWN. What it has is a rule — it wears the
 * FOREGROUND OF WHATEVER GROUND IT SITS ON. On the gold tile that is
 * `--accent-foreground` (`BRAND.onGold`); in the app it will be `currentColor`,
 * which on a dark surface inherits `--foreground`. This card's ground is
 * `--background`, so the mark wears `--foreground` — `BRAND.text`. Gold is an
 * accent this card already spends TWICE, on "Flow" and on the rule, and it
 * would have made this the one surface where that rule breaks. `currentColor`
 * must never reach Satori, which is why the colour is interpolated here instead
 * of living in the artwork.
 *
 * WHAT THE BAND THAT USED TO SIT HERE CLAIMED, AND WHY THE CLAIM IS GONE TOO.
 * A full-width 16px gold band sat at the top of this card, and the comment on
 * it said it was "what still reads as KnowFlow after the wordmark has stopped
 * being legible" at the ~200px width a WhatsApp thumbnail gets. That was
 * measured and it is FALSE: the wordmark is legible at 200 and at 120 without
 * it. The comment is deleted with the band rather than left behind, because a
 * false justification in the source outlives the thing it justified.
 *
 * KNOWN AND ACCEPTED LIMIT, RECORDED RATHER THAN DISCOVERED LATER: below
 * roughly 100px wide the diamond starts to fail where the band would have
 * survived. That is ruled acceptable. At the 200px messaging thumbnail that
 * actually binds this surface the mark holds — 16x17px of ink, the 10-unit gap
 * clearing 100% back to the ground, and two connected components at every
 * threshold tested.
 */
const MARK_PX = 129;
const MARK_MARGIN_BOTTOM = 31;

/**
 * NOT OPTIONAL, AND THE BUILD OUTPUT IS HOW YOU CHECK IT. Moving this file under
 * `[locale]/` put it behind a DYNAMIC segment, and the route table immediately
 * changed from `○ (Static)` to `ƒ (Dynamic)` — meaning the card would be
 * rendered by a lambda on every crawler hit, and the font read in
 * `_brand/brand.ts` would be reaching the filesystem from inside a traced
 * serverless bundle rather than from the build's own working directory. The
 * layout's `generateStaticParams` does not reach a metadata image route; this
 * one does, and it puts all three images back to prerendered-at-build.
 *
 * If you ever see `ƒ /[locale]/opengraph-image` in the build output again, the
 * font read is the thing that breaks, not this line.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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
        {/* Cream, and derived. See "THE MARK ON THIS CARD" above. */}
        <img
          src={markDataUri(BRAND.text)}
          width={MARK_PX}
          height={MARK_PX}
          style={{ marginBottom: MARK_MARGIN_BOTTOM }}
          alt=""
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
