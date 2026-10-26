import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { EXT_BY_MIME, MAX_FRAME_BYTES, type AttachmentMime, type AttachmentRef, type AttachmentUpload, type Sha256 } from '@sdd-studio/protocol';

export interface AttachmentStore {
  init(): Promise<void>;
  put(upload: AttachmentUpload): Promise<AttachmentRef>;
  read(sha256: Sha256, mime: AttachmentMime): Promise<Uint8Array>;
}

export class AttachmentError extends Error {
  constructor(
    readonly code: 'bad-request' | 'not-found' | 'internal',
    message: string,
  ) {
    super(message);
  }
}

const WARN_BYTES = 1024 ** 3;
const NOT_AVAILABLE = 'attachment not available';

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

const SIGNATURES: Record<AttachmentMime, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/gif': (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  'image/webp': (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
  'application/pdf': (b) => startsWith(b, ascii('%PDF-')),
  'text/plain': (b) => !b.includes(0),
  'text/markdown': (b) => !b.includes(0),
};

const bytesOf = (upload: AttachmentUpload): Uint8Array =>
  upload.kind === 'text' ? new TextEncoder().encode(upload.text) : Buffer.from(upload.data, 'base64');

const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const isInside = (parent: string, child: string): boolean => child === parent || child.startsWith(parent + path.sep);

export function createAttachmentStore(root: string, opts: { onWarn?: (message: string) => void } = {}): AttachmentStore {
  const studioDir = path.join(root, '.sdd-studio');
  const dir = path.join(studioDir, 'attachments');
  const onWarn = opts.onWarn ?? ((message) => console.warn('[sdd-studio]', message));

  const totalBytes = async (): Promise<number> => {
    let total = 0;
    for (const name of await readdir(dir)) {
      const info = await stat(path.join(dir, name)).catch(() => null);
      if (info?.isFile()) total += info.size;
    }
    return total;
  };

  const warnWhenLarge = (): void => {
    totalBytes()
      .then((total) => {
        if (total > WARN_BYTES) onWarn(`attachment store is ${Math.round(total / 1024 ** 2)} MiB; delete .sdd-studio/attachments to reclaim space`);
      })
      .catch(() => undefined);
  };

  const alreadyStored = async (file: string, size: number): Promise<boolean> => {
    const info = await stat(file).catch(() => null);
    return !!info?.isFile() && info.size === size;
  };

  const writeAtomically = async (file: string, bytes: Uint8Array): Promise<void> => {
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(tmp, 'wx');
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
      await rename(tmp, file);
    } catch {
      await unlink(tmp).catch(() => undefined);
      // Windows refuses to rename over a file another writer just created; the name is the content hash, so it is already stored.
      if (await alreadyStored(file, bytes.length)) return;
      throw new AttachmentError('internal', 'attachment could not be saved');
    }
  };

  return {
    async init() {
      await mkdir(dir, { recursive: true });
      warnWhenLarge();
    },

    async put(upload) {
      const bytes = bytesOf(upload);
      if (!SIGNATURES[upload.mime](bytes)) {
        throw new AttachmentError('bad-request', `attachment "${upload.name}" does not match ${upload.mime}`);
      }
      if (bytes.length > MAX_FRAME_BYTES) {
        throw new AttachmentError('bad-request', `attachment "${upload.name}" is too large`);
      }
      const sha256 = sha256Of(bytes);
      const file = path.join(dir, `${sha256}.${EXT_BY_MIME[upload.mime]}`);
      if (!(await alreadyStored(file, bytes.length))) {
        try {
          await mkdir(dir, { recursive: true });
        } catch {
          throw new AttachmentError('internal', 'attachment could not be saved');
        }
        await writeAtomically(file, bytes);
      }
      return {
        sha256,
        kind: upload.kind,
        mime: upload.mime,
        name: upload.name,
        size: bytes.length,
        ...(upload.kind === 'image' ? { width: upload.width, height: upload.height } : {}),
      };
    },

    async read(sha256, mime) {
      const unavailable = new AttachmentError('not-found', NOT_AVAILABLE);
      try {
        const rootReal = await realpath(root);
        const dirReal = await realpath(dir);
        if (!isInside(path.join(rootReal, '.sdd-studio'), dirReal)) throw unavailable;
        const file = path.join(dirReal, `${sha256}.${EXT_BY_MIME[mime]}`);
        if ((await realpath(file)) !== file) throw unavailable;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = await handle.stat();
          if (!info.isFile() || info.size > MAX_FRAME_BYTES) throw unavailable;
          const bytes = await handle.readFile();
          if (sha256Of(bytes) !== sha256) throw unavailable;
          return bytes;
        } finally {
          await handle.close();
        }
      } catch {
        throw unavailable;
      }
    },
  };
}
