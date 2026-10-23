import { FRAME_BUDGET_BYTES, type AttachmentUpload, type Sha256 } from '@sdd-studio/protocol';
import { blobToBase64, sha256Hex } from './bytes';
import type { DraftAttachment, EncodedAttachment } from './draft-attachment';
import { browserImageCodec, encodeImage, type EncodeStep, type ImageCodec } from './encode-image';

export const BUDGET_LADDER: readonly EncodeStep[] = [
  { maxSide: 1568, quality: 0.85 },
  { maxSide: 1568, quality: 0.7 },
  { maxSide: 1280, quality: 0.7 },
  { maxSide: 1024, quality: 0.6 },
];

const FILLER_ID = 'x'.repeat(24);
const encoder = new TextEncoder();

export function commandFrameBytes(cmd: object): number {
  return encoder.encode(JSON.stringify({ kind: 'command', id: FILLER_ID, ...cmd })).byteLength;
}

export class FrameBudgetError extends Error {
  constructor(
    readonly excessBytes: number,
    readonly heaviest: string[],
  ) {
    super('frame-budget-exceeded');
    this.name = 'FrameBudgetError';
  }
}

export interface FitOptions {
  build(uploads: AttachmentUpload[]): object;
  attachments: readonly DraftAttachment[];
  codec?: ImageCodec;
  budget?: number;
}

const weightOf = (a: EncodedAttachment): number => ('data' in a.upload ? a.upload.data.length : a.upload.text.length);
const isLadderEligible = (a: DraftAttachment): boolean => a.kind === 'image' && a.encoded.upload.mime !== 'image/gif';

async function encodeAtStep(a: DraftAttachment, step: EncodeStep, codec: ImageCodec): Promise<EncodedAttachment> {
  const image = await encodeImage(a.original, a.original.type as never, step, codec);
  const bytes = new Uint8Array(await image.blob.arrayBuffer());
  return {
    upload: { kind: 'image', name: a.name, mime: image.mime, data: await blobToBase64(image.blob), width: image.width, height: image.height },
    sha256: (await sha256Hex(bytes)) as Sha256,
  };
}

export async function fitFrameBudget(o: FitOptions): Promise<EncodedAttachment[]> {
  const budget = o.budget ?? FRAME_BUDGET_BYTES;
  const codec = o.codec ?? browserImageCodec;
  const current = o.attachments.map((a) => a.encoded);
  const steps = o.attachments.map(() => 0);
  const cache = new Map<string, EncodedAttachment>();
  const measure = () => commandFrameBytes(o.build(current.map((c) => c.upload)));
  let size = measure();
  while (size > budget) {
    let target = -1;
    o.attachments.forEach((a, i) => {
      if (!isLadderEligible(a) || steps[i]! >= BUDGET_LADDER.length - 1) return;
      if (target < 0 || weightOf(current[i]!) > weightOf(current[target]!)) target = i;
    });
    if (target < 0) {
      const heaviest = o.attachments
        .map((a, i) => ({ name: a.name, weight: weightOf(current[i]!) }))
        .sort((x, y) => y.weight - x.weight)
        .slice(0, 2)
        .map((x) => x.name);
      throw new FrameBudgetError(size - budget, heaviest);
    }
    const next = steps[target]! + 1;
    const key = `${o.attachments[target]!.id}:${next}`;
    let encoded = cache.get(key);
    if (!encoded) {
      encoded = await encodeAtStep(o.attachments[target]!, BUDGET_LADDER[next]!, codec);
      cache.set(key, encoded);
    }
    steps[target] = next;
    current[target] = encoded;
    size = measure();
  }
  return current;
}
