import type { ConversationDocument } from './conversation';

export interface AgentGeneratedDocument {
  id: string;
  name: string;
  path: string;
  type: 'spec' | 'plan' | 'wbs' | 'architecture' | 'code' | 'context' | 'review' | 'fix' | 'test';
  status: 'generated' | 'modified' | 'approved';
}

const documentTypeOf = (path: string, name: string): AgentGeneratedDocument['type'] => {
  if (/\/fixes\//.test(path)) return 'fix';
  if (/\.(spec|test)\.(ts|tsx|js|mjs)$/.test(name)) return 'test';
  if (name === 'plan.md') return 'plan';
  if (name === 'tasks.json') return 'wbs';
  if (name === 'architect.md') return 'architecture';
  if (/\/context\//.test(path)) return 'context';
  if (name === 'cycle.json' || name === 'brief.yaml') return 'review';
  if (/\.(ts|tsx|mjs|js)$/.test(name)) return 'code';
  return 'spec';
};

export const toViewerDocument = (document: ConversationDocument): AgentGeneratedDocument => ({
  id: document.path,
  name: document.name,
  path: document.path,
  type: documentTypeOf(document.path, document.name),
  status: 'generated',
});
