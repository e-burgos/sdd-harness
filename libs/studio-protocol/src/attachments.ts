import { z } from 'zod';
import { AgentId } from './domain';
import { IMAGE_MAX_SIDE, MAX_FRAME_BYTES, MAX_PROMPT_REFS } from './limits';

export const ImageMime = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export type ImageMime = z.infer<typeof ImageMime>;
export const TextMime = z.enum(['text/plain', 'text/markdown']);
export type TextMime = z.infer<typeof TextMime>;
export const AttachmentMime = z.union([ImageMime, z.literal('application/pdf'), TextMime]);
export type AttachmentMime = z.infer<typeof AttachmentMime>;

export const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
} as const;

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export type Sha256 = z.infer<typeof Sha256>;

const DisplayName = z.string().min(1).max(255);
const Base64 = z.base64().max(MAX_FRAME_BYTES);
const Dim = z.number().int().min(1).max(IMAGE_MAX_SIDE);

export const AttachmentUpload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), name: DisplayName, mime: ImageMime, data: Base64, width: Dim, height: Dim }),
  z.object({ kind: z.literal('pdf'), name: DisplayName, mime: z.literal('application/pdf'), data: Base64 }),
  z.object({ kind: z.literal('text'), name: DisplayName, mime: TextMime, text: z.string().min(1).max(MAX_FRAME_BYTES) }),
]);
export type AttachmentUpload = z.infer<typeof AttachmentUpload>;

export const AttachmentRef = z.object({
  sha256: Sha256,
  kind: z.enum(['image', 'pdf', 'text']),
  mime: AttachmentMime,
  name: DisplayName,
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type AttachmentRef = z.infer<typeof AttachmentRef>;

export const CatalogId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
export type CatalogId = z.infer<typeof CatalogId>;

export const PromptRefs = z.object({
  agents: z.array(AgentId).max(MAX_PROMPT_REFS),
  skills: z.array(CatalogId).max(MAX_PROMPT_REFS),
});
export type PromptRefs = z.infer<typeof PromptRefs>;

export const AttachmentContent = z.object({ sha256: Sha256, mime: AttachmentMime, data: z.base64() });
export type AttachmentContent = z.infer<typeof AttachmentContent>;
