export type MentionTrigger = '@' | '/';

export interface ActiveMention {
  trigger: MentionTrigger;
  query: string;
  start: number;
}

export type MentionItem =
  | { kind: 'file'; id: string; path: string }
  | { kind: 'agent'; id: string; description: string }
  | { kind: 'command'; id: string; description: string }
  | { kind: 'skill'; id: string; description: string; skillKind: 'skill' | 'prompt' };

export function detectMention(text: string, cursor: number): ActiveMention | null {
  const head = text.slice(0, cursor);
  const at = /(?:^|\s)@(\S*)$/.exec(head);
  if (at) return { trigger: '@', query: at[1]!, start: cursor - at[1]!.length - 1 };
  const slash = /^\/(\S*)$/.exec(head);
  if (slash) return { trigger: '/', query: slash[1]!, start: 0 };
  return null;
}

const quotePath = (path: string): string => (/\s/.test(path) ? `\`${path}\`` : path);

export function insertionFor(item: MentionItem): string {
  switch (item.kind) {
    case 'file':
      return `${quotePath(item.path)} `;
    case 'agent':
      return `@${item.id} `;
    case 'command':
    case 'skill':
      return `/${item.id} `;
  }
}

export function applyMention(text: string, mention: ActiveMention, cursor: number, item: MentionItem): { text: string; cursor: number } {
  const inserted = insertionFor(item);
  const next = text.slice(0, mention.start) + inserted + text.slice(cursor);
  return { text: next, cursor: mention.start + inserted.length };
}
