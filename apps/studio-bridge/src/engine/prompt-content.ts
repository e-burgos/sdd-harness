import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { OutgoingMessage } from './types';

export function toSdkUserMessage({ id, prompt }: OutgoingMessage): SDKUserMessage {
  const content = [
    ...prompt.preamble.map((text) => ({ type: 'text' as const, text })),
    ...prompt.blocks.map(({ text }) => ({ type: 'text' as const, text })),
    { type: 'text' as const, text: prompt.text },
  ];
  return {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
    session_id: '',
    uuid: id as SDKUserMessage['uuid'],
  };
}

export function toHookContext(messages: OutgoingMessage[]): string {
  return messages.map(({ prompt }) => `Message from the user, sent while you were working:\n${prompt.text}`).join('\n\n');
}
