import { FRAME_BUDGET_BYTES, type AttachmentUpload } from '@sdd-studio/protocol';
import { blobToBase64 } from './bytes';
import { PDF_MAX_BYTES } from './classify';
import type { DraftAttachment } from './draft-attachment';
import type { ImageCodec } from './encode-image';
import { BUDGET_LADDER, commandFrameBytes, fitFrameBudget, FrameBudgetError } from './frame-budget';

const SHA = 'a'.repeat(64);
const codec: ImageCodec = {
  decode: async () => ({ width: 3000, height: 3000 }),
  encode: async (_b, w, _h, type, quality) => new Blob([new Uint8Array(Math.round(w * quality * 150))], { type }),
};

const build = (uploads: AttachmentUpload[]) => ({ cmd: 'thread.send', threadId: 't1', text: 'hola', attachments: uploads, refs: { agents: [], skills: [] } });

async function image(id: string, rawBytes: number): Promise<DraftAttachment> {
  const blob = new Blob([new Uint8Array(rawBytes)], { type: 'image/jpeg' });
  return {
    id, kind: 'image', name: `${id}.jpg`, mime: 'image/jpeg', size: rawBytes, original: blob,
    encoded: { upload: { kind: 'image', name: `${id}.jpg`, mime: 'image/jpeg', data: await blobToBase64(blob), width: 1568, height: 1568 }, sha256: SHA },
  };
}

function pdf(id: string, rawBytes: number): DraftAttachment {
  const bytes = new Uint8Array(rawBytes);
  return {
    id, kind: 'pdf', name: `${id}.pdf`, mime: 'application/pdf', size: rawBytes, original: new Blob([bytes]),
    encoded: { upload: { kind: 'pdf', name: `${id}.pdf`, mime: 'application/pdf', data: 'A'.repeat(Math.ceil(rawBytes / 3) * 4) }, sha256: SHA },
  };
}

describe('commandFrameBytes', () => {
  it('measures the whole serialized command in utf-8 including escapes', () => {
    const quoted = '"\n'.repeat(1000);
    const bytes = commandFrameBytes({ cmd: 'thread.send', threadId: 't', text: quoted });
    expect(bytes).toBeGreaterThan(quoted.length * 2);
    expect(commandFrameBytes({ cmd: 'x', text: 'é' })).toBe(commandFrameBytes({ cmd: 'x', text: 'e' }) + 1);
  });
});

describe('fitFrameBudget', () => {
  it('sends as is when the command already fits', async () => {
    const list = [await image('a', 1000)];
    const out = await fitFrameBudget({ build, attachments: list, codec });
    expect(out[0]).toBe(list[0]!.encoded);
  });

  it('fits five large images by descending the ladder', async () => {
    const list = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((id) => image(id, 300_000)));
    expect(commandFrameBytes(build(list.map((a) => a.encoded.upload)))).toBeGreaterThan(FRAME_BUDGET_BYTES);
    const out = await fitFrameBudget({ build, attachments: list, codec });
    expect(commandFrameBytes(build(out.map((e) => e.upload)))).toBeLessThanOrEqual(FRAME_BUDGET_BYTES);
    expect(out.some((e, i) => e !== list[i]!.encoded)).toBe(true);
  });

  it('re-encodes each attachment and step at most once', async () => {
    const list = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((id) => image(id, 300_000)));
    const encode = vi.fn(codec.encode);
    await fitFrameBudget({ build, attachments: list, codec: { ...codec, encode } });
    expect(encode.mock.calls.length).toBeLessThanOrEqual(list.length * (BUDGET_LADDER.length - 1));
  });

  it('accepts a PDF at the raw limit but not when images cannot make room', async () => {
    const atLimit = pdf('big', PDF_MAX_BYTES);
    const out = await fitFrameBudget({ build, attachments: [atLimit], codec });
    expect(out).toHaveLength(1);
  });

  it('fails with the excess and the two heaviest names when nothing can shrink', async () => {
    const list = [pdf('big', PDF_MAX_BYTES), await image('i1', 40_000), await image('i2', 40_000), await image('i3', 40_000), await image('i4', 40_000)];
    const error = await fitFrameBudget({ build, attachments: list, codec, budget: 700_000 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FrameBudgetError);
    expect((error as FrameBudgetError).excessBytes).toBeGreaterThan(0);
    expect((error as FrameBudgetError).heaviest[0]).toBe('big.pdf');
    expect((error as FrameBudgetError).heaviest).toHaveLength(2);
  });
});
