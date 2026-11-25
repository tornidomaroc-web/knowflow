/**
 * THE CAMERA SCREEN'S RULES, ON THE DEVICE ("صوّر صفحاتك"; the server half is
 * src/lib/page-reader.ts and POST /api/page-read).
 *
 * Pure: no DOM, no network. The browser half that decodes and encodes a photo
 * is src/lib/page-photo-encode.ts, and the screen is
 * src/components/upload/CameraPages.tsx. `scripts/verify-camera-screen.mjs`
 * holds everything here; `scripts/verify-page-photo-encode.mjs` runs the
 * encoder in a real browser.
 *
 * 1. EVERY PHOTO IS RE-ENCODED BEFORE IT LEAVES THE PHONE, to a baseline JPEG
 *    with no metadata, upright, its long side at most PHOTO_LONG_SIDE:
 *    - the server refuses a progressive JPEG (src/lib/page-reader.ts,
 *      MAX_PHOTO_PIXELS), and photos shared through WhatsApp or Telegram
 *      are progressive;
 *    - the camera stores a portrait page as a landscape image plus an EXIF
 *      orientation tag; the re-encoded file is turned upright and carries no
 *      tag, so nothing after this step has to know about orientation;
 *    - no metadata leaves the phone (the camera writes GPS and the device);
 *    - 2300 px is under the model's tier edge (2576, `fitToTier`), so the
 *      server sends the photo on as it is, and a 12 MP capture shrinks from
 *      about 3 to 6 MB to under 1 MB.
 * 2. ONE BATCH, READ AT MOST ONCE (item 4j). The photos are uploaded with the
 *    student's own session to `{uid}/page-photos/{batch}/p1.jpg`… (the only
 *    keys the storage policy lets a student write), then POST /api/page-read
 *    is called for that batch. The route CLAIMS a batch before it reads it
 *    (PAGE_BATCH_CLAIM_NAME, src/lib/page-reader.ts), so asking again for the
 *    SAME keys can never read or bill it twice:
 *    - the read has a time limit (READ_TIME_LIMIT_MS); on that limit or a
 *      network error it is asked ONCE more with the same keys;
 *    - 409 page-batch-taken: another request has it (the first one, being
 *      handled, or done): the screen says `unconfirmed` and uploads nothing;
 *    - 410 page-batch-gone: nobody has it and its photos are not there: the
 *      photos are uploaded again under a NEW batch (once per send);
 *    - no answer after the second ask: `unconfirmed`, and the batch is KEPT:
 *      "Try again" asks for the same keys (sendPageBatch's `again`), never a
 *      new upload unless the route answers 410.
 *    Until a 200 the photos stay in memory, so a new upload needs no new shot.
 * 3. ONLY A BATCH NEVER POSTED IS DELETED BY THE APP (an upload that failed),
 *    with the student's session (the storage policy lets a student delete
 *    under their own page-photos/ and nowhere else). Once posted, the batch
 *    is the server's: the request holding it removes the photos, and a
 *    request that never arrived leaves them for the sweep's hour. Deleting
 *    after a refusal could pull the photos from under a first request still
 *    reading them.
 */
import { MAX_PAGE_PHOTOS, PAGE_BATCH_GONE, PAGE_BATCH_TAKEN, pagePhotoKey, readPhotoHeader } from '@/lib/page-reader';

export { MAX_PAGE_PHOTOS };

/** The long side of every photo sent, in pixels (rule 1). */
export const PHOTO_LONG_SIDE = 2300;

/**
 * The JPEG quality of the re-encoded photo, 0 to 1 (canvas `toBlob`).
 * 0.85: the reader needs the thin strokes of handwriting and Arabic marks
 * (the dots and the vowel signs) intact, and JPEG's ringing around a dark
 * stroke on paper starts to blur those below about 0.75; above 0.9 the file
 * grows by about half again with nothing more for the reader to see. A page
 * at 2300 px comes out between about 0.4 and 1 MB. Chosen by that reasoning,
 * not measured against the reader: measuring it would cost model calls.
 */
export const PHOTO_JPEG_QUALITY = 0.85;

/** How many times an upload is attempted, each under a new batch id, before giving up (rule 2). */
export const UPLOAD_ATTEMPTS = 2;

