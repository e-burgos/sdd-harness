import type { GenerationState, Preflight, ResolvedConfig, TargetCheck } from '@sdd-studio/protocol';
import { saveWizardState } from '@/lib/wizard/persist';
import type { WizardAction } from '@/lib/wizard/state';
import { run, scoped } from '@/lib/wizard/__tests__/fixtures';
import { validation, wizardClient } from './harness';

export const FINGERPRINT = '0123456789abcdef';
export const DEFAULT_TARGET = '/home/dev/projects/acme';

export const resolvedConfig: ResolvedConfig = {
  mode: 'nx',
  project: { name: 'acme', packageScope: '@acme' },
  apps: [
    { name: 'next-web', type: 'nextjs', path: 'apps/next-web', port: 3010, portSource: 'default', tucuUi: true, ml: false, shell: null, route: null, stack: 'Next.js App Router' },
    { name: 'api', type: 'nestjs', path: 'apps/api', port: 4000, portSource: 'default', tucuUi: null, ml: false, shell: null, route: null, stack: 'NestJS modular' },
  ],
  libs: [{ name: 'shared-types', type: 'shared-types', path: 'libs/shared-types' }],
  services: [{ type: 'postgres', port: 5432, version: '16' }],
  dockerCompose: true,
  profile: 'team',
};

export const readyPreflight: Preflight = {
  node: { version: '22.1.0' },
  pnpm: { found: true, version: '9.12.0' },
  git: { found: true, identity: true },
  registry: { url: 'https://registry.npmjs.org/', reachable: 'yes' },
  ready: true,
};

export const targetCheck = (overrides: Partial<TargetCheck> = {}): TargetCheck => ({
  input: DEFAULT_TARGET,
  resolvedPath: DEFAULT_TARGET,
  state: 'missing',
  reason: null,
  entries: null,
  insideProject: false,
  needsConfirmation: false,
  fingerprint: FINGERPRINT,
  ...overrides,
});

export const generationState = (overrides: Partial<GenerationState> = {}): GenerationState => ({
  id: 'gen-1',
  target: DEFAULT_TARGET,
  projectName: 'acme',
  mode: 'nx',
  cliVersion: '0.17.0',
  argv: ['init', '--config', 'harness.config.json', '-y'],
  status: 'running',
  stages: [
    { stage: 'prepare', status: 'done' },
    { stage: 'scaffold', status: 'done' },
    { stage: 'install', status: 'active' },
    { stage: 'generate', status: 'pending' },
    { stage: 'validate', status: 'pending' },
    { stage: 'build', status: 'pending' },
  ],
  gate: { validate: 'pending', build: 'pending' },
  failure: null,
  exitCode: null,
  hasSdd: false,
  startedAt: '2026-11-04T10:00:00.000Z',
  finishedAt: null,
  lastSeq: 0,
  ...overrides,
});

const fullstack: WizardAction[] = [
  { type: 'project', patch: { name: 'acme', description: 'Acme platform' } },
  { type: 'app-add', appType: 'nextjs' },
  { type: 'app-add', appType: 'nestjs' },
  { type: 'lib-toggle', libType: 'shared-types' },
  { type: 'service-toggle', serviceType: 'postgres' },
];

export function preloadFullstack(): void {
  window.sessionStorage.clear();
  saveWizardState(run(fullstack, scoped('fullstack', 'nx')), window.sessionStorage);
}

type Handler = (cmd: Record<string, unknown>) => unknown;

export function summaryClient(overrides: Partial<Record<string, Handler>> = {}) {
  return wizardClient({
    'wizard.validate': () => validation([], resolvedConfig),
    'wizard.preflight': () => readyPreflight,
    'wizard.checkTarget': () => targetCheck(),
    ...overrides,
  });
}
