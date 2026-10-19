# SDD Studio — Plan 1: protocolo + puente local

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `@e-burgos/sdd-studio`, un puente local que lee/observa `sdd/`, ejecuta agentes del kit con el Claude Agent SDK, pide aprobaciones y expone todo por un WebSocket tipado (`libs/studio-protocol`), testeable de punta a punta con `--engine=fake`.

**Architecture:** `libs/studio-protocol` define con zod todos los mensajes WS (handshake, comandos, eventos). `apps/studio-bridge` compone: lector+watcher de `sdd/` → snapshot y eventos de sdd-bot; `SessionManager` (hilos, cola por canal, aprobaciones, SPEC GATE, presencia) sobre una interfaz `AgentEngine` con dos implementaciones (`ClaudeAgentSdkEngine`, `FakeEngine`); `ThreadStore` persiste en `.sdd-studio/`; un servidor `ws` en loopback con token y allowlist de `Origin`.

**Tech Stack:** Node ≥ 20, TypeScript ~5.9, zod ^3.23, `@anthropic-ai/claude-agent-sdk` 0.3.292 (fijada), `ws` ^8.18, `chokidar` ^4, `citty`, `picocolors`, esbuild ^0.28, vitest ~4.1, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-10-07-sdd-studio-design.md` (§2, §3, §5, §6, §7, §8, §9, §11). La web (§4 UI, `--local-ui`, Playwright, deploy Cloudflare) va en el **Plan 2**, que se escribe después de ejecutar éste.

## Global Constraints

- El kit (`apps/cli/templates/sdd/`) **no se modifica** en este plan.
- Node ≥ 20 para el puente (`engines`); target esbuild `node20`, formato ESM.
- `@anthropic-ai/claude-agent-sdk` con versión **exacta** `0.3.292`.
- El puente escucha **sólo** en `127.0.0.1`; puerto default `4320`.
- Token de emparejamiento: 32 bytes aleatorios en base64url; comparación en tiempo constante.
- Allowlist de `Origin` por defecto: `https://studio.sdd.estebanburgos.com.ar`, `http://localhost:*`, `http://127.0.0.1:*`, ampliable con `--allow-origin`.
- `workspace.readFile` sólo bajo `sdd/`: sin `..`, sin segmentos que empiecen con `.`, sin symlinks que escapen; tope 2 MB.
- `command.run` con allowlist fija: `gate`, `validate`, `rebuild-tasks-index`, `rebuild-catalog`; args `^[A-Za-z0-9._-]{1,80}$`, máx. 4; sin shell.
- `.sdd-studio/` lleva su propio `.gitignore` con `*`; el `.gitignore` del repo no se toca.
- El puente nunca escribe en `sdd/`.
- `PROTOCOL_VERSION = 1`.
- Código e identificadores en inglés; mensajes al usuario en español (idioma del kit).
- Política de modelo/esfuerzo (AGENTS.md): cada task indica su tier; subagentes ejecutores en ese tier, revisores de task en `sonnet`/`medium`, revisión final de rama en `opus`/`high`.

### Desvíos menores respecto de la spec (decididos al planificar)

- `workspace.changed` manda el **snapshot completo de resúmenes** (es chico) en vez de "slices".
- `subagent.start` no lleva `parentToolUseId`: el hook `SubagentStart` del SDK no lo expone.
- Se agrega `channel.botHistory {channelId, limit}` y `.sdd-studio/channels/<canal>.jsonl` para que los mensajes de sdd-bot sobrevivan a recargas (la spec no lo cubría y un canal que pierde su historial al recargar es un bug de UX).
- El hilo del Orchestrator corre como **sesión principal sin `agent`** (Claude Code con el `CLAUDE.md`/`AGENTS.md` del repo, que es quien orquesta en el kit) y se muestra como `sdd-orchestrator`; los DMs a otros agentes pasan `agent: <id>`. El spike (Task 1) lo confirma.

## Review Focus

1. **Un agente reescribe un JSON de `sdd/` y el watcher lo lee a medias** → no debe haber eventos de sdd-bot espurios ni perderse el estado: el área queda `stale` con los datos anteriores (test en Task 7).
2. **Dos pestañas conectadas al mismo puente** → ambas reciben todos los eventos; una aprobación respondida en una se ve resuelta en la otra (test en Task 16).
3. **El puente se reinicia en medio de un turno** → el hilo queda `interrupted` y el siguiente `thread.send` retoma con el mismo `engineSessionId` (tests en Task 9 y Task 12).
4. **Repo en una ruta con espacios o en Windows (`C:\…`)** → el SPEC GATE y `resolveSddPath` deciden igual (tests en Task 4 y Task 8).
5. **Salidas de herramientas o diffs enormes** → se truncan (diff ≤ 4000 chars, resumen ≤ 200) y los mensajes entrantes > 1 MB se rechazan (tests en Task 10 y Task 16).

---

### Task 1: Wiring del monorepo, scaffold del puente y spike del Agent SDK

**Tier:** `opus` / `high` (el spike decide si seguimos). Requiere `claude` logueado en la máquina; si no hay login, lo corre el usuario.

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `apps/studio-bridge/package.json`, `apps/studio-bridge/tsconfig.json`, `apps/studio-bridge/tsconfig.lib.json`, `apps/studio-bridge/tsconfig.spec.json`, `apps/studio-bridge/vitest.config.ts`
- Create: `apps/studio-bridge/scripts/record-sdk-fixtures.mjs`
- Create: `apps/studio-bridge/src/engine/__fixtures__/{simple,subagent,permission,interrupt}.jsonl` (generados)
- Create: `docs/superpowers/notes/2026-10-07-sdk-spike.md`

**Interfaces:**
- Produces: fixtures jsonl con líneas `{"kind":"message"|"hook"|"canUseTool","data":…}` que consumen Task 13 y Task 14.

- [ ] **Step 1: Agregar `libs/*` al workspace**

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - libs/*
```

- [ ] **Step 2: Crear el paquete del puente**

`apps/studio-bridge/package.json`:
```json
{
  "name": "@e-burgos/sdd-studio",
  "version": "0.1.0",
  "description": "Local bridge for SDD Studio: drives the SDD kit agents with Claude on your own machine",
  "type": "module",
  "bin": { "sdd-studio": "./bin/sdd-studio.mjs" },
  "files": ["bin/", "dist/"],
  "engines": { "node": ">=20" },
  "homepage": "https://sdd.estebanburgos.com.ar",
  "author": "Esteban Burgos",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/e-burgos/sdd-harness.git",
    "directory": "apps/studio-bridge"
  },
  "scripts": {
    "build": "node build.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.lib.json && tsc --noEmit -p tsconfig.spec.json",
    "record-fixtures": "node scripts/record-sdk-fixtures.mjs"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "0.3.292",
    "chokidar": "^4.0.3",
    "citty": "^0.1.6",
    "picocolors": "^1.1.1",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.9",
    "@types/ws": "^8.5.12",
    "esbuild": "^0.28.0",
    "typescript": "~5.9.2",
    "vitest": "~4.1.0"
  }
}
```

`apps/studio-bridge/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

`apps/studio-bridge/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./dist/out-tsc", "types": ["node"] },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`apps/studio-bridge/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./dist/out-tsc", "types": ["node"] },
  "include": ["src/**/*.ts"]
}
```

`apps/studio-bridge/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    testTimeout: 30000,
  },
});
```

Run: `pnpm install`
Expected: instala sin errores; `pnpm-lock.yaml` actualizado.

- [ ] **Step 3: Script grabador de fixtures**

`apps/studio-bridge/scripts/record-sdk-fixtures.mjs`:
```js
#!/usr/bin/env node
// Graba streams reales del Agent SDK en src/engine/__fixtures__/*.jsonl para testear el
// mapeo sin gastar tokens. Necesita `claude` logueado (o ANTHROPIC_API_KEY). Usa haiku/low.
// Uso: pnpm --filter @e-burgos/sdd-studio record-fixtures [escenario]
import { query } from '@anthropic-ai/claude-agent-sdk';
import { cp, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(pkg, 'src/engine/__fixtures__');
const kitAgents = path.resolve(pkg, '../cli/templates/sdd/agents');

const SCENARIOS = {
  simple: { prompt: 'Reply with exactly the word OK. Do not use any tool.' },
  subagent: {
    prompt:
      'Use the Agent tool with subagent_type "sdd-planner" and ask it to reply with exactly the word PLANNED without using any tool. Then reply DONE.',
  },
  permission: {
    prompt: 'Use the Write tool to create a file named hello.txt containing the text hi. Do nothing else.',
  },
  interrupt: { prompt: 'Count from 1 to 200, one number per line.', interrupt: true },
};

async function makeWorkspace() {
  const dir = await mkdtemp(path.join(tmpdir(), 'sdd-studio-spike-'));
  await mkdir(path.join(dir, '.claude/agents'), { recursive: true });
  for (const file of await readdir(kitAgents)) {
    await cp(path.join(kitAgents, file), path.join(dir, '.claude/agents', file));
  }
  return dir;
}

async function record(name, scenario) {
  const cwd = await makeWorkspace();
  const lines = [];
  const log = (kind, data) => lines.push(JSON.stringify({ kind, data }));
  const hook = () => [{ hooks: [async (input) => (log('hook', input), {})] }];
  const q = query({
    prompt: scenario.prompt,
    options: {
      cwd,
      model: 'haiku',
      effort: 'low',
      settingSources: ['project'],
      forwardSubagentText: true,
      permissionMode: 'default',
      maxTurns: 6,
      canUseTool: async (toolName, input, opts) => {
        log('canUseTool', { toolName, input, toolUseID: opts.toolUseID, agentID: opts.agentID ?? null });
        return { behavior: 'deny', message: 'denied by fixture recorder' };
      },
      hooks: { SubagentStart: hook(), SubagentStop: hook(), PreToolUse: hook() },
    },
  });
  let interrupted = false;
  for await (const msg of q) {
    log('message', msg);
    if (scenario.interrupt && !interrupted && msg.type === 'assistant') {
      interrupted = true;
      await q.interrupt();
    }
  }
  await writeFile(path.join(outDir, `${name}.jsonl`), lines.join('\n') + '\n');
  console.log(`${name}: ${lines.length} records (cwd ${cwd})`);
}

await mkdir(outDir, { recursive: true });
const only = process.argv[2];
for (const [name, scenario] of Object.entries(SCENARIOS)) {
  if (!only || only === name) await record(name, scenario);
}
```

- [ ] **Step 4: Correr el spike**

Run: `env -u ANTHROPIC_API_KEY pnpm --filter @e-burgos/sdd-studio record-fixtures`
Expected: cuatro líneas `<escenario>: N records`. Si falla por auth, **detenerse y avisar al usuario** (no seguir con el plan).

- [ ] **Step 5: Revisar los fixtures por datos sensibles**

Run: `grep -lE "$HOME|@[a-z0-9.-]+\.[a-z]{2,}" apps/studio-bridge/src/engine/__fixtures__/*.jsonl`
Expected: sin coincidencias de rutas del home ni emails. Si aparecen, reemplazarlos por `/tmp/workspace` y `user@example.com` con `sed -i ''` antes de commitear.

- [ ] **Step 6: Escribir las notas del spike**

Crear `docs/superpowers/notes/2026-10-07-sdk-spike.md` respondiendo con evidencia de los fixtures (citar el campo y el valor):

```markdown
# Spike Agent SDK 0.3.292 — 2026-10-07

1. Auth sin ANTHROPIC_API_KEY: ¿funcionó? `system/init.apiKeySource` = …
2. `effort: 'low'` con haiku: ¿aceptado o error? (si error: el engine omite effort para ese modelo)
3. Subagente: nombre del tool_use que lanza subagentes (`Agent`|`Task`) = …; `input.subagent_type` = …;
   ¿mensajes con `parent_tool_use_id` ≠ null? …; `SubagentStart.agent_type` = …
4. `canUseTool`: ¿`toolUseID` y `agentID` presentes? valores …
5. Interrupt: ¿qué `result.subtype` llega después de `interrupt()`? …
6. `sdd-orchestrator.agent.md`: ¿declara `tools:` que excluya Agent? → confirma o cambia
   "Orchestrator = sesión principal sin `agent`".
Decisión: seguir / ajustar (listar ajustes a Tasks 13–14).
```

Run: `grep -n "^tools:" apps/cli/templates/sdd/agents/sdd-orchestrator.agent.md`
Expected: anotar el resultado en el punto 6.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml apps/studio-bridge docs/superpowers/notes
git commit -m "chore(studio): scaffold sdd-studio bridge and record Agent SDK fixtures"
```

---

### Task 2: `libs/studio-protocol` — dominio, snapshot y handshake

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `libs/studio-protocol/package.json`, `libs/studio-protocol/tsconfig.json`, `libs/studio-protocol/vitest.config.ts`
- Create: `libs/studio-protocol/src/{version,domain,snapshot,handshake,index}.ts`
- Test: `libs/studio-protocol/src/domain.spec.ts`, `libs/studio-protocol/src/handshake.spec.ts`

**Interfaces:**
- Produces (todos exportados desde `@sdd-studio/protocol`, cada uno como schema zod + `type` homónimo):
  `PROTOCOL_VERSION`, `KNOWN_AGENTS`, `DEFAULT_AGENT`, `AgentId`, `ModelChoice`, `Effort`, `PermissionModeChoice`, `AuthMode`, `ChannelId`, `ThreadOptions`, `Author`, `SessionStatus`, `ThreadInfo`, `PresenceState`, `Presence`, `channelForSpec(id): string`, `specIdOfChannel(ch): string | null`, `defaultThreadOptions(agent?): ThreadOptions`, `AREAS`, `Area`, `TaskSummary`, `CycleSummary`, `SpecSummary`, `FixSummary`, `AgentSummary`, `GateMode`, `WorkspaceSnapshot`, `Hello`, `Welcome`, `HandshakeErrorCode`, `HandshakeError`.

- [ ] **Step 1: Paquete**

`libs/studio-protocol/package.json`:
```json
{
  "name": "@sdd-studio/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "@types/node": "^20.19.9", "typescript": "~5.9.2", "vitest": "~4.1.0" }
}
```

`libs/studio-protocol/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

`libs/studio-protocol/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['src/**/*.spec.ts'] } });
```

Run: `pnpm install`

- [ ] **Step 2: Tests que fallan**

`libs/studio-protocol/src/domain.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  ChannelId,
  ThreadOptions,
  WorkspaceSnapshot,
  channelForSpec,
  defaultThreadOptions,
  specIdOfChannel,
} from './index';

describe('ChannelId', () => {
  it('accepts general, fixes and spec channels (mixed-case authors included)', () => {
    for (const id of ['general', 'fixes', 'spec:spec-dev-001-pagos', 'spec:spec-EBurgos-002-x']) {
      expect(ChannelId.safeParse(id).success).toBe(true);
    }
  });
  it('rejects anything else', () => {
    for (const id of ['', 'random', 'spec:', 'spec:../x', 'spec:a b', 'general2']) {
      expect(ChannelId.safeParse(id).success).toBe(false);
    }
  });
  it('round-trips spec ids', () => {
    expect(specIdOfChannel(channelForSpec('spec-dev-001-pagos'))).toBe('spec-dev-001-pagos');
    expect(specIdOfChannel('general')).toBeNull();
  });
});

describe('ThreadOptions', () => {
  it('defaults to the orchestrator with kit model', () => {
    expect(defaultThreadOptions()).toEqual({
      agent: 'sdd-orchestrator',
      model: 'kit',
      effort: null,
      permissionMode: 'default',
    });
  });
  it('rejects bypassPermissions', () => {
    const r = ThreadOptions.safeParse({ ...defaultThreadOptions(), permissionMode: 'bypassPermissions' });
    expect(r.success).toBe(false);
  });
});

describe('WorkspaceSnapshot', () => {
  it('parses a minimal snapshot', () => {
    const snap = {
      project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [],
      agents: [], gateMode: 'block', pricing: null, stale: ['specs'],
    };
    expect(WorkspaceSnapshot.parse(snap)).toEqual(snap);
  });
});
```

`libs/studio-protocol/src/handshake.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Hello, PROTOCOL_VERSION, Welcome } from './index';