/**
 * The read's time limit, per ask (rule 2): 75 s.
 * Measured: G2 (99 photos, Haiku 5.5, the route's settings) took 2.6 s a page
 * at the median, 4.4 s at p95 and 6.4 s at most; the live run on production
 * (2026-11-17, 3 pages) answered in 17.4 s end to end, about 11 s before the
 * ingestion and 6 s in it. Ten pages, three at a time, at the measured
 * maximum: 4 x 6.4 s reading + about 5 s of downloads and checks + about 6 s
 * of ingestion = about 37 s. 75 s is twice that and four times the measured
 * 3-page send, so a normal read is never cut; a request stuck below the page
 * (the build 9 send that showed "reading" for 13 minutes) is given up in 75 s
 * instead. A read slower than that is not lost: the second ask is answered
 * 409 while the first is handled, and the material appears in the list.
 */
export const READ_TIME_LIMIT_MS = 75_000;

// --- orientation ---------------------------------------------------------------------

/**
 * The EXIF orientation of a JPEG (1 to 8), or 1 when there is none or the
 * bytes are not a JPEG. Reads APP1 `Exif` IFD0 tag 0x0112 only.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  const b = bytes;
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return 1;
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) return 1; // a scan or the end: no EXIF before it
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return 1;
    const start = i + 4;
    if (marker === 0xe1 && start + 6 <= b.length && b[start] === 0x45 && b[start + 1] === 0x78 && b[start + 2] === 0x69 && b[start + 3] === 0x66 && b[start + 4] === 0 && b[start + 5] === 0) {
      return tiffOrientation(b, start + 6, Math.min(b.length, i + 2 + len));
    }
    i += 2 + len;
  }
  return 1;
}

function tiffOrientation(b: Uint8Array, t: number, end: number): number {
  if (t + 8 > end) return 1;
  const little = b[t] === 0x49 && b[t + 1] === 0x49;
  const big = b[t] === 0x4d && b[t + 1] === 0x4d;
  if (!little && !big) return 1;
  const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000 : b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]));
  if (u16(t + 2) !== 42) return 1;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) return 1;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** The size a stored w x h image shows at under orientation `o` (5 to 8 swap the sides). */
export function uprightSize(width: number, height: number, orientation: number): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

/** Scaled so the long side is at most `max`, never enlarged, whole pixels, at least 1. */
export function fitLongSide(width: number, height: number, max: number = PHOTO_LONG_SIDE): { width: number; height: number } {
  const s = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

/**
 * The canvas transform (a, b, c, d, e, f) that draws the STORED image upright
 * onto an output canvas of `outW` x `outH` (the upright, scaled size), and
 * the size to draw the stored image at. For 5 to 8 the stored image is drawn
 * with its sides swapped, because the transform turns it a quarter.
 */
export function orientationTransform(orientation: number, outW: number, outH: number): {
  matrix: [number, number, number, number, number, number];
  drawWidth: number;
  drawHeight: number;
} {
  const swap = orientation >= 5 && orientation <= 8;
  const drawWidth = swap ? outH : outW;
  const drawHeight = swap ? outW : outH;
  const m: Record<number, [number, number, number, number, number, number]> = {
    2: [-1, 0, 0, 1, outW, 0],
    3: [-1, 0, 0, -1, outW, outH],
    4: [1, 0, 0, -1, 0, outH],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, outW, 0],
    7: [0, -1, -1, 0, outW, outH],
    8: [0, -1, 1, 0, 0, outH],
  };
  return { matrix: m[orientation] ?? [1, 0, 0, 1, 0, 0], drawWidth, drawHeight };
}

/** A baseline JPEG (SOF0), the only kind the encoder may hand on (rule 1). */
export function isBaselineJpeg(bytes: Uint8Array): boolean {
  const h = readPhotoHeader(bytes);
  if (h.format !== 'jpeg' || !h.sequential || h.width === 0) return false;
  // `sequential` also admits SOF1 (extended); a baseline is SOF0 exactly.
  for (let i = 2; i + 3 < bytes.length; ) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1];
    if (marker === 0xc0) return true;
    if (marker === 0xda || marker === 0xd9) return false;
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return false;
}

// --- the batch --------------------------------------------------------------------------

/** The file name of the photo at `index` (0-based) in a batch: p1.jpg, p2.jpg… in page order. */
export function photoName(index: number): string {
  return `p${index + 1}.jpg`;
}

/** The storage keys of a batch of `count` photos, in page order. */
export function batchKeys(userId: string, batchId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => pagePhotoKey(userId, batchId, photoName(i)));
}

