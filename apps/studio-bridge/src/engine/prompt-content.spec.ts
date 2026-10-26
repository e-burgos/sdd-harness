import type { AttachmentRef } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import { buildTurnPrompt, toHookContext, toSdkUserMessage, type CatalogView } from './prompt-content';
import { plainPrompt, type OutgoingMessage } from './types';

const ref = (over: Partial<AttachmentRef> & Pick<AttachmentRef, 'kind' | 'mime' | 'name'>): AttachmentRef => ({
  sha256: 'a'.repeat(64), size: 3, ...over,
});
const image = ref({ kind: 'image', mime: 'image/png', name: 'shot.png', width: 4, height: 4 });
const pdf = ref({ kind: 'pdf', mime: 'application/pdf', name: 'spec.pdf' });
const note = ref({ kind: 'text', mime: 'text/plain', name: 'note.txt' });
const catalog: CatalogView = {
  agents: [{ id: 'sdd-planner' }],
  skills: [
    { id: 'commit', kind: 'skill', path: '.claude/skills/commit/SKILL.md' },
    { id: 'review-cycle', kind: 'prompt', path: 'sdd/prompts/review-cycle.prompt.md' },
  ],
};
const noRefs = { agents: [], skills: [] };
const bytes = new Uint8Array([1, 2, 3]);
const reader = (map: Record<string, Uint8Array | null> = {}) =>
  vi.fn(async (r: AttachmentRef) => (r.name in map ? map[r.name]! : bytes));

describe('buildTurnPrompt', () => {
  it('builds the preamble in order and only for refs still in the catalog', () => {
    const prompt = buildTurnPrompt(
      { text: 'go', attachments: [], refs: { agents: ['sdd-planner', 'gone'], skills: ['commit', 'review-cycle', 'ghost'] } },
      catalog,
    );
    expect(prompt.preamble).toEqual([
      'Delegate this task to the subagent "sdd-planner" using the Agent tool.',
      'Use the skill "commit" (.claude/skills/commit/SKILL.md) for this task.',
      'Follow the instructions in sdd/prompts/review-cycle.prompt.md.',
    ]);
    expect(prompt.text).toBe('go');
  });

  it('strips the leading /<id> of a referenced skill and its trailing space', () => {
    const refs = { agents: [], skills: ['commit'] };
    expect(buildTurnPrompt({ text: '/commit fix the thing', attachments: [], refs }, catalog).text).toBe('fix the thing');
    expect(buildTurnPrompt({ text: '/commit', attachments: [], refs }, catalog).text).toBe('');
    expect(buildTurnPrompt({ text: '/committed x', attachments: [], refs }, catalog).text).toBe('/committed x');
    expect(buildTurnPrompt({ text: 'see /commit', attachments: [], refs }, catalog).text).toBe('see /commit');
  });

  it('keeps the original text when stripping would leave nothing to send', () => {
    const prompt = buildTurnPrompt({ text: '/ghost', attachments: [], refs: { agents: [], skills: ['ghost'] } }, catalog);
    expect(prompt).toEqual({ text: '/ghost', preamble: [], blocks: [] });
  });

  it('emits one attachment block per ref in order', () => {
    const prompt = buildTurnPrompt({ text: 'x', attachments: [image, pdf], refs: noRefs }, catalog);
    expect(prompt.blocks).toEqual([{ kind: 'attachment', ref: image }, { kind: 'attachment', ref: pdf }]);
  });
});

describe('toSdkUserMessage', () => {
  it('stamps the message id as uuid and carries the text as a single block', async () => {
    expect(await toSdkUserMessage({ id: 'u-1', prompt: plainPrompt('hola') }, reader())).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hola' }] },
      parent_tool_use_id: null,
      session_id: '',
      uuid: 'u-1',
    });
  });

  it('orders preamble, attachments by type and the developer text', async () => {
    const message: OutgoingMessage = {
      id: 'u-2',
      prompt: {
        text: 'body',
        preamble: ['pre'],
        blocks: [image, pdf, note].map((r) => ({ kind: 'attachment' as const, ref: r })),
      },
    };
    const read = reader({ 'note.txt': new TextEncoder().encode('hi there') });
    const { message: out } = await toSdkUserMessage(message, read);
    const b64 = Buffer.from(bytes).toString('base64');
    expect(out.content).toEqual([
      { type: 'text', text: 'pre' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 }, title: 'spec.pdf' },
      { type: 'text', text: 'Attached file "note.txt":\nhi there' },
      { type: 'text', text: 'body' },
    ]);
  });

  it('replaces an unreadable attachment with a marker and keeps going', async () => {
    const message: OutgoingMessage = { id: 'u-3', prompt: { text: 'body', preamble: [], blocks: [{ kind: 'attachment', ref: image }] } };
    const { message: out } = await toSdkUserMessage(message, reader({ 'shot.png': null }));
    expect(out.content).toEqual([
      { type: 'text', text: '[attachment unavailable: "shot.png"]' },
      { type: 'text', text: 'body' },
    ]);
  });

  it('treats a throwing reader as unavailable', async () => {
    const message: OutgoingMessage = { id: 'u-4', prompt: { text: 'b', preamble: [], blocks: [{ kind: 'attachment', ref: pdf }] } };
    const { message: out } = await toSdkUserMessage(message, async () => { throw new Error('boom'); });
    expect(out.content[0]).toEqual({ type: 'text', text: '[attachment unavailable: "spec.pdf"]' });
  });

  it('closes with the attachment names when the text is empty, and never emits an empty text block', async () => {
    const withFiles: OutgoingMessage = {
      id: 'u-5',
      prompt: { text: '  ', preamble: [], blocks: [image, note].map((r) => ({ kind: 'attachment' as const, ref: r })) },
    };
    const { message } = await toSdkUserMessage(withFiles, reader());
    expect(message.content.at(-1)).toEqual({ type: 'text', text: 'Attachments: shot.png, note.txt' });

    const skillOnly: OutgoingMessage = { id: 'u-6', prompt: { text: '', preamble: ['Use the skill "x" (p) for this task.'], blocks: [] } };
    const { message: bare } = await toSdkUserMessage(skillOnly, reader());
    expect(bare.content).toEqual([{ type: 'text', text: 'Use the skill "x" (p) for this task.' }]);
    for (const block of [...message.content, ...bare.content] as { type: string; text?: string }[]) {
      if (block.type === 'text') expect(block.text?.length).toBeGreaterThan(0);
    }
  });
});

describe('toHookContext', () => {
  it('wraps each message with the mid-work envelope', () => {
    const context = toHookContext([
      { id: 'a', prompt: plainPrompt('one') },
      { id: 'b', prompt: plainPrompt('two') },
    ]);
    expect(context).toBe(
      'Message from the user, sent while you were working:\none\n\nMessage from the user, sent while you were working:\ntwo',
    );
  });
});
