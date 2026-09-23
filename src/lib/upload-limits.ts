/**
 * THE LARGEST FILE A STUDENT CAN UPLOAD, DEFINED ONCE (register #50, decision 1:
 * accept the real ceiling, owner's ruling 2026-09-23).
 *
 * The browser check (`DropZone`), the line under the drop zone and the server's
 * own guard (`/api/ingest`) all read MAX_UPLOAD_BYTES from here, and the sentence
 * a student reads is composed from it in `@/lib/limit-messages`, so the promise
 * and the enforcement cannot drift apart again. They did once: the app promised
 * 50 MB in seven places while the platform refused anything near 4.5 MB.
 *
 * WHY 4 MB. Measured 2026-09-23 on a preview deployment, with requests the route
 * refused at its extension check (a `.bin` file, answered 415 before any database
 * or storage call), so the measurement wrote nothing:
 *
 *   - Vercel refuses a request with `413 FUNCTION_PAYLOAD_TOO_LARGE`, before our
 *     code runs, once its body AND ITS HEADERS together pass about 4,500,000
 *     bytes. A body of exactly 4,500,000 bytes was refused. With ~6.7 KB of
 *     headers the largest body that passed was 4,493,270 bytes, and that same
 *     body with a 1,000-byte header added was refused.
 *   - The browser's multipart encoding sends the file's bytes RAW (no base64),
 *     plus an envelope of 402 bytes and the filename: 411 bytes for `Notes.pdf`,
 *     819 bytes for a 226-character Arabic name.
 *   - A student's headers are not ours to fix (their Supabase session cookies are
 *     among them), so the limit keeps headroom: a 4 MiB file with the longest
 *     envelope measured is a 4,195,123-byte body, which passed, with about 300 KB
 *     left for headers.
 *
 * 1 MB here is 1,048,576 bytes, the unit Windows uses when it shows a file's
 * size, so a file the student's computer shows as "4 MB" or less always passes.
 * On a phone or a Mac, which count 1 MB as 1,000,000 bytes, the same limit is
 * 4.19 MB, still above anything shown there as "4 MB".
 *
 * Raising this number is not a code change: a file past about 4,490,000 bytes
 * (4.28 MB in this file's units) is refused by the platform, not by us. Real
 * large-file support needs the upload to bypass Vercel entirely (a signed-URL
 * upload straight to storage, `docs/b5b-scoping.md` (b2)), which is Phase 7 work.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The one comparison, so the browser and the server cannot disagree at the edge. */
export function isOverUploadLimit(bytes: number): boolean {
  return bytes > MAX_UPLOAD_BYTES;
}

/**
 * What `/api/ingest` answers, as an unvalidated wire shape: every field is
 * optional until the caller checks it (as `IngestionAck` is in the route).
 */
export interface UploadReply {
  success?: boolean;
  document_id?: string;
  chunk_count?: number;
  error?: string;
}

/**
 * Read an upload reply WITHOUT assuming it is JSON. The platform answers some
 * failures itself, in plain text, before the route runs: a 413 past its size
 * ceiling (`Request Entity Too Large … FUNCTION_PAYLOAD_TOO_LARGE`), or a timeout.
 * The old code called `res.json()` on those and showed the student the parser's
 * own error, `Unexpected token 'R', "Request En"... is not valid JSON`. Anything
 * that is not a JSON object comes back as `null`.
 */
export function parseUploadReply(body: string): UploadReply | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as UploadReply)
      : null;
  } catch {
    return null;
  }
}
