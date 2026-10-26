import type { AlwaysOffer, AlwaysRule } from '@sdd-studio/protocol';

const NON_SIMPLE_COMMAND = /[\n;&|`<>(){}]|\$\(/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const PROGRAM = /^[A-Za-z0-9._/-]+$/;
const SUBCOMMAND = /^[a-z][a-z0-9:_-]*$/;
const MCP_TOOL = /^mcp__.+__.+$/;
const MAX_TOOL_LENGTH = 128;
const MAX_MCP_TOOL_LENGTH = 256;
const MAX_PREFIX_SUBCOMMANDS = 2;
const WRAPPERS = new Set(['sudo', 'env', 'bash', 'sh', 'zsh', 'eval', 'exec', 'xargs', 'nohup', 'time', 'command', 'npx', 'pnpx', 'bunx']);

function tokenize(command: string): string[] | null {
  if (NON_SIMPLE_COMMAND.test(command)) return null;
  const tokens: string[] = [];
  let current = '';
  let started = false;
  let quote: string | null = null;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) return null;
  if (started) tokens.push(current);
  return tokens;
}

const basename = (program: string): string => program.slice(program.lastIndexOf('/') + 1);

export function bashPrefixOf(command: string): string | null {
  const tokens = tokenize(command);
  const program = tokens?.[0];
  if (!tokens || program === undefined) return null;
  if (ENV_ASSIGNMENT.test(program) || !PROGRAM.test(program) || WRAPPERS.has(basename(program))) return null;
  const subcommands: string[] = [];
  for (const token of tokens.slice(1, 1 + MAX_PREFIX_SUBCOMMANDS)) {
    if (!SUBCOMMAND.test(token)) break;
    subcommands.push(token);
  }
  return [program, ...subcommands].join(' ');
}

export function alwaysOfferOf(toolName: string, input: Record<string, unknown>, gateWarning?: string): AlwaysOffer {
  if (gateWarning) return { kind: 'none', reason: 'gate-warning' };
  if (toolName === 'Bash') {
    const prefix = typeof input.command === 'string' ? bashPrefixOf(input.command) : null;
    return prefix ? { kind: 'bash-prefix', prefix } : { kind: 'none', reason: 'not-calculable' };
  }
  if (MCP_TOOL.test(toolName)) {
    return toolName.length <= MAX_MCP_TOOL_LENGTH ? { kind: 'mcp', tool: toolName } : { kind: 'none', reason: 'not-calculable' };
  }
  return toolName.length <= MAX_TOOL_LENGTH ? { kind: 'tool', tool: toolName } : { kind: 'none', reason: 'not-calculable' };
}

export function ruleOf(offer: AlwaysOffer): AlwaysRule | null {
  return offer.kind === 'none' ? null : offer;
}

export function matchesRule(rule: AlwaysRule, toolName: string, input: Record<string, unknown>): boolean {
  if (rule.kind !== 'bash-prefix') return toolName === rule.tool;
  if (toolName !== 'Bash' || typeof input.command !== 'string') return false;
  const tokens = tokenize(input.command);
  if (!tokens || (tokens[0] !== undefined && ENV_ASSIGNMENT.test(tokens[0]))) return false;
  const prefix = rule.prefix.split(' ');
  return tokens.length >= prefix.length && prefix.every((token, index) => tokens[index] === token);
}