/** A new batch id: a lowercase v4 UUID, the shape the storage policy and the route accept. */
export function newBatchId(): string {
  return crypto.randomUUID().toLowerCase();
}

export interface PageBatchDeps {
  userId: string;
  newBatchId: () => string;
  /** Uploads one photo with the student's session; throws when it did not arrive. */
  upload: (key: string, photo: Blob) => Promise<void>;
  /**
   * POST /api/page-read with these keys; resolves with the answer, throws when
   * no answer came. It must stop when `signal` aborts (the time limit), body
   * included. `ask` numbers the POSTs of one send from 0 (the `kf_r` of the
   * address), so the server's log tells a second ask from a first.
   */
  read: (keys: string[], signal: AbortSignal, ask: number) => Promise<{ status: number; text: string }>;
  /** Deletes these keys with the student's session; best effort, never throws to the caller. */
  remove: (keys: string[]) => Promise<void>;
  /** Progress: photos uploaded so far, then `reading` once the POST has left. */
  onProgress?: (p: { stage: 'uploading'; done: number; total: number } | { stage: 'reading' }) => void;
  /** READ_TIME_LIMIT_MS unless a proof sets it. */
  readTimeLimitMs?: number;
}

/** A batch that was posted and not answered: asked again with the same keys (rule 2). */
export interface PostedBatch {
  batchId: string;
  keys: string[];
}

export type PageBatchResult =
  /** The route answered (any status but 409 taken and 410 gone); `keys` is the batch it was given. */
  | { kind: 'answered'; status: number; text: string; batchId: string; keys: string[] }
  /** Every upload attempt failed (each attempt's batch deleted), or a new upload after a 410 was gone too. */
  | { kind: 'upload-failed'; batchIds: string[] }
  /**
   * Posted, and whether the material was made is unknown: no answer after the
   * second ask (`taken` false), or another request has the batch (`taken`
   * true). The batch is KEPT for "Try again" (`again`).
   */
  | { kind: 'unconfirmed'; batchId: string; keys: string[]; taken: boolean };

/** The route's `code`, from an answer's text, or undefined. */
function answerCode(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as { code?: unknown }).code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Rule 2 and rule 3. Without `again`: upload the photos under a new batch
 * (again under another new batch if an upload fails, UPLOAD_ATTEMPTS in all;
 * a failed batch is deleted), then ask for it. With `again` (a batch posted
 * earlier and not answered): ask for those keys, no upload. Each ask has the
 * time limit, and one more ask with the same keys follows a limit or a
 * network error. A 410 sends the same photos once more under a new batch.
 * The photos are not touched: the caller keeps them.
 */
export async function sendPageBatch(photos: readonly Blob[], deps: PageBatchDeps, again?: PostedBatch): Promise<PageBatchResult> {
  if (photos.length < 1 || photos.length > MAX_PAGE_PHOTOS) throw new Error(`a batch is 1 to ${MAX_PAGE_PHOTOS} photos`);
  if (again && again.keys.length !== photos.length) throw new Error('the batch asked again must be these photos');
  const limit = deps.readTimeLimitMs ?? READ_TIME_LIMIT_MS;
  const tried: string[] = [];
  let asks = 0;
  let current: PostedBatch | null = again ?? null;
  let uploadedAgain = false;

  // One POST under the time limit; null when no answer came. deps.read is
  // called in the same turn as the caller's onProgress('reading').
  const askOnce = async (keys: string[]): Promise<{ status: number; text: string } | null> => {
    const timeLimit = new AbortController();
    const timer = setTimeout(() => timeLimit.abort(), limit);
    try {
      return await deps.read(keys, timeLimit.signal, asks++);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  for (;;) {
    if (!current) {
      current = await uploadBatch(photos, deps, tried);
      if (!current) return { kind: 'upload-failed', batchIds: tried };
    }
    const { batchId, keys } = current;
    deps.onProgress?.({ stage: 'reading' });
    let answer = await askOnce(keys);
    if (answer === null) answer = await askOnce(keys);
    if (answer === null) return { kind: 'unconfirmed', batchId, keys, taken: false };
    const code = answerCode(answer.text);
    if (answer.status === 409 && code === PAGE_BATCH_TAKEN) return { kind: 'unconfirmed', batchId, keys, taken: true };
    if (answer.status === 410 && code === PAGE_BATCH_GONE) {
      // Nobody has this batch and its photos are not there: the photos go
      // again under a new batch, once.
      if (uploadedAgain) return { kind: 'upload-failed', batchIds: [...tried, batchId] };
      uploadedAgain = true;
      current = null;
      continue;
    }
    return { kind: 'answered', status: answer.status, text: answer.text, batchId, keys };
  }
}

/** Upload the photos under a new batch, UPLOAD_ATTEMPTS times at most; a batch that failed is deleted. */
async function uploadBatch(photos: readonly Blob[], deps: PageBatchDeps, tried: string[]): Promise<PostedBatch | null> {
  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt++) {
    const batchId = deps.newBatchId();
    tried.push(batchId);
    const keys = batchKeys(deps.userId, batchId, photos.length);
    try {
      for (let i = 0; i < photos.length; i++) {
        deps.onProgress?.({ stage: 'uploading', done: i, total: photos.length });
        await deps.upload(keys[i], photos[i]);
      }
      deps.onProgress?.({ stage: 'uploading', done: photos.length, total: photos.length });
      return { batchId, keys };
    } catch {
      await safely(() => deps.remove(keys));
    }
  }
  return null;
}

async function safely(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* best effort: the server's sweep removes a batch older than an hour */
  }
}

