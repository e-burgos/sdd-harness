import {
  EXT_BY_MIME,
  FRAME_BUDGET_BYTES,
  ImageMime,
  MAX_ATTACHMENTS,
  TEXT_ATTACHMENT_EXTENSIONS,
  type TextMime,
} from '@sdd-studio/protocol';

const FRAME_OVERHEAD_BYTES = 16_384;
export const PDF_MAX_BYTES = Math.floor((FRAME_BUDGET_BYTES - FRAME_OVERHEAD_BYTES) / 4) * 3;
export const TEXT_MAX_BYTES = FRAME_BUDGET_BYTES - FRAME_OVERHEAD_BYTES;

export type ClassifyFailure = 'unsupported' | 'pdf-too-large' | 'text-too-large' | 'empty';

export type Classified =
  | { ok: true; kind: 'image'; mime: ImageMime; name: string; bytes: Uint8Array; size: number }
  | { ok: true; kind: 'pdf'; mime: 'application/pdf'; name: string; bytes: Uint8Array; size: number }
  | { ok: true; kind: 'text'; mime: TextMime; name: string; text: string; size: number }
  | { ok: false; reason: ClassifyFailure; name: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((b, i) => bytes[offset + i] === b);

function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

const isPdf = (bytes: Uint8Array): boolean => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(TEXT_ATTACHMENT_EXTENSIONS);
const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set(['md', 'mdx', 'markdown']);

function decodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return text.includes('\0') ? null : text;
  } catch {
    return null;
  }
}

const pad = (n: number): string => String(n).padStart(2, '0');
const clock = (now: Date): string => `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const CLIPBOARD_IMAGE_NAME = /^image\.[a-z0-9]+$/i;

export function displayNameFor(name: string, mime: keyof typeof EXT_BY_MIME, now: Date): string {
  const trimmed = name.trim();
  const usable = trimmed.length > 0 && trimmed.length <= 255 && !CLIPBOARD_IMAGE_NAME.test(trimmed);
  return usable ? trimmed : `pasted-${clock(now)}.${EXT_BY_MIME[mime]}`;
}

export async function classify(file: File, now: Date = new Date()): Promise<Classified> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fail = (reason: ClassifyFailure): Classified => ({ ok: false, reason, name: file.name });

  const image = sniffImage(bytes);
  if (image && file.type === image) {
    return { ok: true, kind: 'image', mime: image, name: displayNameFor(file.name, image, now), bytes, size: bytes.byteLength };
  }
  if (isPdf(bytes)) {
    if (bytes.byteLength > PDF_MAX_BYTES) return fail('pdf-too-large');
    return { ok: true, kind: 'pdf', mime: 'application/pdf', name: displayNameFor(file.name, 'application/pdf', now), bytes, size: bytes.byteLength };
  }
  const extension = extensionOf(file.name);
  if (TEXT_EXTENSIONS.has(extension)) {
    if (bytes.byteLength > TEXT_MAX_BYTES) return fail('text-too-large');
    const text = decodeUtf8Strict(bytes);
    if (text === null) return fail('unsupported');
    if (text.length === 0) return fail('empty');
    const mime: TextMime = MARKDOWN_EXTENSIONS.has(extension) ? 'text/markdown' : 'text/plain';
    return { ok: true, kind: 'text', mime, name: file.name, text, size: bytes.byteLength };
  }
  return fail('unsupported');
}

export function splitByCapacity<T>(files: T[], currentCount: number): { accepted: T[]; rejected: T[] } {
  const room = Math.max(0, MAX_ATTACHMENTS - currentCount);
  return { accepted: files.slice(0, room), rejected: files.slice(room) };
}
