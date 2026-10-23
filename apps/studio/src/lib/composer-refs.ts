import { MAX_PROMPT_REFS, type PromptRefs } from '@sdd-studio/protocol';
import { PROMPT_COMMANDS } from './slash';

export const FIXED_COMMANDS: readonly string[] = ['gate', 'validate', ...Object.keys(PROMPT_COMMANDS)];

export interface RefCatalog {
  agentIds: readonly string[];
  skillIds: readonly string[];
}

const AGENT_TOKEN = /(?:^|\s)@([A-Za-z0-9][A-Za-z0-9_-]{0,63})(?=$|\s|[.,;:!?)\]}"'](?:\s|$))/g;
const LEADING_SLASH = /^\/([A-Za-z0-9][A-Za-z0-9._:-]{0,79})(?=\s|$)/;

export const isFixedCommand = (id: string): boolean => FIXED_COMMANDS.includes(id);

export function leadingSlashId(text: string): string | null {
  return LEADING_SLASH.exec(text.trimStart())?.[1] ?? null;
}

export function leadingSkillRef(text: string, skillIds: readonly string[]): string | null {
  const id = leadingSlashId(text);
  return id && !isFixedCommand(id) && skillIds.includes(id) ? id : null;
}

export function mentionedAgents(text: string, agentIds: readonly string[]): string[] {
  const known = new Set(agentIds);
  const found = new Set<string>();
  for (const match of text.matchAll(AGENT_TOKEN)) {
    const id = match[1]!;
    if (known.has(id)) found.add(id);
  }
  return [...found].slice(0, MAX_PROMPT_REFS);
}

export function extractRefs(text: string, catalog: RefCatalog): PromptRefs {
  const skill = leadingSkillRef(text, catalog.skillIds);
  return { agents: mentionedAgents(text, catalog.agentIds), skills: skill ? [skill] : [] };
}

export type SlashResolution = 'fixed-command' | 'skill' | 'parse-slash';

export function resolveSlash(text: string, skillIds: readonly string[]): SlashResolution {
  const id = leadingSlashId(text);
  if (id && isFixedCommand(id)) return 'fixed-command';
  if (leadingSkillRef(text, skillIds)) return 'skill';
  return 'parse-slash';
}
