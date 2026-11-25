/**
 * "PHOTOGRAPH YOUR PAGES" (صوّر صفحاتك): THE PAGE READER'S RULES, IN ONE PLACE.
 *
 * A student photographs up to MAX_PAGE_PHOTOS pages. The app uploads the
 * photos to the private `documents` bucket under the student's own folder
 * (`{userId}/page-photos/{batchId}/{name}`, which the storage policy of
 * 002_storage.sql already lets the student write and read), and sends their
 * keys to POST /api/page-read. The route checks that every key is the
 * caller's, reads each photo with Claude Haiku 5.5 (one page per call), turns
 * the transcriptions into ONE .md file with a heading per photo, hands it to
 * the same ingestion path every upload takes (src/lib/ingest-material.ts) and
 * deletes the photos.
 *
 * WHY THE PHOTOS GO THROUGH STORAGE AND NOT THE REQUEST: a Vercel function
 * takes at most about 4.5 MB of request body (measured for #50 at about
 * 4,500,000 bytes, body plus headers), and ten phone photos are 15 to 50 MB.
 *
 * THE MODEL SETTINGS ARE G2'S (D:\Temp\kf-research\ocr-g2\report.md, measured
 * 2026-11-16 on 99 images): `claude-haiku-5-5` at its high-resolution image
 * tier (long edge at most 2576 px and at most 4784 image tokens of 28x28 px),
 * thinking disabled, one page per call, the G2 prompt byte for byte, the image
 * EXIF-oriented, fitted to that tier with the G2 runner's own rule and sent as
 * JPEG quality 90. One setting differs, on purpose: `max_tokens` (below).
 *
 * Pure: no I/O, so scripts/verify-page-reader.mjs checks every rule here
 * without a network, a database or a model call.
 */
import type { Locale } from '@/lib/i18n';

// --- the model call --------------------------------------------------------------

/**
 * Claude Haiku 5.5. Anthropic publishes this id as fixed: no date suffix and no
 * separate alias exists (the Claude API skill's model table and its "Migrating
 * to Claude Haiku 5.5" section, read 2026-11-16), so there is no dated id to
 * pin; this string is the pin. The G2 responses reported the same id.
 */
export const PAGE_READ_MODEL = 'claude-haiku-5-5';

/**
 * The G2 prompt, byte for byte (run.py `PROMPT`, sha256 c7b935a9…7b93cd, held
 * by scripts/verify-page-reader.mjs). It asks for [?] where a word cannot be
 * read; G2 never saw one, so the model gives no "retake" signal (report,
 * objection 2): capture quality has to come from the camera side.
 */
export const PAGE_READ_PROMPT =
  'Transcribe this photographed study page exactly, in reading order. Arabic reads right to left; ' +
  'if the page has two columns, transcribe the right column completely, then the left column.\n' +
  '- Keep tables as Markdown tables.\n' +
  '- Keep headings, numbered and bulleted lists, English terms, digits and diacritics (harakat) exactly as printed.\n' +
  '- Add nothing: no commentary, no translation, no corrections, no description of the image.\n' +
  '- If a word cannot be read, write [?] in its place.\n' +
  'Output only the transcription.';

/**
 * 4,000, not run.py's 8,192 or the report's 4,096, so that the reservation
 * below is a true upper bound on what one page can cost:
 *   input  at most 4,784 image tokens + 175 = 4,959 (G2: every call's input was
 *          its image tokens + 175, e.g. 4,931 = 4,756 + 175)
 *   output at most 4,000
 *   (4,959 x 0.10 + 4,000 x 0.50) / 1e6 = 0.0024959 USD <= 0.0025.
 * At 4,096 a page could cost 0.0025439 and at 8,192 0.0045919, more than the
 * route reserves for it. The longest G2 transcription was 1,001 tokens.
 * A page that stops at this cap is a failed page, never partial text.
 */
export const PAGE_READ_MAX_TOKENS = 4000;

/** What the model call adds to the image's tokens (G2: 4,931 - 4,756 and 4,915 - 4,740). */
export const PAGE_READ_PROMPT_TOKENS = 175;

/** Pages read at once. G2: "sequential or at concurrency <= 3". */
export const PAGE_READ_CONCURRENCY = 3;

/**
 * The SDK's retries (run.py: 2). They are left only for answers that were not
 * billed (408, 409, 429, 5xx, a refused connection): each call's own time
 * limit is the time left on the deadline below (run.py's 180 s was longer
 * than its whole run for the same reason), so the SDK never gives up on a slow
 * page and sends it a second time while the first may still be billed.
 */
export const PAGE_READ_MAX_RETRIES = 2;

