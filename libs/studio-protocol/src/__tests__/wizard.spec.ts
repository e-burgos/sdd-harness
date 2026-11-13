import { describe, expect, it } from 'vitest';
import {
  BRIDGE_FEATURES,
  ClientCommand,
  ConfigCatalog,
  ConfigCliFailure,
  ConfigValidation,
  GENERATION_BUFFER_BYTES,
  GENERATION_CHUNK_MAX,
  GenerateResult,
  GenerationSnapshot,
  GenerationState,
  MAX_CONFIG_BYTES,
  MAX_DIR_ENTRIES,
  PROTOCOL_VERSION,
  Preflight,
  ServerEvent,
  TargetCheck,
  WS_CLOSE_WORKSPACE_SWITCHED,
  Welcome,
  WizardCatalogResult,
  decodeServerMessage,
} from '../index';

const base = { kind: 'command', id: 'c1' } as const;
const generation = {
  id: 'g1',
  target: '/tmp/p',
  projectName: 'p',
  mode: 'nx',
  cliVersion: '0.17.0',
  argv: ['harness', 'init'],
  status: 'running',
  stages: ['prepare', 'scaffold', 'install', 'generate', 'validate', 'build'].map((stage) => ({ stage, status: 'pending' })),
  gate: { validate: 'pending', build: 'pending' },
  failure: null,
  exitCode: null,
  hasSdd: false,
  startedAt: '2026-11-04T10:00:00Z',
  finishedAt: null,
  lastSeq: 0,
};
const check = {
  input: '/tmp/p',
  resolvedPath: '/tmp/p',
  state: 'empty',
  reason: null,
  entries: null,
  insideProject: false,
  needsConfirmation: false,
  fingerprint: null,
};

describe('wizard commands', () => {
  it.each([
    [{ cmd: 'wizard.catalog' }],
    [{ cmd: 'wizard.preflight' }],
    [{ cmd: 'wizard.validate', config: { project: { name: 'x' } } }],
    [{ cmd: 'wizard.listDirs' }],
    [{ cmd: 'wizard.listDirs', path: '/home/x', showHidden: true }],
    [{ cmd: 'wizard.checkTarget', path: '/home/x/p' }],
    [{ cmd: 'wizard.generate', config: {}, path: '/home/x/p' }],
    [{ cmd: 'wizard.generate', config: {}, path: '/home/x/p', fingerprint: 'abcdef0123456789' }],
    [{ cmd: 'wizard.generation.get' }],
    [{ cmd: 'wizard.generation.get', generationId: 'g1', sinceSeq: 4 }],
    [{ cmd: 'wizard.generation.cancel', generationId: 'g1' }],
    [{ cmd: 'wizard.reveal', generationId: 'g1' }],
    [{ cmd: 'workspace.open', generationId: 'g1' }],
  ])('parses %j', (body) => {
    expect(ClientCommand.safeParse({ ...base, ...body }).success).toBe(true);
  });

  it('applies defaults to listDirs and generation.get', () => {
    const listDirs = ClientCommand.parse({ ...base, cmd: 'wizard.listDirs' });
    expect(listDirs).toMatchObject({ showHidden: false });
    const get = ClientCommand.parse({ ...base, cmd: 'wizard.generation.get' });
    expect(get).toMatchObject({ sinceSeq: 0 });
  });

  it.each([
    [{ cmd: 'wizard.validate' }],
    [{ cmd: 'wizard.validate', config: 'text' }],
    [{ cmd: 'wizard.validate', config: { blob: 'x'.repeat(MAX_CONFIG_BYTES) } }],
    [{ cmd: 'wizard.generate', config: { blob: 'x'.repeat(MAX_CONFIG_BYTES) }, path: '/a' }],
    [{ cmd: 'wizard.listDirs', path: '' }],
    [{ cmd: 'wizard.listDirs', path: '/a\0b' }],
    [{ cmd: 'wizard.listDirs', path: `/${'a'.repeat(1024)}` }],
    [{ cmd: 'wizard.checkTarget' }],
    [{ cmd: 'wizard.checkTarget', path: '/a\0' }],
    [{ cmd: 'wizard.generate', config: {} }],
    [{ cmd: 'wizard.generate', config: {}, path: '/a', fingerprint: 'XYZ' }],
    [{ cmd: 'wizard.generate', config: {}, path: '/a', fingerprint: 'abcdef012345678' }],
    [{ cmd: 'wizard.generation.get', sinceSeq: -1 }],
    [{ cmd: 'wizard.generation.get', sinceSeq: 1.5 }],
    [{ cmd: 'wizard.generation.get', generationId: '' }],
    [{ cmd: 'wizard.generation.cancel' }],
    [{ cmd: 'wizard.generation.cancel', generationId: 'x'.repeat(65) }],
    [{ cmd: 'wizard.reveal' }],
    [{ cmd: 'workspace.open' }],
    [{ cmd: 'workspace.open', path: '/a' }],
  ])('rejects %j', (body) => {
    expect(ClientCommand.safeParse({ ...base, ...body }).success).toBe(false);
  });

  it('accepts a config exactly at the size limit', () => {
    const overhead = JSON.stringify({ blob: '' }).length;
    const config = { blob: 'x'.repeat(MAX_CONFIG_BYTES - overhead) };
    expect(JSON.stringify(config).length).toBe(MAX_CONFIG_BYTES);
    expect(ClientCommand.safeParse({ ...base, cmd: 'wizard.validate', config }).success).toBe(true);
  });

  it('measures the config limit in UTF-8 bytes, not UTF-16 length', () => {
    const overhead = JSON.stringify({ blob: '' }).length;
    const config = { blob: 'ñ'.repeat((MAX_CONFIG_BYTES - overhead) / 2 + 1) };
    expect(JSON.stringify(config).length).toBeLessThanOrEqual(MAX_CONFIG_BYTES);
    expect(ClientCommand.safeParse({ ...base, cmd: 'wizard.validate', config }).success).toBe(false);
  });
});

