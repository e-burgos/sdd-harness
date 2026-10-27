import { agentMeta } from '../agents';
import type { NavNode, NavSection } from './nav-tree';

const normalize = (text: string) => text.toLowerCase();

function searchableText(node: NavNode): string {
  const parts = [node.label, node.title ?? ''];
  if (node.kind === 'dm') parts.push(agentMeta(node.label).name);
  return normalize(parts.join(' '));
}

function filterNode(node: NavNode, query: string): NavNode | null {
  if (searchableText(node).includes(query)) return node;
  const children = node.children.flatMap((child) => filterNode(child, query) ?? []);
  const threads = node.threads.filter((thread) => normalize(thread.title).includes(query));
  return children.length > 0 || threads.length > 0 ? { ...node, children, threads } : null;
}

export function filterNavTree(sections: NavSection[], rawQuery: string): NavSection[] {
  const query = normalize(rawQuery.trim());
  if (query === '') return sections;
  return sections.flatMap((section) => {
    const children = section.children.flatMap((child) => filterNode(child, query) ?? []);
    const threads = section.threads.filter((thread) => normalize(thread.title).includes(query));
    return children.length > 0 || threads.length > 0 ? [{ ...section, children, threads }] : [];
  });
}
