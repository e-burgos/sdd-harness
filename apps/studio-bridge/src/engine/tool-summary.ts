export const TOOL_SUMMARY_MAX = 160;
export const BASH_SUMMARY_MAX = 600;
const BASH_HEAD_MAX = 360;
const SDD_PATH = /(^|\/)sdd\/\S/;

export interface ToolSummary {
  summary: string;
  truncated: boolean;
}

export const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function cutAtWordBoundary(text: string, max: number): { head: string; cleanCut: boolean } {
  const lastSpace = text.lastIndexOf(' ', max);
  return lastSpace > 2
    ? { head: text.slice(0, lastSpace), cleanCut: true }
    : { head: text.slice(0, max), cleanCut: false };
}

function referencedSddPaths(text: string): string[] {
  const paths = text
    .split(/\s+/)
    .map((token) => token.replace(/^[^\w./~-]+/, '').replace(/[^\w/]+$/, ''))
    .filter((token) => SDD_PATH.test(token));
  return [...new Set(paths)];
}

function summarizeBash(command: string): ToolSummary {
  const line = `$ ${command.replace(/\s*[\r\n]+\s*/g, ' ').trim()}`;
  if (line.length <= BASH_SUMMARY_MAX) return { summary: line, truncated: false };
  const { head, cleanCut } = cutAtWordBoundary(line, BASH_HEAD_MAX);
  let summary = cleanCut ? `${head} …` : `${head}…`;
  const missing = referencedSddPaths(line.slice(head.length)).filter((path) => !head.includes(path));
  for (const path of missing) {
    const next = `${summary} ${path}`;
    if (next.length > BASH_SUMMARY_MAX) break;
    summary = next;
  }
  return { summary, truncated: true };
}

export function summarizeToolDetailed(name: string, input: Record<string, unknown>): ToolSummary {
  const s = (key: string): string => (typeof input[key] === 'string' ? (input[key] as string) : '');
  const plain = (summary: string): ToolSummary => ({ summary, truncated: false });
  const clipped = (text: string): ToolSummary => ({
    summary: truncate(text, TOOL_SUMMARY_MAX),
    truncated: text.length > TOOL_SUMMARY_MAX,
  });
  switch (name) {
    case 'Bash':
      return summarizeBash(s('command'));
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'Read':
      return plain(s('file_path') || name);
    case 'NotebookEdit':
      return plain(s('notebook_path') || name);
    case 'Glob':
    case 'Grep':
      return clipped(`${name} ${s('pattern')}`);
    case 'Agent':
    case 'Task':
      return clipped(`${s('subagent_type') || 'subagent'}: ${s('description')}`);
    default:
      return plain(name);
  }
}

export const summarizeTool = (name: string, input: Record<string, unknown>): string =>
  summarizeToolDetailed(name, input).summary;

export function diffFor(name: string, input: Record<string, unknown>): string | undefined {
  const prefixed = (prefix: string, text: string) => text.split('\n').map((l) => prefix + l).join('\n');
  if (name === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return truncate(`${prefixed('-', input.old_string)}\n${prefixed('+', input.new_string)}`, 4000);
  }
  if (name === 'Write' && typeof input.content === 'string') return truncate(prefixed('+', input.content), 4000);
  return undefined;
}
