'use client';

import { MAX_ATTACHMENTS, type AttachmentUpload } from '@sdd-studio/protocol';
import { useCallback, useState } from 'react';
import { useBridge, useStudio } from '@/components/BridgeProvider';
import { buildDraftAttachment } from './attachments/build-draft';
import { classify, splitByCapacity, type ClassifyFailure } from './attachments/classify';
import type { DraftAttachment, EncodedAttachment } from './attachments/draft-attachment';
import { ImageEncodeError } from './attachments/encode-image';
import { fitFrameBudget } from './attachments/frame-budget';

export interface AttachmentFailure {
  name: string;
  reason: ClassifyFailure | 'image-encode' | 'too-many';
}

const NO_ATTACHMENTS: DraftAttachment[] = [];
let sequence = 0;
const nextId = (): string => `att-${Date.now().toString(36)}-${++sequence}`;

export function useAttachmentDraft(key: string) {
  const { store } = useBridge();
  const attachments = useStudio((s) => s.drafts[key]?.attachments ?? NO_ATTACHMENTS);
  const [failures, setFailures] = useState<AttachmentFailure[]>([]);
  const current = useCallback(() => store.getState().drafts[key]?.attachments ?? NO_ATTACHMENTS, [store, key]);

  const add = useCallback(
    async (files: File[]): Promise<void> => {
      const { accepted, rejected } = splitByCapacity(files, current().length);
      const problems: AttachmentFailure[] = rejected.length > 0 ? [{ name: '', reason: 'too-many' }] : [];
      const built: DraftAttachment[] = [];
      for (const file of accepted) {
        const classified = await classify(file);
        if (!classified.ok) {
          problems.push({ name: classified.name, reason: classified.reason });
          continue;
        }
        try {
          built.push(await buildDraftAttachment(classified, file, nextId()));
        } catch (error) {
          problems.push({ name: classified.name, reason: error instanceof ImageEncodeError ? 'image-encode' : 'unsupported' });
        }
      }
      const latest = current();
      const room = Math.max(0, MAX_ATTACHMENTS - latest.length);
      const kept = built.slice(0, room);
      for (const dropped of built.slice(room)) if (dropped.previewUrl) URL.revokeObjectURL(dropped.previewUrl);
      if (built.length > kept.length) problems.push({ name: '', reason: 'too-many' });
      if (kept.length > 0) store.getState().setDraftAttachments(key, [...latest, ...kept]);
      setFailures(problems);
    },
    [store, key, current],
  );

  const remove = useCallback(
    (id: string) => {
      store.getState().setDraftAttachments(key, current().filter((a) => a.id !== id));
    },
    [store, key, current],
  );

  const dismissFailures = useCallback(() => setFailures([]), []);

  const buildUploads = useCallback(
    async (build: (uploads: AttachmentUpload[]) => object): Promise<EncodedAttachment[]> => {
      const list = current();
      if (list.length === 0) return [];
      return fitFrameBudget({ build, attachments: list });
    },
    [current],
  );

  return { attachments, failures, add, remove, dismissFailures, buildUploads };
}

export type AttachmentDraftModel = ReturnType<typeof useAttachmentDraft>;
