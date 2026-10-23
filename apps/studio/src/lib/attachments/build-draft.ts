import type { Sha256 } from '@sdd-studio/protocol';
import { blobToBase64, bytesToBase64, sha256Hex } from './bytes';
import type { Classified } from './classify';
import type { DraftAttachment } from './draft-attachment';
import { browserImageCodec, encodeImage, type ImageCodec } from './encode-image';

type Accepted = Extract<Classified, { ok: true }>;

const asBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => bytes as Uint8Array<ArrayBuffer>;

export async function buildDraftAttachment(
  classified: Accepted,
  file: File,
  id: string,
  codec: ImageCodec = browserImageCodec,
  createPreviewUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
): Promise<DraftAttachment> {
  const base = { id, name: classified.name, original: file, size: classified.size };
  if (classified.kind === 'image') {
    const image = await encodeImage(file, classified.mime, undefined, codec);
    const sha256 = (await sha256Hex(new Uint8Array(await image.blob.arrayBuffer()))) as Sha256;
    return {
      ...base,
      kind: 'image',
      mime: image.mime,
      size: image.blob.size,
      encoded: {
        upload: { kind: 'image', name: classified.name, mime: image.mime, data: await blobToBase64(image.blob), width: image.width, height: image.height },
        sha256,
      },
      previewUrl: createPreviewUrl(image.blob),
    };
  }
  if (classified.kind === 'pdf') {
    return {
      ...base,
      kind: 'pdf',
      mime: classified.mime,
      encoded: {
        upload: { kind: 'pdf', name: classified.name, mime: classified.mime, data: bytesToBase64(classified.bytes) },
        sha256: (await sha256Hex(asBytes(classified.bytes))) as Sha256,
      },
    };
  }
  return {
    ...base,
    kind: 'text',
    mime: classified.mime,
    encoded: {
      upload: { kind: 'text', name: classified.name, mime: classified.mime, text: classified.text },
      sha256: (await sha256Hex(new TextEncoder().encode(classified.text))) as Sha256,
    },
  };
}
