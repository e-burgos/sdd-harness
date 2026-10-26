import type { AttachmentMime, AttachmentUpload, Sha256 } from '@sdd-studio/protocol';

export interface EncodedAttachment {
  upload: AttachmentUpload;
  sha256: Sha256;
}

export interface DraftAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  mime: AttachmentMime;
  size: number;
  original: Blob;
  encoded: EncodedAttachment;
  previewUrl?: string;
}
