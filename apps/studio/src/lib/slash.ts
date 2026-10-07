export const PROMPT_COMMANDS = {
  'open-cycle': 'sdd/prompts/start-sdd-cycle.prompt.md',
  review: 'sdd/prompts/review-cycle.prompt.md',
  hotfix: 'sdd/prompts/hotfix-bypass-gate.prompt.md',
  check: 'sdd/prompts/check-spec-before-implement.prompt.md',
  resume: 'sdd/prompts/hermes-resume.prompt.md',
  steward: 'sdd/prompts/sdd-steward.prompt.md',
} as const;

export type SlashAction =
  | { kind: 'run'; name: 'gate' | 'validate'; args: string[] }
  | { kind: 'prompt'; name: keyof typeof PROMPT_COMMANDS; path: string; args: string }
  | { kind: 'error'; reason: 'unknown' | 'args'; name: string }
  | null;

const SAFE_ARG = /^[A-Za-z0-9._-]{1,80}$/;

export function parseSlash(text: string): SlashAction {
  const match = /^\/([a-z-]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  const name = match[1]!;
  const rest = (match[2] ?? '').trim();
  if (name === 'gate' || name === 'validate') {
    const args = rest ? rest.split(/\s+/) : [];
    const max = name === 'gate' ? 2 : 0;
    if (args.length > max || !args.every((a) => SAFE_ARG.test(a))) return { kind: 'error', reason: 'args', name };
    return { kind: 'run', name, args };
  }
  if (name in PROMPT_COMMANDS) {
    const key = name as keyof typeof PROMPT_COMMANDS;
    return { kind: 'prompt', name: key, path: PROMPT_COMMANDS[key], args: rest };
  }
  return { kind: 'error', reason: 'unknown', name };
}