describe('wizard events', () => {
  it('parses generation.status', () => {
    expect(ServerEvent.safeParse({ kind: 'generation.status', generation }).success).toBe(true);
  });
  it('rejects generation.status with a wrong stage count or status', () => {
    expect(ServerEvent.safeParse({ kind: 'generation.status', generation: { ...generation, stages: [] } }).success).toBe(false);
    expect(ServerEvent.safeParse({ kind: 'generation.status', generation: { ...generation, status: 'paused' } }).success).toBe(false);
  });
  it('parses generation.output and enforces chunk size and seq', () => {
    const output = { kind: 'generation.output', generationId: 'g1', seq: 1, stream: 'stdout', chunk: 'hola' };
    expect(ServerEvent.safeParse(output).success).toBe(true);
    expect(ServerEvent.safeParse({ ...output, seq: 0 }).success).toBe(false);
    expect(ServerEvent.safeParse({ ...output, stream: 'stdin' }).success).toBe(false);
    expect(ServerEvent.safeParse({ ...output, chunk: 'x'.repeat(GENERATION_CHUNK_MAX) }).success).toBe(true);
    expect(ServerEvent.safeParse({ ...output, chunk: 'x'.repeat(GENERATION_CHUNK_MAX + 1) }).success).toBe(false);
  });
  it('parses workspace.switched', () => {
    expect(ServerEvent.safeParse({ kind: 'workspace.switched', root: '/r', project: 'p' }).success).toBe(true);
    expect(ServerEvent.safeParse({ kind: 'workspace.switched', root: '/r' }).success).toBe(false);
  });
  it('decodes the new events from the wire', () => {
    const raw = JSON.stringify({ kind: 'workspace.switched', root: '/r', project: 'p' });
    expect(decodeServerMessage(raw).ok).toBe(true);
  });
});

describe('handshake and limits', () => {
  const welcome = {
    kind: 'welcome',
    protocolVersion: PROTOCOL_VERSION,
    bridgeVersion: '0.2.0',
    kitVersion: null,
    authMode: 'api-key',
  };
  it('accepts a null workspace and keeps the previous shape valid', () => {
    expect(Welcome.safeParse({ ...welcome, workspace: null }).success).toBe(true);
    expect(Welcome.safeParse({ ...welcome, workspace: { root: '/r', project: 'p' } }).success).toBe(true);
    expect(Welcome.safeParse(welcome).success).toBe(false);
  });
  it('announces the wizard features', () => {
    expect(BRIDGE_FEATURES).toContain('project-wizard');
    expect(BRIDGE_FEATURES).toContain('workspace-switch');
  });
  it('exposes the numeric limits', () => {
    expect(PROTOCOL_VERSION).toBe(2);
    expect(MAX_CONFIG_BYTES).toBe(65_536);
    expect(GENERATION_CHUNK_MAX).toBe(32_768);
    expect(GENERATION_BUFFER_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_DIR_ENTRIES).toBe(500);
    expect(WS_CLOSE_WORKSPACE_SWITCHED).toBe(4010);
  });
});

