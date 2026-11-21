import { AASA } from '@/lib/universal-links';

/**
 * https://tryknowflow.com/.well-known/apple-app-site-association (item 4g).
 * Apple's CDN fetches it with no redirect allowed: this static segment outranks
 * `[locale]`, and the middleware matcher skips any path with a dot, so no
 * locale 307 fronts it. `Response.json` sets application/json; the file has
 * no extension, so a copy under public/ would not get that type. Built once,
 * served from the CDN. The object and its rule live in src/lib/universal-links.ts.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(AASA);
}
