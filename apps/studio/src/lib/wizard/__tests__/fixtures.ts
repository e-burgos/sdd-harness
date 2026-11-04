import type { ConfigCatalog } from '@sdd-studio/protocol';
import { initialWizardState, wizardReducer, type WizardAction, type WizardState } from '../state';

type Entry = ConfigCatalog['appTypes'][number];

const app = (
  type: string,
  role: Entry['role'],
  defaultName: string,
  defaultPort: number,
  flags: Partial<Pick<Entry, 'workspaceOnly' | 'tucuUi' | 'ml' | 'shell'>> = {},
): Entry => ({
  type,
  label: type,
  hint: `${type} hint`,
  role,
  defaultName,
  defaultPort,
  stack: `${type} stack`,
  stackPlain: null,
  workspaceOnly: false,
  tucuUi: false,
  ml: false,
  shell: false,
  ...flags,
});

export const catalogFixture: ConfigCatalog = {
  format: 1,
  cliVersion: '0.17.0',
  modes: [
    { mode: 'nx', maxApps: null, libs: true },
    { mode: 'standalone', maxApps: 1, libs: false },
  ],
  appTypes: [
    app('react', 'frontend', 'web', 3000, { tucuUi: true }),
    app('nextjs', 'frontend', 'next-web', 3010, { tucuUi: true }),
    app('next-bff', 'frontend', 'bff', 3020, { workspaceOnly: true, tucuUi: true }),
    app('mfe-shell', 'frontend', 'shell', 3030, { workspaceOnly: true, tucuUi: true }),
    app('mfe', 'frontend', 'mfe', 3040, { workspaceOnly: true, tucuUi: true, shell: true }),
    app('nestjs', 'backend', 'api', 4000),
    app('fastify', 'backend', 'fastify-api', 4010),
    app('hono', 'backend', 'hono-api', 4020),
    app('python', 'backend', 'py-api', 4030, { ml: true }),
    app('springboot', 'backend', 'java-api', 4040),
  ],
  libTypes: ['shared-types', 'shared-utils', 'ui-kit', 'api-client', 'config'].map((type) => ({ type, label: type })),
  serviceTypes: [
    { type: 'postgres', label: 'Postgres', hint: 'db', defaultPort: 5432, version: '16' },
    { type: 'redis', label: 'Redis', hint: 'cache', defaultPort: 6379, version: '7' },
  ],
  profiles: ['team', 'solo'],
  patterns: { name: '^[a-z][a-z0-9-]*$', packageScope: '^@[a-z0-9-]+$', author: '^[a-z0-9-]+$' },
  portRange: { min: 1000, max: 65535 },
  targetDir: { tolerated: ['.git', 'README.md'] },
  jsonSchema: {},
};

export const run = (actions: WizardAction[], from: WizardState = initialWizardState()): WizardState =>
  actions.reduce((state, action) => wizardReducer(state, action, catalogFixture), from);

export const scoped = (scope: 'fullstack' | 'front' | 'back', mode: 'nx' | 'standalone'): WizardState =>
  run([
    { type: 'change', change: { type: 'scope', scope } },
    { type: 'change', change: { type: 'mode', mode } },
  ]);

export const idOf = (state: WizardState, name: string): string => {
  const found = state.apps.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no app ${name}`);
  return found.id;
};