describe('wizard result types', () => {
  it('parses a TargetCheck and rejects a malformed fingerprint', () => {
    expect(TargetCheck.safeParse(check).success).toBe(true);
    expect(TargetCheck.safeParse({ ...check, fingerprint: 'abc' }).success).toBe(false);
    expect(TargetCheck.safeParse({ ...check, state: 'unknown' }).success).toBe(false);
  });
  it('parses every GenerateResult outcome', () => {
    const validation = { format: 1, cliVersion: '0.17.0', ok: false, issues: [], resolved: null };
    expect(GenerateResult.safeParse({ outcome: 'started', generation }).success).toBe(true);
    expect(GenerateResult.safeParse({ outcome: 'needs-confirmation', check }).success).toBe(true);
    expect(GenerateResult.safeParse({ outcome: 'blocked', check, reason: 'config-differs' }).success).toBe(true);
    expect(GenerateResult.safeParse({ outcome: 'invalid-config', validation }).success).toBe(true);
    expect(GenerateResult.safeParse({ outcome: 'other' }).success).toBe(false);
  });
  it('parses a GenerationSnapshot with and without generation', () => {
    const empty = { generation: null, output: [], truncatedBefore: false, hasMore: false };
    expect(GenerationSnapshot.safeParse(empty).success).toBe(true);
    const withOutput = { ...empty, generation, output: [{ seq: 1, stream: 'stderr', chunk: 'x' }] };
    expect(GenerationSnapshot.safeParse(withOutput).success).toBe(true);
    expect(GenerationState.safeParse(generation).success).toBe(true);
  });
  it('parses a ConfigValidation with issues and resolved config', () => {
    const validation = {
      format: 1,
      cliVersion: '0.17.0',
      ok: true,
      issues: [{ severity: 'warning', code: 'port-conflict', path: ['apps', 1, 'port'], message: 'm' }],
      resolved: {
        mode: 'nx',
        project: { name: 'p', packageScope: '@p' },
        apps: [
          { name: 'web', type: 'react', path: 'apps/web', port: 3000, portSource: 'default', tucuUi: true, ml: false, shell: null, route: null, stack: 'React' },
        ],
        libs: [],
        services: [{ type: 'postgres', port: 5432, version: '16' }],
        dockerCompose: true,
        profile: 'team',
      },
    };
    expect(ConfigValidation.safeParse(validation).success).toBe(true);
    expect(ConfigValidation.safeParse({ ...validation, format: 2 }).success).toBe(false);
    expect(ConfigValidation.safeParse({ ...validation, issues: [{ severity: 'info', code: 'x', path: [], message: 'm' }] }).success).toBe(false);
  });
  it('parses the CLI failure payload', () => {
    const failure = { format: 1, cliVersion: '0.17.0', ok: false, error: { code: 'unreadable', message: 'bad' } };
    expect(ConfigCliFailure.safeParse(failure).success).toBe(true);
    expect(ConfigCliFailure.safeParse({ ...failure, ok: true }).success).toBe(false);
    expect(ConfigCliFailure.safeParse({ ...failure, error: { code: 'other', message: 'm' } }).success).toBe(false);
  });
  it('parses a Preflight and a catalog result', () => {
    const preflight = {
      node: { version: '20.0.0' },
      pnpm: { found: true, version: '9.0.0' },
      git: { found: true, identity: false },
      registry: { url: null, reachable: 'unknown' },
      ready: true,
    };
    expect(Preflight.safeParse(preflight).success).toBe(true);
    const catalog = {
      format: 1,
      cliVersion: '0.17.0',
      modes: [{ mode: 'nx', maxApps: null, libs: true }, { mode: 'standalone', maxApps: 1, libs: false }],
      appTypes: [],
      libTypes: [],
      serviceTypes: [],
      profiles: ['team', 'solo'],
      patterns: { name: '^a$', packageScope: '^b$', author: '^c$' },
      portRange: { min: 1024, max: 65535 },
      targetDir: { tolerated: ['.git'] },
      jsonSchema: {},
    };
    expect(ConfigCatalog.safeParse(catalog).success).toBe(true);
    const limits = { nameMax: 64, packageScopeMax: 64, maxApps: 32, maxLibs: 32, maxServices: 16, configBytes: 65_536 };
    expect(ConfigCatalog.safeParse({ ...catalog, limits }).success).toBe(true);
    expect(ConfigCatalog.safeParse({ ...catalog, limits: { ...limits, maxApps: 0 } }).success).toBe(false);
    const nx = { majors: [22, 23, 24], default: 24, versions: { '22': '22.7.12', '23': '23.3.2', '24': '24.0.6' } };
    expect(ConfigCatalog.safeParse({ ...catalog, nx }).success).toBe(true);
    expect(ConfigCatalog.safeParse({ ...catalog, nx: { ...nx, majors: [] } }).success).toBe(false);
    const result = { catalog, initArgv: ['harness', 'init'], home: '/h', suggestedParent: '/h', platform: 'posix' };
    expect(WizardCatalogResult.safeParse(result).success).toBe(true);
    expect(WizardCatalogResult.safeParse({ ...result, platform: 'darwin' }).success).toBe(false);
  });
});