/**
 * The deadline for listing, downloading, preparing and reading. A photo not
 * prepared, or a page not finished, by then fails as `read-timeout`; a page
 * not started by then is never sent. Each call races it, so even the SDK's
 * wait before a retry (a 429's `retry-after`, up to 60 s, slept without
 * looking at the signal) cannot carry the reading past it. 10 pages at
 * concurrency 3 took about 4 x 2.6 s in G2's terms (median), 4 x 6.4 s at its
 * slowest.
 */
export const PAGE_READ_DEADLINE_MS = 120_000;

/** One photo's download may take this long before that photo alone fails (`photo-missing`). */
export const PAGE_READ_DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * The route's `maxDuration`, in seconds. The reading ends by its deadline;
 * the .md's ingestion gets what is left of this, less
 * PAGE_READ_ANSWER_MARGIN_MS, so the route answers in JSON before the
 * platform cuts it off.
 */
export const PAGE_READ_MAX_DURATION_S = 300;
export const PAGE_READ_ANSWER_MARGIN_MS = 10_000;

// --- the money -------------------------------------------------------------------

/**
 * What the route sets aside per photo before anything is sent: the owner's
 * figure, and (PAGE_READ_MAX_TOKENS) a true bound on one page's price at
 * Claude Haiku 5.5's rates (HAIKU_55_USD_PER_MTOK, src/lib/ai-allowance.ts).
 * After each call the ledger gets the real price from the response's `usage`
 * (haiku55Usd), never this figure.
 */
export const PAGE_READ_RESERVE_USD = 0.0025;

export function pageReadReserveUsd(photos: number): number {
  return Number((Math.max(0, photos) * PAGE_READ_RESERVE_USD).toFixed(6));
}

// --- the photos ------------------------------------------------------------------

/** One batch is one material: at most this many photos per request. */
export const MAX_PAGE_PHOTOS = 10;

/**
 * Bytes: a 48 MP iPhone "JPEG Max" or a 50 MP Android photo is 10 to 25 MB,
 * a camera capture through the web view about 2 to 5 MB. Read from the
 * storage listing BEFORE the photo is downloaded.
 */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/**
 * THE SHAPE A PHOTO MAY HAVE, FROM ITS HEADER, BEFORE ANYTHING DECODES IT.
 * A decompression bomb is small on disk and huge in memory, and the pixel
 * count alone does not bound it: a 117 KB PNG of 10,000,000 x 4 is 40 MP, yet
 * resizing that strip took 3.5 GB (6.5 GB in 16-bit RGBA) in review, over a
 * Vercel instance's 2 GB. So, all from the header:
 *   pixels  at most 50,000,000: a 48 MP (8064 x 6048) or 50 MP (8160 x 6120)
 *           camera passes;
 *   a side  at most 12,000 px (a phone's longest side is 8,160);
 *   shape   the long side at most 8 times the short one (a page is about
 *           1.4, a phone photo 1.33 to 2.2);
 *   kind    a baseline (or extended sequential) JPEG, or a non-interlaced
 *           PNG. A camera writes those. A progressive JPEG or an interlaced
 *           PNG is decoded whole into memory (about 0.5 GB at 50 MP), and a
 *           progressive JPEG with thousands of scans took 17 s to decode
 *           before any time limit could fire.
 * Within these, the heaviest decode and resize measured (a 16-bit RGBA PNG
 * of 12,000 x 4,166) peaked at about 240 MB with the one libvips thread sharp
 * uses on glibc Linux, as on Vercel, and about 490 MB with the 16 threads of
 * a desktop; one photo is decoded at a time per instance
 * (src/lib/page-photo-image.ts).
 */
export const MAX_PHOTO_PIXELS = 50_000_000;
export const MAX_PHOTO_SIDE = 12_000;
export const MAX_PHOTO_ASPECT = 8;