describe('handshake', () => {
  it('parses hello', () => {
    const hello = { kind: 'hello', token: 't', protocolVersion: PROTOCOL_VERSION, clientVersion: '0.1.0' };
    expect(Hello.parse(hello)).toEqual(hello);
  });
  it('rejects an empty token', () => {
    expect(Hello.safeParse({ kind: 'hello', token: '', protocolVersion: 1, clientVersion: 'x' }).success).toBe(false);
  });
  it('parses welcome', () => {
    const welcome = {
      kind: 'welcome', protocolVersion: 1, bridgeVersion: '0.1.0',
      workspace: { root: '/r', project: 'p' }, kitVersion: '0.16.0', authMode: 'local-claude-login',
    };
    expect(Welcome.parse(welcome)).toEqual(welcome);
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `pnpm --filter @sdd-studio/protocol test`
Expected: FAIL (`Cannot find module './index'`).

- [ ] **Step 4: Implementación**

`libs/studio-protocol/src/version.ts`:
```ts
export const PROTOCOL_VERSION = 1;
```

`libs/studio-protocol/src/domain.ts`:
```ts
import { z } from 'zod';

export const KNOWN_AGENTS = [
  'sdd-orchestrator',
  'sdd-functional',
  'sdd-planner',
  'sdd-architect',
  'sdd-implementor-back',
  'sdd-implementor-front',
  'sdd-reviewer',
  'sdd-steward',
] as const;
export const DEFAULT_AGENT = 'sdd-orchestrator';

export const AgentId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
export type AgentId = z.infer<typeof AgentId>;
export const ModelChoice = z.enum(['kit', 'haiku', 'sonnet', 'opus', 'fable']);
export type ModelChoice = z.infer<typeof ModelChoice>;
export const Effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type Effort = z.infer<typeof Effort>;
export const PermissionModeChoice = z.enum(['default', 'acceptEdits', 'plan']);
export type PermissionModeChoice = z.infer<typeof PermissionModeChoice>;
export const AuthMode = z.enum(['local-claude-login', 'api-key']);
export type AuthMode = z.infer<typeof AuthMode>;

export const ChannelId = z.string().regex(/^(general|fixes|spec:[A-Za-z0-9][A-Za-z0-9._-]{0,127})$/);
export type ChannelId = z.infer<typeof ChannelId>;

export const ThreadOptions = z.object({
  agent: AgentId,
  model: ModelChoice,
  effort: Effort.nullable(),
  permissionMode: PermissionModeChoice,
});
export type ThreadOptions = z.infer<typeof ThreadOptions>;

export const Author = z.object({ agent: z.string().min(1), parentToolUseId: z.string().nullable() });
export type Author = z.infer<typeof Author>;

export const SessionStatus = z.enum(['queued', 'running', 'waiting-approval', 'idle', 'interrupted', 'error']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const ThreadInfo = z.object({
  id: z.string().min(1),
  channelId: ChannelId,
  title: z.string(),
  agent: AgentId,
  options: ThreadOptions,
  status: SessionStatus,
  createdAt: z.string(),
  lastActivity: z.string(),
});
export type ThreadInfo = z.infer<typeof ThreadInfo>;

export const PresenceState = z.enum(['working', 'waiting', 'open', 'idle']);
export type PresenceState = z.infer<typeof PresenceState>;
export const Presence = z.object({
  agent: z.string(),
  state: PresenceState,
  threadId: z.string().nullable(),
  specId: z.string().nullable(),
  tool: z.string().nullable(),
});
export type Presence = z.infer<typeof Presence>;

export const channelForSpec = (specId: string): string => `spec:${specId}`;
export const specIdOfChannel = (channelId: string): string | null =>
  channelId.startsWith('spec:') ? channelId.slice(5) : null;

export function defaultThreadOptions(agent: string = DEFAULT_AGENT): ThreadOptions {
  return { agent, model: 'kit', effort: null, permissionMode: 'default' };
}
```

`libs/studio-protocol/src/snapshot.ts`:
```ts
import { z } from 'zod';

export const AREAS = ['global', 'specs', 'fixes', 'agents', 'tools', 'pricing', 'kit'] as const;
export const Area = z.enum(AREAS);
export type Area = z.infer<typeof Area>;

export const TaskSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  storyPoints: z.number().nullable(),
});
export type TaskSummary = z.infer<typeof TaskSummary>;

export const CycleSummary = z.object({
  specId: z.string(),
  cycle: z.string().regex(/^cycle-\d{2}$/),
  status: z.string(),
  flow: z.string(),
  apps: z.array(z.string()),
  tasks: z.array(TaskSummary),
  tasksTotal: z.number().int().nonnegative(),
  tasksDone: z.number().int().nonnegative(),
});
export type CycleSummary = z.infer<typeof CycleSummary>;

export const SpecSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  folder: z.string(),
  module: z.string().nullable(),
  app: z.string().nullable(),
  dependsOn: z.array(z.string()),
});
export type SpecSummary = z.infer<typeof SpecSummary>;

export const FixSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.string().nullable(),
  specId: z.string().nullable(),
});
export type FixSummary = z.infer<typeof FixSummary>;

export const AgentSummary = z.object({
  id: z.string(),
  description: z.string(),
  model: z.string().nullable(),
});
export type AgentSummary = z.infer<typeof AgentSummary>;

export const GateMode = z.enum(['block', 'warn']);
export type GateMode = z.infer<typeof GateMode>;

export const WorkspaceSnapshot = z.object({
  project: z.string(),
  profile: z.string(),
  kitVersion: z.string().nullable(),
  specs: z.array(SpecSummary),
  cycles: z.array(CycleSummary),
  fixes: z.array(FixSummary),
  agents: z.array(AgentSummary),
  gateMode: GateMode,
  pricing: z.record(z.unknown()).nullable(),
  stale: z.array(Area),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshot>;
```

`libs/studio-protocol/src/handshake.ts`:
```ts
import { z } from 'zod';
import { AuthMode } from './domain';

export const Hello = z.object({
  kind: z.literal('hello'),
  token: z.string().min(1).max(256),
  protocolVersion: z.number().int(),
  clientVersion: z.string().max(64),
});
export type Hello = z.infer<typeof Hello>;

export const Welcome = z.object({
  kind: z.literal('welcome'),
  protocolVersion: z.number().int(),
  bridgeVersion: z.string(),
  workspace: z.object({ root: z.string(), project: z.string() }),
  kitVersion: z.string().nullable(),
  authMode: AuthMode,
});
export type Welcome = z.infer<typeof Welcome>;

export const HandshakeErrorCode = z.enum(['bad-token', 'protocol-mismatch', 'bad-message', 'timeout']);
export type HandshakeErrorCode = z.infer<typeof HandshakeErrorCode>;
export const HandshakeError = z.object({
  kind: z.literal('handshake.error'),
  code: HandshakeErrorCode,
  message: z.string(),
});
export type HandshakeError = z.infer<typeof HandshakeError>;
```

`libs/studio-protocol/src/index.ts`:
```ts
export * from './version';
export * from './domain';
export * from './snapshot';
export * from './handshake';
```

- [ ] **Step 5: Verificar que pasan**

Run: `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
Expected: PASS, sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add libs/studio-protocol pnpm-lock.yaml
git commit -m "feat(studio-protocol): domain, snapshot and handshake schemas"
```

---

### Task 3: `libs/studio-protocol` — eventos, comandos y codec

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `libs/studio-protocol/src/{events,commands,codec}.ts`
- Modify: `libs/studio-protocol/src/index.ts`
- Test: `libs/studio-protocol/src/{events,commands,codec}.spec.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `Usage`, `ThreadEvent` (union por `type`: `user.message`, `message.start|delta|end`, `tool.start|end`, `subagent.start|stop`, `approval.requested|resolved`, `turn.end`, `session.status`), `BotKind`, `BotEvent {channelId, botKind, payload}`, `ServerEvent` (union por `kind`: `thread.event`, `thread.updated`, `presence.changed`, `workspace.changed`, `bot.event`, `command.output`, `command.exit`), `KitCommandName`, `ClientCommand` (union por `cmd`, todos con `kind:'command'` e `id`), `ErrorCode`, `CommandResult`, `ClientMessage`, `ServerMessage`, `Decoded<T>`, `decodeClientMessage(raw)`, `decodeServerMessage(raw)`, `encodeMessage(m)`.

- [ ] **Step 1: Tests que fallan**

`libs/studio-protocol/src/events.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ServerEvent, ThreadEvent } from './index';

const author = { agent: 'sdd-planner', parentToolUseId: 'toolu_1' };

describe('ThreadEvent', () => {
  it('parses every event type', () => {
    const events = [
      { type: 'user.message', text: 'hola' },
      { type: 'message.start', messageId: 'm1', author },
      { type: 'message.delta', messageId: 'm1', text: 'x' },
      { type: 'message.end', messageId: 'm1' },
      { type: 'tool.start', toolUseId: 't1', author, tool: 'Edit', summary: 'a.ts', diff: '-a\n+b' },
      { type: 'tool.end', toolUseId: 't1', isError: false, summary: 'ok' },
      { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'subagent.stop', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'approval.requested', approvalId: 'p1', author, tool: 'Bash', summary: '$ ls', gateWarning: 'w' },
      { type: 'approval.resolved', approvalId: 'p1', decision: 'deny', reason: 'no' },
      { type: 'turn.end', usage: { model: 'claude-haiku', effort: null, tokensIn: 1, tokensOut: 2, costUsd: 0.01 } },
      { type: 'session.status', status: 'error', error: { code: 'x', message: 'y' } },
    ];
    for (const e of events) expect(ThreadEvent.parse(e)).toEqual(e);
  });
  it('rejects unknown types and negative tokens', () => {
    expect(ThreadEvent.safeParse({ type: 'nope' }).success).toBe(false);
    const bad = { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: -1, tokensOut: 0, costUsd: 0 } };
    expect(ThreadEvent.safeParse(bad).success).toBe(false);
  });
});

describe('ServerEvent', () => {
  it('parses bot.event and command.exit', () => {
    const bot = { kind: 'bot.event', channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F1' } };
    expect(ServerEvent.parse(bot)).toEqual(bot);
    expect(ServerEvent.parse({ kind: 'command.exit', runId: 'r', exitCode: 1 })).toEqual({
      kind: 'command.exit', runId: 'r', exitCode: 1,
    });
  });
});
```

`libs/studio-protocol/src/commands.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ClientCommand, defaultThreadOptions } from './index';

const base = { kind: 'command', id: 'c1' } as const;

describe('ClientCommand', () => {
  it('parses thread.create', () => {
    const cmd = { ...base, cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' };
    expect(ClientCommand.parse(cmd)).toEqual(cmd);
  });
  it('rejects unsafe or too many command.run args', () => {
    for (const args of [['a b'], ['a;b'], ['$(x)'], ['../x/..', 'a', 'b', 'c', 'd']]) {
      expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'gate', args }).success).toBe(false);
    }
    expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'gate', args: ['spec-dev-001-x', 'cycle-01'] }).success).toBe(true);
  });
  it('rejects commands outside the allowlist', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'rm', args: [] }).success).toBe(false);
  });
  it('rejects a text over 100k chars', () => {
    const cmd = { ...base, cmd: 'thread.send', threadId: 't', text: 'x'.repeat(100_001) };
    expect(ClientCommand.safeParse(cmd).success).toBe(false);
  });
  it('caps channel.botHistory limit at 200', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'channel.botHistory', channelId: 'fixes', limit: 201 }).success).toBe(false);
  });
});
```

`libs/studio-protocol/src/codec.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodeClientMessage, decodeServerMessage, encodeMessage } from './index';

describe('codec', () => {
  it('reports invalid JSON', () => {
    expect(decodeClientMessage('{')).toEqual({ ok: false, error: 'invalid JSON' });
  });
  it('decodes hello and commands', () => {
    const hello = decodeClientMessage(JSON.stringify({ kind: 'hello', token: 't', protocolVersion: 1, clientVersion: 'x' }));
    expect(hello.ok && hello.value.kind).toBe('hello');
    const cmd = decodeClientMessage(JSON.stringify({ kind: 'command', id: '1', cmd: 'workspace.snapshot' }));
    expect(cmd.ok).toBe(true);
  });
  it('rejects a well-formed but unknown message with a path in the error', () => {
    const r = decodeClientMessage(JSON.stringify({ kind: 'command', id: '1', cmd: 'nope' }));
    expect(r.ok).toBe(false);
  });
  it('round-trips a server event', () => {
    const msg = { kind: 'command.output', runId: 'r', stream: 'stdout', chunk: 'x' } as const;
    expect(decodeServerMessage(encodeMessage(msg))).toEqual({ ok: true, value: msg });
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm --filter @sdd-studio/protocol test`
Expected: FAIL (exports inexistentes).

- [ ] **Step 3: Implementación**

`libs/studio-protocol/src/events.ts`:
```ts
import { z } from 'zod';
import { Author, ChannelId, Effort, Presence, SessionStatus, ThreadInfo } from './domain';
import { Area, WorkspaceSnapshot } from './snapshot';

export const Usage = z.object({
  model: z.string(),
  effort: Effort.nullable(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type Usage = z.infer<typeof Usage>;

export const ThreadEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user.message'), text: z.string() }),
  z.object({ type: z.literal('message.start'), messageId: z.string(), author: Author }),
  z.object({ type: z.literal('message.delta'), messageId: z.string(), text: z.string() }),
  z.object({ type: z.literal('message.end'), messageId: z.string() }),
  z.object({
    type: z.literal('tool.start'),
    toolUseId: z.string(),
    author: Author,
    tool: z.string(),
    summary: z.string(),
    diff: z.string().optional(),
  }),
  z.object({ type: z.literal('tool.end'), toolUseId: z.string(), isError: z.boolean(), summary: z.string() }),
  z.object({ type: z.literal('subagent.start'), agentId: z.string(), agentType: z.string() }),
  z.object({ type: z.literal('subagent.stop'), agentId: z.string(), agentType: z.string() }),
  z.object({
    type: z.literal('approval.requested'),
    approvalId: z.string(),
    author: Author,
    tool: z.string(),
    summary: z.string(),
    diff: z.string().optional(),
    gateWarning: z.string().optional(),
  }),
  z.object({
    type: z.literal('approval.resolved'),
    approvalId: z.string(),
    decision: z.enum(['allow', 'deny']),
    reason: z.string().optional(),
  }),
  z.object({ type: z.literal('turn.end'), usage: Usage }),
  z.object({
    type: z.literal('session.status'),
    status: SessionStatus,
    error: z.object({ code: z.string(), message: z.string() }).optional(),
  }),
]);
export type ThreadEvent = z.infer<typeof ThreadEvent>;

export const BotKind = z.enum([
  'spec.created',
  'spec.status',
  'cycle.opened',
  'cycle.status',
  'task.status',
  'fix.created',
  'fix.status',
]);
export type BotKind = z.infer<typeof BotKind>;
export const BotEvent = z.object({ channelId: ChannelId, botKind: BotKind, payload: z.record(z.unknown()) });
export type BotEvent = z.infer<typeof BotEvent>;

export const ServerEvent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('thread.event'),
    threadId: z.string(),
    seq: z.number().int().nonnegative(),
    event: ThreadEvent,
  }),
  z.object({ kind: z.literal('thread.updated'), thread: ThreadInfo }),
  z.object({ kind: z.literal('presence.changed'), presence: z.array(Presence) }),
  z.object({ kind: z.literal('workspace.changed'), areas: z.array(Area), snapshot: WorkspaceSnapshot }),
  z.object({ kind: z.literal('bot.event'), ...BotEvent.shape }),
  z.object({
    kind: z.literal('command.output'),
    runId: z.string(),
    stream: z.enum(['stdout', 'stderr']),
    chunk: z.string(),
  }),
  z.object({ kind: z.literal('command.exit'), runId: z.string(), exitCode: z.number().int() }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
```

`libs/studio-protocol/src/commands.ts`:
```ts
import { z } from 'zod';
import { ChannelId, ThreadOptions } from './domain';

const Id = z.string().min(1).max(64);
const Text = z.string().min(1).max(100_000);
const SafeArg = z.string().regex(/^[A-Za-z0-9._-]{1,80}$/);
const cmd = <T extends string>(name: T) => ({ kind: z.literal('command'), id: Id, cmd: z.literal(name) });

export const KitCommandName = z.enum(['gate', 'validate', 'rebuild-tasks-index', 'rebuild-catalog']);
export type KitCommandName = z.infer<typeof KitCommandName>;

export const ClientCommand = z.discriminatedUnion('cmd', [
  z.object({ ...cmd('workspace.snapshot') }),
  z.object({ ...cmd('workspace.readFile'), path: z.string().min(1).max(512) }),
  z.object({ ...cmd('thread.create'), channelId: ChannelId, options: ThreadOptions, text: Text }),
  z.object({ ...cmd('thread.send'), threadId: Id, text: Text }),
  z.object({ ...cmd('thread.interrupt'), threadId: Id }),
  z.object({ ...cmd('thread.setOptions'), threadId: Id, options: ThreadOptions.omit({ agent: true }).partial() }),
  z.object({ ...cmd('thread.list'), channelId: ChannelId.optional() }),
  z.object({ ...cmd('thread.history'), threadId: Id, sinceSeq: z.number().int().nonnegative() }),
  z.object({ ...cmd('channel.botHistory'), channelId: ChannelId, limit: z.number().int().min(1).max(200) }),
  z.object({
    ...cmd('approval.respond'),
    approvalId: Id,
    decision: z.enum(['allow', 'deny']),
    reason: z.string().max(2000).optional(),
    scope: z.enum(['once', 'thread']),
  }),
  z.object({ ...cmd('command.run'), name: KitCommandName, args: z.array(SafeArg).max(4) }),
]);
export type ClientCommand = z.infer<typeof ClientCommand>;

export const ErrorCode = z.enum(['bad-request', 'not-found', 'bad-path', 'conflict', 'internal']);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const CommandResult = z.union([
  z.object({ kind: z.literal('result'), id: z.string(), ok: z.literal(true), data: z.unknown() }),
  z.object({
    kind: z.literal('result'),
    id: z.string(),
    ok: z.literal(false),
    error: z.object({ code: ErrorCode, message: z.string() }),
  }),
]);
export type CommandResult = z.infer<typeof CommandResult>;
```

`libs/studio-protocol/src/codec.ts`:
```ts
import { z } from 'zod';
import { ClientCommand, CommandResult } from './commands';
import { ServerEvent } from './events';
import { HandshakeError, Hello, Welcome } from './handshake';

export const ClientMessage = z.union([Hello, ClientCommand]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export const ServerMessage = z.union([Welcome, HandshakeError, CommandResult, ServerEvent]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type Decoded<T> = { ok: true; value: T } | { ok: false; error: string };

function decode<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: string): Decoded<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  const error = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  return { ok: false, error: error.slice(0, 500) };
}

export const decodeClientMessage = (raw: string): Decoded<ClientMessage> => decode(ClientMessage, raw);
export const decodeServerMessage = (raw: string): Decoded<ServerMessage> => decode(ServerMessage, raw);
export const encodeMessage = (message: ClientMessage | ServerMessage): string => JSON.stringify(message);
```

`libs/studio-protocol/src/index.ts`:
```ts
export * from './version';
export * from './domain';
export * from './snapshot';
export * from './handshake';
export * from './events';
export * from './commands';
export * from './codec';
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/studio-protocol
git commit -m "feat(studio-protocol): thread events, client commands and codec"
```

---

### Task 4: Fixture de workspace y resolución segura de rutas

**Tier:** `sonnet` / `medium`.

**Files:**
- Modify: `apps/studio-bridge/package.json` (devDependency `"@sdd-studio/protocol": "workspace:*"`)
- Create: `apps/studio-bridge/test/fixtures/workspace/` (archivos abajo)
- Create: `apps/studio-bridge/src/test-utils/fixture.ts`
- Create: `apps/studio-bridge/src/workspace/paths.ts`
- Test: `apps/studio-bridge/src/workspace/paths.spec.ts`

**Interfaces:**
- Produces: `copyFixture(): Promise<{ root: string; cleanup(): Promise<void> }>`, `waitFor<T>(fn: () => T | undefined | null | false, timeoutMs?): Promise<T>`, `class PathError extends Error { code: 'bad-path' | 'not-found' }`, `resolveSddPath(root: string, rel: string): Promise<string>`.

- [ ] **Step 1: Dependencia del protocolo**

En `apps/studio-bridge/package.json`, agregar a `devDependencies`: `"@sdd-studio/protocol": "workspace:*"` (es dev porque esbuild lo empaqueta dentro de `dist/`).

Run: `pnpm install`

- [ ] **Step 2: Fixture de workspace** (todos bajo `apps/studio-bridge/test/fixtures/workspace/`)

`sdd/global.json`:
```json
{ "project": "studio fixture", "profile": "team", "completed_modules": [], "in_progress_modules": [], "pending_modules": [] }
```

`sdd/specs/index.json`:
```json
{
  "specs": [
    {
      "id": "spec-dev-001-pagos",
      "folder": "sdd/specs/spec-dev-001-pagos",
      "file": "sdd/specs/spec-dev-001-pagos/spec-dev-001-pagos.spec.md",
      "module": "pagos",
      "app": "apps/api",
      "status": "in-progress",
      "title": "Pagos",
      "created_at": "2026-10-01",
      "completed_at": null,
      "depends_on": []
    },
    {
      "id": "spec-dev-002-borrador",
      "folder": "sdd/specs/spec-dev-002-borrador",
      "file": "sdd/specs/spec-dev-002-borrador/spec-dev-002-borrador.spec.md",
      "module": "borrador",
      "app": "apps/api",
      "status": "draft",
      "title": "Borrador",
      "created_at": "2026-10-02",
      "completed_at": null,
      "depends_on": ["spec-dev-001-pagos"]
    }
  ]
}
```

`sdd/specs/spec-dev-001-pagos/cycles/cycle-01/cycle.json`:
```json
{ "cycle": "cycle-01", "spec": "spec-dev-001-pagos", "apps": ["apps/api"], "flow": "full", "status": "in-progress" }
```

`sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json`:
```json
{
  "spec": "spec-dev-001-pagos",
  "cycle": "cycle-01",
  "flow": "full",
  "tasks": [
    { "id": "TASK-BE-001", "title": "Endpoint de pagos", "status": "done", "story_points": 3 },
    { "id": "TASK-BE-002", "title": "Tests de pagos", "status": "pending", "story_points": 2 },
    { "id": "TASK-BE-003", "title": "Descartada", "status": "skipped", "story_points": 1 }
  ]
}
```

`sdd/specs/spec-dev-001-pagos/spec-dev-001-pagos.spec.md`:
```markdown
# Pagos
```

`sdd/fixes.json`:
```json
{ "fixes": [ { "id": "FIX-dev-001-001", "title": "Typo en el recibo", "status": "pending", "severity": "low", "spec_id": "spec-dev-001-pagos" } ] }
```

`sdd/tools.json`:
```json
{ "rtk": { "enabled": false }, "claude_mod": { "enabled": false, "gate": "block" } }
```

`sdd/pricing.json`:
```json
{ "currency": "USD", "models": {} }
```

`sdd/kit.json`:
```json
{ "kit_version": "0.16.0", "files": {} }
```

`sdd/agents/sdd-orchestrator.agent.md`:
```markdown
---
name: sdd-orchestrator
description: Orquestador SDD.
model: opus
---
Cuerpo.
```

`sdd/agents/sdd-planner.agent.md`:
```markdown
---
name: sdd-planner
description: Planner SDD.
model: sonnet
---
Cuerpo.
```

`sdd/scripts/spec-gate.mjs` (stub para Task 15):
```js
const args = process.argv.slice(2);
console.log(`gate ${args.join(' ')}`);
if (args[0] === 'blocked') {
  console.error('blocked');
  process.exit(1);
}
```

`sdd/scripts/validate-sdd.mjs`:
```js
console.log('validate ok');
```

`apps/studio-bridge/test/fixtures/workspace/apps/api/.gitkeep`: vacío.

- [ ] **Step 3: Utilidades de test**

`apps/studio-bridge/src/test-utils/fixture.ts`:
```ts
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE_ROOT = fileURLToPath(new URL('../../test/fixtures/workspace', import.meta.url));

export async function copyFixture(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(tmpdir(), 'sdd studio '));
  await cp(FIXTURE_ROOT, root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export async function waitFor<T>(fn: () => T | undefined | null | false, timeoutMs = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
```

(El prefijo `sdd studio ` con espacio es deliberado: cubre el punto 4 del Review Focus en todos los tests.)

- [ ] **Step 4: Test que falla**

`apps/studio-bridge/src/workspace/paths.spec.ts`:
```ts
import { symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { PathError, resolveSddPath } from './paths';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

describe('resolveSddPath', () => {
  it('resolves a file under sdd/', async () => {
    const p = await resolveSddPath(root, 'sdd/global.json');
    expect(p.endsWith(path.join('sdd', 'global.json'))).toBe(true);
  });

  it.each(['../x', 'sdd/../package.json', '/etc/passwd', 'C:/x', 'C:\\x', 'sdd/.secret', 'other/x', 'sdd//x', ''])(
    'rejects %j',
    async (rel) => {
      await expect(resolveSddPath(root, rel)).rejects.toMatchObject({ code: 'bad-path' });
    },
  );

  it('reports missing files as not-found', async () => {
    await expect(resolveSddPath(root, 'sdd/nope.json')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects a symlink that escapes sdd/', async () => {
    await writeFile(path.join(root, 'outside.txt'), 'secret');
    try {
      await symlink(path.join(root, 'outside.txt'), path.join(root, 'sdd', 'link.txt'));
    } catch {
      return; // Windows sin privilegio de symlink: el caso no aplica.
    }
    await expect(resolveSddPath(root, 'sdd/link.txt')).rejects.toBeInstanceOf(PathError);
  });
});
```

- [ ] **Step 5: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- paths`
Expected: FAIL (`Cannot find module './paths'`).

- [ ] **Step 6: Implementación**

`apps/studio-bridge/src/workspace/paths.ts`:
```ts
import { realpath } from 'node:fs/promises';
import path from 'node:path';

export class PathError extends Error {
  constructor(
    readonly code: 'bad-path' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

/** Resuelve `rel` (posix, relativo a la raíz) sólo si queda dentro de `sdd/` sin escapar. */
export async function resolveSddPath(root: string, rel: string): Promise<string> {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) {
    throw new PathError('bad-path', 'ruta vacía o demasiado larga');
  }
  const norm = rel.replace(/\\/g, '/');
  if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm)) throw new PathError('bad-path', 'ruta absoluta');
  const parts = norm.split('/');
  if (parts[0] !== 'sdd') throw new PathError('bad-path', 'fuera de sdd/');
  if (parts.some((p) => p === '' || p.startsWith('.'))) throw new PathError('bad-path', 'segmento inválido');
  const sddReal = await realpath(path.join(root, 'sdd'));
  let real: string;
  try {
    real = await realpath(path.join(root, ...parts));
  } catch {
    throw new PathError('not-found', `no existe: ${norm}`);
  }
  if (real !== sddReal && !real.startsWith(sddReal + path.sep)) {
    throw new PathError('bad-path', 'la ruta escapa de sdd/');
  }
  return real;
}
```

- [ ] **Step 7: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- paths`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/studio-bridge pnpm-lock.yaml
git commit -m "feat(studio-bridge): fixture workspace and sdd/-scoped path resolution"
```

---

### Task 5: Snapshot del workspace

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/workspace/snapshot.ts`
- Test: `apps/studio-bridge/src/workspace/snapshot.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceSnapshot`, `Area` (Task 2); `copyFixture` (Task 4).
- Produces: `interface LoadResult { snapshot: WorkspaceSnapshot; failed: Area[] }`, `loadWorkspaceSnapshot(root): Promise<LoadResult>`, `mergeSnapshot(prev: WorkspaceSnapshot | null, next: LoadResult): WorkspaceSnapshot`, `changedAreas(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): Area[]`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/workspace/snapshot.spec.ts`:
```ts
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { changedAreas, loadWorkspaceSnapshot, mergeSnapshot } from './snapshot';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

const tasksFile = () => path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');

describe('loadWorkspaceSnapshot', () => {
  it('summarizes the fixture', async () => {
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.project).toBe('studio fixture');
    expect(snapshot.profile).toBe('team');
    expect(snapshot.kitVersion).toBe('0.16.0');
    expect(snapshot.gateMode).toBe('block');
    expect(snapshot.specs.map((s) => s.id)).toEqual(['spec-dev-001-pagos', 'spec-dev-002-borrador']);
    expect(snapshot.specs[1]?.dependsOn).toEqual(['spec-dev-001-pagos']);
    expect(snapshot.cycles).toHaveLength(1);
    expect(snapshot.cycles[0]).toMatchObject({
      specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'full',
      apps: ['apps/api'], tasksTotal: 2, tasksDone: 1,
    });
    expect(snapshot.fixes).toEqual([
      { id: 'FIX-dev-001-001', title: 'Typo en el recibo', status: 'pending', severity: 'low', specId: 'spec-dev-001-pagos' },
    ]);
    expect(snapshot.agents).toEqual([
      { id: 'sdd-orchestrator', description: 'Orquestador SDD.', model: 'opus' },
      { id: 'sdd-planner', description: 'Planner SDD.', model: 'sonnet' },
    ]);
  });

  it('defaults gateMode to block and project to the folder name when files are missing', async () => {
    await rm(path.join(root, 'sdd/tools.json'));
    await rm(path.join(root, 'sdd/global.json'));
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.gateMode).toBe('block');
    expect(snapshot.project).toBe(path.basename(root));
  });

  it('marks specs as failed when a cycle file is invalid JSON', async () => {
    await writeFile(tasksFile(), '{ "tasks": [');
    const { failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toContain('specs');
  });

  it('parses agent frontmatter with CRLF line endings', async () => {
    await writeFile(
      path.join(root, 'sdd/agents/sdd-reviewer.agent.md'),
      '---\r\nname: sdd-reviewer\r\ndescription: Reviewer.\r\nmodel: opus\r\n---\r\nx',
    );
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.agents.find((a) => a.id === 'sdd-reviewer')).toEqual({
      id: 'sdd-reviewer', description: 'Reviewer.', model: 'opus',
    });
  });
});

describe('mergeSnapshot / changedAreas', () => {
  it('keeps the previous data of a failed area and flags it stale', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(tasksFile(), '{ broken');
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(next.stale).toEqual(['specs']);
    expect(next.cycles).toEqual(prev.cycles);
    expect(changedAreas(prev, next)).toEqual(['specs']);
  });

  it('detects a fixes change only', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes: [] }));
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(changedAreas(prev, next)).toEqual(['fixes']);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- snapshot`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/workspace/snapshot.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentSummary,
  Area,
  CycleSummary,
  FixSummary,
  SpecSummary,
  TaskSummary,
  WorkspaceSnapshot,
} from '@sdd-studio/protocol';

type Json = Record<string, any>;
type ReadResult = { ok: true; value: Json | null } | { ok: false };

export interface LoadResult {
  snapshot: WorkspaceSnapshot;
  failed: Area[];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

async function readJson(file: string): Promise<ReadResult> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { ok: true, value: null } : { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as Json };
  } catch {
    return { ok: false };
  }
}

const toTask = (t: Json): TaskSummary => ({
  id: str(t.id),
  title: str(t.title, str(t.id)),
  status: str(t.status, 'pending'),
  storyPoints: typeof t.story_points === 'number' ? t.story_points : null,
});

const toSpec = (s: Json): SpecSummary => ({
  id: str(s.id),
  title: str(s.title, str(s.id)),
  status: str(s.status, 'draft'),
  folder: str(s.folder),
  module: strOrNull(s.module),
  app: strOrNull(s.app),
  dependsOn: strings(s.depends_on),
});

const toFix = (f: Json): FixSummary => ({
  id: str(f.id),
  title: str(f.title, str(f.id)),
  status: str(f.status, 'pending'),
  severity: strOrNull(f.severity),
  specId: strOrNull(f.spec_id),
});

async function loadSpecs(root: string, sdd: string) {
  const index = await readJson(path.join(sdd, 'specs', 'index.json'));
  if (!index.ok) return { ok: false, specs: [] as SpecSummary[], cycles: [] as CycleSummary[] };
  let ok = true;
  const specs = (Array.isArray(index.value?.specs) ? index.value.specs : []).map(toSpec);
  const cycles: CycleSummary[] = [];
  for (const spec of specs) {
    if (!spec.folder) continue;
    const dir = path.join(root, ...spec.folder.split('/'), 'cycles');
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.filter((n) => /^cycle-\d{2}$/.test(n)).sort()) {
      const [cycle, tasks] = await Promise.all([
        readJson(path.join(dir, name, 'cycle.json')),
        readJson(path.join(dir, name, 'tasks.json')),
      ]);
      if (!cycle.ok || !tasks.ok) {
        ok = false;
        continue;
      }
      const list = (Array.isArray(tasks.value?.tasks) ? tasks.value.tasks : []).map(toTask);
      const counted = list.filter((t: TaskSummary) => t.status !== 'skipped');
      cycles.push({
        specId: spec.id,
        cycle: name,
        status: str(cycle.value?.status, 'unknown'),
        flow: str(cycle.value?.flow, str(tasks.value?.flow, 'full')),
        apps: strings(cycle.value?.apps),
        tasks: list,
        tasksTotal: counted.length,
        tasksDone: counted.filter((t: TaskSummary) => t.status === 'done').length,
      });
    }
  }
  return { ok, specs, cycles };
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'));
  const out: Record<string, string> = {};
  for (const line of match?.[1]?.split('\n') ?? []) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv?.[1] && kv[2] !== undefined) out[kv[1]] = kv[2].trim();
  }
  return out;
}

async function loadAgents(dir: string): Promise<AgentSummary[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const agents: AgentSummary[] = [];
  for (const name of names.filter((n) => n.endsWith('.agent.md')).sort()) {
    const text = await readFile(path.join(dir, name), 'utf8').catch(() => '');
    const fm = parseFrontmatter(text);
    agents.push({
      id: fm.name ?? name.replace(/\.agent\.md$/, ''),
      description: fm.description ?? '',
      model: fm.model ?? null,
    });
  }
  return agents;
}

export async function loadWorkspaceSnapshot(root: string): Promise<LoadResult> {
  const sdd = path.join(root, 'sdd');
  const failed: Area[] = [];
  const read = async (area: Area, rel: string): Promise<Json | null> => {
    const result = await readJson(path.join(sdd, rel));
    if (!result.ok) {
      failed.push(area);
      return null;
    }
    return result.value;
  };
  const [global, tools, pricing, kit, fixes] = await Promise.all([
    read('global', 'global.json'),
    read('tools', 'tools.json'),
    read('pricing', 'pricing.json'),
    read('kit', 'kit.json'),
    read('fixes', 'fixes.json'),
  ]);
  const specs = await loadSpecs(root, sdd);
  if (!specs.ok) failed.push('specs');
  const snapshot: WorkspaceSnapshot = {
    project: str(global?.project, path.basename(root)),
    profile: str(global?.profile, 'team'),
    kitVersion: strOrNull(kit?.kit_version),
    specs: specs.specs,
    cycles: specs.cycles,
    fixes: Array.isArray(fixes?.fixes) ? fixes.fixes.map(toFix) : [],
    agents: await loadAgents(path.join(sdd, 'agents')),
    gateMode: tools?.claude_mod?.gate === 'warn' ? 'warn' : 'block',
    pricing: pricing && typeof pricing === 'object' ? pricing : null,
    stale: [],
  };
  return { snapshot, failed };
}

const AREA_FIELDS: Record<Area, (keyof WorkspaceSnapshot)[]> = {
  global: ['project', 'profile'],
  specs: ['specs', 'cycles'],
  fixes: ['fixes'],
  agents: ['agents'],
  tools: ['gateMode'],
  pricing: ['pricing'],
  kit: ['kitVersion'],
};

export function mergeSnapshot(prev: WorkspaceSnapshot | null, next: LoadResult): WorkspaceSnapshot {
  const out: WorkspaceSnapshot = { ...next.snapshot, stale: [...next.failed] };
  if (prev) {
    for (const area of next.failed) {
      for (const field of AREA_FIELDS[area]) (out as Record<string, unknown>)[field] = prev[field];
    }
  }
  return out;
}

export function changedAreas(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): Area[] {
  return (Object.keys(AREA_FIELDS) as Area[]).filter((area) => {
    const fieldsChanged = AREA_FIELDS[area].some(
      (field) => JSON.stringify(prev[field]) !== JSON.stringify(next[field]),
    );
    return fieldsChanged || prev.stale.includes(area) !== next.stale.includes(area);
  });
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- snapshot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/workspace
git commit -m "feat(studio-bridge): workspace snapshot loader with stale areas"
```

---

### Task 6: Eventos de sdd-bot (diff de snapshots)

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/workspace/diff.ts`
- Test: `apps/studio-bridge/src/workspace/diff.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceSnapshot`, `BotEvent`, `channelForSpec` (Tasks 2–3).
- Produces: `diffSnapshots(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): BotEvent[]`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/workspace/diff.spec.ts`:
```ts
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { diffSnapshots } from './diff';

const base: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, agents: [], gateMode: 'block', pricing: null, stale: [],
  specs: [{ id: 's1', title: 'S1', status: 'in-progress', folder: 'sdd/specs/s1', module: null, app: null, dependsOn: [] }],
  cycles: [{
    specId: 's1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasksTotal: 1, tasksDone: 0,
    tasks: [{ id: 'T1', title: 'Task 1', status: 'pending', storyPoints: 1 }],
  }],
  fixes: [{ id: 'F1', title: 'Fix 1', status: 'pending', severity: 'low', specId: 's1' }],
};
const clone = (): WorkspaceSnapshot => structuredClone(base);

describe('diffSnapshots', () => {
  it('emits nothing for identical snapshots', () => {
    expect(diffSnapshots(base, clone())).toEqual([]);
  });

  it('reports a new spec and a spec status change', () => {
    const next = clone();
    next.specs[0]!.status = 'completed';
    next.specs.push({ id: 's2', title: 'S2', status: 'draft', folder: 'sdd/specs/s2', module: null, app: null, dependsOn: [] });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'spec:s1', botKind: 'spec.status', payload: { specId: 's1', from: 'in-progress', to: 'completed' } },
      { channelId: 'spec:s2', botKind: 'spec.created', payload: { specId: 's2', title: 'S2', status: 'draft' } },
    ]);
  });

  it('reports cycle opened, cycle status and task status', () => {
    const next = clone();
    next.cycles[0]!.status = 'completed';
    next.cycles[0]!.tasks[0]!.status = 'done';
    next.cycles.push({ ...structuredClone(base.cycles[0]!), cycle: 'cycle-02', status: 'in-progress' });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'spec:s1', botKind: 'cycle.status', payload: { specId: 's1', cycle: 'cycle-01', from: 'in-progress', to: 'completed' } },
      { channelId: 'spec:s1', botKind: 'task.status', payload: { specId: 's1', cycle: 'cycle-01', taskId: 'T1', title: 'Task 1', from: 'pending', to: 'done' } },
      { channelId: 'spec:s1', botKind: 'cycle.opened', payload: { specId: 's1', cycle: 'cycle-02', flow: 'full', status: 'in-progress' } },
    ]);
  });

  it('reports fixes on the fixes channel', () => {
    const next = clone();
    next.fixes[0]!.status = 'resolved';
    next.fixes.push({ id: 'F2', title: 'Fix 2', status: 'pending', severity: 'high', specId: null });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'F1', from: 'pending', to: 'resolved' } },
      { channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F2', title: 'Fix 2', severity: 'high', specId: null } },
    ]);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- diff`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/workspace/diff.ts`:
