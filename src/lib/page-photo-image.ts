/**
 * ONE PHOTO, MADE READY FOR THE MODEL (the rules: src/lib/page-reader.ts).
 *
 * The bytes reach this function only after `readPhotoHeader` has named them a
 * baseline JPEG or a non-interlaced PNG and `headerRefusal` has held their
 * header to the pixel, side and shape bounds, so no decoder ever sees a HEIC
 * file or a decompression bomb. Then, as G2's runner did with PIL (EXIF
 * transpose, Lanczos resize, JPEG q90):
 *   1. the header again, through libvips this time: it must agree the photo
 *      is a JPEG or a PNG, not progressive or interlaced, within the same
 *      bounds (`sizeRefusal`), and `limitInputPixels` is a further pixel cap
 *      that libvips enforces when it opens the header, before any decode;
 *   2. the photo turned upright from its EXIF orientation (`rotate()` with no
 *      angle, the same as `autoOrient()`), so the model reads lines the right
 *      way up and the fit below uses the upright size (sharp swaps the resize
 *      target for a quarter turn, so the output is exactly that size);
 *   3. resized to exactly the size `fitToTier` gives (the model's image tier;
 *      sharp's default kernel is lanczos3), never enlarged;
 *   4. flattened on white (a PNG with transparency), in sRGB, written as JPEG
 *      quality 90. sharp writes no metadata unless asked (keepMetadata 0), so
 *      the EXIF block, GPS position included, the XMP and the ICC profile
 *      never leave for the model.
 *
 * ONE DECODE AT A TIME IN THE WHOLE PROCESS, not per request: Vercel's Fluid
 * compute runs several requests in one instance (2 GB by default), and each
 * decode within the bounds above can take a few hundred MB.
 *
 * TIME: `timeout` bounds the evaluation of the output image. It cannot bound
 * the work a decoder does before that (a progressive JPEG's scans are read
 * first, which is one reason those are refused), and the reading deadline in
 * src/lib/page-reader-server.ts is what bounds the whole batch.
 *
 * ONLY TWO DECODERS. sharp 0.34.5 is subject to GHSA-f88m-g3jw-g9cj (High,
 * 2026-07-17: libvips CVE-2026-33327, -33328, -35590, -35591, fixed in 0.35)
 * for untrusted input. 0.35.x cannot be used on Vercel yet: it moved its entry
 * point to dist/index.cjs, which Next's file tracing does not follow, so
 * libvips is left out of the function (vercel/next.js#96064, open). So this
 * module turns every libvips loader off except the JPEG and PNG buffer
 * loaders (sharp's documented allowlist; the advisory's workaround blocks
 * only GIF, TIFF and VIPS): whatever the bytes claim, no other parser runs.
 * `block` is process-wide; nothing else in this app decodes images with sharp.
 */
import sharp from 'sharp';
import { fitToTier, MAX_PHOTO_PIXELS, sizeRefusal } from '@/lib/page-reader';

sharp.block({ operation: ['VipsForeignLoad'] });
sharp.unblock({ operation: ['VipsForeignLoadJpegBuffer', 'VipsForeignLoadPngBuffer'] });

// libvips caches decoded images per process. A function instance serves many
// requests, and one student's pages have no reason to stay in its memory.
sharp.cache(false);

/** Seconds the output image's evaluation (turn, resize, encode) may take. */
export const PHOTO_TIMEOUT_S = 10;

export interface ModelPhoto {
  jpeg: Buffer;
  width: number;
  height: number;
}

// The process-wide queue: each photo waits for the one before it to finish.
let queue: Promise<unknown> = Promise.resolve();
function oneDecodeAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * `signal`: the request's deadline. A photo still waiting for its turn when
 * the deadline passes is never decoded: it gives the slot to the next one,
 * so an expired request cannot hold up live ones.
 */
export function photoForModel(bytes: Uint8Array, signal?: AbortSignal): Promise<ModelPhoto> {
  return oneDecodeAtATime(() =>
    signal?.aborted ? Promise.reject(new Error('the deadline passed before this photo was decoded')) : prepare(bytes)
  );
}

async function prepare(bytes: Uint8Array): Promise<ModelPhoto> {
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const options = { limitInputPixels: MAX_PHOTO_PIXELS, failOn: 'error' as const };
  const meta = await sharp(input, options).metadata();
  if (meta.format !== 'jpeg' && meta.format !== 'png') throw new Error(`not a JPEG or PNG to libvips: ${meta.format}`);
  if (!meta.width || !meta.height) throw new Error('the photo has no size in its header');
  if (meta.isProgressive) throw new Error('progressive or interlaced to libvips');
  const refusal = sizeRefusal(meta.width, meta.height);
  if (refusal) throw new Error(`${refusal} to libvips: ${meta.width} x ${meta.height}`);
  // EXIF orientations 5 to 8 turn the photo a quarter: its upright width is its stored height.
  const quarterTurn = (meta.orientation ?? 1) >= 5;
  const upright = quarterTurn ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  const size = fitToTier(upright.width, upright.height);
  const jpeg = await sharp(input, options)
    .rotate()
    .resize(size.width, size.height, { fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg({ quality: 90 })
    .timeout({ seconds: PHOTO_TIMEOUT_S })
    .toBuffer();
  return { jpeg, width: size.width, height: size.height };
}
