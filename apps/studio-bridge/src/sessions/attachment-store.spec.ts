import { createHash } from 'node:crypto';
import { mkdir, open, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_FRAME_BYTES, type AttachmentUpload } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { createAttachmentStore, type AttachmentStore } from './attachment-store';

let root: string;
let cleanup: () => Promise<void>;
let store: AttachmentStore;
const attachmentsDir = () => path.join(root, '.sdd-studio', 'attachments');

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  store = createAttachmentStore(root);
  await store.init();
});
afterEach(() => cleanup());

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const image = (mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', bytes: number[], name = 'a'): AttachmentUpload => ({
  kind: 'image', name, mime, data: b64(bytes), width: 10, height: 20,
});
const pdf = (bytes: number[], name = 'doc.pdf'): AttachmentUpload => ({ kind: 'pdf', name, mime: 'application/pdf', data: b64(bytes) });
const text = (value: string, mime: 'text/plain' | 'text/markdown' = 'text/plain'): AttachmentUpload => ({ kind: 'text', name: 'n.txt', mime, text: value });

describe('attachment store put', () => {
  it.each([
    ['image/png', PNG, 'png'],
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 1], 'jpg'],
    ['image/gif', [...ascii('GIF89a'), 1], 'gif'],
    ['image/webp', [...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')], 'webp'],
  ] as const)('stores %s with the right magic bytes', async (mime, bytes, ext) => {
    const ref = await store.put(image(mime, [...bytes]));
    expect(ref).toMatchObject({ kind: 'image', mime, size: bytes.length, width: 10, height: 20 });
    const file = path.join(attachmentsDir(), `${ref.sha256}.${ext}`);
    expect([...(await readFile(file))]).toEqual([...bytes]);
    expect(ref.sha256).toBe(sha(Buffer.from(bytes)));
  });

  it('stores a PDF and text (utf-8 bytes, markdown extension)', async () => {
    const pdfRef = await store.put(pdf([...ascii('%PDF-1.4'), 9]));
    expect(pdfRef).toMatchObject({ kind: 'pdf', mime: 'application/pdf' });
    expect(pdfRef.width).toBeUndefined();
    const textRef = await store.put(text('héllo', 'text/markdown'));
    expect(textRef.size).toBe(Buffer.byteLength('héllo'));
    expect(await readFile(path.join(attachmentsDir(), `${textRef.sha256}.md`), 'utf8')).toBe('héllo');
  });

  it('rejects content that does not match the declared mime without echoing data or paths', async () => {
    const error = await store.put(image('image/png', [1, 2, 3], 'evil.png')).catch((e: Error) => e);
    expect(error).toMatchObject({ code: 'bad-request', message: 'attachment "evil.png" does not match image/png' });
    await expect(store.put(pdf([1, 2, 3]))).rejects.toMatchObject({ code: 'bad-request' });
    await expect(store.put(text('a\u0000b'))).rejects.toMatchObject({ code: 'bad-request' });
    expect(await readdir(attachmentsDir())).toEqual([]);
  });

  it('rejects bytes above the frame limit', async () => {
    const big = [...ascii('%PDF-'), ...new Array(MAX_FRAME_BYTES).fill(1)];
    await expect(store.put(pdf(big))).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('dedupes by hash: the second put does not rewrite the file', async () => {
    const first = await store.put(image('image/png', PNG, 'one'));
    const file = path.join(attachmentsDir(), `${first.sha256}.png`);
    const before = await stat(file);
    const second = await store.put(image('image/png', PNG, 'two'));
    expect(second.sha256).toBe(first.sha256);
    expect(second.name).toBe('two');
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
    expect(await readdir(attachmentsDir())).toHaveLength(1);
  });

  it('concurrent identical puts leave exactly one file and no tmp leftovers', async () => {
    await Promise.all([1, 2, 3, 4].map(() => store.put(image('image/png', PNG))));
    const names = await readdir(attachmentsDir());
    expect(names).toHaveLength(1);
    expect(names[0]).not.toMatch(/\.tmp$/);
  });

  it('reports a disk failure generically and cleans the tmp file', async () => {
    await writeFile(path.join(root, '.sdd-studio', 'blocker'), 'x');
    const broken = createAttachmentStore(path.join(root, '.sdd-studio', 'blocker'));
    const error = await broken.put(image('image/png', PNG)).catch((e: Error) => e);
    expect(error).toMatchObject({ code: 'internal', message: 'attachment could not be saved' });
  });

  it('init warns without blocking when the store exceeds 1 GiB', async () => {
    const warn = vi.fn();
    const big = createAttachmentStore(root, { onWarn: warn });
    await mkdir(attachmentsDir(), { recursive: true });
    const handle = await open(path.join(attachmentsDir(), 'huge.bin'), 'w');
    await handle.truncate(1024 ** 3 + 1);
    await handle.close();
    await big.init();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    expect(await readdir(attachmentsDir())).toContain('huge.bin');
  });

  it('read returns the stored bytes', async () => {
    const ref = await store.put(image('image/png', PNG));
    expect([...(await store.read(ref.sha256 as never, 'image/png'))]).toEqual(PNG);
  });
});

describe('attachment store read (R-C2-2)', () => {
  const notAvailable = { code: 'not-found', message: 'attachment not available' };

  it('rejects a planted symlink', async () => {
    const hash = sha(Buffer.from('target'));
    await symlink('/etc/hosts', path.join(attachmentsDir(), `${hash}.png`));
    await expect(store.read(hash as never, 'image/png')).rejects.toMatchObject(notAvailable);
  });

  it('rejects a directory named like a sha', async () => {
    const hash = 'a'.repeat(64);
    await mkdir(path.join(attachmentsDir(), `${hash}.png`));
    await expect(store.read(hash as never, 'image/png')).rejects.toMatchObject(notAvailable);
  });

  it('rejects a file above the frame limit', async () => {
    const hash = 'b'.repeat(64);
    await writeFile(path.join(attachmentsDir(), `${hash}.pdf`), Buffer.alloc(MAX_FRAME_BYTES + 1));
    await expect(store.read(hash as never, 'application/pdf')).rejects.toMatchObject(notAvailable);
  });

  it('rejects altered content (hash mismatch)', async () => {
    const ref = await store.put(image('image/png', PNG));
    await writeFile(path.join(attachmentsDir(), `${ref.sha256}.png`), Buffer.from([...PNG, 99]));
    await expect(store.read(ref.sha256 as never, 'image/png')).rejects.toMatchObject(notAvailable);
  });

  it('a different mime resolves to another extension and is not found', async () => {
    const ref = await store.put(image('image/png', PNG));
    await expect(store.read(ref.sha256 as never, 'image/jpeg')).rejects.toMatchObject(notAvailable);
  });

  it('rejects an attachments directory that is a symlink out of .sdd-studio', async () => {
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    const hash = sha(Buffer.from(PNG));
    await writeFile(path.join(outside, `${hash}.png`), Buffer.from(PNG));
    await rm(attachmentsDir(), { recursive: true });
    await symlink(outside, attachmentsDir());
    await expect(store.read(hash as never, 'image/png')).rejects.toMatchObject(notAvailable);
  });

  it('a missing file is not available', async () => {
    await expect(store.read('c'.repeat(64) as never, 'image/png')).rejects.toMatchObject(notAvailable);
  });
});
