/**
 * THE CAMERA SCREEN'S ENCODER, IN THE BROWSER (rule 1 of src/lib/page-photos.ts):
 * a photo in, a baseline JPEG out, upright, its long side at most
 * PHOTO_LONG_SIDE, no metadata.
 *
 * DOES THE DECODER ALREADY TURN THE PHOTO UPRIGHT? Browsers differ, and have
 * changed (WebKit and Chromium now apply the EXIF orientation when decoding
 * an image; older ones did not). Rather than trust a version, the answer is
 * MEASURED once per page: a 2 x 1 JPEG tagged orientation 6 (a quarter turn)
 * is decoded the same way every photo is; if it comes back 1 x 2 the decoder
 * turned it and the photo is drawn as decoded, otherwise the transform for
 * the photo's own tag is applied here. Either way the output is upright and
 * carries no tag.
 *
 * WHAT IS CHECKED ON THE WAY OUT: the bytes must be a baseline JPEG (SOF0).
 * The canvas encoders of WebKit and Chromium write one; if one ever wrote a
 * progressive file the server would refuse it, so the photo is refused HERE,
 * with a sentence, before anything is uploaded.
 *
 * `scripts/verify-page-photo-encode.mjs` runs this file in a real browser on
 * photos tagged 1, 3, 6 and 8.
 */
import { fitLongSide, isBaselineJpeg, orientationTransform, PHOTO_JPEG_QUALITY, PHOTO_LONG_SIDE, readJpegOrientation, uprightSize } from '@/lib/page-photos';

/** A 2 x 1 red JPEG tagged EXIF orientation 6, 305 bytes. */
const ORIENTATION_PROBE =
  '/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCAANSP/9k=';

export class PhotoEncodeError extends Error {
  constructor(public readonly code: 'unreadable' | 'not-baseline') {
    super(code);
    this.name = 'PhotoEncodeError';
  }
}

export interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to an <img>: some decoders refuse a Blob in createImageBitmap */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoEncodeError('unreadable');
  }
}

let probe: Promise<boolean> | null = null;

/** Whether this browser's decoder applies the EXIF orientation itself (measured once). */
export function decoderAppliesOrientation(): Promise<boolean> {
  if (!probe) {
    probe = (async () => {
      const bytes = Uint8Array.from(atob(ORIENTATION_PROBE), (c) => c.charCodeAt(0));
      const d = await decode(new Blob([bytes], { type: 'image/jpeg' }));
      d.close();
      return d.width === 1 && d.height === 2;
    })().catch(() => false);
  }
  return probe;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoEncodeError('unreadable'))), 'image/jpeg', quality);
  });
}

/**
 * Re-encode one photo (rule 1). Throws PhotoEncodeError: `unreadable` when the
 * browser cannot decode it, `not-baseline` when the encoder's output is not a
 * baseline JPEG.
 */
export async function reencodePagePhoto(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const tagged = readJpegOrientation(head);
  const applied = await decoderAppliesOrientation();
  const d = await decode(file);
  try {
    // The decoder turned it already: draw as decoded.
    return await encodeUpright(d, applied ? 1 : tagged);
  } finally {
    d.close();
  }
}

/**
 * The second half, apart so the proof can run it on pixels no decoder has
 * turned: draw `d` (as stored) upright under `orientation`, fitted to
 * PHOTO_LONG_SIDE, on white, and encode it as a baseline JPEG.
 */
export async function encodeUpright(d: Decoded, orientation: number): Promise<{ blob: Blob; width: number; height: number }> {
  if (!d.width || !d.height) throw new PhotoEncodeError('unreadable');
  const upright = uprightSize(d.width, d.height, orientation);
  const out = fitLongSide(upright.width, upright.height, PHOTO_LONG_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoEncodeError('unreadable');
  // A PNG may be transparent; a JPEG has no alpha, so paper white under it.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const t = orientationTransform(orientation, out.width, out.height);
  ctx.setTransform(...t.matrix);
  ctx.drawImage(d.source, 0, 0, t.drawWidth, t.drawHeight);
  const blob = await toJpeg(canvas, PHOTO_JPEG_QUALITY);
  // Free the canvas's memory at once: ten of them would add up on a phone.
  canvas.width = 0;
  canvas.height = 0;
  if (!isBaselineJpeg(new Uint8Array(await blob.arrayBuffer()))) throw new PhotoEncodeError('not-baseline');
  return { blob, width: out.width, height: out.height };
}
