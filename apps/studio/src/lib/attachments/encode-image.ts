import { IMAGE_MAX_SIDE, type ImageMime } from '@sdd-studio/protocol';

export interface EncodeStep {
  maxSide: number;
  quality: number;
}

export interface EncodedImage {
  blob: Blob;
  mime: ImageMime;
  width: number;
  height: number;
}

export interface DecodedBitmap {
  width: number;
  height: number;
}

export interface ImageCodec {
  decode(blob: Blob): Promise<DecodedBitmap>;
  encode(bitmap: DecodedBitmap, width: number, height: number, type: ImageMime, quality: number): Promise<Blob | null>;
  release?(bitmap: DecodedBitmap): void;
}

export class ImageEncodeError extends Error {
  constructor() {
    super('image-encode-failed');
    this.name = 'ImageEncodeError';
  }
}

export const FIRST_STEP: EncodeStep = { maxSide: IMAGE_MAX_SIDE, quality: 0.85 };

const bitmapSources = new WeakMap<DecodedBitmap, ImageBitmap>();

export const browserImageCodec: ImageCodec = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob);
    const handle: DecodedBitmap = { width: bitmap.width, height: bitmap.height };
    bitmapSources.set(handle, bitmap);
    return handle;
  },
  async encode(handle, width, height, type, quality) {
    const source = bitmapSources.get(handle);
    if (!source) return null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(source, 0, 0, width, height);
      return canvas.convertToBlob({ type, quality });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  },
  release(handle) {
    bitmapSources.get(handle)?.close();
    bitmapSources.delete(handle);
  },
};

function targetSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encodeWithFallback(codec: ImageCodec, bitmap: DecodedBitmap, size: { width: number; height: number }, source: ImageMime, quality: number): Promise<EncodedImage> {
  const attempts: { type: ImageMime; quality: number }[] =
    source === 'image/jpeg'
      ? [{ type: 'image/jpeg', quality }]
      : [{ type: 'image/webp', quality: 0.9 }, { type: 'image/png', quality: 1 }];
  for (const attempt of attempts) {
    const blob = await codec.encode(bitmap, size.width, size.height, attempt.type, attempt.quality);
    if (blob && blob.type === attempt.type && blob.size > 0) return { blob, mime: attempt.type, ...size };
  }
  throw new ImageEncodeError();
}

export async function encodeImage(
  original: Blob,
  mime: ImageMime,
  step: EncodeStep = FIRST_STEP,
  codec: ImageCodec = browserImageCodec,
): Promise<EncodedImage> {
  let bitmap: DecodedBitmap;
  try {
    bitmap = await codec.decode(original);
  } catch {
    throw new ImageEncodeError();
  }
  try {
    const size = targetSize(bitmap.width, bitmap.height, step.maxSide);
    const fitsAsIs = size.width === bitmap.width && size.height === bitmap.height;
    if (mime === 'image/gif' && fitsAsIs) {
      return { blob: original, mime, ...size };
    }
    return await encodeWithFallback(codec, bitmap, size, mime, step.quality);
  } catch (error) {
    throw error instanceof ImageEncodeError ? error : new ImageEncodeError();
  } finally {
    codec.release?.(bitmap);
  }
}