/** The folder under the student's own prefix. */
export const PAGE_PHOTOS_FOLDER = 'page-photos';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`);
// A flat, plain file name: no dot first, no slash, no `..`, at most 73 characters.
const NAME = '[A-Za-z0-9][A-Za-z0-9_-]{0,63}(?:\\.[A-Za-z0-9]{1,8})?';
const KEY_RE = new RegExp(`^(${UUID})/${PAGE_PHOTOS_FOLDER}/(${UUID})/(${NAME})$`);

/** The key a client uploads photo `name` of batch `batchId` under. */
export function pagePhotoKey(userId: string, batchId: string, name: string): string {
  return `${userId}/${PAGE_PHOTOS_FOLDER}/${batchId}/${name}`;
}

export interface PhotoBatch {
  ok: boolean;
  /** Set when ok: the batch folder and each key's file name, in the order given. */
  folder?: string;
  names?: string[];
  /** Set when not ok: `shape` and `count` are the client's mistake (400); `foreign` is a key outside the caller's own folder (403). */
  reason?: 'shape' | 'count' | 'duplicate' | 'mixed-batch' | 'foreign';
}

/**
 * Every key must be `{userId}/page-photos/{batchId}/{name}` with THIS caller's
 * id first (the same rule the storage policy applies: the first path segment
 * is the owner), the same batch for all, no key twice, 1 to MAX_PAGE_PHOTOS.
 * A key that is well formed but names another user's folder is `foreign`.
 * Nothing here touches storage: it decides before anything is read or deleted.
 */
export function checkPhotoKeys(userId: string, keys: unknown): PhotoBatch {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_PAGE_PHOTOS) return { ok: false, reason: 'count' };
  if (!keys.every((k) => typeof k === 'string')) return { ok: false, reason: 'shape' };
  const parts = (keys as string[]).map((k) => KEY_RE.exec(k));
  if (parts.some((m) => m === null)) return { ok: false, reason: 'shape' };
  const matches = parts as RegExpExecArray[];
  if (!UUID_RE.test(userId) || matches.some((m) => m[1] !== userId)) return { ok: false, reason: 'foreign' };
  if (new Set(keys as string[]).size !== keys.length) return { ok: false, reason: 'duplicate' };
  const batch = matches[0][2];
  if (matches.some((m) => m[2] !== batch)) return { ok: false, reason: 'mixed-batch' };
  return { ok: true, folder: `${userId}/${PAGE_PHOTOS_FOLDER}/${batch}`, names: matches.map((m) => m[3]) };
}

// --- reading the header, before anything decodes ---------------------------------

export type PhotoFormat = 'jpeg' | 'png' | 'heif' | 'other';

export interface PhotoHeader {
  format: PhotoFormat;
  /** Stored width and height from the header; 0 when they could not be read. */
  width: number;
  height: number;
  /**
   * Whether the photo is in the one-pass form a camera writes: a JPEG whose
   * frame header is SOF0 or SOF1 (baseline or extended sequential, Huffman),
   * or a PNG that is not interlaced. False for a progressive, lossless,
   * hierarchical or arithmetic-coded JPEG and for an Adam7-interlaced PNG.
   */
  sequential: boolean;
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif', 'avis']);

/**
 * The format from the file's first bytes (never from its name or the MIME type
 * a client declared), and for JPEG and PNG the stored size from the header:
 * PNG's IHDR, JPEG's first SOFn frame header. Nothing is decoded. HEIF/HEIC
 * (and AVIF, the same container) is recognised by its `ftyp` box so it can be
 * refused cleanly, before any decoder sees it.
 */
export function readPhotoHeader(bytes: Uint8Array): PhotoHeader {
  const b = bytes;
  const none = (format: PhotoFormat): PhotoHeader => ({ format, width: 0, height: 0, sequential: false });
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    const ihdr = b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52;
    if (!ihdr || b.length < 29) return none('png');
    // IHDR data: width (4), height (4), bit depth, colour type, compression, filter, interlace.
    return { format: 'png', width: be32(b, 16), height: be32(b, 20), sequential: b[28] === 0 };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const frame = jpegFrame(b);
    return { format: 'jpeg', width: frame.width, height: frame.height, sequential: frame.marker === 0xc0 || frame.marker === 0xc1 };
  }
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return none(HEIF_BRANDS.has(brand) ? 'heif' : 'other');
  }
  return none('other');
}

function be16(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}
function be32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
}

// SOF0-3, 5-7, 9-11, 13-15: the frame headers that carry the size (not DHT C4, JPG C8, DAC CC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** The first frame header's marker and size; marker 0 and size 0 when there is none before a scan. */
function jpegFrame(b: Uint8Array): { marker: number; width: number; height: number } {
  const none = { marker: 0, width: 0, height: 0 };
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return none;
    while (i < b.length && b[i] === 0xff) i += 1; // fill bytes
    if (i >= b.length) break;
    const marker = b[i];
    i += 1;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // standalone markers
    if (marker === 0xd9 || marker === 0xda) break; // end of image, or a scan before any frame header
    if (i + 1 >= b.length) break;
    const len = be16(b, i);
    if (len < 2) break;
    if (SOF.has(marker)) {
      if (i + 7 > b.length) break;
      // After the length (2 bytes) and the sample precision (1): height, then width.
      return { marker, width: be16(b, i + 5), height: be16(b, i + 3) };
    }
    i += len;
  }
  return none;
}

// --- fitting a photo to the model's image tier ---------------------------------------

/** Claude Haiku 5.5's high-resolution tier (Claude 4.7 and later): long edge and image tokens. */
export const TIER_LONG_EDGE = 2576;
export const TIER_IMAGE_TOKENS = 4784;
const PATCH = 28;

/** Image tokens for a w x h image: one per 28 x 28 patch. */
export function imageTokens(width: number, height: number): number {
  return Math.ceil(width / PATCH) * Math.ceil(height / PATCH);
}

/**
 * The G2 runner's `fit` (run.py), the same arithmetic step for step, so a photo
 * is sent at exactly the size G2 measured: scale to the long edge, then shrink
 * by 0.5% until the image tokens fit. Never enlarges.
 */
export function fitToTier(width: number, height: number): { width: number; height: number } {
  let s = Math.min(1.0, TIER_LONG_EDGE / Math.max(width, height));
  while (Math.ceil((width * s) / PATCH) * Math.ceil((height * s) / PATCH) > TIER_IMAGE_TOKENS) {
    s *= 0.995;
  }
  return { width: Math.max(1, Math.trunc(width * s)), height: Math.max(1, Math.trunc(height * s)) };
}

// --- one photo's outcome ------------------------------------------------------------

/**
 * Why a photo was not read. Machine codes only: there is no screen for this
 * route yet, and the screen that comes with it will say each one in words.
 *   photo-*  refused before anything was sent (nothing billed)
 *   read-*   the model was called, or would have been but the time ran out
 */
export const PHOTO_FAILURES = [
  'photo-missing',
  'photo-too-large',
  'photo-heic',
  'photo-type',
  'photo-too-many-pixels',
  'photo-odd-shape',
  'photo-unreadable',
  'read-timeout',
  'read-failed',
  'read-cut-off',
  'read-refused',
  'read-empty',
] as const;
export type PhotoFailure = (typeof PHOTO_FAILURES)[number];

export interface PhotoOutcome {
  n: number;
  read: boolean;
  code?: PhotoFailure;
}

/** The route's refusal codes: a key outside the caller's own folder (403), and no photo read at all (422). */
export const PAGE_PHOTO_FOREIGN = 'page-photo-foreign';
export const PAGES_UNREAD = 'pages-unread';

/**
 * EXACTLY ONCE PER BATCH (item 4j: a send that reached the server late, or
 * twice, must never be read or billed twice).
 *
 * The route CLAIMS a batch before anything else touches it: the service role
 * creates `{batch folder}/PAGE_BATCH_CLAIM_NAME` with `upsert: false`, and
 * Storage refuses a second object at the same name (the unique index on
 * storage.objects (bucket_id, name)), so of two requests for one batch, at
 * the same moment or minutes apart, exactly one holds it. The other is
 * answered 409 PAGE_BATCH_TAKEN at once: it reads nothing, deletes nothing,
 * counts nothing and spends nothing.
 *
 * The claim stays once a material may have been made (the ingestion service
 * was called), so a late second request is still refused; it is let go when
 * the request ends with nothing saved (a refusal, no page read), AFTER the
 * photos are removed, so asking again is answered 410 PAGE_BATCH_GONE: no
 * request holds or made anything from this batch and its photos are not
 * there, so the app uploads them again under a new batch. A claim whose
 * photos are all missing is let go and answered 410 the same way, before any
 * gate counts it. The sweep (src/lib/page-photo-sweep.ts) removes a claim
 * with its folder an hour after the folder's newest object.
 *
 * The name is one checkPhotoKeys accepts (so the sweep sees an app folder),
 * but the route refuses it as a photo key (no app names a page that way).
 */
export const PAGE_BATCH_CLAIM_NAME = 'kf-claim';
export const PAGE_BATCH_TAKEN = 'page-batch-taken';
export const PAGE_BATCH_GONE = 'page-batch-gone';

/** The app's timeline in the read's query (src/lib/page-photos.ts pageReadUrl). */
const TIMELINE_KEYS = ['kf_t', 'kf_c', 'kf_s', 'kf_u', 'kf_r'] as const;

/** The arrival line: the app's timeline values that are whole numbers (at most 15 digits), nothing else. */
export function arrivalLine(url: string, arrivedAt: number): Record<string, string | number | null> {
  let params: URLSearchParams;
  try {
    params = new URL(url, 'https://tryknowflow.com').searchParams;
  } catch {
    params = new URLSearchParams();
  }
  const line: Record<string, string | number | null> = { tag: 'kf-page-read-arrival', at: new Date(arrivedAt).toISOString(), at_ms: arrivedAt };
  for (const k of TIMELINE_KEYS) {
    const v = params.get(k);
    line[k] = v !== null && /^\d{1,15}$/.test(v) ? Number(v) : null;
  }
  // Arrival minus the phone's clock at fetch(): the time to arrive, give or
  // take the two clocks' difference.
  line.gap_ms = typeof line.kf_t === 'number' ? arrivedAt - line.kf_t : null;
  return line;
}

/**
 * The refusal a photo gets from its header alone, or null when it may be
 * decoded (MAX_PHOTO_PIXELS says why each bound is there). libvips' own view
 * of the header is held to the same bounds again before it decodes
 * (`sizeRefusal`, src/lib/page-photo-image.ts).
 */
export function headerRefusal(h: PhotoHeader): PhotoFailure | null {
  if (h.format === 'heif') return 'photo-heic';
  if (h.format !== 'jpeg' && h.format !== 'png') return 'photo-type';
  if (h.width <= 0 || h.height <= 0) return 'photo-unreadable';
  if (!h.sequential) return 'photo-type';
  return sizeRefusal(h.width, h.height);
}

/** The pixel, side and shape bounds on a width and height, or null when they hold. */
export function sizeRefusal(width: number, height: number): PhotoFailure | null {
  if (width * height > MAX_PHOTO_PIXELS || Math.max(width, height) > MAX_PHOTO_SIDE) return 'photo-too-many-pixels';
  if (Math.max(width, height) > MAX_PHOTO_ASPECT * Math.min(width, height)) return 'photo-odd-shape';
  return null;
}

/**
 * WHICH REFUSALS ANTHROPIC BILLS. A refusal that arrives before any output
 * (no output tokens) is billed only in these categories; in any other
 * category, or with none, it is not billed, though `usage` still carries
 * token counts ("How refusals are billed",
 * https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback,
 * read 2026-11-16; the page says the billed categories may change, so check it
 * again when Anthropic adds one). Haiku 5.5 refuses as cyber, bio,
 * frontier_llm or general_harms. A refusal after some output is billed like
 * any response.
 */
export const BILLED_PRE_OUTPUT_REFUSALS: readonly string[] = ['bio', 'frontier_llm', 'reasoning_extraction'];

/** Whether Anthropic billed this response, so whether the ledger records it. */
export function responseBilled(response: {
  stop_reason?: string | null;
  stop_details?: { category?: string | null } | null;
  usage?: { output_tokens?: number | null } | null;
}): boolean {
  if (response.stop_reason !== 'refusal') return true;
  if ((response.usage?.output_tokens ?? 0) > 0) return true;
  const category = response.stop_details?.category ?? null;
  return category !== null && BILLED_PRE_OUTPUT_REFUSALS.includes(category);
}

/**
 * The text of one response, or why it is not a page. The text is the text
 * blocks joined exactly as G2's runner joined them, and it is NOT changed in
 * any other way: no trim, no normalisation, no "fix". Haiku 5.5 makes silent
 * edits of its own (G2: a dropped repeated adjective, a moved "سنة 1665"); the
 * pipeline adds none, so what the student's material holds is exactly what the
 * model wrote (scripts/verify-page-reader.mjs holds both G2 cases byte for byte).
 */
export function pageText(response: {
  stop_reason?: string | null;
  content?: ReadonlyArray<{ type: string; text?: string }> | null;
}): { text: string } | { code: PhotoFailure } {
  if (response.stop_reason === 'max_tokens') return { code: 'read-cut-off' };
  if (response.stop_reason === 'refusal') return { code: 'read-refused' };
  if (response.stop_reason !== 'end_turn') return { code: 'read-failed' };
  const text = (response.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
  if (text.trim() === '') return { code: 'read-empty' };
  return { text };
}

// --- the material -------------------------------------------------------------------

/**
 * The heading above each photo's text in the material, in the request's
 * language. DRAFT copy (docs/copy-drafts/page_reader.md), awaiting the owner's
 * approval. Western digits, as everywhere in KnowFlow.
 */
export const PAGE_HEADING: Record<Locale, string> = {
  en: 'Page {n}',
  ar: 'الصفحة {n}',
};

/**
 * ONE .md file: a level-2 heading per photo that was read, numbered by the
 * photo's place in the batch (a failed photo 3 leaves "Page 3" out, so the
 * numbers still match the photos), then the model's text exactly as it came.
 */
export function pagesMarkdown(pages: ReadonlyArray<{ n: number; text: string }>, locale: Locale): string {
  return pages.map((p) => `## ${PAGE_HEADING[locale].replace('{n}', String(p.n))}\n\n${p.text}`).join('\n\n') + '\n';
}