```ts
import { channelForSpec, type BotEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';

export function diffSnapshots(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): BotEvent[] {
  const events: BotEvent[] = [];

  const prevSpecs = new Map(prev.specs.map((s) => [s.id, s]));
  for (const spec of next.specs) {
    const before = prevSpecs.get(spec.id);
    const channelId = channelForSpec(spec.id);
    if (!before) {
      events.push({ channelId, botKind: 'spec.created', payload: { specId: spec.id, title: spec.title, status: spec.status } });
    } else if (before.status !== spec.status) {
      events.push({ channelId, botKind: 'spec.status', payload: { specId: spec.id, from: before.status, to: spec.status } });
    }
  }

  const prevCycles = new Map(prev.cycles.map((c) => [`${c.specId}/${c.cycle}`, c]));
  for (const cycle of next.cycles) {
    const before = prevCycles.get(`${cycle.specId}/${cycle.cycle}`);
    const channelId = channelForSpec(cycle.specId);
    const ids = { specId: cycle.specId, cycle: cycle.cycle };
    if (!before) {
      events.push({ channelId, botKind: 'cycle.opened', payload: { ...ids, flow: cycle.flow, status: cycle.status } });
      continue;
    }
    if (before.status !== cycle.status) {
      events.push({ channelId, botKind: 'cycle.status', payload: { ...ids, from: before.status, to: cycle.status } });
    }
    const prevTasks = new Map(before.tasks.map((t) => [t.id, t]));
    for (const task of cycle.tasks) {
      const was = prevTasks.get(task.id);
      if (was && was.status !== task.status) {
        events.push({
          channelId,
          botKind: 'task.status',
          payload: { ...ids, taskId: task.id, title: task.title, from: was.status, to: task.status },
        });
      }
    }
  }

  const prevFixes = new Map(prev.fixes.map((f) => [f.id, f]));
  for (const fix of next.fixes) {
    const before = prevFixes.get(fix.id);
    if (!before) {
      events.push({
        channelId: 'fixes',
        botKind: 'fix.created',
        payload: { fixId: fix.id, title: fix.title, severity: fix.severity, specId: fix.specId },
      });
    } else if (before.status !== fix.status) {
      events.push({ channelId: 'fixes', botKind: 'fix.status', payload: { fixId: fix.id, from: before.status, to: fix.status } });
    }
  }
  return events;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- diff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/workspace/diff.ts apps/studio-bridge/src/workspace/diff.spec.ts
git commit -m "feat(studio-bridge): sdd-bot events from snapshot diffs"
```

---

