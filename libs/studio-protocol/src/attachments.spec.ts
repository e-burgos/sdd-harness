import { describe, expect, it } from 'vitest';
import {
  AttachmentContent,
  AttachmentMime,
  AttachmentRef,
  AttachmentUpload,
  CatalogId,
  EXT_BY_MIME,
  IMAGE_MAX_SIDE,
  MAX_FRAME_BYTES,
  PromptRefs,
  Sha256,
} from './index';

const sha = 'a'.repeat(64);
const png = { kind: 'image', name: 'shot.png', mime: 'image/png', data: 'aGVsbG8=', width: 100, height: 50 };

describe('AttachmentUpload', () => {
  it('parses image, pdf and text uploads', () => {
    const pdf = { kind: 'pdf', name: 'a.pdf', mime: 'application/pdf', data: 'aGVsbG8=' };
    const text = { kind: 'text', name: 'a.md', mime: 'text/markdown', text: '# hola' };
    for (const upload of [png, pdf, text]) expect(AttachmentUpload.parse(upload)).toEqual(upload);
  });
  it('rejects data that is not base64', () => {
    expect(AttachmentUpload.safeParse({ ...png, data: 'not base64 !!' }).success).toBe(false);
  });
  it('rejects image dimensions out of range', () => {
    expect(AttachmentUpload.safeParse({ ...png, width: IMAGE_MAX_SIDE + 1 }).success).toBe(false);
    expect(AttachmentUpload.safeParse({ ...png, height: 0 }).success).toBe(false);
  });
  it('rejects a mime that does not match its kind', () => {
    expect(AttachmentUpload.safeParse({ ...png, mime: 'application/pdf' }).success).toBe(false);
    expect(AttachmentUpload.safeParse({ kind: 'text', name: 'a', mime: 'image/png', text: 'x' }).success).toBe(false);
  });
  it('rejects empty text and oversize payloads', () => {
    expect(AttachmentUpload.safeParse({ kind: 'text', name: 'a', mime: 'text/plain', text: '' }).success).toBe(false);
    const huge = 'A'.repeat(MAX_FRAME_BYTES + 4);
    expect(AttachmentUpload.safeParse({ ...png, data: huge }).success).toBe(false);
  });
  it('rejects an empty or too long display name', () => {
    expect(AttachmentUpload.safeParse({ ...png, name: '' }).success).toBe(false);
    expect(AttachmentUpload.safeParse({ ...png, name: 'n'.repeat(256) }).success).toBe(false);
  });
});

describe('AttachmentRef', () => {
  it('parses with and without dimensions', () => {
    const ref = { sha256: sha, kind: 'pdf', mime: 'application/pdf', name: 'a.pdf', size: 10 };
    expect(AttachmentRef.parse(ref)).toEqual(ref);
    const image = { ...ref, kind: 'image', mime: 'image/png', width: 10, height: 10 };
    expect(AttachmentRef.parse(image)).toEqual(image);
  });
  it('rejects a malformed sha256 and a negative size', () => {
    const ref = { sha256: sha, kind: 'text', mime: 'text/plain', name: 'a', size: 1 };
    expect(AttachmentRef.safeParse({ ...ref, sha256: 'A'.repeat(64) }).success).toBe(false);
    expect(AttachmentRef.safeParse({ ...ref, sha256: 'abc' }).success).toBe(false);
    expect(AttachmentRef.safeParse({ ...ref, size: -1 }).success).toBe(false);
  });
});

describe('PromptRefs and CatalogId', () => {
  it('parses up to 5 refs per list', () => {
    const refs = { agents: ['sdd-planner'], skills: ['sdd-planner', 'start-sdd-cycle.prompt'] };
    expect(PromptRefs.parse(refs)).toEqual(refs);
    expect(PromptRefs.safeParse({ agents: Array(6).fill('a'), skills: [] }).success).toBe(false);
    expect(PromptRefs.safeParse({ agents: [], skills: Array(6).fill('a') }).success).toBe(false);
  });
  it('rejects ids with path separators or spaces', () => {
    for (const id of ['../x', 'a b', '', '-a', 'a/b']) expect(CatalogId.safeParse(id).success).toBe(false);
    expect(CatalogId.safeParse('plugin:skill-1.0').success).toBe(true);
  });
});

describe('AttachmentContent, Sha256 and mime tables', () => {
  it('parses content and validates sha256', () => {
    const content = { sha256: sha, mime: 'image/webp', data: 'aGVsbG8=' };
    expect(AttachmentContent.parse(content)).toEqual(content);
    expect(Sha256.safeParse(sha).success).toBe(true);
    expect(Sha256.safeParse('g'.repeat(64)).success).toBe(false);
  });
  it('maps every supported mime to an extension', () => {
    for (const mime of AttachmentMime.options.flatMap((o) => ('options' in o ? o.options : [o.value]))) {
      expect(EXT_BY_MIME[mime as keyof typeof EXT_BY_MIME]).toBeTruthy();
    }
  });
});
