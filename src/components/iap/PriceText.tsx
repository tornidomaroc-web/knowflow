import { Fragment } from 'react';
import { LatinText } from '@/components/ui/LatinText';
import { readsRightToLeft } from '@/lib/latin-groups';

/**
 * STOREKIT'S PRICE, ALWAYS ONE ISOLATE (the owner's render review of #338 at
 * 69f160f, 2026-11-18): the Arabic disclosure drew "$9.99" as "9.99$".
 *
 * Why it mirrored: LatinText isolates a Latin RUN, which starts on a letter,
 * so "$9.99" is never isolated. Left in the Arabic sentence, the bidi rule W2
 * turns the European digits after an Arabic letter into Arabic numbers, and
 * the "$" (a neutral then) takes the Arabic side: it is drawn to the right of
 * "9.99". The same happens to "9,99 €" ("€ 9,99") and to the "$" of "US$9.99".
 *
 * The fix: `displayPrice` is drawn as its own isolate (`<bdi>`), on one line,
 * wherever a sentence holds {price}, so the sentence around it can never
 * reorder it. Its direction is the price's own first strong letter (what
 * dir="auto" decides): left to right for "$9.99", "9,99 €", "US$9.99",
 * "MAD 99.00"; right to left for an Arabic-script price such as
 * "٣٫٦٧ ر.س.", whose closing "." a left-to-right isolate would move to the
 * number's side. No character is added or changed: the paragraph's
 * textContent is the filled string, as with LatinText.
 *
 * scripts/design-c/iap.mjs (check 25) reads [data-kf-price] in every paywall
 * render: its text is exactly the price asked and its glyphs are in reading
 * order; its forced case unwraps the isolate and must be flagged.
 */
export function priceDir(price: string): 'ltr' | 'rtl' {
  return readsRightToLeft(price) ? 'rtl' : 'ltr';
}

export function PriceSentence({ template, price }: { template: string; price: string }) {
  const parts = template.split('{price}');
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <bdi dir={priceDir(price)} data-kf-price="" className="whitespace-nowrap">
              {price}
            </bdi>
          )}
          {p && <LatinText text={p} />}
        </Fragment>
      ))}
    </>
  );
}
