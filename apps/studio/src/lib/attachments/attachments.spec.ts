import { FRAME_BUDGET_BYTES, MAX_ATTACHMENTS } from '@sdd-studio/protocol';
import { classify, displayNameFor, PDF_MAX_BYTES, splitByCapacity, TEXT_MAX_BYTES } from './classify';
import { encodeImage, ImageEncodeError, type ImageCodec } from './encode-image';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const file = (content: number[] | string | Uint8Array<ArrayBuffer>, name: string, type = '') =>
  new File([Array.isArray(content) ? new Uint8Array(content) : content], name, { type });

describe('classify', () => {
  it('accepts images only when MIME and magic bytes agree', async () => {
    expect(await classify(file(PNG, 'a.png', 'image/png'))).toMatchObject({ ok: true, kind: 'image', mime: 'image/png' });
    expect(await classify(file(JPEG, 'a.jpg', 'image/jpeg'))).toMatchObject({ ok: true, mime: 'image/jpeg' });
    expect(await classify(file(GIF, 'a.gif', 'image/gif'))).toMatchObject({ ok: true, mime: 'image/gif' });
    expect(await classify(file(WEBP, 'a.webp', 'image/webp'))).toMatchObject({ ok: true, mime: 'image/webp' });
    expect(await classify(file(PNG, 'a.png', 'image/jpeg'))).toMatchObject({ ok: false, reason: 'unsupported' });
    expect(await classify(file('not an image', 'a.png', 'image/png'))).toMatchObject({ ok: false });
  });

  it('accepts PDFs by magic bytes and rejects those over the raw limit', async () => {
    expect(await classify(file(PDF, 'a.pdf', 'application/pdf'))).toMatchObject({ ok: true, kind: 'pdf' });
    const atLimit = new Uint8Array(PDF_MAX_BYTES);
    atLimit.set(PDF);
    expect(await classify(file(atLimit, 'big.pdf'))).toMatchObject({ ok: true, kind: 'pdf' });
    const over = new Uint8Array(PDF_MAX_BYTES + 1);
    over.set(PDF);
    expect(await classify(file(over, 'big.pdf'))).toMatchObject({ ok: false, reason: 'pdf-too-large' });
  });

  it('accepts text by extension with strict UTF-8 and picks markdown', async () => {
    expect(await classify(file('hola', 'a.md'))).toMatchObject({ ok: true, kind: 'text', mime: 'text/markdown', text: 'hola' });
    expect(await classify(file('x', 'a.ts'))).toMatchObject({ ok: true, mime: 'text/plain' });
    expect(await classify(file(new Uint8Array([0xff, 0xfe, 0x41]), 'a.txt'))).toMatchObject({ ok: false, reason: 'unsupported' });
    expect(await classify(file('a\0b', 'a.txt'))).toMatchObject({ ok: false });
    expect(await classify(file('', 'a.txt'))).toMatchObject({ ok: false, reason: 'empty' });
    expect(await classify(file('x'.repeat(TEXT_MAX_BYTES + 1), 'a.txt'))).toMatchObject({ ok: false, reason: 'text-too-large' });
    expect(TEXT_MAX_BYTES).toBeLessThan(FRAME_BUDGET_BYTES);
  });

  it('rejects unknown types', async () => {
    expect(await classify(file([1, 2, 3], 'a.exe'))).toMatchObject({ ok: false, reason: 'unsupported' });
    expect(await classify(file([1, 2, 3], 'noext'))).toMatchObject({ ok: false });
  });

  it('names clipboard images pasted-HHmmss', () => {
    const now = new Date(2026, 0, 2, 3, 4, 5);
    expect(displayNameFor('image.png', 'image/png', now)).toBe('pasted-030405.png');
    expect(displayNameFor('', 'image/jpeg', now)).toBe('pasted-030405.jpg');
    expect(displayNameFor('foto.png', 'image/png', now)).toBe('foto.png');
  });

  it('keeps at most five attachments and reports the surplus', () => {
    const { accepted, rejected } = splitByCapacity([1, 2, 3, 4], MAX_ATTACHMENTS - 2);
    expect(accepted).toEqual([1, 2]);
    expect(rejected).toEqual([3, 4]);
    expect(splitByCapacity([1], MAX_ATTACHMENTS).accepted).toEqual([]);
  });
});

function fakeCodec(width: number, height: number, produce: (type: string) => Blob | null = (type) => new Blob(['clean'], { type })): ImageCodec & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    decode: async () => ({ width, height }),
    encode: async (_b, w, h, type, quality) => {
      calls.push([w, h, type, quality]);
      return produce(type);
    },
  };
}

describe('encodeImage', () => {
  it('shrinks the long side to 1568 and re-encodes JPEG without metadata', async () => {
    const original = new Blob([new Uint8Array(JPEG), 'GPSLatitude'], { type: 'image/jpeg' });
    const codec = fakeCodec(3136, 1568);
    const out = await encodeImage(original, 'image/jpeg', undefined, codec);
    expect(out).toMatchObject({ mime: 'image/jpeg', width: 1568, height: 784 });
    expect(out.blob).not.toBe(original);
    expect(await out.blob.text()).not.toContain('GPS');
    expect(codec.calls[0]).toEqual([1568, 784, 'image/jpeg', 0.85]);
  });

  it('re-encodes PNG to webp and falls back to png when webp is unsupported', async () => {
    const original = new Blob([new Uint8Array(PNG)], { type: 'image/png' });
    expect((await encodeImage(original, 'image/png', undefined, fakeCodec(100, 100))).mime).toBe('image/webp');
    const noWebp = fakeCodec(100, 100, (type) => new Blob(['x'], { type: type === 'image/webp' ? 'image/png' : type }));
    const out = await encodeImage(original, 'image/png', undefined, noWebp);
    expect(out.mime).toBe('image/png');
    expect(out.blob).not.toBe(original);
  });

  it('never returns the original when the re-encode fails', async () => {
    const original = new Blob([new Uint8Array(JPEG)], { type: 'image/jpeg' });
    await expect(encodeImage(original, 'image/jpeg', undefined, fakeCodec(10, 10, () => null))).rejects.toBeInstanceOf(ImageEncodeError);
    const broken: ImageCodec = { decode: async () => { throw new Error('bad'); }, encode: async () => null };
    await expect(encodeImage(original, 'image/jpeg', undefined, broken)).rejects.toBeInstanceOf(ImageEncodeError);
  });

  it('keeps a small GIF as is and flattens a large one to a still frame', async () => {
    const gif = new Blob([new Uint8Array(GIF)], { type: 'image/gif' });
    const small = await encodeImage(gif, 'image/gif', undefined, fakeCodec(200, 100));
    expect(small.blob).toBe(gif);
    const large = await encodeImage(gif, 'image/gif', undefined, fakeCodec(4000, 2000));
    expect(large.blob).not.toBe(gif);
    expect(large.mime).toBe('image/webp');
    expect(Math.max(large.width, large.height)).toBe(1568);
  });
});
