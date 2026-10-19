export const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

export function summarizeTool(name: string, input: Record<string, unknown>): string {
  const s = (key: string): string => (typeof input[key] === 'string' ? (input[key] as string) : '');
  switch (name) {
    case 'Bash':
      return truncate(`$ ${s('command')}`, 160);
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'Read':
      return s('file_path') || name;
    case 'NotebookEdit':
      return s('notebook_path') || name;
    case 'Glob':
    case 'Grep':
      return truncate(`${name} ${s('pattern')}`, 160);
    case 'Agent':
    case 'Task':
      return truncate(`${s('subagent_type') || 'subagent'}: ${s('description')}`, 160);
    default:
      return name;
  }
}

export function diffFor(name: string, input: Record<string, unknown>): string | undefined {
  const prefixed = (prefix: string, text: string) => text.split('\n').map((l) => prefix + l).join('\n');
  if (name === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return truncate(`${prefixed('-', input.old_string)}\n${prefixed('+', input.new_string)}`, 4000);
  }
  if (name === 'Write' && typeof input.content === 'string') return truncate(prefixed('+', input.content), 4000);
  return undefined;
}
