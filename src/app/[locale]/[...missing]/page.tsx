import { notFound } from 'next/navigation';

/**
 * THE CATCH-ALL THAT MAKES THE 404 OURS.
 *
 * In the App Router an unmatched URL renders the ROOT `not-found.tsx`, and a
 * nested `not-found.tsx` only answers a `notFound()` thrown inside its own
 * segment. This app has no root layout (every page lives under `[locale]`), so
 * `/en/anything-missing` fell through to Next's built-in page: black, unstyled,
 * English only, with none of the product's tokens. Witnessed on the PR
 * preview before this file existed.
 *
 * This route matches everything under `[locale]` that no real page claimed
 * and throws `notFound()` from inside the segment, which is what makes
 * `[locale]/not-found.tsx` the page a lost student sees. Static: it renders
 * the same for every path.
 */
export default function MissingPage() {
  notFound();
}
