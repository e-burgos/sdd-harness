import type { ConfigCatalog, ResolvedConfig } from '@sdd-studio/protocol';
import { appTypeEntry, stackDescription } from './catalog';
import type { WizardState } from './state';

export interface PreviewSource {
  mode: 'nx' | 'standalone';
  project: string;
  apps: Array<{ name: string; type: string; path: string; stack: string }>;
  libs: Array<{ name: string; type: string; path: string }>;
  services: Array<{ type: string }>;
}

export type TreeNodeKind = 'dir' | 'file' | 'app' | 'lib';

export interface TreeNode {
  id: string;
  depth: number;
  name: string;
  detail: string | null;
  kind: TreeNodeKind;
}

export const sourceFromResolved = (resolved: ResolvedConfig): PreviewSource => ({
  mode: resolved.mode,
  project: resolved.project.name,
  apps: resolved.apps.map((app) => ({ name: app.name, type: app.type, path: app.path, stack: app.stack })),
  libs: resolved.libs,
  services: resolved.services.map((service) => ({ type: service.type })),
});

export function sourceFromState(state: WizardState, catalog: ConfigCatalog): PreviewSource | null {
  if (state.mode === null) return null;
  const standalone = state.mode === 'standalone';
  return {
    mode: state.mode,
    project: state.project.name,
    apps: state.apps.map((app) => {
      const entry = appTypeEntry(catalog, app.type);
      return {
        name: app.name,
        type: app.type,
        path: standalone ? '.' : `apps/${app.name}`,
        stack: entry ? stackDescription(entry, false) : app.type,
      };
    }),
    libs: standalone ? [] : state.libs.map((lib) => ({ name: lib.name, type: lib.type, path: `libs/${lib.name}` })),
    services: state.services.map((type) => ({ type })),
  };
}

const node = (id: string, depth: number, name: string, kind: TreeNodeKind, detail: string | null = null): TreeNode => ({ id, depth, name, detail, kind });

export function previewTree(source: PreviewSource): TreeNode[] {
  const nodes: TreeNode[] = [node('root', 0, `${source.project === '' ? '…' : source.project}/`, 'dir')];
  if (source.mode === 'nx') {
    nodes.push(node('apps', 1, 'apps/', 'dir'));
    for (const app of source.apps) nodes.push(node(`app:${app.path}`, 2, `${app.name}/`, 'app', `${app.type} · ${app.stack}`));
    if (source.libs.length > 0) {
      nodes.push(node('libs', 1, 'libs/', 'dir'));
      for (const lib of source.libs) nodes.push(node(`lib:${lib.path}`, 2, `${lib.name}/`, 'lib', lib.type));
    }
    nodes.push(node('tools', 1, 'tools/', 'dir'));
  } else {
    for (const app of source.apps) nodes.push(node(`app:${app.path}`, 1, './', 'app', `${app.name} · ${app.type} · ${app.stack}`));
  }
  nodes.push(node('sdd', 1, 'sdd/', 'dir'));
  nodes.push(node('config', 1, 'harness.config.json', 'file'));
  if (source.services.length > 0) nodes.push(node('compose', 1, 'docker-compose.yml', 'file', source.services.map((service) => service.type).join(', ')));
  return nodes;
}
