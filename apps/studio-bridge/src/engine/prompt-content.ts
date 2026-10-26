import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentSummary, AttachmentRef, PromptRefs, SkillSummary } from '@sdd-studio/protocol';
import type { EngineCallbacks, OutgoingMessage, PromptBlock, TurnPrompt } from './types';

export interface AcceptedMessage {
  text: string;
  attachments: AttachmentRef[];
  refs: PromptRefs;
}

export interface CatalogView {
  agents: Pick<AgentSummary, 'id'>[];
  skills: Pick<SkillSummary, 'id' | 'kind' | 'path'>[];
}

type ContentBlock = SDKUserMessage['message']['content'] extends string | (infer Block)[] ? Block : never;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function preambleOf(refs: PromptRefs, catalog: CatalogView): string[] {
  const agentLines = refs.agents
    .filter((id) => catalog.agents.some((agent) => agent.id === id))
    .map((id) => `Delegate this task to the subagent "${id}" using the Agent tool.`);
  const skillLines = refs.skills.flatMap((id) => {
    const skill = catalog.skills.find((candidate) => candidate.id === id);
    if (!skill) return [];
    return [skill.kind === 'skill' ? `Use the skill "${id}" (${skill.path}) for this task.` : `Follow the instructions in ${skill.path}.`];
  });
  return [...agentLines, ...skillLines];
}

function withoutLeadingSkillToken(text: string, skills: string[]): string {
  for (const id of skills) {
    const match = new RegExp(`^/${escapeRegExp(id)}(?:\\s+|$)`).exec(text);
    if (match) return text.slice(match[0].length);
  }
  return text;
}

export function buildTurnPrompt(message: AcceptedMessage, catalog: CatalogView): TurnPrompt {
  const preamble = preambleOf(message.refs, catalog);
  const blocks: PromptBlock[] = message.attachments.map((ref) => ({ kind: 'attachment', ref }));
  const stripped = withoutLeadingSkillToken(message.text, message.refs.skills);
  const nothingElse = preamble.length === 0 && blocks.length === 0;
  const text = stripped.trim().length === 0 && nothingElse ? message.text : stripped;
  return { text, preamble, blocks };
}

const text = (value: string): ContentBlock => ({ type: 'text', text: value });

async function attachmentBlock(ref: AttachmentRef, read: EngineCallbacks['readAttachment']): Promise<ContentBlock> {
  const bytes = await read(ref).catch(() => null);
  if (!bytes) return text(`[attachment unavailable: ${JSON.stringify(ref.name)}]`);
  if (ref.kind === 'text') return text(`Attached file ${JSON.stringify(ref.name)}:\n${Buffer.from(bytes).toString('utf8')}`);
  const data = Buffer.from(bytes).toString('base64');
  if (ref.kind === 'pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: ref.name };
  }
  return { type: 'image', source: { type: 'base64', media_type: ref.mime as 'image/png', data } };
}

function trailingText({ prompt }: OutgoingMessage): string | null {
  if (prompt.text.trim().length > 0) return prompt.text;
  const names = prompt.blocks.flatMap((block) => (block.kind === 'attachment' ? [block.ref.name] : []));
  return names.length > 0 ? `Attachments: ${names.join(', ')}` : null;
}

export async function toSdkUserMessage(message: OutgoingMessage, read: EngineCallbacks['readAttachment']): Promise<SDKUserMessage> {
  const { prompt } = message;
  const attachments = await Promise.all(
    prompt.blocks.map((block) => (block.kind === 'attachment' ? attachmentBlock(block.ref, read) : Promise.resolve(text(block.text)))),
  );
  const closing = trailingText(message);
  const content = [...prompt.preamble.map(text), ...attachments, ...(closing === null ? [] : [text(closing)])];
  return {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
    session_id: '',
    uuid: message.id as SDKUserMessage['uuid'],
  };
}

export function toHookContext(messages: OutgoingMessage[]): string {
  return messages.map(({ prompt }) => `Message from the user, sent while you were working:\n${prompt.text}`).join('\n\n');
}
