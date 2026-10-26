import { describe, expect, it } from 'vitest';
import * as protocol from './index';

const PUBLISHED_EXPORTS = [
  'PROTOCOL_VERSION', 'MAX_FRAME_BYTES', 'FRAME_BUDGET_BYTES', 'MAX_ATTACHMENTS', 'IMAGE_MAX_SIDE',
  'MAX_PROMPT_REFS', 'FILE_SEARCH_MAX', 'MAX_PENDING_PER_THREAD', 'BRIDGE_FEATURES', 'TEXT_ATTACHMENT_EXTENSIONS',
  'Welcome', 'HandshakeError', 'ImageMime', 'TextMime', 'AttachmentMime', 'EXT_BY_MIME', 'Sha256',
  'AttachmentUpload', 'AttachmentRef', 'CatalogId', 'PromptRefs', 'AttachmentContent',
  'SpecIdValue', 'CycleIdValue', 'FixIdValue', 'ThreadLinkTarget', 'ThreadLink', 'ThreadInfo',
  'AlwaysRule', 'AlwaysOffer', 'ClientCommand', 'SendResult', 'FileSearchResult',
  'ThreadEvent', 'CatalogSource', 'AgentSummary', 'SkillSummary', 'FixSummary', 'WorkspaceSnapshot',
];

describe('public surface', () => {
  it('publishes every contract of the spec from the index', () => {
    const missing = PUBLISHED_EXPORTS.filter((name) => !(name in protocol));
    expect(missing).toEqual([]);
  });
  it('keeps the frame budget below the frame limit', () => {
    expect(protocol.FRAME_BUDGET_BYTES).toBeLessThan(protocol.MAX_FRAME_BYTES);
  });
});

describe('cycle-02 contracts are validated by cycle-01 specs', () => {
  it('rejects a v2 thread info that lacks the migrated fields', () => {
    const legacy = {
      id: 't', channelId: 'general', title: 'x', agent: 'a', options: protocol.defaultThreadOptions('a'),
      status: 'idle', createdAt: 'c', lastActivity: 'l',
    };
    expect(protocol.ThreadInfo.safeParse(legacy).success).toBe(false);
  });
});
