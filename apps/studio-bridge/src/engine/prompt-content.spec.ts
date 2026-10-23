import { describe, expect, it } from 'vitest';
import { toHookContext, toSdkUserMessage } from './prompt-content';
import { plainPrompt } from './types';

describe('toSdkUserMessage', () => {
  it('stamps the message id as uuid and carries the text as a single block', () => {
    expect(toSdkUserMessage({ id: 'u-1', prompt: plainPrompt('hola') })).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hola' }] },
      parent_tool_use_id: null,
      session_id: '',
      uuid: 'u-1',
    });
  });

  it('orders preamble, blocks and the developer text', () => {
    const message = toSdkUserMessage({ id: 'u-2', prompt: { text: 'body', preamble: ['pre'], blocks: [{ kind: 'text', text: 'blk' }] } });
    expect(message.message.content).toEqual([
      { type: 'text', text: 'pre' },
      { type: 'text', text: 'blk' },
      { type: 'text', text: 'body' },
    ]);
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