### Task 7: Watcher de `sdd/`

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/workspace/watcher.ts`
- Test: `apps/studio-bridge/src/workspace/watcher.spec.ts`

**Interfaces:**
- Consumes: Tasks 5–6.
- Produces: `interface WorkspaceUpdate { snapshot: WorkspaceSnapshot; areas: Area[]; events: BotEvent[] }`, `interface WorkspaceWatcher { current(): WorkspaceSnapshot; refresh(): Promise<WorkspaceUpdate | null>; close(): Promise<void> }`, `startWorkspaceWatcher(opts: { root: string; debounceMs?: number; onUpdate(u: WorkspaceUpdate): void; onError?(e: unknown): void }): Promise<WorkspaceWatcher>`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/workspace/watcher.spec.ts`:
```ts
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { startWorkspaceWatcher, type WorkspaceUpdate, type WorkspaceWatcher } from './watcher';

let root: string;
let cleanup: () => Promise<void>;
let watcher: WorkspaceWatcher | undefined;
const updates: WorkspaceUpdate[] = [];

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  updates.length = 0;
  watcher = await startWorkspaceWatcher({ root, debounceMs: 50, onUpdate: (u) => updates.push(u) });
});
afterEach(async () => {
  await watcher?.close();
  await cleanup();
});

const tasksFile = () => path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');

describe('startWorkspaceWatcher', () => {
  it('exposes the initial snapshot', () => {
    expect(watcher!.current().project).toBe('studio fixture');
  });

  it('emits a task.status bot event when a task changes', async () => {
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    const update = await waitFor(() => updates.find((u) => u.events.some((e) => e.botKind === 'task.status')));
    expect(update.areas).toContain('specs');
    expect(watcher!.current().cycles[0]?.tasksDone).toBe(2);
  });

  it('keeps the last good state while a file is half-written, then recovers', async () => {
    const good = await readFile(tasksFile(), 'utf8');
    await writeFile(tasksFile(), '{ "tasks": [');
    await waitFor(() => watcher!.current().stale.includes('specs'));
    expect(watcher!.current().cycles[0]?.tasksDone).toBe(1);
    expect(updates.flatMap((u) => u.events)).toEqual([]);
    await writeFile(tasksFile(), good);
    await waitFor(() => watcher!.current().stale.length === 0);
    expect(updates.flatMap((u) => u.events)).toEqual([]);
  });

  it('stops after close', async () => {
    await watcher!.close();
    watcher = undefined;
    await writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes: [] }));
    await new Promise((r) => setTimeout(r, 300));
    expect(updates).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- watcher`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/workspace/watcher.ts`:
```ts
import path from 'node:path';
import chokidar from 'chokidar';
import type { Area, BotEvent, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { diffSnapshots } from './diff';
import { changedAreas, loadWorkspaceSnapshot, mergeSnapshot } from './snapshot';

export interface WorkspaceUpdate {
  snapshot: WorkspaceSnapshot;
  areas: Area[];
  events: BotEvent[];
}

export interface WorkspaceWatcher {
  current(): WorkspaceSnapshot;
  refresh(): Promise<WorkspaceUpdate | null>;
  close(): Promise<void>;
}

const IGNORED = /[\\/]sdd[\\/](docs|node_modules)([\\/]|$)/;

export async function startWorkspaceWatcher(opts: {
  root: string;
  debounceMs?: number;
  onUpdate: (update: WorkspaceUpdate) => void;
  onError?: (error: unknown) => void;
}): Promise<WorkspaceWatcher> {
  let current = mergeSnapshot(null, await loadWorkspaceSnapshot(opts.root));
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<WorkspaceUpdate | null> | null = null;
  let dirty = false;
  let closed = false;

  const refresh = async (): Promise<WorkspaceUpdate | null> => {
    const next = mergeSnapshot(current, await loadWorkspaceSnapshot(opts.root));
    const areas = changedAreas(current, next);
    if (areas.length === 0 || closed) return null;
    const update = { snapshot: next, areas, events: diffSnapshots(current, next) };
    current = next;
    opts.onUpdate(update);
    return update;
  };

  const run = async (): Promise<void> => {
    timer = null;
    if (running) {
      dirty = true;
      return;
    }
    running = refresh().catch((error) => {
      opts.onError?.(error);
      return null;
    });
    await running;
    running = null;
    if (dirty && !closed) {
      dirty = false;
      schedule();
    }
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), opts.debounceMs ?? 200);
  };

  const watcher = chokidar.watch(path.join(opts.root, 'sdd'), {
    ignoreInitial: true,
    ignored: (p: string) => IGNORED.test(p),
  });
  watcher.on('all', schedule);
  watcher.on('error', (error) => opts.onError?.(error));
  await new Promise<void>((resolve) => watcher.once('ready', () => resolve()));

  return {
    current: () => current,
    refresh: async () => {
      if (running) await running;
      return refresh();
    },
    close: async () => {
      closed = true;
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
```

- [ ] **Step 4: Verificar que pasa (tres corridas para detectar flakiness)**

Run: `for i in 1 2 3; do pnpm --filter @e-burgos/sdd-studio test -- watcher || break; done`
Expected: PASS las tres veces.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/workspace/watcher.ts apps/studio-bridge/src/workspace/watcher.spec.ts
git commit -m "feat(studio-bridge): debounced sdd/ watcher with stale-safe updates"
```

---

### Task 8: SPEC GATE (juez de ediciones)

**Tier:** `opus` / `high` (regla dura del kit).

**Files:**
- Create: `apps/studio-bridge/src/gate/judge.ts`
- Test: `apps/studio-bridge/src/gate/judge.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceSnapshot`.
- Produces: `type Verdict = { kind: 'allow' } | { kind: 'warn'; reason: string } | { kind: 'deny'; reason: string }`, `EDIT_TOOLS: Set<string>`, `editTargetOf(toolName: string, input: Record<string, unknown>): string | null`, `relativeToRoot(root, filePath): string | null`, `isCodePath(rel): boolean`, `judgeEdit(snapshot, root, filePath): Verdict`.

Fuente de verdad de la regla: `apps/cli/templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts` (`judgeEdit`). Diferencias deliberadas: la app aplica el gate siempre (no depende de `claude_mod.enabled`, sólo de `claude_mod.gate`), y si `specs` o `fixes` están `stale` permite, igual que el mod cuando no puede leer `sdd/`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/gate/judge.spec.ts`:
```ts
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { editTargetOf, isCodePath, judgeEdit, relativeToRoot } from './judge';

const idle: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, specs: [], agents: [], gateMode: 'block', pricing: null, stale: [],
  cycles: [{ specId: 's', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 }],
  fixes: [{ id: 'F', title: 'f', status: 'resolved', severity: null, specId: null }],
};
const ROOT = '/repo with spaces';

describe('relativeToRoot', () => {
  it.each([
    ['/repo with spaces/apps/a.ts', 'apps/a.ts'],
    ['apps/../apps/b.ts', 'apps/b.ts'],
    ['/elsewhere/x.ts', null],
  ])('%s → %s', (input, expected) => {
    expect(relativeToRoot(ROOT, input)).toBe(expected);
  });
  it('handles Windows paths', () => {
    expect(relativeToRoot('C:\\work\\repo', 'C:\\work\\repo\\apps\\a.ts')).toBe('apps/a.ts');
    expect(relativeToRoot('C:\\work\\repo', 'D:\\other\\a.ts')).toBeNull();
  });
});

describe('isCodePath', () => {
  it.each([
    ['apps/a.ts', true], ['README.md', false], ['package.json', true],
    ['sdd/specs/x.md', false], ['.claude/agents/x.md', false], ['libs/x/README.md', true],
  ])('%s → %s', (rel, expected) => {
    expect(isCodePath(rel)).toBe(expected);
  });
});

describe('editTargetOf', () => {
  it('extracts file_path / notebook_path from edit tools only', () => {
    expect(editTargetOf('Edit', { file_path: '/a' })).toBe('/a');
    expect(editTargetOf('NotebookEdit', { notebook_path: '/n.ipynb' })).toBe('/n.ipynb');
    expect(editTargetOf('Bash', { command: 'rm -rf /' })).toBeNull();
    expect(editTargetOf('Write', {})).toBeNull();
  });
});

describe('judgeEdit', () => {
  it('denies code edits without an active cycle or open fix in block mode', () => {
    const v = judgeEdit(idle, ROOT, `${ROOT}/apps/a.ts`);
    expect(v.kind).toBe('deny');
    expect(v.kind !== 'allow' && v.reason).toContain('SPEC GATE');
  });
  it('warns in warn mode', () => {
    expect(judgeEdit({ ...idle, gateMode: 'warn' }, ROOT, `${ROOT}/apps/a.ts`).kind).toBe('warn');
  });
  it('allows sdd/ and docs at the root', () => {
    expect(judgeEdit(idle, ROOT, `${ROOT}/sdd/specs/x.md`)).toEqual({ kind: 'allow' });
    expect(judgeEdit(idle, ROOT, `${ROOT}/README.md`)).toEqual({ kind: 'allow' });
  });
  it('allows with an in-progress cycle or an open fix', () => {
    const cycle = structuredClone(idle);
    cycle.cycles[0]!.status = 'in-progress';
    expect(judgeEdit(cycle, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
    const fix = structuredClone(idle);
    fix.fixes[0]!.status = 'in-progress';
    expect(judgeEdit(fix, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it('allows when specs or fixes could not be read', () => {
    expect(judgeEdit({ ...idle, stale: ['specs'] }, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it('allows files outside the repo (not ours to judge)', () => {
    expect(judgeEdit(idle, ROOT, '/tmp/x.ts')).toEqual({ kind: 'allow' });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- judge`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/gate/judge.ts`:
```ts
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';

export type Verdict = { kind: 'allow' } | { kind: 'warn'; reason: string } | { kind: 'deny'; reason: string };

// Misma regla que sdd-mod (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts): mantener en sincronía.
const EXEMPT_DIRS = new Set(['sdd', '.claude', '.github', '.gemini', '.agents', '.agent', '.vscode', '.idea']);
const OPEN_FIX = new Set(['pending', 'in-progress']);
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function editTargetOf(toolName: string, input: Record<string, unknown>): string | null {
  if (!EDIT_TOOLS.has(toolName)) return null;
  const target = input.file_path ?? input.notebook_path;
  return typeof target === 'string' ? target : null;
}

/** Ruta relativa a la raíz con `/`, o null si cae fuera. */
export function relativeToRoot(root: string, filePath: string): string | null {
  const norm = (p: string) => p.replace(/\\/g, '/');
  const base = norm(root).replace(/\/+$/, '');
  const raw = norm(filePath);
  const isAbsolute = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw);
  const parts: string[] = [];
  for (const part of (isAbsolute ? raw : `${base}/${raw}`).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const full = (raw.startsWith('/') || base.startsWith('/') ? '/' : '') + parts.join('/');
  if (!full.startsWith(`${base}/`)) return null;
  return full.slice(base.length + 1);
}

export function isCodePath(rel: string): boolean {
  const [first, ...rest] = rel.split('/');
  if (rest.length === 0) return !/\.md$/i.test(first ?? '');
  return !EXEMPT_DIRS.has(first ?? '');
}

export function judgeEdit(snapshot: WorkspaceSnapshot, root: string, filePath: string): Verdict {
  if (snapshot.stale.includes('specs') || snapshot.stale.includes('fixes')) return { kind: 'allow' };
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel)) return { kind: 'allow' };
  const active =
    snapshot.cycles.some((c) => c.status === 'in-progress') || snapshot.fixes.some((f) => OPEN_FIX.has(f.status));
  if (active) return { kind: 'allow' };
  const reason =
    `SPEC GATE: no hay ningún ciclo in-progress ni un fix abierto, así que todavía no se escribe ` +
    `código (${rel}). Abrí un ciclo (/gate <spec> → orchestrator) o registrá el cambio con ` +
    `[FIX]/[BUGFIX]/[HOTFIX]. Reglas: sdd/dual-harness/rules/sdd-gates.md.`;
  return snapshot.gateMode === 'block' ? { kind: 'deny', reason } : { kind: 'warn', reason };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- judge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/gate
git commit -m "feat(studio-bridge): SPEC GATE judge for agent edits"
```

---

### Task 9: `ThreadStore` (`.sdd-studio/`)

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/sessions/store.ts`
- Test: `apps/studio-bridge/src/sessions/store.spec.ts`

**Interfaces:**
- Consumes: `ThreadInfo`, `ThreadEvent`, `BotEvent`.
- Produces: `interface StoredThread extends ThreadInfo { engineSessionId: string | null }`, `interface HistoryEntry { seq: number; event: ThreadEvent }`, `class ThreadStore { constructor(root); init(): Promise<void>; list(channelId?): StoredThread[]; get(id): StoredThread | undefined; upsert(t): Promise<void>; append(threadId, event): number; history(threadId, sinceSeq): Promise<HistoryEntry[]>; appendBot(e: BotEvent): void; botHistory(channelId, limit): Promise<BotEvent[]>; flush(): Promise<void> }`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/sessions/store.spec.ts`:
```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { ThreadStore, type StoredThread } from './store';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

const thread = (over: Partial<StoredThread> = {}): StoredThread => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator', options: defaultThreadOptions(),
  status: 'idle', createdAt: '2026-10-07T00:00:00.000Z', lastActivity: '2026-10-07T00:00:00.000Z',
  engineSessionId: null, ...over,
});

describe('ThreadStore', () => {
  it('creates a self-ignoring .sdd-studio folder', async () => {
    await new ThreadStore(root).init();
    expect(await readFile(path.join(root, '.sdd-studio/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('persists threads and events across instances', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ engineSessionId: 'sess-1' }));
    expect(a.append('t1', { type: 'user.message', text: 'hola' })).toBe(0);
    expect(a.append('t1', { type: 'message.end', messageId: 'm' })).toBe(1);
    await a.flush();

    const b = new ThreadStore(root);
    await b.init();
    expect(b.get('t1')?.engineSessionId).toBe('sess-1');
    expect(await b.history('t1', 1)).toEqual([{ seq: 1, event: { type: 'message.end', messageId: 'm' } }]);
    expect(b.append('t1', { type: 'message.end', messageId: 'n' })).toBe(2);
  });

  it('marks busy threads as interrupted after a restart', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ id: 'r', status: 'running' }));
    await a.upsert(thread({ id: 'w', status: 'waiting-approval' }));
    await a.upsert(thread({ id: 'q', status: 'queued' }));
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    expect(b.list().map((t) => [t.id, t.status])).toEqual([['r', 'interrupted'], ['w', 'interrupted'], ['q', 'interrupted']]);
  });

  it('filters by channel and returns [] for unknown thread history', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread({ id: 'a', channelId: 'fixes' }));
    await s.upsert(thread({ id: 'b', channelId: 'general' }));
    expect(s.list('fixes').map((t) => t.id)).toEqual(['a']);
    expect(await s.history('../../etc/passwd', 0)).toEqual([]);
  });

  it('keeps the last N bot events per channel', async () => {
    const s = new ThreadStore(root);
    await s.init();
    for (let i = 0; i < 5; i++) {
      s.appendBot({ channelId: 'spec:s1', botKind: 'task.status', payload: { i } });
    }
    expect((await s.botHistory('spec:s1', 2)).map((e) => e.payload.i)).toEqual([3, 4]);
    expect(await s.botHistory('fixes', 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- store`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/sessions/store.ts`:
```ts
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BotEvent, ThreadEvent, ThreadInfo } from '@sdd-studio/protocol';

export interface StoredThread extends ThreadInfo {
  engineSessionId: string | null;
}

export interface HistoryEntry {
  seq: number;
  event: ThreadEvent;
}

const BUSY = new Set(['running', 'waiting-approval', 'queued']);

async function readLines(file: string): Promise<string[]> {
  const raw = await readFile(file, 'utf8').catch(() => '');
  return raw.split('\n').filter((line) => line.trim() !== '');
}

export class ThreadStore {
  private readonly threads = new Map<string, StoredThread>();
  private readonly seqs = new Map<string, number>();
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly root: string) {}

  private get dir(): string {
    return path.join(this.root, '.sdd-studio');
  }

  private threadFile(id: string): string {
    return path.join(this.dir, 'threads', `${id}.jsonl`);
  }

  // ChannelId ya está validado por el protocolo: sólo letras, dígitos, `.`, `_`, `-` y un `:`.
  private channelFile(channelId: string): string {
    return path.join(this.dir, 'channels', `${channelId.replace(':', '__')}.jsonl`);
  }

  async init(): Promise<void> {
    await mkdir(path.join(this.dir, 'threads'), { recursive: true });
    await mkdir(path.join(this.dir, 'channels'), { recursive: true });
    await writeFile(path.join(this.dir, '.gitignore'), '*\n');
    let stored: unknown = [];
    try {
      stored = JSON.parse(await readFile(path.join(this.dir, 'threads.json'), 'utf8'));
    } catch {
      stored = [];
    }
    for (const t of Array.isArray(stored) ? (stored as StoredThread[]) : []) {
      if (BUSY.has(t.status)) t.status = 'interrupted';
      this.threads.set(t.id, t);
      this.seqs.set(t.id, (await readLines(this.threadFile(t.id))).length);
    }
    await this.persist();
  }

  list(channelId?: string): StoredThread[] {
    return [...this.threads.values()]
      .filter((t) => !channelId || t.channelId === channelId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(id: string): StoredThread | undefined {
    return this.threads.get(id);
  }

  upsert(thread: StoredThread): Promise<void> {
    this.threads.set(thread.id, thread);
    if (!this.seqs.has(thread.id)) this.seqs.set(thread.id, 0);
    return this.persist();
  }

  /** Asigna el seq de forma síncrona (orden garantizado) y encola la escritura. */
  append(threadId: string, event: ThreadEvent): number {
    const seq = this.seqs.get(threadId) ?? 0;
    this.seqs.set(threadId, seq + 1);
    void this.enqueue(() => appendFile(this.threadFile(threadId), `${JSON.stringify({ seq, event })}\n`));
    return seq;
  }

  async history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]> {
    if (!this.threads.has(threadId)) return [];
    await this.flush();
    const out: HistoryEntry[] = [];
    for (const line of await readLines(this.threadFile(threadId))) {
      try {
        const entry = JSON.parse(line) as HistoryEntry;
        if (entry.seq >= sinceSeq) out.push(entry);
      } catch {
        // Línea truncada por un corte: se ignora.
      }
    }
    return out;
  }

  appendBot(event: BotEvent): void {
    void this.enqueue(() => appendFile(this.channelFile(event.channelId), `${JSON.stringify(event)}\n`));
  }

  async botHistory(channelId: string, limit: number): Promise<BotEvent[]> {
    await this.flush();
    const lines = await readLines(this.channelFile(channelId));
    const out: BotEvent[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        out.push(JSON.parse(line) as BotEvent);
      } catch {
        // idem
      }
    }
    return out;
  }

  flush(): Promise<void> {
    return this.chain;
  }

  private persist(): Promise<void> {
    return this.enqueue(async () => {
      const tmp = path.join(this.dir, 'threads.json.tmp');
      await writeFile(tmp, JSON.stringify([...this.threads.values()], null, 2));
      await rename(tmp, path.join(this.dir, 'threads.json'));
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.chain.then(fn);
    this.chain = next.catch(() => undefined);
    return next;
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/sessions/store.ts apps/studio-bridge/src/sessions/store.spec.ts
git commit -m "feat(studio-bridge): thread and bot-event persistence in .sdd-studio/"
```

---

### Task 10: Contrato `AgentEngine`, resúmenes de herramientas y `FakeEngine`

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/engine/types.ts`, `apps/studio-bridge/src/engine/tool-summary.ts`, `apps/studio-bridge/src/engine/fake-engine.ts`
- Test: `apps/studio-bridge/src/engine/tool-summary.spec.ts`, `apps/studio-bridge/src/engine/fake-engine.spec.ts`

**Interfaces:**
- Consumes: `Author`, `ThreadEvent`, `ThreadOptions`.
- Produces:
  ```ts
  interface EngineTurnInput { threadId: string; text: string; options: ThreadOptions; resumeSessionId: string | null; cwd: string }
  interface ApprovalRequest { toolName: string; input: Record<string, unknown>; author: Author; toolUseId: string | null }
  type ApprovalDecision = { behavior: 'allow' } | { behavior: 'deny'; message: string }
  interface EngineCallbacks { emit(e: ThreadEvent): void; onSessionId(id: string): void; requestApproval(r: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> }
  interface EngineTurn { done: Promise<void>; interrupt(): Promise<void> }
  interface AgentEngine { readonly name: string; startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn }
  truncate(s, max): string; summarizeTool(name, input): string; diffFor(name, input): string | undefined
  class FakeEngine implements AgentEngine  // marcadores en el texto: #sub, #tool, #edit, #slow, #fail
  ```

- [ ] **Step 1: Tests que fallan**

`apps/studio-bridge/src/engine/tool-summary.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { diffFor, summarizeTool, truncate } from './tool-summary';

describe('summarizeTool', () => {
  it.each([
    ['Bash', { command: 'pnpm test' }, '$ pnpm test'],
    ['Edit', { file_path: '/r/a.ts' }, '/r/a.ts'],
    ['NotebookEdit', { notebook_path: '/r/n.ipynb' }, '/r/n.ipynb'],
    ['Grep', { pattern: 'TODO' }, 'Grep TODO'],
    ['Agent', { subagent_type: 'sdd-planner', description: 'plan' }, 'sdd-planner: plan'],
    ['WebFetch', { url: 'x' }, 'WebFetch'],
  ])('%s', (name, input, expected) => {
    expect(summarizeTool(name, input)).toBe(expected);
  });
  it('truncates long commands to 160 chars', () => {
    expect(summarizeTool('Bash', { command: 'x'.repeat(500) })).toHaveLength(160);
  });
});

describe('diffFor', () => {
  it('builds a +/- diff for Edit and a + diff for Write', () => {
    expect(diffFor('Edit', { old_string: 'a\nb', new_string: 'c' })).toBe('-a\n-b\n+c');
    expect(diffFor('Write', { content: 'x\ny' })).toBe('+x\n+y');
    expect(diffFor('Bash', { command: 'ls' })).toBeUndefined();
  });
  it('caps diffs at 4000 chars', () => {
    expect(diffFor('Write', { content: 'y'.repeat(10_000) })!.length).toBe(4000);
  });
});

describe('truncate', () => {
  it('adds an ellipsis only when needed', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdef', 4)).toBe('abc…');
  });
});
```

`apps/studio-bridge/src/engine/fake-engine.spec.ts`:
```ts
import type { ThreadEvent } from '@sdd-studio/protocol';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { FakeEngine } from './fake-engine';
import type { ApprovalDecision, EngineCallbacks } from './types';

function harness(decision: ApprovalDecision = { behavior: 'allow' }) {
  const events: ThreadEvent[] = [];
  const sessions: string[] = [];
  const approvals: string[] = [];
  const cb: EngineCallbacks = {
    emit: (e) => events.push(e),
    onSessionId: (id) => sessions.push(id),
    requestApproval: async (r) => (approvals.push(r.toolName), decision),
  };
  return { events, sessions, approvals, cb };
}
const input = (text: string) => ({ threadId: 't', text, options: defaultThreadOptions(), resumeSessionId: null, cwd: '/repo' });

describe('FakeEngine', () => {
  it('echoes and ends the turn', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('hola'), h.cb).done;
    expect(h.sessions).toEqual(['fake-t']);
    expect(h.events.find((e) => e.type === 'message.delta')).toMatchObject({ text: 'echo: hola' });
    expect(h.events.at(-1)?.type).toBe('turn.end');
  });

  it('runs a subagent with #sub', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('#sub'), h.cb).done;
    expect(h.events.map((e) => e.type)).toContain('subagent.start');
    expect(h.events.find((e) => e.type === 'message.start' && e.author.agent === 'sdd-planner')).toBeTruthy();
  });

  it('asks for approval with #tool and skips the tool when denied', async () => {
    const h = harness({ behavior: 'deny', message: 'no' });
    await new FakeEngine(1).startTurn(input('#tool'), h.cb).done;
    expect(h.approvals).toEqual(['Bash']);
    expect(h.events.some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('stops a #slow turn on interrupt', async () => {
    const h = harness();
    const turn = new FakeEngine(1).startTurn(input('#slow'), h.cb);
    await turn.interrupt();
    await turn.done;
    expect(h.events.some((e) => e.type === 'turn.end')).toBe(false);
  });

  it('rejects with #fail', async () => {
    const h = harness();
    await expect(new FakeEngine(1).startTurn(input('#fail'), h.cb).done).rejects.toThrow('fake failure');
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm --filter @e-burgos/sdd-studio test -- engine`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/engine/types.ts`:
```ts
import type { Author, ThreadEvent, ThreadOptions } from '@sdd-studio/protocol';

export interface EngineTurnInput {
  threadId: string;
  text: string;
  options: ThreadOptions;
  resumeSessionId: string | null;
  cwd: string;
}

export interface ApprovalRequest {
  toolName: string;
  input: Record<string, unknown>;
  author: Author;
  toolUseId: string | null;
}

export type ApprovalDecision = { behavior: 'allow' } | { behavior: 'deny'; message: string };

export interface EngineCallbacks {
  emit(event: ThreadEvent): void;
  onSessionId(id: string): void;
  requestApproval(request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision>;
}

export interface EngineTurn {
  done: Promise<void>;
  interrupt(): Promise<void>;
}

/** Frontera del motor: la web y el SessionManager nunca ven tipos del SDK. */
export interface AgentEngine {
  readonly name: string;
  startTurn(input: EngineTurnInput, callbacks: EngineCallbacks): EngineTurn;
}
```

`apps/studio-bridge/src/engine/tool-summary.ts`:
```ts
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
```

`apps/studio-bridge/src/engine/fake-engine.ts`:
```ts
import path from 'node:path';
import type { Author } from '@sdd-studio/protocol';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

/**
 * Motor guionado para tests y `--engine=fake`. Marcadores en el texto del prompt:
 * #sub (habla sdd-planner como subagente), #tool (pide aprobación para Bash),
 * #edit (pide aprobación para Write en apps/x.ts), #slow (no termina hasta interrupt), #fail.
 */
export class FakeEngine implements AgentEngine {
  readonly name = 'fake';
  private counter = 0;

  constructor(private readonly delayMs = 5) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    let stopped = false;
    const wait = () => new Promise((r) => setTimeout(r, this.delayMs));
    const main: Author = { agent: input.options.agent, parentToolUseId: null };
    const say = (author: Author, text: string) => {
      const messageId = `fake-msg-${++this.counter}`;
      cb.emit({ type: 'message.start', messageId, author });
      cb.emit({ type: 'message.delta', messageId, text });
      cb.emit({ type: 'message.end', messageId });
    };
    const askAndRun = async (toolName: string, toolInput: Record<string, unknown>, summary: string) => {
      const toolUseId = `fake-tool-${++this.counter}`;
      const decision = await cb.requestApproval(
        { toolName, input: toolInput, author: main, toolUseId },
        new AbortController().signal,
      );
      if (stopped || decision.behavior !== 'allow') return;
      cb.emit({ type: 'tool.start', toolUseId, author: main, tool: toolName, summary });
      cb.emit({ type: 'tool.end', toolUseId, isError: false, summary: 'ok' });
    };

    const done = (async () => {
      cb.onSessionId(input.resumeSessionId ?? `fake-${input.threadId}`);
      await wait();
      if (input.text.includes('#fail')) throw new Error('fake failure');
      if (input.text.includes('#slow')) {
        while (!stopped) await wait();
        return;
      }
      if (input.text.includes('#sub')) {
        cb.emit({ type: 'subagent.start', agentId: 'fake-sub', agentType: 'sdd-planner' });
        await wait();
        say({ agent: 'sdd-planner', parentToolUseId: 'fake-agent-call' }, 'planned');
        cb.emit({ type: 'subagent.stop', agentId: 'fake-sub', agentType: 'sdd-planner' });
      }
      if (input.text.includes('#tool')) await askAndRun('Bash', { command: 'echo hi' }, '$ echo hi');
      if (input.text.includes('#edit')) {
        const file = path.join(input.cwd, 'apps', 'x.ts');
        await askAndRun('Write', { file_path: file, content: 'export {};' }, file);
      }
      if (stopped) return;
      say(main, `echo: ${input.text}`);
      cb.emit({
        type: 'turn.end',
        usage: { model: 'fake', effort: input.options.effort, tokensIn: 10, tokensOut: 5, costUsd: 0 },
      });
    })();

    return {
      done,
      interrupt: async () => {
        stopped = true;
      },
    };
  }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm --filter @e-burgos/sdd-studio test -- engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/engine
git commit -m "feat(studio-bridge): AgentEngine contract, tool summaries and FakeEngine"
```

---

### Task 11: Presencia de agentes

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/sessions/presence.ts`
- Test: `apps/studio-bridge/src/sessions/presence.spec.ts`

**Interfaces:**
- Consumes: `ThreadInfo`, `ThreadEvent`, `Presence`, `specIdOfChannel`.
- Produces: `class PresenceTracker { constructor(knownAgents: () => string[]); onThread(t: ThreadInfo): void; onEvent(threadId: string, e: ThreadEvent): void; compute(): Presence[] }`. Estados: `waiting` (el agente pidió una aprobación pendiente) > `working` (hilo `running` donde es el principal o un subagente activo) > `open` (tiene un hilo tocado en esta ejecución del puente) > `idle`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/sessions/presence.spec.ts`:
```ts
import { defaultThreadOptions, type ThreadInfo } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { PresenceTracker } from './presence';

const thread = (status: ThreadInfo['status']): ThreadInfo => ({
  id: 't1', channelId: 'spec:s1', title: 'x', agent: 'sdd-orchestrator', options: defaultThreadOptions(),
  status, createdAt: '', lastActivity: '',
});
const stateOf = (tracker: PresenceTracker, agent: string) => tracker.compute().find((p) => p.agent === agent);

describe('PresenceTracker', () => {
  const agents = () => ['sdd-orchestrator', 'sdd-planner', 'sdd-reviewer'];

  it('reports everyone idle at start', () => {
    expect(new PresenceTracker(agents).compute().every((p) => p.state === 'idle')).toBe(true);
  });

  it('tracks main agent, subagent, approval and turn end', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('running'));
    expect(stateOf(p, 'sdd-orchestrator')).toMatchObject({ state: 'working', threadId: 't1', specId: 's1' });

    p.onEvent('t1', { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' });
    p.onEvent('t1', { type: 'tool.start', toolUseId: 'u', author: { agent: 'sdd-planner', parentToolUseId: 'x' }, tool: 'Read', summary: '' });
    expect(stateOf(p, 'sdd-planner')).toMatchObject({ state: 'working', tool: 'Read' });

    p.onThread(thread('waiting-approval'));
    p.onEvent('t1', { type: 'approval.requested', approvalId: 'p', author: { agent: 'sdd-planner', parentToolUseId: 'x' }, tool: 'Bash', summary: '' });
    expect(stateOf(p, 'sdd-planner')?.state).toBe('waiting');

    p.onEvent('t1', { type: 'approval.resolved', approvalId: 'p', decision: 'allow' });
    p.onEvent('t1', { type: 'subagent.stop', agentId: 'a1', agentType: 'sdd-planner' });
    p.onEvent('t1', { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 0, tokensOut: 0, costUsd: 0 } });
    p.onThread(thread('idle'));
    expect(stateOf(p, 'sdd-orchestrator')?.state).toBe('open');
    expect(stateOf(p, 'sdd-planner')?.state).toBe('idle');
  });

  it('includes unknown subagent types that show up at runtime', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('running'));
    p.onEvent('t1', { type: 'subagent.start', agentId: 'a2', agentType: 'Explore' });
    expect(stateOf(p, 'Explore')?.state).toBe('working');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- presence`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/sessions/presence.ts`:
```ts
import { specIdOfChannel, type Presence, type ThreadEvent, type ThreadInfo } from '@sdd-studio/protocol';

interface ThreadPresence {
  main: string;
  specId: string | null;
  status: ThreadInfo['status'];
  tools: Map<string, string>;
  subagents: Map<string, string>;
  waitingAgent: string | null;
}

export class PresenceTracker {
  private readonly threads = new Map<string, ThreadPresence>();

  constructor(private readonly knownAgents: () => string[]) {}

  onThread(thread: ThreadInfo): void {
    const entry = this.threads.get(thread.id) ?? {
      main: thread.agent,
      specId: specIdOfChannel(thread.channelId),
      status: thread.status,
      tools: new Map<string, string>(),
      subagents: new Map<string, string>(),
      waitingAgent: null,
    };
    entry.status = thread.status;
    this.threads.set(thread.id, entry);
  }

  onEvent(threadId: string, event: ThreadEvent): void {
    const t = this.threads.get(threadId);
    if (!t) return;
    switch (event.type) {
      case 'tool.start':
        t.tools.set(event.author.agent, event.tool);
        break;
      case 'subagent.start':
        t.subagents.set(event.agentId, event.agentType);
        break;
      case 'subagent.stop':
        t.subagents.delete(event.agentId);
        t.tools.delete(event.agentType);
        break;
      case 'approval.requested':
        t.waitingAgent = event.author.agent;
        break;
      case 'approval.resolved':
        t.waitingAgent = null;
        break;
      case 'turn.end':
        t.tools.clear();
        t.subagents.clear();
        t.waitingAgent = null;
        break;
      default:
        break;
    }
  }

  compute(): Presence[] {
    const names = new Set(this.knownAgents());
    for (const t of this.threads.values()) {
      names.add(t.main);
      for (const sub of t.subagents.values()) names.add(sub);
    }
    return [...names].sort().map((agent) => this.presenceOf(agent));
  }

  private presenceOf(agent: string): Presence {
    const at = (id: string, t: ThreadPresence, state: Presence['state']): Presence => ({
      agent, state, threadId: id, specId: t.specId, tool: t.tools.get(agent) ?? null,
    });
    const entries = [...this.threads.entries()];
    for (const [id, t] of entries) {
      if (t.status === 'waiting-approval' && t.waitingAgent === agent) return at(id, t, 'waiting');
    }
    for (const [id, t] of entries) {
      const active = t.main === agent || [...t.subagents.values()].includes(agent);
      if ((t.status === 'running' || t.status === 'waiting-approval') && active) return at(id, t, 'working');
    }
    for (const [id, t] of entries) if (t.main === agent) return { ...at(id, t, 'open'), tool: null };
    return { agent, state: 'idle', threadId: null, specId: null, tool: null };
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- presence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/sessions/presence.ts apps/studio-bridge/src/sessions/presence.spec.ts
git commit -m "feat(studio-bridge): agent presence tracker"
```

---

### Task 12: `SessionManager` (hilos, cola por canal, aprobaciones, SPEC GATE)

**Tier:** `opus` / `high` (concurrencia y aprobaciones).

**Files:**
- Create: `apps/studio-bridge/src/sessions/session-manager.ts`
- Test: `apps/studio-bridge/src/sessions/session-manager.spec.ts`

**Interfaces:**
- Consumes: `ThreadStore`, `StoredThread` (Task 9); `AgentEngine`, `ApprovalRequest`, `ApprovalDecision`, `summarizeTool`, `diffFor` (Task 10); `PresenceTracker` (Task 11); `judgeEdit`, `editTargetOf` (Task 8); tipos del protocolo.
- Produces:
  ```ts
  class SessionError extends Error { code: 'not-found' | 'conflict' | 'bad-request' }
  interface SessionManagerDeps { root: string; engine: AgentEngine; store: ThreadStore; snapshot(): WorkspaceSnapshot; broadcast(m: ServerEvent): void; newId?(): string; now?(): string }
  class SessionManager {
    constructor(deps: SessionManagerDeps)
    createThread(a: { channelId: string; options: ThreadOptions; text: string }): Promise<ThreadInfo>
    send(threadId: string, text: string): Promise<void>
    interrupt(threadId: string): Promise<void>
    setOptions(threadId: string, patch: Partial<Omit<ThreadOptions, 'agent'>>): Promise<ThreadInfo>
    list(channelId?: string): ThreadInfo[]
    history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]>
    respondApproval(approvalId: string, decision: 'allow' | 'deny', reason: string | undefined, scope: 'once' | 'thread'): void
    presence(): Presence[]
  }
  ```
- Reglas: un hilo con turno activo o en cola rechaza `send` con `conflict`. "Escribe" = `permissionMode !== 'plan'`. Un hilo que escribe queda `queued` si otro hilo del mismo canal que escribe tiene un turno activo; al terminar ese turno se arranca el siguiente en cola (FIFO). Tras `interrupt`, un `session.status: error` emitido por el motor no pisa `interrupted`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/sessions/session-manager.spec.ts`:
```ts
import { defaultThreadOptions, type ServerEvent, type ThreadEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeEngine } from '../engine/fake-engine';
import type { AgentEngine, EngineTurnInput } from '../engine/types';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import { SessionError, SessionManager } from './session-manager';
import { ThreadStore } from './store';

let root: string;
let cleanup: () => Promise<void>;
let snapshot: WorkspaceSnapshot;
let sent: ServerEvent[];

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  sent = [];
});
afterEach(() => cleanup());

async function manager(engine: AgentEngine = new FakeEngine(1)) {
  const store = new ThreadStore(root);
  await store.init();
  let n = 0;
  const m = new SessionManager({
    root, engine, store, snapshot: () => snapshot, broadcast: (e) => sent.push(e), newId: () => `id${++n}`,
  });
  return { m, store };
}
const eventsOf = (threadId: string): ThreadEvent[] =>
  sent.flatMap((e) => (e.kind === 'thread.event' && e.threadId === threadId ? [e.event] : []));
const statusOf = (m: SessionManager, id: string) => m.list().find((t) => t.id === id)?.status;
const pendingApproval = (threadId: string) =>
  eventsOf(threadId).find((e): e is Extract<ThreadEvent, { type: 'approval.requested' }> => e.type === 'approval.requested');
const opts = defaultThreadOptions();

describe('SessionManager', () => {
  it('runs a turn end to end and persists the history', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const types = eventsOf(t.id).map((e) => e.type);
    expect(types[0]).toBe('user.message');
    expect(types).toContain('turn.end');
    expect((await m.history(t.id, 0)).map((h) => h.event.type)).toEqual(types);
    expect(sent.some((e) => e.kind === 'presence.changed')).toBe(true);
  });

  it('waits for approval and runs the tool when allowed', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    expect(statusOf(m, t.id)).toBe('waiting-approval');
    m.respondApproval(req.approvalId, 'allow', undefined, 'once');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(true);
  });

  it('sends the deny reason back and skips the tool', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    m.respondApproval(req.approvalId, 'deny', 'no toques eso', 'once');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(eventsOf(t.id)).toContainEqual({ type: 'approval.resolved', approvalId: req.approvalId, decision: 'deny', reason: 'no toques eso' });
    expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('remembers "always in this thread" approvals', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    sent.length = 0;
    await m.send(t.id, '#tool');
    await waitFor(() => statusOf(m, t.id) === 'idle' && eventsOf(t.id).some((e) => e.type === 'tool.start'));
    expect(pendingApproval(t.id)).toBeUndefined();
  });

  it('denies code edits through the SPEC GATE without asking', async () => {
    snapshot = { ...snapshot, cycles: snapshot.cycles.map((c) => ({ ...c, status: 'completed' })), fixes: [] };
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const resolved = eventsOf(t.id).find((e) => e.type === 'approval.resolved');
    expect(resolved).toMatchObject({ decision: 'deny' });
    expect(resolved?.type === 'approval.resolved' && resolved.reason).toContain('SPEC GATE');
    expect(sent.some((e) => e.kind === 'thread.updated' && e.thread.status === 'waiting-approval')).toBe(false);
  });

  it('asks with a gate warning in warn mode', async () => {
    snapshot = { ...snapshot, gateMode: 'warn', cycles: [], fixes: [] };
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
    expect((await waitFor(() => pendingApproval(t.id))).gateWarning).toContain('SPEC GATE');
  });

  it('queues a second writing thread in the same channel and starts it after the first', async () => {
    const { m } = await manager();
    const a = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: '#slow' });
    const b = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: 'hola' });
    const c = await m.createThread({ channelId: 'spec:spec-dev-002-borrador', options: opts, text: '#slow' });
    const d = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: { ...opts, permissionMode: 'plan' }, text: '#slow' });
    expect(statusOf(m, b.id)).toBe('queued');
    expect(statusOf(m, c.id)).toBe('running');
    expect(statusOf(m, d.id)).toBe('running');
    await m.interrupt(a.id);
    await waitFor(() => statusOf(m, b.id) === 'idle');
    expect(statusOf(m, a.id)).toBe('interrupted');
    await m.interrupt(c.id);
    await m.interrupt(d.id);
  });

  it('rejects a send while the thread is busy', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#slow' });
    await expect(m.send(t.id, 'otra')).rejects.toMatchObject({ code: 'conflict' });
    await m.interrupt(t.id);
  });

  it('interrupting a thread denies its pending approval', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    await m.interrupt(t.id);
    await waitFor(() => eventsOf(t.id).some((e) => e.type === 'approval.resolved'));
    expect(eventsOf(t.id)).toContainEqual({ type: 'approval.resolved', approvalId: req.approvalId, decision: 'deny', reason: 'interrupted' });
    expect(statusOf(m, t.id)).toBe('interrupted');
  });

  it('marks the thread as error when the engine fails', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#fail' });
    await waitFor(() => statusOf(m, t.id) === 'error');
    expect(eventsOf(t.id).at(-1)).toMatchObject({ type: 'session.status', status: 'error' });
  });

  it('resumes with the stored engine session id, also after a restart', async () => {
    const inputs: EngineTurnInput[] = [];
    const spy: AgentEngine = {
      name: 'spy',
      startTurn: (input, cb) => {
        inputs.push(input);
        cb.onSessionId('sess-42');
        return { done: Promise.resolve(), interrupt: async () => {} };
      },
    };
    const first = await manager(spy);
    const t = await first.m.createThread({ channelId: 'general', options: opts, text: 'uno' });
    await waitFor(() => statusOf(first.m, t.id) === 'idle');
    await first.store.flush();
    const second = await manager(spy);
    await second.m.send(t.id, 'dos');
    expect(inputs.map((i) => i.resumeSessionId)).toEqual([null, 'sess-42']);
  });

  it('applies option changes without touching the agent', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const updated = await m.setOptions(t.id, { model: 'opus', effort: 'high' });
    expect(updated.options).toEqual({ ...opts, model: 'opus', effort: 'high' });
  });

  it('reports unknown threads and approvals as not-found', async () => {
    const { m } = await manager();
    await expect(m.send('nope', 'x')).rejects.toBeInstanceOf(SessionError);
    expect(() => m.respondApproval('nope', 'allow', undefined, 'once')).toThrow(SessionError);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- session-manager`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/sessions/session-manager.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type {
  Presence,
  ServerEvent,
  SessionStatus,
  ThreadEvent,
  ThreadInfo,
  ThreadOptions,
  WorkspaceSnapshot,
} from '@sdd-studio/protocol';
import { diffFor, summarizeTool } from '../engine/tool-summary';
import type { AgentEngine, ApprovalDecision, ApprovalRequest, EngineTurn } from '../engine/types';
import { editTargetOf, judgeEdit } from '../gate/judge';
import { PresenceTracker } from './presence';
import type { HistoryEntry, StoredThread, ThreadStore } from './store';

export class SessionError extends Error {
  constructor(
    readonly code: 'not-found' | 'conflict' | 'bad-request',
    message: string,
  ) {
    super(message);
  }
}

export interface SessionManagerDeps {
  root: string;
  engine: AgentEngine;
  store: ThreadStore;
  snapshot: () => WorkspaceSnapshot;
  broadcast: (message: ServerEvent) => void;
  newId?: () => string;
  now?: () => string;
}

interface Live {
  turn: EngineTurn | null;
  queued: string | null;
  alwaysAllow: Set<string>;
}

interface PendingApproval {
  threadId: string;
  toolName: string;
  settle: (decision: ApprovalDecision) => void;
}

const toInfo = ({ engineSessionId: _ignored, ...info }: StoredThread): ThreadInfo => info;

export class SessionManager {
  private readonly live = new Map<string, Live>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly tracker: PresenceTracker;
  private readonly newId: () => string;
  private readonly now: () => string;
  private lastPresence = '';

  constructor(private readonly deps: SessionManagerDeps) {
    this.newId = deps.newId ?? randomUUID;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.tracker = new PresenceTracker(() => deps.snapshot().agents.map((a) => a.id));
  }

  list(channelId?: string): ThreadInfo[] {
    return this.deps.store.list(channelId).map(toInfo);
  }

  history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]> {
    this.require(threadId);
    return this.deps.store.history(threadId, sinceSeq);
  }

  presence(): Presence[] {
    return this.tracker.compute();
  }

  async createThread(args: { channelId: string; options: ThreadOptions; text: string }): Promise<ThreadInfo> {
    const now = this.now();
    const thread: StoredThread = {
      id: this.newId(),
      channelId: args.channelId,
      title: (args.text.split('\n')[0] ?? '').slice(0, 80),
      agent: args.options.agent,
      options: args.options,
      status: 'idle',
      createdAt: now,
      lastActivity: now,
      engineSessionId: null,
    };
    await this.deps.store.upsert(thread);
    await this.send(thread.id, args.text);
    return toInfo(this.require(thread.id));
  }

  async send(threadId: string, text: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    if (live.turn || live.queued !== null) throw new SessionError('conflict', 'el hilo está ocupado: esperá o interrumpilo');
    this.emit(thread, { type: 'user.message', text });
    if (this.blocked(thread)) {
      live.queued = text;
      await this.setStatus(thread, 'queued');
      return;
    }
    this.start(thread, text);
  }

  async interrupt(threadId: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    const wasQueued = live.queued !== null;
    live.queued = null;
    if (!live.turn && !wasQueued) return;
    await this.setStatus(thread, 'interrupted');
    for (const [, pending] of this.approvals) {
      if (pending.threadId === threadId) pending.settle({ behavior: 'deny', message: 'interrupted' });
    }
    await live.turn?.interrupt();
    if (wasQueued) this.drain(thread.channelId);
  }

  async setOptions(threadId: string, patch: Partial<Omit<ThreadOptions, 'agent'>>): Promise<ThreadInfo> {
    const thread = this.require(threadId);
    const { agent: _fixed, ...allowed } = patch as Partial<ThreadOptions>;
    thread.options = { ...thread.options, ...allowed };
    await this.deps.store.upsert(thread);
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    return toInfo(thread);
  }

  respondApproval(approvalId: string, decision: 'allow' | 'deny', reason: string | undefined, scope: 'once' | 'thread'): void {
    const pending = this.approvals.get(approvalId);
    if (!pending) throw new SessionError('not-found', `no hay una aprobación pendiente ${approvalId}`);
    if (decision === 'allow' && scope === 'thread') this.liveOf(pending.threadId).alwaysAllow.add(pending.toolName);
    pending.settle(decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: reason ?? 'denegado por el usuario' });
  }

  // ── internos ─────────────────────────────────────────────────────────────

  private require(threadId: string): StoredThread {
    const thread = this.deps.store.get(threadId);
    if (!thread) throw new SessionError('not-found', `no existe el hilo ${threadId}`);
    return thread;
  }

  private liveOf(threadId: string): Live {
    let live = this.live.get(threadId);
    if (!live) {
      live = { turn: null, queued: null, alwaysAllow: new Set() };
      this.live.set(threadId, live);
    }
    return live;
  }

  private writes(thread: StoredThread): boolean {
    return thread.options.permissionMode !== 'plan';
  }

  private blocked(thread: StoredThread): boolean {
    if (!this.writes(thread)) return false;
    return this.deps.store
      .list(thread.channelId)
      .some((other) => other.id !== thread.id && this.writes(other) && this.live.get(other.id)?.turn);
  }

  private start(thread: StoredThread, text: string): void {
    const live = this.liveOf(thread.id);
    void this.setStatus(thread, 'running');
    const turn = this.deps.engine.startTurn(
      { threadId: thread.id, text, options: thread.options, resumeSessionId: thread.engineSessionId, cwd: this.deps.root },
      {
        emit: (event) => this.emit(thread, event),
        onSessionId: (id) => {
          if (thread.engineSessionId === id) return;
          thread.engineSessionId = id;
          void this.deps.store.upsert(thread);
        },
        requestApproval: (request, signal) => this.requestApproval(thread, request, signal),
      },
    );
    live.turn = turn;
    turn.done.then(
      () => this.finish(thread, null),
      (error: unknown) => this.finish(thread, error),
    );
  }

  private async finish(thread: StoredThread, error: unknown): Promise<void> {
    this.liveOf(thread.id).turn = null;
    if (error && thread.status !== 'interrupted') {
      const message = error instanceof Error ? error.message : String(error);
      this.emit(thread, { type: 'session.status', status: 'error', error: { code: 'engine', message: message.slice(0, 500) } });
    } else if (thread.status === 'running' || thread.status === 'waiting-approval') {
      await this.setStatus(thread, 'idle');
    }
    this.drain(thread.channelId);
  }

  private drain(channelId: string): void {
    const waiting = this.deps.store
      .list(channelId)
      .filter((t) => this.live.get(t.id)?.queued != null)
      .sort((a, b) => a.lastActivity.localeCompare(b.lastActivity));
    for (const thread of waiting) {
      if (this.blocked(thread)) break;
      const live = this.liveOf(thread.id);
      const text = live.queued!;
      live.queued = null;
      this.start(thread, text);
    }
  }

  private async requestApproval(thread: StoredThread, request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> {
    const summary = summarizeTool(request.toolName, request.input);
    const diff = diffFor(request.toolName, request.input);
    const extra = diff ? { diff } : {};
    let gateWarning: string | undefined;
    const target = editTargetOf(request.toolName, request.input);
    if (target) {
      const verdict = judgeEdit(this.deps.snapshot(), this.deps.root, target);
      if (verdict.kind === 'deny') {
        const approvalId = this.newId();
        this.emit(thread, { type: 'approval.requested', approvalId, author: request.author, tool: request.toolName, summary, ...extra });
        this.emit(thread, { type: 'approval.resolved', approvalId, decision: 'deny', reason: verdict.reason });
        return { behavior: 'deny', message: verdict.reason };
      }
      if (verdict.kind === 'warn') gateWarning = verdict.reason;
    }
    if (!gateWarning && this.liveOf(thread.id).alwaysAllow.has(request.toolName)) return { behavior: 'allow' };

    const approvalId = this.newId();
    this.emit(thread, {
      type: 'approval.requested',
      approvalId,
      author: request.author,
      tool: request.toolName,
      summary,
      ...extra,
      ...(gateWarning ? { gateWarning } : {}),
    });
    await this.setStatus(thread, 'waiting-approval');

    return new Promise<ApprovalDecision>((resolve) => {
      const onAbort = () => settle({ behavior: 'deny', message: 'aborted' });
      const settle = (decision: ApprovalDecision) => {
        if (!this.approvals.delete(approvalId)) return;
        signal.removeEventListener('abort', onAbort);
        this.emit(thread, {
          type: 'approval.resolved',
          approvalId,
          decision: decision.behavior,
          ...(decision.behavior === 'deny' ? { reason: decision.message } : {}),
        });
        const stillWaiting = [...this.approvals.values()].some((p) => p.threadId === thread.id);
        if (thread.status === 'waiting-approval' && !stillWaiting) void this.setStatus(thread, 'running');
        resolve(decision);
      };
      this.approvals.set(approvalId, { threadId: thread.id, toolName: request.toolName, settle });
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private emit(thread: StoredThread, event: ThreadEvent): void {
    if (event.type === 'session.status') {
      if (thread.status === 'interrupted' && event.status === 'error') return;
      this.applyStatus(thread, event.status);
    }
    const seq = this.deps.store.append(thread.id, event);
    this.deps.broadcast({ kind: 'thread.event', threadId: thread.id, seq, event });
    this.tracker.onEvent(thread.id, event);
    this.publishPresence();
  }

  private async setStatus(thread: StoredThread, status: SessionStatus): Promise<void> {
    if (thread.status === status) return;
    this.emit(thread, { type: 'session.status', status });
    await this.deps.store.upsert(thread);
  }

  private applyStatus(thread: StoredThread, status: SessionStatus): void {
    thread.status = status;
    thread.lastActivity = this.now();
    this.tracker.onThread(toInfo(thread));
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    void this.deps.store.upsert(thread);
  }

  private publishPresence(): void {
    const presence = this.tracker.compute();
    const key = JSON.stringify(presence);
    if (key === this.lastPresence) return;
    this.lastPresence = key;
    this.deps.broadcast({ kind: 'presence.changed', presence });
  }
}
```

- [ ] **Step 4: Verificar que pasa (tres corridas)**

Run: `for i in 1 2 3; do pnpm --filter @e-burgos/sdd-studio test -- session-manager || break; done`
Expected: PASS las tres veces.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @e-burgos/sdd-studio typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/studio-bridge/src/sessions/session-manager.ts apps/studio-bridge/src/sessions/session-manager.spec.ts
git commit -m "feat(studio-bridge): session manager with per-channel write queue, approvals and SPEC GATE"
```

---

### Task 13: Mapeo de mensajes del SDK a eventos normalizados

**Tier:** `opus` / `high`. Ajustar las aserciones de fixtures según `docs/superpowers/notes/2026-10-07-sdk-spike.md` (si el spike mostró otro nombre de herramienta o que no llega texto del subagente, cambiar la aserción y dejar una línea de comentario con el motivo).

**Files:**
- Create: `apps/studio-bridge/src/engine/sdk-mapper.ts`
- Test: `apps/studio-bridge/src/engine/sdk-mapper.spec.ts`

**Interfaces:**
- Consumes: `truncate`, `summarizeTool`, `diffFor` (Task 10); fixtures (Task 1).
- Produces: `type SdkMessageLike = { type: string; subtype?: string; [k: string]: unknown }`, `class SdkEventMapper { constructor(mainAgent: string, effort: Effort | null); sessionId: string | null; mapMessage(m: SdkMessageLike): ThreadEvent[]; mapHook(i: { hook_event_name?: unknown; agent_id?: unknown; agent_type?: unknown }): ThreadEvent[]; authorForAgentId(agentId: string | undefined): Author }`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/engine/sdk-mapper.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import type { ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { SdkEventMapper } from './sdk-mapper';

const MAIN = 'sdd-orchestrator';

describe('SdkEventMapper (synthetic)', () => {
  it('captures the session id on init', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapMessage({ type: 'system', subtype: 'init', session_id: 's1', model: 'claude-haiku' })).toEqual([]);
    expect(m.sessionId).toBe('s1');
  });

  it('maps main-thread text and tool_use, and attributes subagent output', () => {
    const m = new SdkEventMapper(MAIN, null);
    const main = m.mapMessage({
      type: 'assistant', parent_tool_use_id: null,
      message: { id: 'msg1', content: [
        { type: 'text', text: 'voy a delegar' },
        { type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { subagent_type: 'sdd-planner', description: 'plan' } },
      ] },
    });
    expect(main).toEqual([
      { type: 'message.start', messageId: 'msg1:0', author: { agent: MAIN, parentToolUseId: null } },
      { type: 'message.delta', messageId: 'msg1:0', text: 'voy a delegar' },
      { type: 'message.end', messageId: 'msg1:0' },
      { type: 'tool.start', toolUseId: 'toolu_A', author: { agent: MAIN, parentToolUseId: null }, tool: 'Agent', summary: 'sdd-planner: plan' },
    ]);
    const sub = m.mapMessage({
      type: 'assistant', parent_tool_use_id: 'toolu_A',
      message: { id: 'msg2', content: [{ type: 'tool_use', id: 'toolu_B', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' } }] },
    });
    expect(sub).toEqual([
      { type: 'tool.start', toolUseId: 'toolu_B', author: { agent: 'sdd-planner', parentToolUseId: 'toolu_A' }, tool: 'Edit', summary: '/r/a.ts', diff: '-a\n+b' },
    ]);
  });

  it('maps tool results, skipping plain user text', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapMessage({ type: 'user', parent_tool_use_id: null, message: { content: 'hola' } })).toEqual([]);
    expect(m.mapMessage({
      type: 'user', parent_tool_use_id: null,
      message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_B', is_error: true, content: [{ type: 'text', text: 'denied' }] }] },
    })).toEqual([{ type: 'tool.end', toolUseId: 'toolu_B', isError: true, summary: 'denied' }]);
  });

  it('maps a successful result to turn.end using the most expensive model', () => {
    const m = new SdkEventMapper(MAIN, 'low');
    expect(m.mapMessage({
      type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.02,
      usage: { input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 1, output_tokens: 7 },
      modelUsage: { 'claude-haiku': { costUSD: 0.005 }, 'claude-sonnet': { costUSD: 0.015 } },
    })).toEqual([{ type: 'turn.end', usage: { model: 'claude-sonnet', effort: 'low', tokensIn: 16, tokensOut: 7, costUsd: 0.02 } }]);
  });

  it('adds an error status for failed results', () => {
    const m = new SdkEventMapper(MAIN, null);
    const out = m.mapMessage({ type: 'result', subtype: 'error_max_turns', is_error: true, usage: {}, total_cost_usd: 0, modelUsage: {}, errors: ['too many'] });
    expect(out.at(-1)).toEqual({ type: 'session.status', status: 'error', error: { code: 'error_max_turns', message: 'too many' } });
  });

  it('tracks subagents from hooks and attributes approvals by agent id', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapHook({ hook_event_name: 'SubagentStart', agent_id: 'ag1', agent_type: 'sdd-planner' })).toEqual([
      { type: 'subagent.start', agentId: 'ag1', agentType: 'sdd-planner' },
    ]);
    expect(m.authorForAgentId('ag1')).toEqual({ agent: 'sdd-planner', parentToolUseId: null });
    expect(m.authorForAgentId(undefined)).toEqual({ agent: MAIN, parentToolUseId: null });
    expect(m.mapHook({ hook_event_name: 'SubagentStop', agent_id: 'ag1', agent_type: 'sdd-planner' })).toEqual([
      { type: 'subagent.stop', agentId: 'ag1', agentType: 'sdd-planner' },
    ]);
    expect(m.mapHook({ hook_event_name: 'PreToolUse' })).toEqual([]);
  });
});

type Rec = { kind: 'message' | 'hook' | 'canUseTool'; data: any };
const replay = (name: string): { events: ThreadEvent[]; records: Rec[] } => {
  const records = readFileSync(new URL(`./__fixtures__/${name}.jsonl`, import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l) as Rec);
  const m = new SdkEventMapper(MAIN, 'low');
  const events = records.flatMap((r) => (r.kind === 'message' ? m.mapMessage(r.data) : r.kind === 'hook' ? m.mapHook(r.data) : []));
  return { events, records };
};

describe('SdkEventMapper (recorded fixtures)', () => {
  it('simple: main agent speaks and the turn ends with tokens', () => {
    const { events } = replay('simple');
    expect(events.some((e) => e.type === 'message.start' && e.author.agent === MAIN && e.author.parentToolUseId === null)).toBe(true);
    const ends = events.filter((e) => e.type === 'turn.end');
    expect(ends).toHaveLength(1);
    expect(ends[0]?.type === 'turn.end' && ends[0].usage.tokensIn).toBeGreaterThan(0);
  });

  it('subagent: the planner starts and is credited for its output', () => {
    const { events } = replay('subagent');
    expect(events).toContainEqual(expect.objectContaining({ type: 'subagent.start', agentType: 'sdd-planner' }));
    expect(events.some((e) => (e.type === 'message.start' || e.type === 'tool.start') && e.author.agent === 'sdd-planner')).toBe(true);
  });

  it('permission: canUseTool carried a tool use id and the denied Write ends in error', () => {
    const { events, records } = replay('permission');
    const ask = records.find((r) => r.kind === 'canUseTool');
    expect(ask?.data.toolName).toBe('Write');
    expect(typeof ask?.data.toolUseID).toBe('string');
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool.end', isError: true }));
  });

  it('interrupt: mapping completes without throwing', () => {
    expect(() => replay('interrupt')).not.toThrow();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- sdk-mapper`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/engine/sdk-mapper.ts`:
```ts
import type { Author, Effort, ThreadEvent } from '@sdd-studio/protocol';
import { diffFor, summarizeTool, truncate } from './tool-summary';

type Block = { type: string; [key: string]: unknown };
export type SdkMessageLike = { type: string; subtype?: string; [key: string]: unknown };

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Block[]).map((b) => (b.type === 'text' ? str(b.text) : '')).join('\n');
}

/** Traduce el stream del Agent SDK a eventos del protocolo. Sin dependencias del SDK. */
export class SdkEventMapper {
  sessionId: string | null = null;
  private model: string | null = null;
  private counter = 0;
  private readonly subagentByToolUse = new Map<string, string>();
  private readonly subagentById = new Map<string, string>();

  constructor(
    private readonly mainAgent: string,
    private readonly effort: Effort | null,
  ) {}

  mapMessage(msg: SdkMessageLike): ThreadEvent[] {
    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') {
          this.sessionId = str(msg.session_id) || null;
          this.model = str(msg.model) || null;
        }
        return [];
      case 'assistant':
        return this.mapAssistant(msg);
      case 'user':
        return this.mapUser(msg);
      case 'result':
        return this.mapResult(msg);
      default:
        return [];
    }
  }

  mapHook(input: { hook_event_name?: unknown; agent_id?: unknown; agent_type?: unknown }): ThreadEvent[] {
    const agentId = str(input.agent_id);
    const agentType = str(input.agent_type) || 'subagent';
    if (!agentId) return [];
    if (input.hook_event_name === 'SubagentStart') {
      this.subagentById.set(agentId, agentType);
      return [{ type: 'subagent.start', agentId, agentType }];
    }
    if (input.hook_event_name === 'SubagentStop') {
      this.subagentById.delete(agentId);
      return [{ type: 'subagent.stop', agentId, agentType }];
    }
    return [];
  }

  authorForAgentId(agentId: string | undefined): Author {
    if (agentId) return { agent: this.subagentById.get(agentId) ?? 'subagent', parentToolUseId: null };
    return { agent: this.mainAgent, parentToolUseId: null };
  }

  private authorFor(parent: unknown): Author {
    if (typeof parent === 'string' && parent) {
      return { agent: this.subagentByToolUse.get(parent) ?? 'subagent', parentToolUseId: parent };
    }
    return { agent: this.mainAgent, parentToolUseId: null };
  }

  private mapAssistant(msg: SdkMessageLike): ThreadEvent[] {
    const author = this.authorFor(msg.parent_tool_use_id);
    const message = (msg.message ?? {}) as { id?: unknown; content?: unknown };
    const blocks = Array.isArray(message.content) ? (message.content as Block[]) : [];
    const baseId = str(message.id) || `m${++this.counter}`;
    const out: ThreadEvent[] = [];
    blocks.forEach((block, index) => {
      if (block.type === 'text' && str(block.text).trim()) {
        const messageId = `${baseId}:${index}`;
        out.push(
          { type: 'message.start', messageId, author },
          { type: 'message.delta', messageId, text: str(block.text) },
          { type: 'message.end', messageId },
        );
      } else if (block.type === 'tool_use' && str(block.id) && str(block.name)) {
        const name = str(block.name);
        const input = (block.input && typeof block.input === 'object' ? block.input : {}) as Record<string, unknown>;
        if (AGENT_TOOLS.has(name)) this.subagentByToolUse.set(str(block.id), str(input.subagent_type) || 'general-purpose');
        const diff = diffFor(name, input);
        out.push({
          type: 'tool.start',
          toolUseId: str(block.id),
          author,
          tool: name,
          summary: summarizeTool(name, input),
          ...(diff ? { diff } : {}),
        });
      }
    });
    return out;
  }

  private mapUser(msg: SdkMessageLike): ThreadEvent[] {
    const message = (msg.message ?? {}) as { content?: unknown };
    if (!Array.isArray(message.content)) return [];
    return (message.content as Block[])
      .filter((b) => b.type === 'tool_result' && str(b.tool_use_id))
      .map((b) => ({
        type: 'tool.end' as const,
        toolUseId: str(b.tool_use_id),
        isError: b.is_error === true,
        summary: truncate(resultText(b.content), 200),
      }));
  }

  private mapResult(msg: SdkMessageLike): ThreadEvent[] {
    const usage = (msg.usage ?? {}) as Record<string, unknown>;
    const out: ThreadEvent[] = [
      {
        type: 'turn.end',
        usage: {
          model: this.primaryModel(msg.modelUsage),
          effort: this.effort,
          tokensIn: num(usage.input_tokens) + num(usage.cache_read_input_tokens) + num(usage.cache_creation_input_tokens),
          tokensOut: num(usage.output_tokens),
          costUsd: num(msg.total_cost_usd),
        },
      },
    ];
    if (msg.subtype !== 'success' || msg.is_error === true) {
      const errors = Array.isArray(msg.errors) ? msg.errors.filter((e): e is string => typeof e === 'string') : [];
      out.push({
        type: 'session.status',
        status: 'error',
        error: {
          code: str(msg.subtype) || 'error',
          message: truncate(errors.join('; ') || str(msg.result) || str(msg.subtype) || 'error', 500),
        },
      });
    }
    return out;
  }

  private primaryModel(modelUsage: unknown): string {
    let best: { name: string; cost: number } | null = null;
    if (modelUsage && typeof modelUsage === 'object') {
      for (const [name, value] of Object.entries(modelUsage as Record<string, { costUSD?: unknown }>)) {
        const cost = num(value?.costUSD);
        if (!best || cost > best.cost) best = { name, cost };
      }
    }
    return best?.name ?? this.model ?? 'unknown';
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- sdk-mapper`
Expected: PASS (ajustar sólo las aserciones de fixtures según las notas del spike, nunca las sintéticas).

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/engine/sdk-mapper.ts apps/studio-bridge/src/engine/sdk-mapper.spec.ts
git commit -m "feat(studio-bridge): map Agent SDK stream to protocol events"
```

---

### Task 14: `ClaudeAgentSdkEngine`

**Tier:** `opus` / `high`.

**Files:**
- Create: `apps/studio-bridge/src/engine/claude-sdk-engine.ts`
- Test: `apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`

**Interfaces:**
- Consumes: `SdkEventMapper` (Task 13), contrato de Task 10, `DEFAULT_AGENT`.
- Produces: `type QueryFn = (params: { prompt: string; options?: Options }) => Query`, `buildQueryOptions(input: EngineTurnInput, h: { abort: AbortController; canUseTool: NonNullable<Options['canUseTool']>; onHook(input: unknown): void }): Options`, `class ClaudeAgentSdkEngine implements AgentEngine { constructor(queryFn?: QueryFn) }`.

Reglas de `buildQueryOptions`: siempre `cwd`, `abortController`, `settingSources: ['project']`, `forwardSubagentText: true`, `permissionMode`, `canUseTool`, hooks `SubagentStart`/`SubagentStop`. `agent` sólo si no es `sdd-orchestrator`. `model` sólo si no es `kit`; `effort` sólo si el modelo no es `kit` y hay effort. `resume` si hay sesión previa. Si el spike mostró que un modelo rechaza `effort`, agregar acá la exclusión con su test.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';
import { defaultThreadOptions, type ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import { buildQueryOptions, ClaudeAgentSdkEngine, type QueryFn } from './claude-sdk-engine';
import type { ApprovalRequest, EngineTurnInput } from './types';

const input = (over: Partial<EngineTurnInput['options']> = {}, resume: string | null = null): EngineTurnInput => ({
  threadId: 't', text: 'hola', cwd: '/repo', resumeSessionId: resume, options: { ...defaultThreadOptions(), ...over },
});
const handlers = () => ({ abort: new AbortController(), canUseTool: vi.fn(), onHook: vi.fn() });

describe('buildQueryOptions', () => {
  it('leaves model, effort and agent to the kit by default', () => {
    const o = buildQueryOptions(input(), handlers());
    expect(o).toMatchObject({ cwd: '/repo', settingSources: ['project'], forwardSubagentText: true, permissionMode: 'default' });
    expect(o.model).toBeUndefined();
    expect(o.effort).toBeUndefined();
    expect(o.agent).toBeUndefined();
    expect(o.resume).toBeUndefined();
    expect(Object.keys(o.hooks ?? {})).toEqual(['SubagentStart', 'SubagentStop']);
  });
  it('pins model and effort, uses the DM agent and resumes', () => {
    const o = buildQueryOptions(input({ agent: 'sdd-planner', model: 'opus', effort: 'high', permissionMode: 'plan' }, 'sess-1'), handlers());
    expect(o).toMatchObject({ agent: 'sdd-planner', model: 'opus', effort: 'high', permissionMode: 'plan', resume: 'sess-1' });
  });
  it('ignores effort when the model is kit', () => {
    expect(buildQueryOptions(input({ effort: 'max' }), handlers()).effort).toBeUndefined();
  });
});

type Rec = { kind: 'message' | 'hook' | 'canUseTool'; data: any };
function replayQuery(name: string): { fn: QueryFn; interrupt: ReturnType<typeof vi.fn> } {
  const records = readFileSync(new URL(`./__fixtures__/${name}.jsonl`, import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l) as Rec);
  const interrupt = vi.fn(async () => undefined);
  const fn: QueryFn = ({ options }) => {
    const signal = new AbortController().signal;
    async function* run() {
      for (const r of records) {
        if (r.kind === 'message') yield r.data;
        else if (r.kind === 'hook') {
          const matcher = options?.hooks?.[r.data.hook_event_name as 'SubagentStart']?.[0];
          await matcher?.hooks[0]?.(r.data, undefined, { signal });
        } else {
          await options?.canUseTool?.(r.data.toolName, r.data.input, { signal, toolUseID: r.data.toolUseID, agentID: r.data.agentID ?? undefined } as never);
        }
      }
    }
    return Object.assign(run(), { interrupt }) as unknown as Query;
  };
  return { fn, interrupt };
}

describe('ClaudeAgentSdkEngine', () => {
  it('streams mapped events, reports the session id and routes approvals', async () => {
    const { fn } = replayQuery('permission');
    const events: ThreadEvent[] = [];
    const sessions: string[] = [];
    const asked: ApprovalRequest[] = [];
    const turn = new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: (e) => events.push(e),
      onSessionId: (id) => sessions.push(id),
      requestApproval: async (r) => (asked.push(r), { behavior: 'deny', message: 'no' }),
    });
    await turn.done;
    expect(sessions).toHaveLength(1);
    expect(asked[0]).toMatchObject({ toolName: 'Write', author: { agent: 'sdd-orchestrator' } });
    expect(typeof asked[0]?.toolUseId).toBe('string');
    expect(events.some((e) => e.type === 'turn.end')).toBe(true);
  });

  it('interrupts through the query', async () => {
    const { fn, interrupt } = replayQuery('simple');
    const turn = new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: () => {}, onSessionId: () => {}, requestApproval: async () => ({ behavior: 'allow' }),
    });
    await turn.interrupt();
    await turn.done;
    expect(interrupt).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- claude-sdk-engine`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/engine/claude-sdk-engine.ts`:
```ts
import { query as sdkQuery, type HookInput, type Options, type Query } from '@anthropic-ai/claude-agent-sdk';
import { DEFAULT_AGENT } from '@sdd-studio/protocol';
import { SdkEventMapper, type SdkMessageLike } from './sdk-mapper';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

export type QueryFn = (params: { prompt: string; options?: Options }) => Query;

export function buildQueryOptions(
  input: EngineTurnInput,
  h: { abort: AbortController; canUseTool: NonNullable<Options['canUseTool']>; onHook: (input: unknown) => void },
): Options {
  const { agent, model, effort, permissionMode } = input.options;
  const hook = [{ hooks: [async (hookInput: HookInput) => (h.onHook(hookInput), {})] }];
  const options: Options = {
    cwd: input.cwd,
    abortController: h.abort,
    settingSources: ['project'],
    forwardSubagentText: true,
    permissionMode,
    canUseTool: h.canUseTool,
    hooks: { SubagentStart: hook, SubagentStop: hook },
  };
  if (agent !== DEFAULT_AGENT) options.agent = agent;
  if (model !== 'kit') {
    options.model = model;
    if (effort) options.effort = effort;
  }
  if (input.resumeSessionId) options.resume = input.resumeSessionId;
  return options;
}

export class ClaudeAgentSdkEngine implements AgentEngine {
  readonly name = 'claude-agent-sdk';

  constructor(private readonly queryFn: QueryFn = sdkQuery as QueryFn) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    const abort = new AbortController();
    const mapper = new SdkEventMapper(input.options.agent, input.options.model === 'kit' ? null : input.options.effort);
    const emitAll = (events: ReturnType<SdkEventMapper['mapMessage']>) => {
      for (const event of events) cb.emit(event);
    };
    const q = this.queryFn({
      prompt: input.text,
      options: buildQueryOptions(input, {
        abort,
        onHook: (hookInput) => emitAll(mapper.mapHook(hookInput as Parameters<SdkEventMapper['mapHook']>[0])),
        canUseTool: async (toolName, toolInput, opts) => {
          const decision = await cb.requestApproval(
            { toolName, input: toolInput, author: mapper.authorForAgentId(opts.agentID), toolUseId: opts.toolUseID ?? null },
            opts.signal,
          );
          return decision.behavior === 'allow'
            ? { behavior: 'allow', updatedInput: toolInput }
            : { behavior: 'deny', message: decision.message };
        },
      }),
    });
    const done = (async () => {
      for await (const message of q) {
        const msg = message as unknown as SdkMessageLike;
        if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
          cb.onSessionId(msg.session_id);
        }
        emitAll(mapper.mapMessage(msg));
      }
    })();
    return {
      done,
      interrupt: async () => {
        try {
          await q.interrupt();
        } catch {
          abort.abort();
        }
      },
    };
  }
}
```

- [ ] **Step 4: Verificar que pasa y typecheck**

Run: `pnpm --filter @e-burgos/sdd-studio test -- claude-sdk-engine && pnpm --filter @e-burgos/sdd-studio typecheck`
Expected: PASS. Si `HookInput` o el retorno `{}` no compilan contra 0.3.292, usar el tipo exacto que pide `HookCallback` en `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (no castear a `any`).

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/engine/claude-sdk-engine.ts apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts
git commit -m "feat(studio-bridge): Claude Agent SDK engine"
```

---

### Task 15: `CommandRunner` (scripts del kit)

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/commands/runner.ts`
- Test: `apps/studio-bridge/src/commands/runner.spec.ts`

**Interfaces:**
- Consumes: `KitCommandName`, `ServerEvent`; stubs del fixture (`sdd/scripts/spec-gate.mjs`, `validate-sdd.mjs`).
- Produces: `class CommandRunner { constructor(root: string, broadcast: (e: ServerEvent) => void, newId?: () => string); run(name: KitCommandName, args: string[]): string /* runId */ }`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/commands/runner.spec.ts`:
```ts
import type { ServerEvent } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { CommandRunner } from './runner';

let root: string;
let cleanup: () => Promise<void>;
let sent: ServerEvent[];
beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  sent = [];
});
afterEach(() => cleanup());

const exitOf = (runId: string) =>
  sent.find((e): e is Extract<ServerEvent, { kind: 'command.exit' }> => e.kind === 'command.exit' && e.runId === runId);
const outputOf = (runId: string, stream: 'stdout' | 'stderr') =>
  sent.flatMap((e) => (e.kind === 'command.output' && e.runId === runId && e.stream === stream ? [e.chunk] : [])).join('');

describe('CommandRunner', () => {
  it('runs the gate script with its args and streams stdout', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r1');
    expect(runner.run('gate', ['spec-dev-001-pagos', 'cycle-01'])).toBe('r1');
    expect((await waitFor(() => exitOf('r1'))).exitCode).toBe(0);
    expect(outputOf('r1', 'stdout')).toContain('gate spec-dev-001-pagos cycle-01');
  });

  it('reports a non-zero exit and stderr', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r2');
    runner.run('gate', ['blocked']);
    expect((await waitFor(() => exitOf('r2'))).exitCode).toBe(1);
    expect(outputOf('r2', 'stderr')).toContain('blocked');
  });

  it('fails cleanly when the script is missing', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r3');
    runner.run('rebuild-catalog', []);
    expect((await waitFor(() => exitOf('r3'))).exitCode).not.toBe(0);
    expect(sent.filter((e) => e.kind === 'command.exit')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- runner`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/commands/runner.ts`:
```ts
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { KitCommandName, ServerEvent } from '@sdd-studio/protocol';

const SCRIPTS: Record<KitCommandName, string> = {
  gate: 'spec-gate.mjs',
  validate: 'validate-sdd.mjs',
  'rebuild-tasks-index': 'rebuild-tasks-index.mjs',
  'rebuild-catalog': 'rebuild-catalog.mjs',
};

export class CommandRunner {
  constructor(
    private readonly root: string,
    private readonly broadcast: (event: ServerEvent) => void,
    private readonly newId: () => string = randomUUID,
  ) {}

  /** `args` ya viene validado por el protocolo; se pasa sin shell. */
  run(name: KitCommandName, args: string[]): string {
    const runId = this.newId();
    const script = path.join(this.root, 'sdd', 'scripts', SCRIPTS[name]);
    const child = spawn(process.execPath, [script, ...args], { cwd: this.root, shell: false });
    let exited = false;
    const exit = (exitCode: number) => {
      if (exited) return;
      exited = true;
      this.broadcast({ kind: 'command.exit', runId, exitCode });
    };
    child.stdout.on('data', (chunk: Buffer) =>
      this.broadcast({ kind: 'command.output', runId, stream: 'stdout', chunk: chunk.toString('utf8') }),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      this.broadcast({ kind: 'command.output', runId, stream: 'stderr', chunk: chunk.toString('utf8') }),
    );
    child.on('error', (error) => {
      this.broadcast({ kind: 'command.output', runId, stream: 'stderr', chunk: error.message });
      exit(127);
    });
    child.on('close', (code) => exit(code ?? 1));
    return runId;
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @e-burgos/sdd-studio test -- runner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/commands
git commit -m "feat(studio-bridge): allowlisted kit script runner"
```

---

### Task 16: Servidor WebSocket (token, Origin, handshake) y router de comandos

**Tier:** `opus` / `high` (superficie de seguridad).

**Files:**
- Create: `apps/studio-bridge/src/server/security.ts`, `apps/studio-bridge/src/server/ws-server.ts`, `apps/studio-bridge/src/server/router.ts`
- Test: `apps/studio-bridge/src/server/security.spec.ts`, `apps/studio-bridge/src/server/ws-server.spec.ts`, `apps/studio-bridge/src/server/router.spec.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  ```ts
  // security.ts
  createToken(): string; tokensMatch(a: string, b: string): boolean; originAllowed(origin: string | undefined, allowed: string[]): boolean
  // ws-server.ts
  interface BridgeHandlers { welcome(): Omit<Welcome, 'kind' | 'protocolVersion'>; handle(cmd: ClientCommand): Promise<unknown> }
  interface BridgeServer { port: number; broadcast(m: ServerMessage): void; close(): Promise<void> }
  startBridgeServer(o: { port: number; strictPort: boolean; token: string; allowedOrigins: string[]; handlers: BridgeHandlers; helloTimeoutMs?: number }): Promise<BridgeServer>
  MAX_PAYLOAD_BYTES = 1_048_576
  // router.ts
  createHandlers(d: { root: string; authMode: AuthMode; bridgeVersion: string; sessions: SessionManager; watcher: Pick<WorkspaceWatcher, 'current'>; runner: Pick<CommandRunner, 'run'>; store: Pick<ThreadStore, 'botHistory'> }): BridgeHandlers
  ```
- Códigos de cierre: `4000` mensaje inválido/timeout, `4001` token incorrecto, `4002` versión de protocolo.

- [ ] **Step 1: Tests que fallan**

`apps/studio-bridge/src/server/security.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createToken, originAllowed, tokensMatch } from './security';

const ALLOWED = ['https://studio.sdd.estebanburgos.com.ar', 'http://localhost:*', 'http://127.0.0.1:*'];

describe('security', () => {
  it('creates 43-char base64url tokens', () => {
    const t = createToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createToken()).not.toBe(t);
  });
  it('compares tokens of any length safely', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });
  it.each([
    ['https://studio.sdd.estebanburgos.com.ar', true],
    ['http://localhost:3000', true],
    ['http://localhost', true],
    ['http://127.0.0.1:4320', true],
    ['https://evil.example', false],
    ['http://localhost.evil.example:80', false],
    ['https://studio.sdd.estebanburgos.com.ar.evil.example', false],
    [undefined, true],
  ])('origin %s → %s', (origin, expected) => {
    expect(originAllowed(origin, ALLOWED)).toBe(expected);
  });
});
```

`apps/studio-bridge/src/server/ws-server.spec.ts`:
```ts
import { PROTOCOL_VERSION, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { waitFor } from '../test-utils/fixture';
import { MAX_PAYLOAD_BYTES, startBridgeServer, type BridgeServer } from './ws-server';

let server: BridgeServer | undefined;
afterEach(async () => server?.close());

const TOKEN = 'tok';
async function start(helloTimeoutMs = 2000) {
  server = await startBridgeServer({
    port: 0, strictPort: true, token: TOKEN, allowedOrigins: ['http://localhost:*'], helloTimeoutMs,
    handlers: {
      welcome: () => ({ bridgeVersion: '0.1.0', workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'local-claude-login' }),
      handle: async (cmd) => {
        if (cmd.cmd === 'thread.list') return [];
        throw new Error('boom');
      },
    },
  });
  return server;
}
function connect(s: BridgeServer, origin?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}`, origin ? { origin } : {});
  const inbox: ServerMessage[] = [];
  let closeCode: number | null = null;
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  ws.on('close', (code) => (closeCode = code));
  return { ws, inbox, closed: () => closeCode };
}
const opened = (ws: WebSocket) => new Promise<void>((res, rej) => (ws.once('open', () => res()), ws.once('error', rej)));
const hello = (token = TOKEN, protocolVersion = PROTOCOL_VERSION) =>
  JSON.stringify({ kind: 'hello', token, protocolVersion, clientVersion: 'test' });

describe('startBridgeServer', () => {
  it('listens on loopback only', async () => {
    const s = await start();
    expect(s.port).toBeGreaterThan(0);
  });

  it('rejects a foreign origin before the handshake', async () => {
    const s = await start();
    const c = connect(s, 'https://evil.example');
    await expect(opened(c.ws)).rejects.toThrow(/403/);
  });

  it('welcomes a valid hello and answers commands', async () => {
    const s = await start();
    const c = connect(s, 'http://localhost:5173');
    await opened(c.ws);
    c.ws.send(hello());
    await waitFor(() => c.inbox.find((m) => m.kind === 'welcome'));
    c.ws.send(JSON.stringify({ kind: 'command', id: 'a', cmd: 'thread.list' }));
    c.ws.send(JSON.stringify({ kind: 'command', id: 'b', cmd: 'workspace.snapshot' }));
    c.ws.send('{not json');
    await waitFor(() => c.inbox.filter((m) => m.kind === 'result').length === 3);
    expect(c.inbox).toContainEqual({ kind: 'result', id: 'a', ok: true, data: [] });
    expect(c.inbox).toContainEqual({ kind: 'result', id: 'b', ok: false, error: { code: 'internal', message: 'boom' } });
    expect(c.inbox).toContainEqual(expect.objectContaining({ kind: 'result', id: 'unknown', ok: false }));
  });

  it.each([
    ['bad token', hello('nope'), 4001],
    ['protocol mismatch', hello(TOKEN, 999), 4002],
    ['command before hello', JSON.stringify({ kind: 'command', id: 'a', cmd: 'thread.list' }), 4000],
  ])('closes on %s', async (_label, first, code) => {
    const s = await start();
    const c = connect(s);
    await opened(c.ws);
    c.ws.send(first);
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(code);
    expect(c.inbox[0]?.kind).toBe('handshake.error');
  });

  it('closes when no hello arrives in time', async () => {
    const s = await start(100);
    const c = connect(s);
    await opened(c.ws);
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(4000);
  });

  it('broadcasts only to authenticated clients (two tabs)', async () => {
    const s = await start();
    const a = connect(s);
    const b = connect(s);
    const anon = connect(s);
    await Promise.all([opened(a.ws), opened(b.ws), opened(anon.ws)]);
    a.ws.send(hello());
    b.ws.send(hello());
    await waitFor(() => a.inbox.length && b.inbox.length);
    s.broadcast({ kind: 'command.exit', runId: 'r', exitCode: 0 });
    await waitFor(() => a.inbox.length === 2 && b.inbox.length === 2);
    expect(anon.inbox).toEqual([]);
  });

  it('drops oversized messages', async () => {
    const s = await start();
    const c = connect(s);
    await opened(c.ws);
    c.ws.send(hello());
    await waitFor(() => c.inbox.length);
    c.ws.send('x'.repeat(MAX_PAYLOAD_BYTES + 1));
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(1009);
  });
});
```

`apps/studio-bridge/src/server/router.spec.ts`:
```ts
import { defaultThreadOptions, type ClientCommand } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandRunner } from '../commands/runner';
import { FakeEngine } from '../engine/fake-engine';
import { SessionManager } from '../sessions/session-manager';
import { ThreadStore } from '../sessions/store';
import { copyFixture } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import { createHandlers } from './router';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

async function handlers() {
  const snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  const store = new ThreadStore(root);
  await store.init();
  const sessions = new SessionManager({ root, engine: new FakeEngine(1), store, snapshot: () => snapshot, broadcast: () => {} });
  return createHandlers({
    root, authMode: 'api-key', bridgeVersion: '0.1.0', sessions, store,
    watcher: { current: () => snapshot }, runner: new CommandRunner(root, () => {}, () => 'run-1'),
  });
}
const cmd = (c: Record<string, unknown>) => ({ kind: 'command', id: 'x', ...c }) as ClientCommand;

describe('createHandlers', () => {
  it('builds the welcome from the snapshot', async () => {
    expect((await handlers()).welcome()).toEqual({
      bridgeVersion: '0.1.0', workspace: { root, project: 'studio fixture' }, kitVersion: '0.16.0', authMode: 'api-key',
    });
  });

  it('reads files under sdd/ and refuses the rest', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/global.json' }))).toMatchObject({ path: 'sdd/global.json' });
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/../package.json' }))).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('creates threads, lists them and runs kit commands', async () => {
    const h = await handlers();
    const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
    expect(await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))).toEqual([expect.objectContaining({ id: thread.id })]);
    expect(await h.handle(cmd({ cmd: 'command.run', name: 'validate', args: [] }))).toEqual({ runId: 'run-1' });
    expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'fixes', limit: 10 }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm --filter @e-burgos/sdd-studio test -- server`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/server/security.ts`:
```ts
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const createToken = (): string => randomBytes(32).toString('base64url');

export function tokensMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sin Origin (cliente no navegador) se acepta: el token sigue siendo obligatorio. */
export function originAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.some((pattern) =>
    pattern.endsWith(':*')
      ? new RegExp(`^${escapeRe(pattern.slice(0, -2))}(:\\d{1,5})?$`).test(origin)
      : pattern === origin,
  );
}
```

`apps/studio-bridge/src/server/ws-server.ts`:
```ts
import { createServer, type Server } from 'node:http';
import {
  decodeClientMessage,
  PROTOCOL_VERSION,
  type ClientCommand,
  type ErrorCode,
  type ServerMessage,
  type Welcome,
} from '@sdd-studio/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import { SessionError } from '../sessions/session-manager';
import { PathError } from '../workspace/paths';
import { originAllowed, tokensMatch } from './security';

export const MAX_PAYLOAD_BYTES = 1_048_576;

export interface BridgeHandlers {
  welcome(): Omit<Welcome, 'kind' | 'protocolVersion'>;
  handle(command: ClientCommand): Promise<unknown>;
}

export interface BridgeServer {
  port: number;
  broadcast(message: ServerMessage): void;
  close(): Promise<void>;
}

function toError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof SessionError || error instanceof PathError) return { code: error.code, message: error.message };
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) };
}

async function listen(http: Server, port: number, strictPort: boolean): Promise<number> {
  for (let attempt = 0; attempt < (strictPort ? 1 : 10); attempt++) {
    const candidate = port === 0 ? 0 : port + attempt;
    try {
      await new Promise<void>((resolve, reject) => {
        http.once('error', reject);
        http.listen(candidate, '127.0.0.1', () => (http.off('error', reject), resolve()));
      });
      const address = http.address();
      return typeof address === 'object' && address ? address.port : candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || strictPort) throw error;
    }
  }
  throw new Error(`no hay puertos libres desde ${port}`);
}

export async function startBridgeServer(o: {
  port: number;
  strictPort: boolean;
  token: string;
  allowedOrigins: string[];
  handlers: BridgeHandlers;
  helloTimeoutMs?: number;
}): Promise<BridgeServer> {
  const http = createServer((_req, res) => {
    res.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SDD Studio bridge: conectate por WebSocket.');
  });
  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: (info, done) => done(originAllowed(info.origin || undefined, o.allowedOrigins), 403),
  });
  const clients = new Set<WebSocket>();
  const send = (ws: WebSocket, message: ServerMessage) => ws.send(JSON.stringify(message));

  wss.on('connection', (ws) => {
    let authed = false;
    const reject = (code: 'bad-message' | 'bad-token' | 'protocol-mismatch' | 'timeout', message: string, closeCode: number) => {
      send(ws, { kind: 'handshake.error', code, message });
      ws.close(closeCode);
    };
    const timer = setTimeout(() => reject('timeout', 'no llegó el hello a tiempo', 4000), o.helloTimeoutMs ?? 5000);

    ws.on('message', async (raw) => {
      const decoded = decodeClientMessage(raw.toString());
      if (!authed) {
        clearTimeout(timer);
        if (!decoded.ok || decoded.value.kind !== 'hello') return reject('bad-message', 'se esperaba hello', 4000);
        if (!tokensMatch(decoded.value.token, o.token)) return reject('bad-token', 'token inválido', 4001);
        if (decoded.value.protocolVersion !== PROTOCOL_VERSION) {
          return reject('protocol-mismatch', `el puente habla el protocolo ${PROTOCOL_VERSION}`, 4002);
        }
        authed = true;
        clients.add(ws);
        send(ws, { kind: 'welcome', protocolVersion: PROTOCOL_VERSION, ...o.handlers.welcome() });
        return undefined;
      }
      if (!decoded.ok) {
        send(ws, { kind: 'result', id: 'unknown', ok: false, error: { code: 'bad-request', message: decoded.error } });
        return undefined;
      }
      if (decoded.value.kind === 'hello') return undefined;
      const command = decoded.value;
      try {
        const data = await o.handlers.handle(command);
        send(ws, { kind: 'result', id: command.id, ok: true, data: data ?? null });
      } catch (error) {
        send(ws, { kind: 'result', id: command.id, ok: false, error: toError(error) });
      }
      return undefined;
    });
    ws.on('close', () => {
      clearTimeout(timer);
      clients.delete(ws);
    });
  });

  const port = await listen(http, o.port, o.strictPort);
  return {
    port,
    broadcast: (message) => {
      const payload = JSON.stringify(message);
      for (const ws of clients) ws.send(payload);
    },
    close: async () => {
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
```

`apps/studio-bridge/src/server/router.ts`:
```ts
import { readFile, stat } from 'node:fs/promises';
import type { AuthMode, ClientCommand } from '@sdd-studio/protocol';
import type { CommandRunner } from '../commands/runner';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import { resolveSddPath } from '../workspace/paths';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

const MAX_READ_BYTES = 2 * 1024 * 1024;

export function createHandlers(d: {
  root: string;
  authMode: AuthMode;
  bridgeVersion: string;
  sessions: SessionManager;
  watcher: Pick<WorkspaceWatcher, 'current'>;
  runner: Pick<CommandRunner, 'run'>;
  store: Pick<ThreadStore, 'botHistory'>;
}): BridgeHandlers {
  return {
    welcome: () => {
      const snapshot = d.watcher.current();
      return {
        bridgeVersion: d.bridgeVersion,
        workspace: { root: d.root, project: snapshot.project },
        kitVersion: snapshot.kitVersion,
        authMode: d.authMode,
      };
    },
    handle: async (command: ClientCommand) => {
      switch (command.cmd) {
        case 'workspace.snapshot':
          return d.watcher.current();
        case 'workspace.readFile': {
          const file = await resolveSddPath(d.root, command.path);
          if ((await stat(file)).size > MAX_READ_BYTES) throw new SessionError('bad-request', 'archivo demasiado grande');
          return { path: command.path, content: await readFile(file, 'utf8') };
        }
        case 'thread.create':
          return d.sessions.createThread(command);
        case 'thread.send':
          await d.sessions.send(command.threadId, command.text);
          return null;
        case 'thread.interrupt':
          await d.sessions.interrupt(command.threadId);
          return null;
        case 'thread.setOptions':
          return d.sessions.setOptions(command.threadId, command.options);
        case 'thread.list':
          return d.sessions.list(command.channelId);
        case 'thread.history':
          return d.sessions.history(command.threadId, command.sinceSeq);
        case 'channel.botHistory':
          return d.store.botHistory(command.channelId, command.limit);
        case 'approval.respond':
          d.sessions.respondApproval(command.approvalId, command.decision, command.reason, command.scope);
          return null;
        case 'command.run':
          return { runId: d.runner.run(command.name, command.args) };
      }
    },
  };
}
```

- [ ] **Step 4: Verificar que pasan (tres corridas)**

Run: `for i in 1 2 3; do pnpm --filter @e-burgos/sdd-studio test -- server || break; done`
Expected: PASS las tres veces.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge/src/server
git commit -m "feat(studio-bridge): loopback WebSocket server with token, origin allowlist and command router"
```

---

### Task 17: Arranque (`startBridge`), CLI, build y bin

**Tier:** `sonnet` / `medium`.

**Files:**
- Create: `apps/studio-bridge/src/version.ts`, `apps/studio-bridge/src/auth-mode.ts`, `apps/studio-bridge/src/main.ts`, `apps/studio-bridge/src/cli.ts`, `apps/studio-bridge/build.js`, `apps/studio-bridge/bin/sdd-studio.mjs`
- Test: `apps/studio-bridge/src/main.spec.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `BRIDGE_VERSION`, `detectAuthMode(env?): AuthMode`, `class BridgeStartError extends Error`, `DEFAULT_WEB_URL`, `DEFAULT_ORIGINS`, `startBridge(o: { root: string; port: number; strictPort: boolean; engine: 'claude' | 'fake'; allowedOrigins: string[]; webUrl: string; token?: string }): Promise<{ url: string; port: number; token: string; authMode: AuthMode; project: string; close(): Promise<void> }>`.

- [ ] **Step 1: Test que falla**

`apps/studio-bridge/src/main.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION, defaultThreadOptions, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { detectAuthMode } from './auth-mode';
import { BridgeStartError, DEFAULT_ORIGINS, startBridge } from './main';
import { copyFixture, waitFor } from './test-utils/fixture';
import { BRIDGE_VERSION } from './version';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

describe('startBridge', () => {
  it('serves the fixture end to end with the fake engine', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const bridge = await startBridge({
      root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'https://example.test/',
    });
    cleanups.push(bridge.close);
    expect(bridge.url).toBe(`https://example.test/w#bridge=${bridge.port}&token=${bridge.token}`);
    expect(bridge.project).toBe('studio fixture');

    const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}`);
    const inbox: ServerMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ kind: 'hello', token: bridge.token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
    await waitFor(() => inbox.find((m) => m.kind === 'welcome'));
    ws.send(JSON.stringify({ kind: 'command', id: '1', cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }));
    await waitFor(() => inbox.find((m) => m.kind === 'thread.event' && m.event.type === 'turn.end'));
    ws.close();
  });

  it('refuses a folder without sdd/', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'no-sdd-'));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    await expect(
      startBridge({ root: dir, port: 0, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x' }),
    ).rejects.toBeInstanceOf(BridgeStartError);
  });
});

describe('detectAuthMode', () => {
  it('uses the API key when present, the local login otherwise', () => {
    expect(detectAuthMode({ ANTHROPIC_API_KEY: 'k' })).toBe('api-key');
    expect(detectAuthMode({})).toBe('local-claude-login');
  });
});

describe('BRIDGE_VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(BRIDGE_VERSION).toBe(pkg.version);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @e-burgos/sdd-studio test -- main`
Expected: FAIL.

- [ ] **Step 3: Implementación**

`apps/studio-bridge/src/version.ts`:
```ts
export const BRIDGE_VERSION = '0.1.0';
```

`apps/studio-bridge/src/auth-mode.ts`:
```ts
import type { AuthMode } from '@sdd-studio/protocol';

/** Con ANTHROPIC_API_KEY el SDK usa la key; sin ella, el login local de Claude Code. */
export const detectAuthMode = (env: NodeJS.ProcessEnv = process.env): AuthMode =>
  env.ANTHROPIC_API_KEY ? 'api-key' : 'local-claude-login';
```

`apps/studio-bridge/src/main.ts`:
```ts
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AuthMode, ServerMessage } from '@sdd-studio/protocol';
import { detectAuthMode } from './auth-mode';
import { CommandRunner } from './commands/runner';
import { ClaudeAgentSdkEngine } from './engine/claude-sdk-engine';
import { FakeEngine } from './engine/fake-engine';
import { createHandlers } from './server/router';
import { createToken } from './server/security';
import { startBridgeServer, type BridgeServer } from './server/ws-server';
import { SessionManager } from './sessions/session-manager';
import { ThreadStore } from './sessions/store';
import { BRIDGE_VERSION } from './version';
import { startWorkspaceWatcher } from './workspace/watcher';

export class BridgeStartError extends Error {}

export const DEFAULT_WEB_URL = 'https://studio.sdd.estebanburgos.com.ar';
export const DEFAULT_ORIGINS = [DEFAULT_WEB_URL, 'http://localhost:*', 'http://127.0.0.1:*'];

export async function startBridge(o: {
  root: string;
  port: number;
  strictPort: boolean;
  engine: 'claude' | 'fake';
  allowedOrigins: string[];
  webUrl: string;
  token?: string;
}): Promise<{ url: string; port: number; token: string; authMode: AuthMode; project: string; close(): Promise<void> }> {
  const root = path.resolve(o.root);
  if (!existsSync(path.join(root, 'sdd'))) {
    throw new BridgeStartError(
      `No encontré sdd/ en ${root}. Corré sdd-studio en la raíz de un repo con el kit (instalalo con \`harness init\`).`,
    );
  }
  const store = new ThreadStore(root);
  await store.init();
  let server: BridgeServer | null = null;
  const broadcast = (message: ServerMessage) => server?.broadcast(message);

  const watcher = await startWorkspaceWatcher({
    root,
    onUpdate: (update) => {
      broadcast({ kind: 'workspace.changed', areas: update.areas, snapshot: update.snapshot });
      for (const event of update.events) {
        store.appendBot(event);
        broadcast({ kind: 'bot.event', ...event });
      }
    },
  });
  const engine = o.engine === 'fake' ? new FakeEngine() : new ClaudeAgentSdkEngine();
  const sessions = new SessionManager({ root, engine, store, snapshot: () => watcher.current(), broadcast });
  const runner = new CommandRunner(root, broadcast);
  const token = o.token ?? createToken();
  const authMode = detectAuthMode();

  server = await startBridgeServer({
    port: o.port,
    strictPort: o.strictPort,
    token,
    allowedOrigins: o.allowedOrigins,
    handlers: createHandlers({ root, authMode, bridgeVersion: BRIDGE_VERSION, sessions, watcher, runner, store }),
  });
  const url = `${o.webUrl.replace(/\/+$/, '')}/w#bridge=${server.port}&token=${token}`;
  return {
    url,
    port: server.port,
    token,
    authMode,
    project: watcher.current().project,
    close: async () => {
      await server?.close();
      await watcher.close();
      await store.flush();
    },
  };
}
```

`apps/studio-bridge/src/cli.ts`:
```ts
import { spawn } from 'node:child_process';
import { defineCommand, runMain } from 'citty';
import pc from 'picocolors';
import { BridgeStartError, DEFAULT_ORIGINS, DEFAULT_WEB_URL, startBridge } from './main';
import { BRIDGE_VERSION } from './version';

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  const child = spawn(cmd, args as string[], { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}

const main = defineCommand({
  meta: { name: 'sdd-studio', version: BRIDGE_VERSION, description: 'Puente local de SDD Studio' },
  args: {
    root: { type: 'string', description: 'Raíz del repo (default: directorio actual)' },
    port: { type: 'string', description: 'Puerto del WebSocket (default: 4320, o el siguiente libre)' },
    engine: { type: 'string', description: 'claude | fake', default: 'claude' },
    'allow-origin': { type: 'string', description: 'Orígenes extra permitidos, separados por coma' },
    'web-url': { type: 'string', description: 'URL de la web', default: DEFAULT_WEB_URL },
    open: { type: 'boolean', description: 'Abrir el navegador (--no-open para no abrirlo)', default: true },
  },
  async run({ args }) {
    const engine = args.engine === 'fake' ? 'fake' : 'claude';
    const extraOrigins = (args['allow-origin'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const bridge = await startBridge({
        root: args.root ?? process.cwd(),
        port: args.port ? Number(args.port) : 4320,
        strictPort: Boolean(args.port),
        engine,
        allowedOrigins: [...DEFAULT_ORIGINS, ...extraOrigins],
        webUrl: args['web-url'],
      });
      const auth = bridge.authMode === 'api-key' ? 'API key (ANTHROPIC_API_KEY)' : 'login local de Claude Code';
      console.log(`${pc.bold('SDD Studio')} ${pc.dim(`v${BRIDGE_VERSION}`)} · ${bridge.project}`);
      console.log(`  motor:  ${engine === 'fake' ? pc.yellow('fake (sin tokens)') : 'Claude Agent SDK'}`);
      console.log(`  auth:   ${auth}`);
      console.log(`  puerto: 127.0.0.1:${bridge.port}`);
      console.log(`  abrí:   ${pc.cyan(bridge.url)}`);
      console.log(pc.dim('  Ctrl+C para cerrar.'));
      if (args.open) openBrowser(bridge.url);
      const shutdown = async () => {
        await bridge.close();
        process.exit(0);
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    } catch (error) {
      console.error(pc.red(error instanceof BridgeStartError ? error.message : String(error)));
      process.exit(1);
    }
  },
});

runMain(main);
```

`apps/studio-bridge/build.js`:
```js
import { rm } from 'node:fs/promises';
import esbuild from 'esbuild';

await rm('dist', { recursive: true, force: true });
await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  // @sdd-studio/protocol se empaqueta adentro (es privado); el resto son dependencias reales.
  external: ['@anthropic-ai/claude-agent-sdk', 'chokidar', 'citty', 'picocolors', 'ws', 'zod'],
});
console.log('sdd-studio build OK');
```

`apps/studio-bridge/bin/sdd-studio.mjs`:
```js
#!/usr/bin/env node
import '../dist/cli.js';
```

Run: `chmod +x apps/studio-bridge/bin/sdd-studio.mjs`

- [ ] **Step 4: Verificar tests, build y arranque real con el motor fake**

Run: `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck && pnpm --filter @e-burgos/sdd-studio build`
Expected: todo PASS; existe `apps/studio-bridge/dist/cli.js`.

Run: `(cd apps/studio-bridge/test/fixtures/workspace && node ../../../bin/sdd-studio.mjs --engine fake --no-open & PID=$!; sleep 2; kill $PID); rm -rf apps/studio-bridge/test/fixtures/workspace/.sdd-studio`
Expected: imprime `SDD Studio v0.1.0 · studio fixture` y la URL `https://studio.sdd.estebanburgos.com.ar/w#bridge=4320&token=…` antes de que el `kill` lo corte; no queda `.sdd-studio/` dentro del fixture.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-bridge
git commit -m "feat(studio-bridge): startBridge, sdd-studio CLI, build and bin"
```

---

### Task 18: Scripts raíz, CI, release, README y smoke e2e opt-in

**Tier:** `haiku` / `low` para workflows y README; el smoke e2e en `sonnet` / `medium`.

**Files:**
- Modify: `package.json` (raíz)
- Create: `.github/workflows/release-studio.yml`
- Create: `apps/studio-bridge/README.md`
- Create: `apps/studio-bridge/src/engine/claude-sdk-engine.e2e.spec.ts`
- Modify: `.gitignore` (raíz) — agregar `.sdd-studio/`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Scripts raíz**

En `package.json` raíz, reemplazar `build`, `test` y `typecheck`:
```json
"build": "pnpm --filter @e-burgos/sdd-harness --filter @e-burgos/sdd-studio build",
"test": "pnpm --filter @e-burgos/sdd-harness --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio test",
"typecheck": "pnpm --filter @e-burgos/sdd-harness --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio typecheck",
```

`.gitignore` raíz: agregar la línea `.sdd-studio/` (por si alguien corre el puente sobre este repo o sobre `examples/`).

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: PASS en los tres paquetes (CI ya ejecuta estos scripts en ubuntu y windows; no hace falta tocar `ci.yml`).

- [ ] **Step 2: Smoke e2e real (opt-in)**

`apps/studio-bridge/src/engine/claude-sdk-engine.e2e.spec.ts`:
```ts
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { ClaudeAgentSdkEngine } from './claude-sdk-engine';

const kitAgents = fileURLToPath(new URL('../../../cli/templates/sdd/agents', import.meta.url));

// Gasta tokens reales: SDD_STUDIO_E2E=1 pnpm --filter @e-burgos/sdd-studio test -- e2e
describe.skipIf(!process.env.SDD_STUDIO_E2E)('ClaudeAgentSdkEngine (real)', () => {
  it('answers a trivial prompt with haiku/low', async () => {
    const { root, cleanup } = await copyFixture();
    try {
      await mkdir(path.join(root, '.claude/agents'), { recursive: true });
      for (const f of await readdir(kitAgents)) await cp(path.join(kitAgents, f), path.join(root, '.claude/agents', f));
      const events: ThreadEvent[] = [];
      const turn = new ClaudeAgentSdkEngine().startTurn(
        { threadId: 'e2e', text: 'Reply with exactly the word OK.', cwd: root, resumeSessionId: null,
          options: { agent: 'sdd-orchestrator', model: 'haiku', effort: 'low', permissionMode: 'plan' } },
        { emit: (e) => events.push(e), onSessionId: () => {}, requestApproval: async () => ({ behavior: 'deny', message: 'e2e' }) },
      );
      await turn.done;
      const text = events.flatMap((e) => (e.type === 'message.delta' ? [e.text] : [])).join('');
      expect(text).toContain('OK');
      expect(events.some((e) => e.type === 'turn.end')).toBe(true);
    } finally {
      await cleanup();
    }
  }, 120_000);
});
```

Run: `pnpm --filter @e-burgos/sdd-studio test -- e2e`
Expected: 1 test skipped (sin la variable).

Run (sólo con login disponible): `SDD_STUDIO_E2E=1 env -u ANTHROPIC_API_KEY pnpm --filter @e-burgos/sdd-studio test -- e2e`
Expected: PASS.

- [ ] **Step 3: Workflow de release**

`.github/workflows/release-studio.yml`:
```yaml
name: Release Studio Bridge

on:
  push:
    tags:
      - 'studio-v*'
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Install pnpm
        uses: pnpm/action-setup@v6

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - name: Upgrade npm
        run: npm install -g npm@latest

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck and test
        run: |
          pnpm --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio typecheck
          pnpm --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio test

      - name: Build
        run: pnpm --filter @e-burgos/sdd-studio build

      - name: Check if version is already published
        id: version_check
        run: |
          PKG_VERSION=$(node -p "require('./apps/studio-bridge/package.json').version")
          TAG_VERSION="${GITHUB_REF_NAME#studio-v}"
          if [ "$GITHUB_EVENT_NAME" = "push" ] && [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
            echo "::error::tag $GITHUB_REF_NAME no coincide con package.json ($PKG_VERSION)"
            exit 1
          fi
          if npm view "@e-burgos/sdd-studio@$PKG_VERSION" version >/dev/null 2>&1; then
            echo "already_published=true" >> "$GITHUB_OUTPUT"
            echo "::notice::@e-burgos/sdd-studio@$PKG_VERSION ya está en npm."
          else
            echo "already_published=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Publish to npm
        if: steps.version_check.outputs.already_published == 'false'
        run: pnpm --filter @e-burgos/sdd-studio publish --access public --no-git-checks --provenance
```

Nota para el dueño (no automatizable): el publish usa trusted publishing (OIDC) como la CLI; antes del primer tag `studio-v0.1.0` hay que dar de alta `@e-burgos/sdd-studio` como trusted publisher en npmjs.com (o hacer el primer publish a mano).

- [ ] **Step 4: README del puente**

`apps/studio-bridge/README.md`:
```markdown
# @e-burgos/sdd-studio

Puente local de **SDD Studio**: conecta la web de Studio con un repo que tiene instalado el kit
SDD (`@e-burgos/sdd-harness`) y ejecuta sus agentes con Claude **en tu máquina**.

## Uso

```bash
cd mi-repo            # raíz del repo, donde está sdd/
npx @e-burgos/sdd-studio
```

Abre el navegador en la web de Studio ya emparejada con este repo.

| Opción | Default | Descripción |
|---|---|---|
| `--port <n>` | `4320` (o el siguiente libre) | Puerto del WebSocket en 127.0.0.1 |
| `--engine claude\|fake` | `claude` | `fake` no gasta tokens (demo y tests) |
| `--allow-origin <a,b>` | — | Orígenes extra permitidos |
| `--web-url <url>` | `https://studio.sdd.estebanburgos.com.ar` | Web a abrir |
| `--no-open` | — | No abrir el navegador |

## Autenticación

- Sin `ANTHROPIC_API_KEY`: usa el **login local de Claude Code** (`claude login`) de tu máquina.
- Con `ANTHROPIC_API_KEY`: usa la API key.

El puente nunca lee, guarda ni transmite credenciales. Aviso: la documentación del Claude Agent
SDK indica que, sin aprobación previa de Anthropic, productos de terceros no pueden ofrecer el
login de claude.ai ni sus límites de uso. Si distribuís Studio a otras personas, usá API key o
consultá a Anthropic.

## Seguridad

- Escucha sólo en `127.0.0.1`; exige el token de emparejamiento que imprime al arrancar
  (rota en cada arranque) y valida el `Origin` del navegador.
- Sólo lee archivos bajo `sdd/` y sólo ejecuta los scripts del kit
  (`spec-gate`, `validate-sdd`, `rebuild-tasks-index`, `rebuild-catalog`).
- Las ediciones de código de los agentes pasan por el SPEC GATE del kit y por tu aprobación.

## Datos locales

El historial vive en `.sdd-studio/` en la raíz del repo; la carpeta se ignora sola en git.
```

- [ ] **Step 5: Verificación completa**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: PASS.

Run: `npx vitest run` desde `apps/cli` no cambia (la CLI sigue verde): `pnpm --filter @e-burgos/sdd-harness test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .github/workflows/release-studio.yml apps/studio-bridge
git commit -m "chore(studio): root scripts, release workflow, README and opt-in e2e smoke"
```

---

## Después de este plan

- Revisión final de toda la rama con un revisor `opus`/`high` (seguridad del servidor, concurrencia del `SessionManager`, fidelidad del SPEC GATE).
- **Plan 2 — `apps/studio` (web)**: Next.js en Cloudflare (OpenNext), shell Slack, store de eventos, aprobaciones, composer, panel de actividad, `--local-ui` (export estático servido por el puente), spike de Safari, Playwright contra `--engine=fake`, `deploy-studio.yml`, página "Studio" en la documentación. Se escribe con el protocolo ya fijado y las notas del spike.