// --- the answer ---------------------------------------------------------------------------

/** What the screen says about one photo the route did not read (`photos[].code`). */
export type PhotoProblem = 'open' | 'no-text' | 'too-long' | 'not-read';

/** The route's machine code for one photo, in four groups the screen has a sentence for. */
export function photoProblem(code: string | undefined): PhotoProblem {
  switch (code) {
    case 'photo-heic':
    case 'photo-type':
    case 'photo-unreadable':
    case 'photo-too-large':
    case 'photo-too-many-pixels':
    case 'photo-odd-shape':
      return 'open';
    case 'read-empty':
      return 'no-text';
    case 'read-cut-off':
      return 'too-long';
    default:
      // photo-missing, read-timeout, read-failed, read-refused, or a code
      // this build does not know: the page was not read, shoot it again.
      return 'not-read';
  }
}

/** The pages (1-based) the route reports unread, each with its group, from `photos` of an answer. */
export function unreadPages(photos: unknown): { n: number; problem: PhotoProblem }[] {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p): p is { n: number; read: boolean; code?: string } => Boolean(p) && typeof p === 'object' && typeof (p as { n?: unknown }).n === 'number')
    .filter((p) => p.read === false)
    .map((p) => ({ n: p.n, problem: photoProblem(p.code) }));
}

/**
 * The material's name, `<base> <yyyy-mm-dd>` in Western digits, from the
 * phone's own date (never toLocale*String, which writes other digits in some
 * locales). The route stores it as `<name>.md`.
 */
export function materialName(base: string, now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base} ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** One send's timeline, measured on the phone (`pageReadUrl`). */
export interface PageReadTimeline {
  /** The phone's clock (epoch ms) at the moment fetch() is called. */
  sentAt: number;
  /** Ms from the "read the pages" tap until the permission answered (the sheet's time when it opened). */
  consentMs: number;
  /** Ms from the tap until the session was read. */
  sessionMs: number;
  /** Ms from the tap until the last photo was uploaded. */
  uploadedMs: number;
  /** Which POST of the send this is, from 0 (a second ask with the same keys is 1). */
  ask?: number;
}

/**
 * THE READ'S ADDRESS, carrying the send's timeline (item 4j, the first send
 * after the photos permission: the "reading" screen held 13 minutes and no
 * request reached Vercel until the app was left).
 *
 * The timeline rides in the query string; the route writes it, with its own
 * arrival time, in one `kf-page-read-arrival` log line (arrivalLine in
 * src/lib/page-reader.ts), so arrival minus `kf_t` is how long the request
 * took from the page's fetch() call to the server. `kf_r` numbers the asks of
 * one send. Only whole milliseconds, nothing about the student or the pages.
 */
export function pageReadUrl(t: PageReadTimeline): string {
  const ms = (n: number) => String(Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
  return `/api/page-read?kf_t=${ms(t.sentAt)}&kf_c=${ms(t.consentMs)}&kf_s=${ms(t.sessionMs)}&kf_u=${ms(t.uploadedMs)}&kf_r=${ms(t.ask ?? 0)}`;
}
