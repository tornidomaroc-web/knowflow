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
 * 2. ONE BATCH, ONE POST. The photos are uploaded with the student's own
 *    session to `{uid}/page-photos/{batch}/p1.jpg`… (the only keys the
 *    storage policy lets a student write), then POST /api/page-read is called
 *    ONCE for that batch. The server deletes the photos it was given whatever
 *    it answers, and its sweep removes any batch older than an hour, so a
 *    batch is never posted twice: every retry uploads again under a NEW batch
 *    id. Until a 200 the photos stay in memory, so a retry needs no new shot.
 * 3. GIVING UP DELETES THE BATCH, with the student's session (the storage
 *    policy lets a student delete under their own page-photos/ and nowhere
 *    else), so a failed attempt leaves nothing behind for the sweep.
 */
import { MAX_PAGE_PHOTOS, pagePhotoKey, readPhotoHeader } from '@/lib/page-reader';

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
  /** POST /api/page-read with these keys; resolves with the answer, throws when no answer came. */
  read: (keys: string[]) => Promise<{ status: number; text: string }>;
  /** Deletes these keys with the student's session; best effort, never throws to the caller. */
  remove: (keys: string[]) => Promise<void>;
  /** Progress: photos uploaded so far, then `reading` once the POST has left. */
  onProgress?: (p: { stage: 'uploading'; done: number; total: number } | { stage: 'reading' }) => void;
}

export type PageBatchResult =
  /** The route answered (any status); `keys` is the batch it was given. */
  | { kind: 'answered'; status: number; text: string; batchId: string; keys: string[] }
  /** Every upload attempt failed; each attempt's batch was deleted. */
  | { kind: 'upload-failed'; batchIds: string[] }
  /** The POST left and no answer came: whether the material was made is unknown; the batch was deleted. */
  | { kind: 'unconfirmed'; batchId: string; keys: string[] };

/**
 * Rule 2 and rule 3: upload the photos under a new batch (again under another
 * new batch if an upload fails, UPLOAD_ATTEMPTS in all), then ONE POST for
 * the batch that arrived. Not a 2xx, or no answer: the batch is deleted with
 * the student's session (the route deletes what it was given too; deleting
 * twice is harmless). The photos are not touched: the caller keeps them.
 */
export async function sendPageBatch(photos: readonly Blob[], deps: PageBatchDeps): Promise<PageBatchResult> {
  if (photos.length < 1 || photos.length > MAX_PAGE_PHOTOS) throw new Error(`a batch is 1 to ${MAX_PAGE_PHOTOS} photos`);
  const tried: string[] = [];
  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt++) {
    const batchId = deps.newBatchId();
    tried.push(batchId);
    const keys = batchKeys(deps.userId, batchId, photos.length);
    let uploaded = false;
    try {
      for (let i = 0; i < photos.length; i++) {
        deps.onProgress?.({ stage: 'uploading', done: i, total: photos.length });
        await deps.upload(keys[i], photos[i]);
      }
      deps.onProgress?.({ stage: 'uploading', done: photos.length, total: photos.length });
      uploaded = true;
    } catch {
      await safely(() => deps.remove(keys));
    }
    if (!uploaded) continue;

    deps.onProgress?.({ stage: 'reading' });
    let answer: { status: number; text: string };
    try {
      answer = await deps.read(keys);
    } catch {
      await safely(() => deps.remove(keys));
      return { kind: 'unconfirmed', batchId, keys };
    }
    if (answer.status < 200 || answer.status >= 300) await safely(() => deps.remove(keys));
    return { kind: 'answered', status: answer.status, text: answer.text, batchId, keys };
  }
  return { kind: 'upload-failed', batchIds: tried };
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
