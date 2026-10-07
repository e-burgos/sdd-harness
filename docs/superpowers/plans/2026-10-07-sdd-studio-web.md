# SDD Studio — Plan 2: web (apps/studio)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `apps/studio`, la web estilo Slack de SDD Studio (Next.js 16 en Cloudflare vía OpenNext), conectada al puente local `@e-burgos/sdd-studio`, utilizable también sin deploy mediante `sdd-studio --local-ui`.

**Architecture:** Toda la UI es cliente (sin features de servidor), así el mismo código se publica como Worker de Cloudflare (OpenNext) y como export estático (`STUDIO_EXPORT=1`) que el puente sirve en `--local-ui`. Un `BridgeClient` habla el protocolo de `@sdd-studio/protocol` (handshake, comandos con id, eventos push, reconexión); un store zustand aplica eventos con reducers puros (timeline por hilo, presencia, sdd-bot, corridas de scripts); componentes React renderizan sidebar / canal / hilo / composer / panel derecho.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, TypeScript ~5.9, Tailwind CSS 4.3 (`@tailwindcss/postcss`), zustand 5, react-markdown 10 + remark-gfm 4, @phosphor-icons/react 2.1, @fontsource-variable (Space Grotesk, JetBrains Mono), vitest 4 + jsdom + @testing-library/react 16, Playwright 1.63, @opennextjs/cloudflare 1.20 + wrangler 4, cross-env.

**Spec:** `docs/superpowers/specs/2026-10-07-sdd-studio-design.md` (§3.1–3.3, §4, §8, §9, §10). Plan 1 (puente) ya está en `main`: `docs/superpowers/plans/2026-10-07-sdd-studio-bridge.md`.

## Global Constraints

- El kit (`apps/cli/templates/sdd/`) no se modifica.
- La web no usa features de servidor (route handlers, middleware, server actions, `cookies()`/`headers()`): todo debe compilar con `output: 'export'`.
- `STUDIO_EXPORT=1` activa `output: 'export'`, `trailingSlash: true`, `images.unoptimized`, `distDir: '.next-export'`; el export queda en `apps/studio/out/`.
- El token de emparejamiento vive sólo en `sessionStorage` (`sdd-studio:pairing`) y se borra del fragmento de la URL con `history.replaceState` apenas se lee. Nunca en `localStorage`, query string ni logs.
- Protocolo: sólo tipos y codec de `@sdd-studio/protocol` (zod 4); toda respuesta de comando se valida con su schema antes de entrar al store.
- i18n es/en desde el arranque; idioma por defecto según `navigator.language` (`en*` → en, resto → es), override en `localStorage` `sdd-studio:lang`.
- Paleta y tipografías iguales al sitio de docs (`apps/documentation/src/index.css`): ink 950–700, accent 300–500, amberish, roseish; Space Grotesk / JetBrains Mono.
- Puerto del puente en e2e: `4399`; token e2e `e2e-token-0123456789abcdef`.
- Origen de producción: `https://studio.sdd.estebanburgos.com.ar`; ruta del workspace: `/w/` (con `#bridge=<port>&token=<token>`).
- Código e identificadores en inglés; textos de UI vía diccionarios es/en.
- Política de modelo/esfuerzo: cada task indica su tier.

### Desvíos respecto de la spec (decididos al planificar)

- **DMs**: el protocolo suma canales `dm:<agentId>` (la spec pedía DMs pero el `ChannelId` de Plan 1 no los tenía).
- **`--local-ui` siempre disponible** (no sólo como fallback de Safari): el puente sirve el export estático en `http://127.0.0.1:<port>/w/`. Sustituye el spike de Safari: si el navegador bloquea HTTPS→loopback, el fallback ya existe.
- **`--token`** en el puente (para e2e y scripts).
- **Comandos con barra**: `/gate [spec] [cycle]`, `/validate` (scripts); `/open-cycle`, `/review`, `/hotfix`, `/check`, `/resume`, `/steward` (prompts del kit: `start-sdd-cycle`, `review-cycle`, `hotfix-bypass-gate`, `check-spec-before-implement`, `hermes-resume`, `sdd-steward`). No hay `/new-spec`: el kit no tiene ese prompt; una spec nueva se pide conversando en `#general`.
- **Workspaces recientes en localStorage**: no se implementan (el token rota en cada arranque, una lista sin token no reconecta).
- **sdd-bot**: los eventos no traen timestamp; el canal los muestra en un feed propio (más recientes primero), no intercalados con los hilos.
- **Panel de actividad**: muestra agentes, estado y herramienta actual por hilo (sin duración/tokens/costo por agente; el uso queda en el pie del timeline).
- **Alcance de escritura de los DMs**: todos los canales `dm:*` comparten un único alcance de escritura (un solo hilo escritor a la vez entre todos los DMs); los canales de spec siguen teniendo el suyo.

## Review Focus

1. **Reconexión con un hilo abierto** → al volver, se piden sólo los eventos posteriores al último `seq` y no se duplican mensajes (test de store: `seq` repetido se ignora; test de bootstrap).
2. **Aprobación pendiente al abrir la app en otra pestaña** → la tarjeta aparece pendiente (reconstruida desde `thread.history`) y al responderla en una pestaña la otra la ve resuelta (test de reducer con `approval.resolved`).
3. **Token en la URL** → tras leerlo, la barra de direcciones ya no lo muestra y recargar sigue conectando (test de `resolvePairing`).
4. **Respuesta inválida del puente** (versión vieja del protocolo, datos corruptos) → no rompe el render: se descarta y se muestra el error de conexión correspondiente (tests de `BridgeClient` con mensaje inválido y `protocol-mismatch`).
5. **Textos largos** (diff de 4000 chars, `input` de 16 KB, salida de `/validate`) → la UI los muestra en bloques con scroll, no rompe el layout (test de `ApprovalCard` con input truncado).

---

### Task 1: Protocolo y puente — canales DM, `--token` y `--local-ui`

**Tier:** implementer `sonnet`; review `opus` (servidor de archivos estáticos en el puerto del puente).

**Files:**
- Modify: `libs/studio-protocol/src/domain.ts` (+ `domain.spec.ts`)
- Modify: `apps/studio-bridge/src/sessions/session-manager.ts` (+ spec)
- Create: `apps/studio-bridge/src/server/static.ts` (+ `static.spec.ts`)
- Modify: `apps/studio-bridge/src/server/ws-server.ts`, `src/main.ts`, `src/cli.ts`, `src/cli-options.ts` (+ specs), `build.js`, `README.md`

**Interfaces:**
- Produces (protocol): `ChannelId` acepta `dm:<agentId>` (`/^dm:[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`); `channelForDm(agent: string): string`; `dmAgentOfChannel(channelId: string): string | null`.
- Produces (bridge): `serveStatic(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void>`; `startBridgeServer({ ..., localUiDir?: string })`; `startBridge({ ..., localUiDir?: string })` devuelve `url` = `http://127.0.0.1:<port>/w/#bridge=<port>&token=<token>` cuando hay `localUiDir`; CLI `--token <t>` (≥16 chars `[A-Za-z0-9_-]`) y `--local-ui`; `parseToken(raw): string`.

- [ ] **Step 1: Tests de protocolo (fallan)**

En `libs/studio-protocol/src/domain.spec.ts`, dentro de `describe('ChannelId')` agregar:
```ts
  it('accepts dm channels and maps them to agents', () => {
    expect(ChannelId.safeParse('dm:sdd-planner').success).toBe(true);
    expect(ChannelId.safeParse('dm:').success).toBe(false);
    expect(ChannelId.safeParse('dm:../x').success).toBe(false);
    expect(channelForDm('sdd-planner')).toBe('dm:sdd-planner');
    expect(dmAgentOfChannel('dm:sdd-planner')).toBe('sdd-planner');
    expect(dmAgentOfChannel('general')).toBeNull();
  });
```
(Agregar `channelForDm, dmAgentOfChannel` al import.)

Run: `pnpm --filter @sdd-studio/protocol test` → FAIL.

- [ ] **Step 2: Implementación de protocolo**

`libs/studio-protocol/src/domain.ts`: reemplazar la definición de `ChannelId` y agregar helpers:
```ts
export const ChannelId = z
  .string()
  .regex(/^(general|fixes|spec:[A-Za-z0-9][A-Za-z0-9._-]{0,127}|dm:[A-Za-z0-9][A-Za-z0-9_-]{0,63})$/);
export type ChannelId = z.infer<typeof ChannelId>;
```
```ts
export const channelForDm = (agent: string): string => `dm:${agent}`;
export const dmAgentOfChannel = (channelId: string): string | null =>
  channelId.startsWith('dm:') ? channelId.slice(3) : null;
```
Run: `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck` → PASS.

- [ ] **Step 3: DM en SessionManager (test que falla)**

En `apps/studio-bridge/src/sessions/session-manager.spec.ts` agregar:
```ts
  it('runs DMs with the channel agent and rejects a mismatched agent', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'dm:sdd-planner', options: { ...opts, agent: 'sdd-planner' }, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(t.agent).toBe('sdd-planner');
    await expect(
      m.createThread({ channelId: 'dm:sdd-planner', options: opts, text: 'hola' }),
    ).rejects.toMatchObject({ code: 'bad-request' });
  });
```
Implementación, al principio de `createThread`:
```ts
    const dmAgent = dmAgentOfChannel(args.channelId);
    if (dmAgent !== null && args.options.agent !== dmAgent) {
      throw new SessionError('bad-request', `un DM con ${dmAgent} sólo admite ese agente`);
    }
```
(importar `dmAgentOfChannel` de `@sdd-studio/protocol`). Run: `pnpm --filter @e-burgos/sdd-studio exec vitest run session-manager` → PASS.

- [ ] **Step 4: Servidor estático (tests que fallan)**

`apps/studio-bridge/src/server/static.spec.ts`:
```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serveStatic } from './static';

let dir: string;
let server: Server;
let base: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'studio-web-'));
  await mkdir(path.join(dir, 'w'), { recursive: true });
  await mkdir(path.join(dir, '_next', 'static'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), '<h1>home</h1>');
  await writeFile(path.join(dir, 'w', 'index.html'), '<h1>workspace</h1>');
  await writeFile(path.join(dir, '_next', 'static', 'app.js'), 'console.log(1)');
  await writeFile(path.join(tmpdir(), 'outside-secret.txt'), 'secret');
  server = createServer((req, res) => void serveStatic(dir, req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('serves index.html for / and directories', async () => {
    expect(await (await fetch(`${base}/`)).text()).toBe('<h1>home</h1>');
    const w = await fetch(`${base}/w/`);
    expect(w.status).toBe(200);
    expect(w.headers.get('content-type')).toContain('text/html');
    expect(w.headers.get('cache-control')).toBe('no-store');
    expect(w.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await w.text()).toBe('<h1>workspace</h1>');
  });
  it('redirects /w to /w/ keeping nothing else', async () => {
    const r = await fetch(`${base}/w`, { redirect: 'manual' });
    expect(r.status).toBe(308);
    expect(r.headers.get('location')).toBe('/w/');
  });
  it('serves assets with a javascript content type', async () => {
    const r = await fetch(`${base}/_next/static/app.js`);
    expect(r.headers.get('content-type')).toContain('javascript');
  });
  it.each(['/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/w/%2e%2e/%2e%2e/outside-secret.txt', '/nope.html'])(
    '404 for %s',
    async (p) => {
      expect((await fetch(`${base}${p}`)).status).toBe(404);
    },
  );
  it('rejects non-GET methods', async () => {
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405);
  });
});
```

- [ ] **Step 5: Implementación del servidor estático**

`apps/studio-bridge/src/server/static.ts`:
```ts
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res: ServerResponse, status: number, body = ''): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

/** Sirve el export estático de la web (sólo GET/HEAD, confinado a `dir`). */
export async function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    return send(res, 400);
  }
  if (pathname.includes('\0') || pathname.split('/').some((s) => s === '..')) return send(res, 404);
  const root = await realpath(dir);
  let target = path.join(root, ...pathname.split('/').filter(Boolean));
  let info = await stat(target).catch(() => null);
  if (info?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(308, { location: `${pathname}/` });
      return void res.end();
    }
    target = path.join(target, 'index.html');
    info = await stat(target).catch(() => null);
  }
  if (!info?.isFile()) return send(res, 404);
  const real = await realpath(target).catch(() => null);
  if (!real || (real !== root && !real.startsWith(root + path.sep))) return send(res, 404);
  const type = TYPES[path.extname(real).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'content-length': info.size,
    'x-content-type-options': 'nosniff',
    'cache-control': type.startsWith('text/html') ? 'no-store' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(real).pipe(res);
}
```
Run: `pnpm --filter @e-burgos/sdd-studio exec vitest run static` → PASS.

- [ ] **Step 6: Cablear `localUiDir` en el servidor WS y en startBridge (tests que fallan)**

En `ws-server.ts`, `startBridgeServer` acepta `localUiDir?: string`; el handler HTTP pasa a:
```ts
  const http = createServer((req, res) => {
    if (o.localUiDir) return void serveStatic(o.localUiDir, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    res.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SDD Studio bridge: conectate por WebSocket.');
  });
```
En `main.ts`, `startBridge` acepta `localUiDir?: string`, lo pasa al servidor (verificando antes con `existsSync(path.join(localUiDir, 'w', 'index.html'))`, si no `BridgeStartError('Este build del puente no incluye la web local (falta <dir>/w/index.html).')`) y arma la URL:
```ts
  const url = o.localUiDir
    ? `http://127.0.0.1:${server.port}/w/#bridge=${server.port}&token=${token}`
    : `${o.webUrl.replace(/\/+$/, '')}/w#bridge=${server.port}&token=${token}`;
```
Test en `main.spec.ts`:
```ts
  it('serves the local UI and returns a loopback URL when localUiDir is set', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const web = await mkdtemp(path.join(tmpdir(), 'web-'));
    cleanups.push(() => rm(web, { recursive: true, force: true }));
    await mkdir(path.join(web, 'w'), { recursive: true });
    await writeFile(path.join(web, 'w', 'index.html'), '<h1>ws</h1>');
    const bridge = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x', localUiDir: web });
    cleanups.push(bridge.close);
    expect(bridge.url).toBe(`http://127.0.0.1:${bridge.port}/w/#bridge=${bridge.port}&token=${bridge.token}`);
    expect(await (await fetch(`http://127.0.0.1:${bridge.port}/w/`)).text()).toBe('<h1>ws</h1>');
  });
  it('refuses a localUiDir without w/index.html', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const web = await mkdtemp(path.join(tmpdir(), 'web-'));
    cleanups.push(() => rm(web, { recursive: true, force: true }));
    await expect(
      startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x', localUiDir: web }),
    ).rejects.toBeInstanceOf(BridgeStartError);
  });
```
(agregar a los imports `mkdir`, `writeFile` de `node:fs/promises`).

- [ ] **Step 7: CLI `--token` y `--local-ui` (tests que fallan)**

En `cli-options.spec.ts`:
```ts
describe('parseToken', () => {
  it('accepts 16+ url-safe chars', () => {
    expect(parseToken('e2e-token-0123456789abcdef')).toBe('e2e-token-0123456789abcdef');
  });
  it.each(['short', 'has space in it 1234', 'ñññññññññññññññññ', ''])('rejects %j', (raw) => {
    expect(() => parseToken(raw)).toThrow(BridgeStartError);
  });
});
```
`cli-options.ts`:
```ts
export function parseToken(raw: string): string {
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(raw)) {
    throw new BridgeStartError('Token inválido: usá al menos 16 caracteres [A-Za-z0-9_-].');
  }
  return raw;
}
```
`cli.ts`: nuevos args
```ts
    token: { type: 'string', description: 'Token de emparejamiento fijo (tests/scripts; por defecto se genera uno nuevo)' },
    'local-ui': { type: 'boolean', description: 'Servir la web desde el puente (http://127.0.0.1:<puerto>/w/)', default: false },
```
y en `run`: `token: args.token !== undefined ? parseToken(args.token) : undefined`, `localUiDir: args['local-ui'] ? fileURLToPath(new URL('./web', import.meta.url)) : undefined` (en el bundle `dist/cli.js` resuelve `dist/web`).

- [ ] **Step 8: Build del puente copia la web**

`apps/studio-bridge/build.js` — después de `esbuild.build(...)`:
```js
import { cp, stat } from 'node:fs/promises';
// ...
const webOut = new URL('../studio/out/', import.meta.url);
if (await stat(webOut).then((s) => s.isDirectory()).catch(() => false)) {
  await cp(webOut, new URL('./dist/web/', import.meta.url), { recursive: true });
  console.log('sdd-studio: web local incluida en dist/web');
} else {
  console.warn('sdd-studio: no hay apps/studio/out (corré `pnpm --filter sdd-studio-web build:local`); --local-ui no va a estar disponible');
}
```
README del puente: documentar `--local-ui` ("si tu navegador bloquea la conexión de la web hosteada al puerto local —p. ej. Safari— o para usar Studio sin internet") y `--token`.

- [ ] **Step 9: Verificación y commit**

Run: `pnpm --filter @sdd-studio/protocol test && pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
Expected: PASS.
```bash
git add libs/studio-protocol apps/studio-bridge
git commit -m "feat(studio-bridge): dm channels, --token and --local-ui static web"
```

---

### Task 2: Scaffold de `apps/studio` (Next.js 16 + Tailwind 4 + vitest)

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/{package.json,next.config.ts,tsconfig.json,postcss.config.mjs,vitest.config.mts,vitest.setup.ts,.gitignore,next-env.d.ts}`
- Create: `apps/studio/src/app/{layout.tsx,globals.css,page.tsx}`, `apps/studio/src/app/w/page.tsx`
- Create: `apps/studio/src/lib/agents.ts` (+ `agents.spec.ts`)
- Modify: `package.json` (raíz)

**Interfaces:**
- Produces: paquete `sdd-studio-web` (privado) con scripts `dev`, `build`, `build:local`, `test`, `typecheck`, `e2e`, `build:worker`, `preview`, `deploy`; alias `@/*` → `src/*`; `agentMeta(id): { id, name, short, color }`.

- [ ] **Step 1: Paquete**

`apps/studio/package.json`:
```json
{
  "name": "sdd-studio-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "build:local": "cross-env STUDIO_EXPORT=1 next build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test",
    "build:worker": "opennextjs-cloudflare build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  },
  "dependencies": {
    "@fontsource-variable/jetbrains-mono": "^5.2.8",
    "@fontsource-variable/space-grotesk": "^5.2.8",
    "@phosphor-icons/react": "^2.1.10",
    "@sdd-studio/protocol": "workspace:*",
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "zod": "^4.0.0",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "^1.20.9",
    "@playwright/test": "^1.63.0",
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^20.19.9",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.1.2",
    "cross-env": "^10.0.0",
    "jsdom": "^30.1.2",
    "tailwindcss": "^4.3.3",
    "typescript": "~5.9.2",
    "vitest": "~4.1.0",
    "wrangler": "^4.148.0"
  }
}
```
Run: `pnpm install`.

- [ ] **Step 2: Config**

`apps/studio/next.config.ts`:
```ts
import path from 'node:path';
import type { NextConfig } from 'next';

const isExport = process.env.STUDIO_EXPORT === '1';
const monorepoRoot = path.resolve(process.cwd(), '../..');

const config: NextConfig = {
  transpilePackages: ['@sdd-studio/protocol'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  ...(isExport
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true }, distDir: '.next-export' }
    : {}),
};

export default config;
```
`apps/studio/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts", "e2e/**/*.ts", "*.ts", "*.mts"],
  "exclude": ["node_modules", "out", ".next-export", ".open-next"]
}
```
`apps/studio/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```
`apps/studio/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```
`apps/studio/vitest.config.mts`:
```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    testTimeout: 30000,
  },
});
```
`apps/studio/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```
`apps/studio/.gitignore`:
```
.next/
.next-export/
.open-next/
out/
.e2e-workspace/
test-results/
playwright-report/
.wrangler/
*.tsbuildinfo
```

- [ ] **Step 3: Estilos base, layout y páginas mínimas**

`apps/studio/src/app/globals.css`:
```css
@import 'tailwindcss';

@theme {
  --font-display: 'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', monospace;
  --color-ink-950: #0e0e11;
  --color-ink-900: #131318;
  --color-ink-850: #17171d;
  --color-ink-800: #1d1d25;
  --color-ink-700: #2a2a35;
  --color-ink-500: #4b4b5c;
  --color-ink-300: #a1a1b5;
  --color-ink-100: #e4e4ee;
  --color-accent-300: #6ee7b7;
  --color-accent-400: #34d399;
  --color-accent-500: #10b981;
  --color-accent-dim: #34d39922;
  --color-amberish: #fbbf24;
  --color-roseish: #fb7185;
}

html,
body {
  height: 100%;
  background-color: var(--color-ink-950);
  color: var(--color-ink-100);
  font-family: var(--font-display);
}

::selection {
  background: var(--color-accent-dim);
  color: var(--color-accent-300);
}

code,
pre,
kbd {
  font-family: var(--font-mono);
}
```
`apps/studio/src/app/layout.tsx`:
```tsx
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SDD Studio',
  description: 'Centro de operación de repos con el kit SDD',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```
`apps/studio/src/app/page.tsx` (se reemplaza en Task 6):
```tsx
export default function Home() {
  return <main className="p-8">SDD Studio</main>;
}
```
`apps/studio/src/app/w/page.tsx` (se reemplaza en Task 6):
```tsx
export default function WorkspacePage() {
  return <main className="p-8">workspace</main>;
}
```

- [ ] **Step 4: Metadatos de agentes (test que falla)**

`apps/studio/src/lib/agents.spec.ts`:
```ts
import { agentMeta } from './agents';

describe('agentMeta', () => {
  it('knows the kit agents', () => {
    expect(agentMeta('sdd-implementor-back')).toEqual({ id: 'sdd-implementor-back', name: 'Impl-back', short: 'IB', color: '#fbbf24' });
  });
  it('derives a label for unknown agents', () => {
    expect(agentMeta('Explore')).toEqual({ id: 'Explore', name: 'Explore', short: 'EX', color: '#a1a1aa' });
    expect(agentMeta('sdd-custom')).toMatchObject({ name: 'custom', short: 'CU' });
  });
});
```
`apps/studio/src/lib/agents.ts`:
```ts
export interface AgentMeta {
  id: string;
  name: string;
  short: string;
  color: string;
}

const KNOWN: Record<string, Omit<AgentMeta, 'id'>> = {
  'sdd-orchestrator': { name: 'Orchestrator', short: 'OR', color: '#34d399' },
  'sdd-functional': { name: 'Functional', short: 'FN', color: '#60a5fa' },
  'sdd-planner': { name: 'Planner', short: 'PL', color: '#a78bfa' },
  'sdd-architect': { name: 'Architect', short: 'AR', color: '#f472b6' },
  'sdd-implementor-back': { name: 'Impl-back', short: 'IB', color: '#fbbf24' },
  'sdd-implementor-front': { name: 'Impl-front', short: 'IF', color: '#fb923c' },
  'sdd-reviewer': { name: 'Reviewer', short: 'RV', color: '#22d3ee' },
  'sdd-steward': { name: 'Steward', short: 'ST', color: '#94a3b8' },
};

export function agentMeta(id: string): AgentMeta {
  const known = KNOWN[id];
  if (known) return { id, ...known };
  const name = id.replace(/^sdd-/, '');
  return { id, name, short: name.slice(0, 2).toUpperCase(), color: '#a1a1aa' };
}
```

- [ ] **Step 5: Scripts raíz**

`package.json` raíz:
```json
"build": "pnpm --filter sdd-studio-web build:local && pnpm --filter @e-burgos/sdd-harness --filter @e-burgos/sdd-studio build",
"test": "pnpm --filter @e-burgos/sdd-harness --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio --filter sdd-studio-web test",
"typecheck": "pnpm --filter @e-burgos/sdd-harness --filter @sdd-studio/protocol --filter @e-burgos/sdd-studio --filter sdd-studio-web typecheck",
"dev:studio": "pnpm --filter sdd-studio-web dev",
```

- [ ] **Step 6: Verificación y commit**

Run: `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web build && pnpm --filter sdd-studio-web build:local && test -f apps/studio/out/w/index.html && echo EXPORT_OK`
Expected: PASS y `EXPORT_OK`.
```bash
git add apps/studio package.json pnpm-lock.yaml
git commit -m "feat(studio): scaffold Next.js 16 app with Tailwind 4 and vitest"
```

---

### Task 3: Emparejamiento y `BridgeClient`

**Tier:** implementer `sonnet`; review `opus` (token y reconexión).

**Files:**
- Create: `apps/studio/src/lib/bridge/pairing.ts` (+ `pairing.spec.ts`)
- Create: `apps/studio/src/lib/bridge/client.ts` (+ `client.spec.ts`, `client.integration.spec.ts`)

**Interfaces:**
- Produces:
  ```ts
  interface PairingInfo { port: number; token: string }
  parsePairing(hash: string): PairingInfo | null
  resolvePairing(win: PairingWindow): PairingInfo | null   // PairingWindow = { location: { hash; pathname; search }, history: { replaceState }, sessionStorage }
  bridgeUrl(p: PairingInfo): string                          // ws://127.0.0.1:<port>
  PAIRING_KEY = 'sdd-studio:pairing'
  type CommandInput = DistributiveOmit<ClientCommand, 'kind' | 'id'>
  type ConnectionState =
    | { status: 'idle' } | { status: 'connecting'; attempt: number } | { status: 'open'; welcome: Welcome }
    | { status: 'reconnecting'; attempt: number; delayMs: number }
    | { status: 'failed'; reason: 'bad-token' | 'protocol-mismatch' | 'unreachable'; message: string }
  class BridgeError extends Error { code: string }
  class BridgeClient {
    constructor(o: { url: string; token: string; clientVersion: string; WebSocketImpl?: typeof WebSocket; maxDelayMs?: number; requestTimeoutMs?: number; unreachableAfter?: number })
    state: ConnectionState
    connect(): void; close(): void
    request(cmd: CommandInput): Promise<unknown>
    onEvent(fn: (e: ServerEvent) => void): () => void
    onState(fn: (s: ConnectionState) => void): () => void
  }
  ```

- [ ] **Step 1: Tests de emparejamiento (fallan)**

`apps/studio/src/lib/bridge/pairing.spec.ts`:
```ts
import { PAIRING_KEY, bridgeUrl, parsePairing, resolvePairing } from './pairing';

function fakeWindow(hash: string, stored: string | null = null) {
  const storage = new Map<string, string>(stored ? [[PAIRING_KEY, stored]] : []);
  const replaced: string[] = [];
  return {
    replaced,
    storage,
    win: {
      location: { hash, pathname: '/w/', search: '' },
      history: { replaceState: (_d: unknown, _t: string, url: string) => void replaced.push(url) },
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
    },
  };
}

describe('parsePairing', () => {
  it('reads port and token from the fragment', () => {
    expect(parsePairing('#bridge=4320&token=abc_DEF-123')).toEqual({ port: 4320, token: 'abc_DEF-123' });
  });
  it.each(['', '#bridge=4320', '#token=x', '#bridge=0&token=x', '#bridge=99999&token=x', '#bridge=abc&token=x'])('rejects %j', (h) => {
    expect(parsePairing(h)).toBeNull();
  });
});

describe('resolvePairing', () => {
  it('stores the pairing in sessionStorage and strips the fragment', () => {
    const f = fakeWindow('#bridge=4320&token=tok');
    expect(resolvePairing(f.win)).toEqual({ port: 4320, token: 'tok' });
    expect(JSON.parse(f.storage.get(PAIRING_KEY)!)).toEqual({ port: 4320, token: 'tok' });
    expect(f.replaced).toEqual(['/w/']);
  });
  it('falls back to sessionStorage after a reload', () => {
    const f = fakeWindow('', JSON.stringify({ port: 4321, token: 't2' }));
    expect(resolvePairing(f.win)).toEqual({ port: 4321, token: 't2' });
    expect(f.replaced).toEqual([]);
  });
  it('ignores corrupt storage', () => {
    expect(resolvePairing(fakeWindow('', '{bad').win)).toBeNull();
  });
  it('builds a loopback ws url', () => {
    expect(bridgeUrl({ port: 4320, token: 'x' })).toBe('ws://127.0.0.1:4320');
  });
});
```

- [ ] **Step 2: Implementación de emparejamiento**

`apps/studio/src/lib/bridge/pairing.ts`:
```ts
export interface PairingInfo {
  port: number;
  token: string;
}

export interface PairingWindow {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

export const PAIRING_KEY = 'sdd-studio:pairing';

function valid(port: unknown, token: unknown): token is string {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 && typeof token === 'string' && token.length > 0;
}

export function parsePairing(hash: string): PairingInfo | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const port = Number(params.get('bridge'));
  const token = params.get('token');
  return valid(port, token) ? { port, token } : null;
}

/** Lee el emparejamiento del fragmento (y lo saca de la URL) o de sessionStorage. */
export function resolvePairing(win: PairingWindow): PairingInfo | null {
  const fromHash = parsePairing(win.location.hash);
  if (fromHash) {
    try {
      win.sessionStorage.setItem(PAIRING_KEY, JSON.stringify(fromHash));
    } catch {
      // Sin sessionStorage (modo privado estricto): sigue funcionando hasta recargar.
    }
    win.history.replaceState(null, '', win.location.pathname + win.location.search);
    return fromHash;
  }
  try {
    const raw = win.sessionStorage.getItem(PAIRING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { port?: unknown; token?: unknown };
    return valid(parsed.port, parsed.token) ? { port: parsed.port as number, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export const bridgeUrl = (p: PairingInfo): string => `ws://127.0.0.1:${p.port}`;
```

- [ ] **Step 3: Tests unitarios del cliente con un WebSocket falso (fallan)**

`apps/studio/src/lib/bridge/client.spec.ts`:
```ts
import { PROTOCOL_VERSION } from '@sdd-studio/protocol';
import { BridgeClient, type ConnectionState } from './client';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  // helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const welcome = {
  kind: 'welcome', protocolVersion: PROTOCOL_VERSION, bridgeVersion: '0.1.0',
  workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'local-claude-login',
};

function make(extra: Partial<ConstructorParameters<typeof BridgeClient>[0]> = {}) {
  FakeSocket.instances = [];
  const states: ConnectionState[] = [];
  const client = new BridgeClient({
    url: 'ws://127.0.0.1:1', token: 'tok', clientVersion: 'test',
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket, ...extra,
  });
  client.onState((s) => states.push(s));
  return { client, states, socket: () => FakeSocket.instances.at(-1)! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BridgeClient', () => {
  it('sends hello on open and becomes open on welcome', () => {
    const { client, states, socket } = make();
    client.connect();
    socket().open();
    expect(JSON.parse(socket().sent[0]!)).toEqual({ kind: 'hello', token: 'tok', protocolVersion: PROTOCOL_VERSION, clientVersion: 'test' });
    socket().receive(welcome);
    expect(states.map((s) => s.status)).toEqual(['connecting', 'open']);
  });

  it('correlates command results by id', async () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    const sent = JSON.parse(socket().sent[1]!);
    expect(sent).toMatchObject({ kind: 'command', cmd: 'thread.list' });
    socket().receive({ kind: 'result', id: sent.id, ok: true, data: [] });
    await expect(p).resolves.toEqual([]);
  });

  it('rejects failed results with a BridgeError carrying the code', async () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'workspace.readFile', path: 'sdd/x' });
    const id = JSON.parse(socket().sent[1]!).id;
    socket().receive({ kind: 'result', id, ok: false, error: { code: 'bad-path', message: 'no' } });
    await expect(p).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('rejects requests when not connected and on timeout', async () => {
    const { client, socket } = make({ requestTimeoutMs: 1000 });
    await expect(client.request({ cmd: 'thread.list' })).rejects.toMatchObject({ code: 'not-connected' });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
  });

  it('forwards valid push events and drops invalid messages', () => {
    const { client, socket } = make();
    const events: unknown[] = [];
    client.onEvent((e) => events.push(e));
    client.connect();
    socket().open();
    socket().receive(welcome);
    socket().receive({ kind: 'command.exit', runId: 'r', exitCode: 0 });
    socket().receive({ kind: 'nope' });
    socket().onmessage?.({ data: '{broken' });
    expect(events).toEqual([{ kind: 'command.exit', runId: 'r', exitCode: 0 }]);
  });

  it('reconnects with exponential backoff after a drop and rejects in-flight requests', async () => {
    const { client, states, socket } = make({ maxDelayMs: 4000 });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    socket().drop(1006);
    await expect(p).rejects.toMatchObject({ code: 'disconnected' });
    expect(states.at(-1)).toEqual({ status: 'reconnecting', attempt: 1, delayMs: 500 });
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    socket().drop(1006);
    expect(states.at(-1)).toEqual({ status: 'reconnecting', attempt: 2, delayMs: 1000 });
  });

  it('stops on bad token and on protocol mismatch', () => {
    const a = make();
    a.client.connect();
    a.socket().open();
    a.socket().receive({ kind: 'handshake.error', code: 'bad-token', message: 'token inválido' });
    a.socket().drop(4001);
    expect(a.states.at(-1)).toEqual({ status: 'failed', reason: 'bad-token', message: 'token inválido' });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    const b = make();
    b.client.connect();
    b.socket().open();
    b.socket().drop(4002);
    expect(b.states.at(-1)).toMatchObject({ status: 'failed', reason: 'protocol-mismatch' });
  });

  it('gives up as unreachable when it never opened after N attempts', () => {
    const { client, states, socket } = make({ unreachableAfter: 2 });
    client.connect();
    socket().drop(1006);
    vi.advanceTimersByTime(500);
    socket().drop(1006);
    expect(states.at(-1)).toMatchObject({ status: 'failed', reason: 'unreachable' });
  });

  it('close() stops reconnecting', () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    client.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(client.state).toEqual({ status: 'idle' });
  });
});
```

- [ ] **Step 4: Implementación del cliente**

`apps/studio/src/lib/bridge/client.ts`:
```ts
import {
  decodeServerMessage,
  PROTOCOL_VERSION,
  type ClientCommand,
  type ServerEvent,
  type Welcome,
} from '@sdd-studio/protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CommandInput = DistributiveOmit<ClientCommand, 'kind' | 'id'>;

export type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting'; attempt: number }
  | { status: 'open'; welcome: Welcome }
  | { status: 'reconnecting'; attempt: number; delayMs: number }
  | { status: 'failed'; reason: 'bad-token' | 'protocol-mismatch' | 'unreachable'; message: string };

export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Pending {
  resolve: (data: unknown) => void;
  reject: (error: BridgeError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface BridgeClientOptions {
  url: string;
  token: string;
  clientVersion: string;
  WebSocketImpl?: typeof WebSocket;
  maxDelayMs?: number;
  requestTimeoutMs?: number;
  unreachableAfter?: number;
}

export class BridgeClient {
  state: ConnectionState = { status: 'idle' };
  private ws: WebSocket | null = null;
  private seq = 0;
  private failures = 0;
  private everOpened = false;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHandshakeMessage: string | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly eventListeners = new Set<(e: ServerEvent) => void>();
  private readonly stateListeners = new Set<(s: ConnectionState) => void>();

  constructor(private readonly o: BridgeClientOptions) {}

  connect(): void {
    this.stopped = false;
    this.open();
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000);
    this.rejectAll('disconnected', 'conexión cerrada');
    this.setState({ status: 'idle' });
  }

  onEvent(fn: (e: ServerEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  onState(fn: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  request(cmd: CommandInput): Promise<unknown> {
    const ws = this.ws;
    if (this.state.status !== 'open' || !ws) {
      return Promise.reject(new BridgeError('not-connected', 'sin conexión con el puente'));
    }
    const id = `c${++this.seq}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError('timeout', `el puente no respondió a ${cmd.cmd}`));
      }, this.o.requestTimeoutMs ?? 15_000);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ kind: 'command', id, ...cmd }));
    });
  }

  private open(): void {
    this.lastHandshakeMessage = null;
    if (!this.everOpened) this.setState({ status: 'connecting', attempt: this.failures + 1 });
    const Impl = this.o.WebSocketImpl ?? WebSocket;
    const ws = new Impl(this.o.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({ kind: 'hello', token: this.o.token, protocolVersion: PROTOCOL_VERSION, clientVersion: this.o.clientVersion }),
      );
    };
    ws.onmessage = (event) => this.handle(String(event.data));
    ws.onclose = (event) => {
      if (this.ws === ws) this.onClose(event.code);
    };
    ws.onerror = () => undefined;
  }

  private handle(raw: string): void {
    const decoded = decodeServerMessage(raw);
    if (!decoded.ok) return;
    const message = decoded.value;
    switch (message.kind) {
      case 'welcome':
        this.everOpened = true;
        this.failures = 0;
        this.setState({ status: 'open', welcome: message });
        return;
      case 'handshake.error':
        this.lastHandshakeMessage = message.message;
        return;
      case 'result': {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok) pending.resolve(message.data);
        else pending.reject(new BridgeError(message.error.code, message.error.message));
        return;
      }
      default:
        for (const fn of this.eventListeners) fn(message);
    }
  }

  private onClose(code: number): void {
    this.ws = null;
    this.rejectAll('disconnected', 'se perdió la conexión con el puente');
    if (this.stopped) return;
    if (code === 4001) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'bad-token', message: this.lastHandshakeMessage ?? 'token inválido' });
    }
    if (code === 4002) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'protocol-mismatch', message: this.lastHandshakeMessage ?? 'versión de protocolo incompatible' });
    }
    this.failures += 1;
    if (!this.everOpened && this.failures >= (this.o.unreachableAfter ?? 3)) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'unreachable', message: 'no se pudo conectar al puente' });
    }
    const delayMs = Math.min(this.o.maxDelayMs ?? 30_000, 500 * 2 ** (this.failures - 1));
    this.setState({ status: 'reconnecting', attempt: this.failures, delayMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.open();
    }, delayMs);
  }

  private rejectAll(code: string, message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new BridgeError(code, message));
      this.pending.delete(id);
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const fn of this.stateListeners) fn(state);
  }
}
```

- [ ] **Step 5: Test de integración contra el puente real (falla hasta implementar; corre en entorno node)**

`apps/studio/src/lib/bridge/client.integration.spec.ts`:
```ts
// @vitest-environment node
import { defaultThreadOptions, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { DEFAULT_ORIGINS, startBridge } from '../../../../studio-bridge/src/main';
import { copyFixture, waitFor } from '../../../../studio-bridge/src/test-utils/fixture';
import { BridgeClient, type ConnectionState } from './client';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function bridge() {
  const { root, cleanup } = await copyFixture();
  cleanups.push(cleanup);
  const b = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x' });
  cleanups.push(b.close);
  return b;
}

describe('BridgeClient ↔ real bridge', () => {
  it('handshakes, fetches the snapshot and receives thread events', async () => {
    const b = await bridge();
    const client = new BridgeClient({ url: `ws://127.0.0.1:${b.port}`, token: b.token, clientVersion: 'it' });
    cleanups.push(async () => client.close());
    const events: string[] = [];
    client.onEvent((e) => e.kind === 'thread.event' && events.push(e.event.type));
    client.connect();
    await waitFor(() => client.state.status === 'open');
    const snapshot = WorkspaceSnapshot.parse(await client.request({ cmd: 'workspace.snapshot' }));
    expect(snapshot.project).toBe('studio fixture');
    await client.request({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' });
    await waitFor(() => events.includes('turn.end'));
  });

  it('fails with bad-token and does not retry', async () => {
    const b = await bridge();
    const states: ConnectionState[] = [];
    const client = new BridgeClient({ url: `ws://127.0.0.1:${b.port}`, token: 'wrong-token', clientVersion: 'it' });
    cleanups.push(async () => client.close());
    client.onState((s) => states.push(s));
    client.connect();
    await waitFor(() => client.state.status === 'failed');
    expect(client.state).toMatchObject({ status: 'failed', reason: 'bad-token' });
  });
});
```

- [ ] **Step 6: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run bridge` (3 corridas) y `pnpm --filter sdd-studio-web typecheck`.
Expected: PASS.
```bash
git add apps/studio/src/lib/bridge
git commit -m "feat(studio): pairing and reconnecting bridge client"
```

---

### Task 4: Estado de la app (reducers puros + store zustand)

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/src/lib/store/timeline.ts` (+ `timeline.spec.ts`)
- Create: `apps/studio/src/lib/store/state.ts` (+ `state.spec.ts`)
- Create: `apps/studio/src/lib/store/selectors.ts` (+ `selectors.spec.ts`)
- Create: `apps/studio/src/lib/store/store.ts`

**Interfaces:**
- Produces:
  ```ts
  // timeline.ts
  type TimelineItem =
    | { kind: 'user'; id: string; seq: number; text: string }
    | { kind: 'message'; id: string; seq: number; author: Author; text: string; done: boolean }
    | { kind: 'tool'; id: string; seq: number; author: Author; tool: string; summary: string; diff?: string; status: 'running' | 'ok' | 'error'; result?: string }
    | { kind: 'approval'; id: string; seq: number; author: Author; tool: string; summary: string; diff?: string; input?: string; inputTruncated?: boolean; gateWarning?: string; decision: 'pending' | 'allow' | 'deny'; reason?: string }
    | { kind: 'subagent'; id: string; seq: number; agentType: string; phase: 'start' | 'stop' }
    | { kind: 'usage'; id: string; seq: number; usage: Usage }
    | { kind: 'status'; id: string; seq: number; status: SessionStatus; error?: { code: string; message: string } }
  interface ThreadState { info: ThreadInfo | null; items: TimelineItem[]; lastSeq: number }
  emptyThread(): ThreadState
  applyThreadEvent(t: ThreadState, seq: number, e: ThreadEvent): ThreadState     // ignora seq <= lastSeq
  // state.ts
  interface CommandRun { runId: string; name: string; args: string[]; output: string; exitCode: number | null }
  interface StudioState { snapshot: WorkspaceSnapshot | null; threads: Record<string, ThreadState>; presence: Presence[]; bot: Record<string, BotEvent[]>; runs: Record<string, CommandRun> }
  initialState(): StudioState
  applyServerEvent(s: StudioState, e: ServerEvent): StudioState
  setThreads(s, list: ThreadInfo[]): StudioState
  loadHistory(s, threadId: string, entries: { seq: number; event: ThreadEvent }[]): StudioState
  setBotHistory(s, channelId: string, events: BotEvent[]): StudioState
  startRun(s, run: { runId: string; name: string; args: string[] }): StudioState
  // selectors.ts
  interface ChannelEntry { id: string; kind: 'general' | 'fixes' | 'spec' | 'dm'; label: string; status?: string }
  channelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[]
  dmChannelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[]
  threadsInChannel(threads: Record<string, ThreadState>, channelId: string): ThreadInfo[]     // lastActivity desc
  pendingApprovals(t: ThreadState): Extract<TimelineItem, { kind: 'approval' }>[]
  cycleForChannel(snapshot, channelId): CycleSummary | null             // in-progress, si no el último
  type TimelineBlock = { kind: 'item'; item: TimelineItem } | { kind: 'tools'; id: string; author: Author; items: Extract<TimelineItem, { kind: 'tool' }>[] }
  groupTimeline(items: TimelineItem[]): TimelineBlock[]                // tools consecutivos del mismo autor
  // store.ts
  type StudioStore = StoreApi<StudioState & StudioActions>
  createStudioStore(): StudioStore
  interface StudioActions { receive(e: ServerEvent): void; setSnapshot(s: WorkspaceSnapshot): void; setThreads(l: ThreadInfo[]): void; loadHistory(id: string, entries: HistoryEntry[]): void; setPresence(p: Presence[]): void; setBotHistory(c: string, e: BotEvent[]): void; startRun(r: { runId: string; name: string; args: string[] }): void }
  ```

- [ ] **Step 1: Tests de timeline (fallan)**

`apps/studio/src/lib/store/timeline.spec.ts`:
```ts
import type { ThreadEvent } from '@sdd-studio/protocol';
import { applyThreadEvent, emptyThread, type ThreadState } from './timeline';

const main = { agent: 'sdd-orchestrator', parentToolUseId: null };
const planner = { agent: 'sdd-planner', parentToolUseId: 't0' };
const run = (events: [number, ThreadEvent][]): ThreadState => events.reduce((t, [seq, e]) => applyThreadEvent(t, seq, e), emptyThread());

describe('applyThreadEvent', () => {
  it('assembles streamed messages', () => {
    const t = run([
      [0, { type: 'user.message', text: 'hola' }],
      [1, { type: 'message.start', messageId: 'm1', author: main }],
      [2, { type: 'message.delta', messageId: 'm1', text: 'Hola ' }],
      [3, { type: 'message.delta', messageId: 'm1', text: 'mundo' }],
      [4, { type: 'message.end', messageId: 'm1' }],
    ]);
    expect(t.items).toEqual([
      { kind: 'user', id: 'u:0', seq: 0, text: 'hola' },
      { kind: 'message', id: 'm1', seq: 1, author: main, text: 'Hola mundo', done: true },
    ]);
    expect(t.lastSeq).toBe(4);
  });

  it('ignores replayed sequence numbers', () => {
    const once = run([[0, { type: 'user.message', text: 'hola' }]]);
    expect(applyThreadEvent(once, 0, { type: 'user.message', text: 'hola' })).toBe(once);
  });

  it('tracks tools, approvals, subagents, usage and error status', () => {
    const t = run([
      [0, { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' }],
      [1, { type: 'tool.start', toolUseId: 't1', author: planner, tool: 'Bash', summary: '$ ls' }],
      [2, { type: 'tool.end', toolUseId: 't1', isError: false, summary: 'a\nb' }],
      [3, { type: 'approval.requested', approvalId: 'p1', author: planner, tool: 'Write', summary: 'x.ts', diff: '+x', input: '{"file_path":"x.ts"}', gateWarning: 'w' }],
      [4, { type: 'approval.resolved', approvalId: 'p1', decision: 'deny', reason: 'no' }],
      [5, { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 1, tokensOut: 2, costUsd: 0.01 } }],
      [6, { type: 'session.status', status: 'error', error: { code: 'x', message: 'boom' } }],
      [7, { type: 'session.status', status: 'idle' }],
    ]);
    expect(t.items.map((i) => i.kind)).toEqual(['subagent', 'tool', 'approval', 'usage', 'status']);
    expect(t.items[1]).toMatchObject({ status: 'ok', result: 'a\nb' });
    expect(t.items[2]).toMatchObject({ decision: 'deny', reason: 'no', input: '{"file_path":"x.ts"}', gateWarning: 'w' });
    expect(t.items[4]).toMatchObject({ kind: 'status', status: 'error', error: { message: 'boom' } });
  });

  it('updates info.status on session.status when info is known', () => {
    const base: ThreadState = {
      ...emptyThread(),
      info: { id: 't', channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' }, status: 'idle', createdAt: 'a', lastActivity: 'a' },
    };
    expect(applyThreadEvent(base, 0, { type: 'session.status', status: 'running' }).info?.status).toBe('running');
  });
});
```

- [ ] **Step 2: Implementación de timeline**

`apps/studio/src/lib/store/timeline.ts`:
```ts
import type { Author, SessionStatus, ThreadEvent, ThreadInfo, Usage } from '@sdd-studio/protocol';

export type TimelineItem =
  | { kind: 'user'; id: string; seq: number; text: string }
  | { kind: 'message'; id: string; seq: number; author: Author; text: string; done: boolean }
  | {
      kind: 'tool';
      id: string;
      seq: number;
      author: Author;
      tool: string;
      summary: string;
      diff?: string;
      status: 'running' | 'ok' | 'error';
      result?: string;
    }
  | {
      kind: 'approval';
      id: string;
      seq: number;
      author: Author;
      tool: string;
      summary: string;
      diff?: string;
      input?: string;
      inputTruncated?: boolean;
      gateWarning?: string;
      decision: 'pending' | 'allow' | 'deny';
      reason?: string;
    }
  | { kind: 'subagent'; id: string; seq: number; agentType: string; phase: 'start' | 'stop' }
  | { kind: 'usage'; id: string; seq: number; usage: Usage }
  | { kind: 'status'; id: string; seq: number; status: SessionStatus; error?: { code: string; message: string } };

export interface ThreadState {
  info: ThreadInfo | null;
  items: TimelineItem[];
  lastSeq: number;
}

export const emptyThread = (): ThreadState => ({ info: null, items: [], lastSeq: -1 });

function update<K extends TimelineItem['kind']>(
  items: TimelineItem[],
  kind: K,
  id: string,
  fn: (item: Extract<TimelineItem, { kind: K }>) => TimelineItem,
): TimelineItem[] {
  const index = items.findIndex((i) => i.kind === kind && i.id === id);
  if (index < 0) return items;
  const next = items.slice();
  next[index] = fn(items[index] as Extract<TimelineItem, { kind: K }>);
  return next;
}

export function applyThreadEvent(thread: ThreadState, seq: number, event: ThreadEvent): ThreadState {
  if (seq <= thread.lastSeq) return thread;
  let items = thread.items;
  let info = thread.info;
  switch (event.type) {
    case 'user.message':
      items = [...items, { kind: 'user', id: `u:${seq}`, seq, text: event.text }];
      break;
    case 'message.start':
      items = [...items, { kind: 'message', id: event.messageId, seq, author: event.author, text: '', done: false }];
      break;
    case 'message.delta':
      items = update(items, 'message', event.messageId, (m) => ({ ...m, text: m.text + event.text }));
      break;
    case 'message.end':
      items = update(items, 'message', event.messageId, (m) => ({ ...m, done: true }));
      break;
    case 'tool.start':
      items = [
        ...items,
        { kind: 'tool', id: event.toolUseId, seq, author: event.author, tool: event.tool, summary: event.summary, diff: event.diff, status: 'running' },
      ];
      break;
    case 'tool.end':
      items = update(items, 'tool', event.toolUseId, (t) => ({ ...t, status: event.isError ? 'error' : 'ok', result: event.summary }));
      break;
    case 'subagent.start':
    case 'subagent.stop':
      items = [
        ...items,
        { kind: 'subagent', id: `${event.agentId}:${seq}`, seq, agentType: event.agentType, phase: event.type === 'subagent.start' ? 'start' : 'stop' },
      ];
      break;
    case 'approval.requested':
      items = [
        ...items,
        {
          kind: 'approval',
          id: event.approvalId,
          seq,
          author: event.author,
          tool: event.tool,
          summary: event.summary,
          diff: event.diff,
          input: event.input,
          inputTruncated: event.inputTruncated,
          gateWarning: event.gateWarning,
          decision: 'pending',
        },
      ];
      break;
    case 'approval.resolved':
      items = update(items, 'approval', event.approvalId, (a) => ({ ...a, decision: event.decision, reason: event.reason }));
      break;
    case 'turn.end':
      items = [...items, { kind: 'usage', id: `usage:${seq}`, seq, usage: event.usage }];
      break;
    case 'session.status':
      if (info) info = { ...info, status: event.status };
      if (event.status === 'error' || event.status === 'interrupted') {
        items = [...items, { kind: 'status', id: `status:${seq}`, seq, status: event.status, error: event.error }];
      }
      break;
  }
  return { info, items, lastSeq: seq };
}
```

- [ ] **Step 3: Tests de estado y selectores (fallan)**

`apps/studio/src/lib/store/state.spec.ts`:
```ts
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyServerEvent, initialState, loadHistory, setBotHistory, setThreads, startRun } from './state';

const info = (over: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle', createdAt: '2026-10-07T10:00:00Z', lastActivity: '2026-10-07T10:00:00Z', ...over,
});

describe('state reducers', () => {
  it('merges thread.updated into existing timelines', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 0, event: { type: 'user.message', text: 'hola' } });
    s = applyServerEvent(s, { kind: 'thread.updated', thread: info({ status: 'running' }) });
    expect(s.threads.t1?.info?.status).toBe('running');
    expect(s.threads.t1?.items).toHaveLength(1);
  });

  it('replays history without duplicating live events', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'user.message', text: 'b' } });
    s = loadHistory(s, 't1', [
      { seq: 0, event: { type: 'user.message', text: 'a' } },
      { seq: 1, event: { type: 'user.message', text: 'b' } },
    ]);
    expect(s.threads.t1?.items.map((i) => (i.kind === 'user' ? i.text : ''))).toEqual(['b']);
  });

  it('resolves an approval answered in another tab', () => {
    const author = { agent: 'sdd-planner', parentToolUseId: null };
    let s = loadHistory(initialState(), 't1', [
      { seq: 0, event: { type: 'approval.requested', approvalId: 'p', author, tool: 'Bash', summary: '$ ls' } },
    ]);
    s = applyServerEvent(s, { kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'approval.resolved', approvalId: 'p', decision: 'allow' } });
    expect(s.threads.t1?.items[0]).toMatchObject({ decision: 'allow' });
  });

  it('keeps workspace snapshot, presence, bot events and command runs', () => {
    const snapshot = { project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], gateMode: 'block', pricing: null, stale: [] } satisfies WorkspaceSnapshot;
    let s = applyServerEvent(initialState(), { kind: 'workspace.changed', areas: ['specs'], snapshot });
    s = applyServerEvent(s, { kind: 'presence.changed', presence: [{ agent: 'a', state: 'working', threadId: 't1', specId: null, tool: 'Read' }] });
    s = setBotHistory(s, 'fixes', [{ channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F1' } }]);
    s = applyServerEvent(s, { kind: 'bot.event', channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'F1' } });
    s = startRun(s, { runId: 'r', name: 'validate', args: [] });
    s = applyServerEvent(s, { kind: 'command.output', runId: 'r', stream: 'stdout', chunk: 'ok\n' });
    s = applyServerEvent(s, { kind: 'command.exit', runId: 'r', exitCode: 0 });
    expect(s.snapshot?.project).toBe('p');
    expect(s.presence[0]?.state).toBe('working');
    expect(s.bot.fixes?.map((e) => e.botKind)).toEqual(['fix.created', 'fix.status']);
    expect(s.runs.r).toEqual({ runId: 'r', name: 'validate', args: [], output: 'ok\n', exitCode: 0 });
  });

  it('setThreads upserts infos', () => {
    const s = setThreads(initialState(), [info(), info({ id: 't2' })]);
    expect(Object.keys(s.threads).sort()).toEqual(['t1', 't2']);
  });
});
```
`apps/studio/src/lib/store/selectors.spec.ts`:
```ts
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { initialState, setThreads } from './state';
import { channelsOf, cycleForChannel, dmChannelsOf, groupTimeline, pendingApprovals, threadsInChannel } from './selectors';
import { applyThreadEvent, emptyThread } from './timeline';

const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: '0.16.0', gateMode: 'block', pricing: null, stale: [], fixes: [],
  agents: [{ id: 'sdd-orchestrator', description: '', model: 'opus' }, { id: 'sdd-planner', description: '', model: 'sonnet' }],
  specs: [
    { id: 's2', title: 'Dos', status: 'completed', folder: 'sdd/specs/s2', module: null, app: null, dependsOn: [] },
    { id: 's1', title: 'Uno', status: 'in-progress', folder: 'sdd/specs/s1', module: null, app: null, dependsOn: [] },
  ],
  cycles: [
    { specId: 's1', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 1 },
    { specId: 's1', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 3, tasksDone: 1 },
  ],
};

describe('selectors', () => {
  it('lists general, active specs first, then closed specs and fixes', () => {
    expect(channelsOf(snapshot).map((c) => c.id)).toEqual(['general', 'spec:s1', 'spec:s2', 'fixes']);
    expect(channelsOf(null).map((c) => c.id)).toEqual(['general', 'fixes']);
  });
  it('lists DM channels for the workspace agents', () => {
    expect(dmChannelsOf(snapshot).map((c) => c.id)).toEqual(['dm:sdd-orchestrator', 'dm:sdd-planner']);
  });
  it('picks the in-progress cycle, else the last one', () => {
    expect(cycleForChannel(snapshot, 'spec:s1')?.cycle).toBe('cycle-02');
    expect(cycleForChannel(snapshot, 'general')).toBeNull();
  });
  it('sorts threads in a channel by last activity', () => {
    const base = { agent: 'a', options: { agent: 'a', model: 'kit' as const, effort: null, permissionMode: 'default' as const }, status: 'idle' as const, title: 'x', createdAt: '1' };
    const s = setThreads(initialState(), [
      { ...base, id: 'old', channelId: 'general', lastActivity: '2026-01-01' },
      { ...base, id: 'new', channelId: 'general', lastActivity: '2026-02-01' },
      { ...base, id: 'other', channelId: 'fixes', lastActivity: '2026-03-01' },
    ]);
    expect(threadsInChannel(s.threads, 'general').map((t) => t.id)).toEqual(['new', 'old']);
  });
  it('groups consecutive tools of the same author and finds pending approvals', () => {
    const a = { agent: 'x', parentToolUseId: null };
    const b = { agent: 'y', parentToolUseId: 'p' };
    let t = emptyThread();
    t = applyThreadEvent(t, 0, { type: 'tool.start', toolUseId: '1', author: a, tool: 'Read', summary: 'r' });
    t = applyThreadEvent(t, 1, { type: 'tool.start', toolUseId: '2', author: a, tool: 'Grep', summary: 'g' });
    t = applyThreadEvent(t, 2, { type: 'tool.start', toolUseId: '3', author: b, tool: 'Read', summary: 'r' });
    t = applyThreadEvent(t, 3, { type: 'approval.requested', approvalId: 'p1', author: b, tool: 'Bash', summary: '$ x' });
    const blocks = groupTimeline(t.items);
    expect(blocks.map((bl) => (bl.kind === 'tools' ? `tools:${bl.items.length}` : bl.item.kind))).toEqual(['tools:2', 'tools:1', 'approval']);
    expect(pendingApprovals(t).map((p) => p.id)).toEqual(['p1']);
  });
});
```

- [ ] **Step 4: Implementación de estado, selectores y store**

`apps/studio/src/lib/store/state.ts`:
```ts
import type { BotEvent, Presence, ServerEvent, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyThreadEvent, emptyThread, type ThreadState } from './timeline';

export interface CommandRun {
  runId: string;
  name: string;
  args: string[];
  output: string;
  exitCode: number | null;
}

export interface StudioState {
  snapshot: WorkspaceSnapshot | null;
  threads: Record<string, ThreadState>;
  presence: Presence[];
  bot: Record<string, BotEvent[]>;
  runs: Record<string, CommandRun>;
}

const MAX_BOT_EVENTS = 200;
const MAX_RUN_OUTPUT = 200_000;

export const initialState = (): StudioState => ({ snapshot: null, threads: {}, presence: [], bot: {}, runs: {} });

const threadOf = (s: StudioState, id: string): ThreadState => s.threads[id] ?? emptyThread();

function withThread(s: StudioState, id: string, thread: ThreadState): StudioState {
  return thread === s.threads[id] ? s : { ...s, threads: { ...s.threads, [id]: thread } };
}

export function setThreads(s: StudioState, list: ThreadInfo[]): StudioState {
  const threads = { ...s.threads };
  for (const info of list) threads[info.id] = { ...threadOf(s, info.id), info };
  return { ...s, threads };
}

export function loadHistory(s: StudioState, threadId: string, entries: { seq: number; event: ThreadEvent }[]): StudioState {
  let thread = threadOf(s, threadId);
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) thread = applyThreadEvent(thread, entry.seq, entry.event);
  return withThread(s, threadId, thread);
}

export function setBotHistory(s: StudioState, channelId: string, events: BotEvent[]): StudioState {
  return { ...s, bot: { ...s.bot, [channelId]: events.slice(-MAX_BOT_EVENTS) } };
}

export function startRun(s: StudioState, run: { runId: string; name: string; args: string[] }): StudioState {
  return { ...s, runs: { ...s.runs, [run.runId]: { ...run, output: s.runs[run.runId]?.output ?? '', exitCode: s.runs[run.runId]?.exitCode ?? null } } };
}

export function applyServerEvent(s: StudioState, e: ServerEvent): StudioState {
  switch (e.kind) {
    case 'thread.event':
      return withThread(s, e.threadId, applyThreadEvent(threadOf(s, e.threadId), e.seq, e.event));
    case 'thread.updated':
      return withThread(s, e.thread.id, { ...threadOf(s, e.thread.id), info: e.thread });
    case 'presence.changed':
      return { ...s, presence: e.presence };
    case 'workspace.changed':
      return { ...s, snapshot: e.snapshot };
    case 'bot.event': {
      const { kind: _kind, ...event } = e;
      const list = [...(s.bot[e.channelId] ?? []), event].slice(-MAX_BOT_EVENTS);
      return { ...s, bot: { ...s.bot, [e.channelId]: list } };
    }
    case 'command.output': {
      const run = s.runs[e.runId] ?? { runId: e.runId, name: '?', args: [], output: '', exitCode: null };
      return { ...s, runs: { ...s.runs, [e.runId]: { ...run, output: (run.output + e.chunk).slice(-MAX_RUN_OUTPUT) } } };
    }
    case 'command.exit': {
      const run = s.runs[e.runId] ?? { runId: e.runId, name: '?', args: [], output: '', exitCode: null };
      return { ...s, runs: { ...s.runs, [e.runId]: { ...run, exitCode: e.exitCode } } };
    }
  }
}
```
`apps/studio/src/lib/store/selectors.ts`:
```ts
import { channelForDm, channelForSpec, specIdOfChannel, type Author, type CycleSummary, type ThreadInfo, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { ThreadState, TimelineItem } from './timeline';

export interface ChannelEntry {
  id: string;
  kind: 'general' | 'fixes' | 'spec' | 'dm';
  label: string;
  status?: string;
}

const CLOSED = new Set(['completed', 'cancelled', 'archived']);

export function channelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[] {
  const specs = [...(snapshot?.specs ?? [])].sort((a, b) => Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)) || a.id.localeCompare(b.id));
  return [
    { id: 'general', kind: 'general', label: 'general' },
    ...specs.map((s): ChannelEntry => ({ id: channelForSpec(s.id), kind: 'spec', label: s.id, status: s.status })),
    { id: 'fixes', kind: 'fixes', label: 'fixes' },
  ];
}

export function dmChannelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[] {
  return (snapshot?.agents ?? []).map((a) => ({ id: channelForDm(a.id), kind: 'dm', label: a.id }));
}

export function threadsInChannel(threads: Record<string, ThreadState>, channelId: string): ThreadInfo[] {
  return Object.values(threads)
    .flatMap((t) => (t.info && t.info.channelId === channelId ? [t.info] : []))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function pendingApprovals(t: ThreadState): Extract<TimelineItem, { kind: 'approval' }>[] {
  return t.items.filter((i): i is Extract<TimelineItem, { kind: 'approval' }> => i.kind === 'approval' && i.decision === 'pending');
}

export function cycleForChannel(snapshot: WorkspaceSnapshot | null, channelId: string): CycleSummary | null {
  const specId = specIdOfChannel(channelId);
  if (!snapshot || !specId) return null;
  const cycles = snapshot.cycles.filter((c) => c.specId === specId);
  return cycles.find((c) => c.status === 'in-progress') ?? cycles.at(-1) ?? null;
}

export type TimelineBlock =
  | { kind: 'item'; item: TimelineItem }
  | { kind: 'tools'; id: string; author: Author; items: Extract<TimelineItem, { kind: 'tool' }>[] };

export function groupTimeline(items: TimelineItem[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.kind === 'tool') {
      if (last?.kind === 'tools' && last.author.agent === item.author.agent) last.items.push(item);
      else blocks.push({ kind: 'tools', id: `tools:${item.id}`, author: item.author, items: [item] });
    } else {
      blocks.push({ kind: 'item', item });
    }
  }
  return blocks;
}
```
`apps/studio/src/lib/store/store.ts`:
```ts
import type { BotEvent, Presence, ServerEvent, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  applyServerEvent,
  initialState,
  loadHistory,
  setBotHistory,
  setThreads,
  startRun,
  type StudioState,
} from './state';

export interface StudioActions {
  receive(e: ServerEvent): void;
  setSnapshot(s: WorkspaceSnapshot): void;
  setThreads(list: ThreadInfo[]): void;
  loadHistory(threadId: string, entries: { seq: number; event: ThreadEvent }[]): void;
  setPresence(p: Presence[]): void;
  setBotHistory(channelId: string, events: BotEvent[]): void;
  startRun(run: { runId: string; name: string; args: string[] }): void;
}

export type StudioStore = StoreApi<StudioState & StudioActions>;

export function createStudioStore(): StudioStore {
  return createStore<StudioState & StudioActions>()((set) => ({
    ...initialState(),
    receive: (e) => set((s) => applyServerEvent(s, e)),
    setSnapshot: (snapshot) => set({ snapshot }),
    setThreads: (list) => set((s) => setThreads(s, list)),
    loadHistory: (id, entries) => set((s) => loadHistory(s, id, entries)),
    setPresence: (presence) => set({ presence }),
    setBotHistory: (c, events) => set((s) => setBotHistory(s, c, events)),
    startRun: (run) => set((s) => startRun(s, run)),
  }));
}
```

- [ ] **Step 5: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run store && pnpm --filter sdd-studio-web typecheck` → PASS.
```bash
git add apps/studio/src/lib/store
git commit -m "feat(studio): event-sourced store with timeline reducers and selectors"
```

---

### Task 5: i18n y comandos con barra

**Tier:** `haiku`.

**Files:**
- Create: `apps/studio/src/lib/i18n/{es.ts,en.ts,i18n.tsx}` (+ `i18n.spec.tsx`)
- Create: `apps/studio/src/lib/slash.ts` (+ `slash.spec.ts`)
- Create: `apps/studio/src/lib/format.ts` (+ `format.spec.ts`)

**Interfaces:**
- Produces: `type Dict = typeof es`; `type Lang = 'es' | 'en'`; `I18nProvider({ children, initial? })`; `useT(): { t(key: keyof Dict, vars?: Record<string, string | number>): string; lang: Lang; setLang(l: Lang): void }`; `detectLang(navigatorLang: string | undefined, stored: string | null): Lang`; `parseSlash(text: string): SlashAction`; `PROMPT_COMMANDS`; `botText(t, e: BotEvent): string`; `formatCost(usd: number): string`; `formatTokens(n: number): string`.

- [ ] **Step 1: Diccionarios**

`apps/studio/src/lib/i18n/es.ts`:
```ts
export const es = {
  'connect.title': 'Conectá tu repo',
  'connect.body': 'En la raíz de un repo con el kit SDD corré:',
  'connect.copy': 'Copiar',
  'connect.copied': 'Copiado',
  'connect.localUi': 'Si tu navegador bloquea la conexión al puerto local (p. ej. Safari), usá --local-ui.',
  'connect.auth': 'Usa tu login local de Claude Code (o ANTHROPIC_API_KEY). La web nunca ve credenciales.',
  'conn.connecting': 'Conectando con el puente…',
  'conn.reconnecting': 'Reconectando en {seconds}s…',
  'conn.bad-token': 'El token no es válido. Volvé a abrir el enlace que imprime sdd-studio.',
  'conn.protocol-mismatch': 'La versión del puente no es compatible. Actualizalo: npx @e-burgos/sdd-studio@latest',
  'conn.unreachable': 'No hay un puente escuchando en el puerto {port}. ¿Está corriendo sdd-studio?',
  'sidebar.channels': 'Canales',
  'sidebar.agents': 'Agentes',
  'sidebar.views': 'Vistas',
  'sidebar.viewsSoon': 'Próximamente',
  'presence.working': 'trabajando',
  'presence.waiting': 'esperando aprobación',
  'presence.open': 'sesión abierta',
  'presence.idle': 'inactivo',
  'auth.local-claude-login': 'login local',
  'auth.api-key': 'API key',
  'channel.noThreads': 'Todavía no hay hilos. Escribí abajo para empezar uno.',
  'channel.bot': 'sdd-bot',
  'channel.threads': 'Hilos',
  'channel.dmWith': 'Mensaje directo con {name}',
  'thread.back': 'Volver al canal',
  'thread.interrupt': 'Interrumpir',
  'composer.placeholder': 'Escribí un mensaje… (/ para comandos)',
  'composer.send': 'Enviar',
  'composer.agent': 'Agente',
  'composer.model': 'Modelo',
  'composer.effort': 'Esfuerzo',
  'composer.permission': 'Permisos',
  'composer.unknownCommand': 'Comando desconocido: {name}',
  'composer.badArgs': 'Argumentos inválidos para /{name}',
  'model.kit': 'kit (según AGENTS.md)',
  'perm.default': 'preguntar',
  'perm.acceptEdits': 'aceptar ediciones',
  'perm.plan': 'sólo planificar',
  'approval.title': '{name} quiere usar {tool}',
  'approval.allow': 'Aprobar',
  'approval.deny': 'Denegar',
  'approval.always': 'Siempre (hilo)',
  'approval.reason': 'Motivo (opcional)',
  'approval.allowed': 'Aprobado',
  'approval.denied': 'Denegado',
  'approval.input': 'Entrada completa',
  'approval.truncated': 'La entrada es muy larga y se muestra recortada.',
  'tools.used': '{name} usó {count} herramienta(s)',
  'subagent.start': '{name} empezó a trabajar',
  'subagent.stop': '{name} terminó',
  'usage.footer': '{model} · {tokensIn} in · {tokensOut} out · {cost}',
  'status.queued': 'en cola',
  'status.running': 'trabajando',
  'status.waiting-approval': 'esperando aprobación',
  'status.idle': 'listo',
  'status.interrupted': 'interrumpido',
  'status.error': 'error',
  'panel.activity': 'Actividad',
  'panel.details': 'Detalles',
  'panel.noActivity': 'Nadie está trabajando ahora.',
  'panel.noCycle': 'Este canal no tiene un ciclo activo.',
  'cycle.progress': '{done}/{total} tasks',
  'run.title': '$ pnpm sdd:{name} {args}',
  'run.exit': 'terminó con código {code}',
  'run.running': 'corriendo…',
  'bot.spec.created': 'Spec nuevo: {specId} ({status})',
  'bot.spec.status': '{specId}: {from} → {to}',
  'bot.cycle.opened': 'Se abrió {cycle} de {specId} (flow {flow})',
  'bot.cycle.status': '{cycle} de {specId}: {from} → {to}',
  'bot.task.status': '{taskId} «{title}»: {from} → {to}',
  'bot.fix.created': 'Fix nuevo: {fixId}',
  'bot.fix.status': '{fixId}: {from} → {to}',
  'lang.switch': 'English',
};
export type Dict = typeof es;
```
`apps/studio/src/lib/i18n/en.ts`: mismo objeto con las mismas claves traducidas al inglés (`satisfies Record<keyof Dict, string>`):
```ts
import type { Dict } from './es';

export const en = {
  'connect.title': 'Connect your repo',
  'connect.body': 'At the root of a repo with the SDD kit run:',
  'connect.copy': 'Copy',
  'connect.copied': 'Copied',
  'connect.localUi': 'If your browser blocks the connection to the local port (e.g. Safari), use --local-ui.',
  'connect.auth': 'Uses your local Claude Code login (or ANTHROPIC_API_KEY). The web never sees credentials.',
  'conn.connecting': 'Connecting to the bridge…',
  'conn.reconnecting': 'Reconnecting in {seconds}s…',
  'conn.bad-token': 'The token is not valid. Open the link printed by sdd-studio again.',
  'conn.protocol-mismatch': 'The bridge version is not compatible. Update it: npx @e-burgos/sdd-studio@latest',
  'conn.unreachable': 'No bridge is listening on port {port}. Is sdd-studio running?',
  'sidebar.channels': 'Channels',
  'sidebar.agents': 'Agents',
  'sidebar.views': 'Views',
  'sidebar.viewsSoon': 'Coming soon',
  'presence.working': 'working',
  'presence.waiting': 'waiting for approval',
  'presence.open': 'session open',
  'presence.idle': 'idle',
  'auth.local-claude-login': 'local login',
  'auth.api-key': 'API key',
  'channel.noThreads': 'No threads yet. Type below to start one.',
  'channel.bot': 'sdd-bot',
  'channel.threads': 'Threads',
  'channel.dmWith': 'Direct message with {name}',
  'thread.back': 'Back to channel',
  'thread.interrupt': 'Interrupt',
  'composer.placeholder': 'Type a message… (/ for commands)',
  'composer.send': 'Send',
  'composer.agent': 'Agent',
  'composer.model': 'Model',
  'composer.effort': 'Effort',
  'composer.permission': 'Permissions',
  'composer.unknownCommand': 'Unknown command: {name}',
  'composer.badArgs': 'Invalid arguments for /{name}',
  'model.kit': 'kit (per AGENTS.md)',
  'perm.default': 'ask',
  'perm.acceptEdits': 'accept edits',
  'perm.plan': 'plan only',
  'approval.title': '{name} wants to use {tool}',
  'approval.allow': 'Approve',
  'approval.deny': 'Deny',
  'approval.always': 'Always (thread)',
  'approval.reason': 'Reason (optional)',
  'approval.allowed': 'Approved',
  'approval.denied': 'Denied',
  'approval.input': 'Full input',
  'approval.truncated': 'The input is very long and is shown truncated.',
  'tools.used': '{name} used {count} tool(s)',
  'subagent.start': '{name} started working',
  'subagent.stop': '{name} finished',
  'usage.footer': '{model} · {tokensIn} in · {tokensOut} out · {cost}',
  'status.queued': 'queued',
  'status.running': 'working',
  'status.waiting-approval': 'waiting for approval',
  'status.idle': 'ready',
  'status.interrupted': 'interrupted',
  'status.error': 'error',
  'panel.activity': 'Activity',
  'panel.details': 'Details',
  'panel.noActivity': 'Nobody is working right now.',
  'panel.noCycle': 'This channel has no active cycle.',
  'cycle.progress': '{done}/{total} tasks',
  'run.title': '$ pnpm sdd:{name} {args}',
  'run.exit': 'exited with code {code}',
  'run.running': 'running…',
  'bot.spec.created': 'New spec: {specId} ({status})',
  'bot.spec.status': '{specId}: {from} → {to}',
  'bot.cycle.opened': '{cycle} of {specId} opened (flow {flow})',
  'bot.cycle.status': '{cycle} of {specId}: {from} → {to}',
  'bot.task.status': '{taskId} “{title}”: {from} → {to}',
  'bot.fix.created': 'New fix: {fixId}',
  'bot.fix.status': '{fixId}: {from} → {to}',
  'lang.switch': 'Español',
} satisfies Record<keyof Dict, string>;
```

- [ ] **Step 2: Tests (fallan)**

`apps/studio/src/lib/i18n/i18n.spec.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react';
import { I18nProvider, detectLang, useT } from './i18n';

function Probe() {
  const { t, lang, setLang } = useT();
  return (
    <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
      {t('conn.unreachable', { port: 4320 })}
    </button>
  );
}

describe('i18n', () => {
  it('detects the language', () => {
    expect(detectLang('en-US', null)).toBe('en');
    expect(detectLang('es-AR', null)).toBe('es');
    expect(detectLang(undefined, null)).toBe('es');
    expect(detectLang('en-US', 'es')).toBe('es');
  });
  it('interpolates and switches language', () => {
    localStorage.clear();
    render(<I18nProvider initial="es"><Probe /></I18nProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('No hay un puente escuchando en el puerto 4320');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button')).toHaveTextContent('No bridge is listening on port 4320');
    expect(localStorage.getItem('sdd-studio:lang')).toBe('en');
  });
});
```
`apps/studio/src/lib/slash.spec.ts`:
```ts
import { parseSlash } from './slash';

describe('parseSlash', () => {
  it('returns null for plain text', () => {
    expect(parseSlash('hola')).toBeNull();
  });
  it('maps script commands with safe args', () => {
    expect(parseSlash('/gate spec-dev-001-pagos cycle-01')).toEqual({ kind: 'run', name: 'gate', args: ['spec-dev-001-pagos', 'cycle-01'] });
    expect(parseSlash('/validate')).toEqual({ kind: 'run', name: 'validate', args: [] });
    expect(parseSlash('/gate a;b')).toEqual({ kind: 'error', reason: 'args', name: 'gate' });
    expect(parseSlash('/gate a b c d e')).toEqual({ kind: 'error', reason: 'args', name: 'gate' });
  });
  it('maps prompt commands to kit prompt files and keeps the rest as args', () => {
    expect(parseSlash('/open-cycle spec-dev-001-pagos\nrefunds')).toEqual({
      kind: 'prompt', name: 'open-cycle', path: 'sdd/prompts/start-sdd-cycle.prompt.md', args: 'spec-dev-001-pagos\nrefunds',
    });
    expect(parseSlash('/review')).toMatchObject({ kind: 'prompt', path: 'sdd/prompts/review-cycle.prompt.md', args: '' });
  });
  it('flags unknown commands', () => {
    expect(parseSlash('/nope x')).toEqual({ kind: 'error', reason: 'unknown', name: 'nope' });
  });
});
```
`apps/studio/src/lib/format.spec.ts`:
```ts
import { es } from './i18n/es';
import { botText, formatCost, formatTokens } from './format';

const t = (key: keyof typeof es, vars: Record<string, string | number> = {}) =>
  es[key].replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`));

describe('format', () => {
  it('formats cost and tokens', () => {
    expect(formatCost(0.0778)).toBe('$0.078');
    expect(formatCost(1.5)).toBe('$1.50');
    expect(formatTokens(121318)).toBe('121.3k');
    expect(formatTokens(950)).toBe('950');
  });
  it('renders bot events', () => {
    expect(botText(t, { channelId: 'spec:s', botKind: 'task.status', payload: { taskId: 'T1', title: 'Tests', from: 'pending', to: 'done' } })).toBe('T1 «Tests»: pending → done');
  });
});
```

- [ ] **Step 3: Implementación**

`apps/studio/src/lib/i18n/i18n.tsx`:
```tsx
'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { es, type Dict } from './es';

export type Lang = 'es' | 'en';
const LANG_KEY = 'sdd-studio:lang';
const DICTS: Record<Lang, Dict> = { es, en };

export type TFunction = (key: keyof Dict, vars?: Record<string, string | number>) => string;

export function detectLang(navigatorLang: string | undefined, stored: string | null): Lang {
  if (stored === 'es' || stored === 'en') return stored;
  return navigatorLang?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

interface I18nValue {
  t: TFunction;
  lang: Lang;
  setLang(lang: Lang): void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(
    () => initial ?? detectLang(typeof navigator === 'undefined' ? undefined : navigator.language, readStored()),
  );
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // sin storage: el cambio vale para esta sesión
    }
  }, []);
  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    const t: TFunction = (key, vars = {}) =>
      dict[key].replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
    return { t, lang, setLang };
  }, [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT must be used inside <I18nProvider>');
  return value;
}
```
`apps/studio/src/lib/slash.ts`:
```ts
export const PROMPT_COMMANDS = {
  'open-cycle': 'sdd/prompts/start-sdd-cycle.prompt.md',
  review: 'sdd/prompts/review-cycle.prompt.md',
  hotfix: 'sdd/prompts/hotfix-bypass-gate.prompt.md',
  check: 'sdd/prompts/check-spec-before-implement.prompt.md',
  resume: 'sdd/prompts/hermes-resume.prompt.md',
  steward: 'sdd/prompts/sdd-steward.prompt.md',
} as const;

export type SlashAction =
  | { kind: 'run'; name: 'gate' | 'validate'; args: string[] }
  | { kind: 'prompt'; name: keyof typeof PROMPT_COMMANDS; path: string; args: string }
  | { kind: 'error'; reason: 'unknown' | 'args'; name: string }
  | null;

const SAFE_ARG = /^[A-Za-z0-9._-]{1,80}$/;

export function parseSlash(text: string): SlashAction {
  const match = /^\/([a-z-]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  const name = match[1]!;
  const rest = (match[2] ?? '').trim();
  if (name === 'gate' || name === 'validate') {
    const args = rest ? rest.split(/\s+/) : [];
    const max = name === 'gate' ? 2 : 0;
    if (args.length > max || !args.every((a) => SAFE_ARG.test(a))) return { kind: 'error', reason: 'args', name };
    return { kind: 'run', name, args };
  }
  if (name in PROMPT_COMMANDS) {
    const key = name as keyof typeof PROMPT_COMMANDS;
    return { kind: 'prompt', name: key, path: PROMPT_COMMANDS[key], args: rest };
  }
  return { kind: 'error', reason: 'unknown', name };
}
```
`apps/studio/src/lib/format.ts`:
```ts
import type { BotEvent } from '@sdd-studio/protocol';
import type { TFunction } from './i18n/i18n';

export const formatCost = (usd: number): string => (usd < 1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`);

export const formatTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function botText(t: TFunction, e: BotEvent): string {
  const vars = Object.fromEntries(
    Object.entries(e.payload).map(([k, v]) => [k, typeof v === 'string' || typeof v === 'number' ? v : String(v ?? '')]),
  );
  return t(`bot.${e.botKind}` as Parameters<TFunction>[0], vars);
}
```

- [ ] **Step 4: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run i18n slash format && pnpm --filter sdd-studio-web typecheck` → PASS.
```bash
git add apps/studio/src/lib
git commit -m "feat(studio): es/en i18n, slash commands and formatters"
```

---

### Task 6: Conexión y bootstrap (`BridgeProvider`), landing y pantallas de conexión

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/src/components/BridgeProvider.tsx`, `apps/studio/src/lib/bootstrap.ts` (+ `bootstrap.spec.ts`)
- Create: `apps/studio/src/components/ConnectScreen.tsx`, `apps/studio/src/components/ConnectionBanner.tsx` (+ `connection.spec.tsx`)
- Create: `apps/studio/src/components/WorkspaceApp.tsx`
- Modify: `apps/studio/src/app/page.tsx`, `apps/studio/src/app/w/page.tsx`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  ```ts
  bootstrap(client: Pick<BridgeClient, 'request'>, store: StudioStore): Promise<void>     // snapshot + thread.list + presence.get validados con zod; history incremental de hilos ya cargados
  openThread(client, store, threadId): Promise<void>                                       // thread.history desde lastSeq+1
  loadBotHistory(client, store, channelId): Promise<void>
  <BridgeProvider pairing={PairingInfo}>  → context { client: BridgeClient; store: StudioStore; connection: ConnectionState; pairing: PairingInfo }
  useBridge(): BridgeContextValue
  useStudio<T>(selector: (s: StudioState & StudioActions) => T): T
  <ConnectScreen />  <ConnectionBanner />  <WorkspaceApp />
  ```

- [ ] **Step 1: Tests de bootstrap (fallan)**

`apps/studio/src/lib/bootstrap.spec.ts`:
```ts
import { createStudioStore } from './store/store';
import { bootstrap, loadBotHistory, openThread } from './bootstrap';

const snapshot = { project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], gateMode: 'block', pricing: null, stale: [] };
const thread = { id: 't1', channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' }, status: 'idle', createdAt: 'a', lastActivity: 'a' };

function fakeClient(responses: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    request: async (cmd: Record<string, unknown>) => {
      calls.push(cmd);
      return responses[cmd.cmd as string];
    },
  };
}

describe('bootstrap', () => {
  it('loads snapshot, threads and presence, validating them', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'workspace.snapshot': snapshot, 'thread.list': [thread], 'presence.get': [] });
    await bootstrap(client as never, store);
    expect(store.getState().snapshot?.project).toBe('p');
    expect(store.getState().threads.t1?.info?.title).toBe('x');
  });

  it('rejects malformed bridge data', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'workspace.snapshot': { nope: 1 }, 'thread.list': [], 'presence.get': [] });
    await expect(bootstrap(client as never, store)).rejects.toThrow();
  });

  it('asks only for events after the last known seq', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', [{ seq: 0, event: { type: 'user.message', text: 'a' } }]);
    const client = fakeClient({ 'thread.history': [{ seq: 1, event: { type: 'user.message', text: 'b' } }] });
    await openThread(client as never, store, 't1');
    expect(client.calls).toEqual([{ cmd: 'thread.history', threadId: 't1', sinceSeq: 1 }]);
    expect(store.getState().threads.t1?.items).toHaveLength(2);
  });

  it('re-syncs loaded threads on bootstrap after a reconnect', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', [{ seq: 0, event: { type: 'user.message', text: 'a' } }]);
    const client = fakeClient({ 'workspace.snapshot': snapshot, 'thread.list': [thread], 'presence.get': [], 'thread.history': [] });
    await bootstrap(client as never, store);
    expect(client.calls).toContainEqual({ cmd: 'thread.history', threadId: 't1', sinceSeq: 1 });
  });

  it('loads bot history for a channel', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'channel.botHistory': [{ channelId: 'fixes', botKind: 'fix.created', payload: {} }] });
    await loadBotHistory(client as never, store, 'fixes');
    expect(client.calls).toEqual([{ cmd: 'channel.botHistory', channelId: 'fixes', limit: 100 }]);
    expect(store.getState().bot.fixes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implementación de bootstrap**

`apps/studio/src/lib/bootstrap.ts`:
```ts
import { BotEvent, Presence, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { z } from 'zod';
import type { BridgeClient } from './bridge/client';
import type { StudioStore } from './store/store';

type Requester = Pick<BridgeClient, 'request'>;
const History = z.array(z.object({ seq: z.number().int().nonnegative(), event: ThreadEvent }));

export async function openThread(client: Requester, store: StudioStore, threadId: string): Promise<void> {
  const sinceSeq = (store.getState().threads[threadId]?.lastSeq ?? -1) + 1;
  const entries = History.parse(await client.request({ cmd: 'thread.history', threadId, sinceSeq }));
  store.getState().loadHistory(threadId, entries);
}

export async function loadBotHistory(client: Requester, store: StudioStore, channelId: string): Promise<void> {
  const events = z.array(BotEvent).parse(await client.request({ cmd: 'channel.botHistory', channelId, limit: 100 }));
  store.getState().setBotHistory(channelId, events);
}

/** Carga inicial (y re-sincronización tras reconectar). */
export async function bootstrap(client: Requester, store: StudioStore): Promise<void> {
  const [snapshot, threads, presence] = await Promise.all([
    client.request({ cmd: 'workspace.snapshot' }),
    client.request({ cmd: 'thread.list' }),
    client.request({ cmd: 'presence.get' }),
  ]);
  const state = store.getState();
  state.setSnapshot(WorkspaceSnapshot.parse(snapshot));
  state.setThreads(z.array(ThreadInfo).parse(threads));
  state.setPresence(z.array(Presence).parse(presence));
  const loaded = Object.entries(store.getState().threads).filter(([, t]) => t.lastSeq >= 0).map(([id]) => id);
  await Promise.all(loaded.map((id) => openThread(client, store, id)));
}
```

- [ ] **Step 3: Provider, pantallas y páginas**

`apps/studio/src/components/BridgeProvider.tsx`:
```tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { bootstrap } from '@/lib/bootstrap';
import { BridgeClient, type ConnectionState } from '@/lib/bridge/client';
import { bridgeUrl, type PairingInfo } from '@/lib/bridge/pairing';
import type { StudioState } from '@/lib/store/state';
import { createStudioStore, type StudioActions, type StudioStore } from '@/lib/store/store';

const CLIENT_VERSION = '0.1.0';

export interface BridgeContextValue {
  client: BridgeClient;
  store: StudioStore;
  connection: ConnectionState;
  pairing: PairingInfo;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ pairing, children }: { pairing: PairingInfo; children: ReactNode }) {
  const [client] = useState(() => new BridgeClient({ url: bridgeUrl(pairing), token: pairing.token, clientVersion: CLIENT_VERSION }));
  const [store] = useState(createStudioStore);
  const [connection, setConnection] = useState<ConnectionState>(client.state);

  useEffect(() => {
    const offState = client.onState((s) => {
      setConnection(s);
      if (s.status === 'open') void bootstrap(client, store).catch((error) => console.error('[sdd-studio] bootstrap:', error));
    });
    const offEvents = client.onEvent((e) => store.getState().receive(e));
    client.connect();
    return () => {
      offState();
      offEvents();
      client.close();
    };
  }, [client, store]);

  const value = useMemo(() => ({ client, store, connection, pairing }), [client, store, connection, pairing]);
  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge(): BridgeContextValue {
  const value = useContext(BridgeContext);
  if (!value) throw new Error('useBridge must be used inside <BridgeProvider>');
  return value;
}

export function useStudio<T>(selector: (s: StudioState & StudioActions) => T): T {
  return useStore(useBridge().store, selector);
}
```
`apps/studio/src/components/ConnectScreen.tsx`:
```tsx
'use client';

import { CopySimple, Plugs } from '@phosphor-icons/react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';

export const BRIDGE_COMMAND = 'npx @e-burgos/sdd-studio';

export function ConnectScreen({ error }: { error?: string }) {
  const { t, lang, setLang } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <Plugs size={28} className="text-accent-400" weight="duotone" />
          <h1 className="text-2xl font-semibold">{t('connect.title')}</h1>
          <button className="ml-auto text-xs text-ink-300 hover:text-ink-100" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {t('lang.switch')}
          </button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-roseish/40 bg-roseish/10 p-3 text-sm text-roseish">{error}</p>}
        <p className="mb-3 text-ink-300">{t('connect.body')}</p>
        <div className="flex items-center gap-2 rounded-lg bg-ink-950 p-3 font-mono text-sm">
          <code className="flex-1 text-accent-300">{BRIDGE_COMMAND}</code>
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            onClick={() => {
              void navigator.clipboard?.writeText(BRIDGE_COMMAND);
              setCopied(true);
            }}
          >
            <CopySimple size={16} /> {copied ? t('connect.copied') : t('connect.copy')}
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-300">{t('connect.auth')}</p>
        <p className="mt-2 text-xs text-ink-500">{t('connect.localUi')}</p>
      </section>
    </main>
  );
}
```
`apps/studio/src/components/ConnectionBanner.tsx`:
```tsx
'use client';

import type { ConnectionState } from '@/lib/bridge/client';
import { useT } from '@/lib/i18n/i18n';

export function ConnectionBanner({ connection }: { connection: ConnectionState }) {
  const { t } = useT();
  if (connection.status === 'open' || connection.status === 'idle' || connection.status === 'failed') return null;
  const text =
    connection.status === 'reconnecting'
      ? t('conn.reconnecting', { seconds: Math.ceil(connection.delayMs / 1000) })
      : t('conn.connecting');
  return (
    <div role="status" className="border-b border-amberish/30 bg-amberish/10 px-4 py-1.5 text-center text-xs text-amberish">
      {text}
    </div>
  );
}
```
`apps/studio/src/components/connection.spec.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';

const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('connection UI', () => {
  it('shows the bridge command and an error', () => {
    wrap(<ConnectScreen error="token inválido" />);
    expect(screen.getByText('npx @e-burgos/sdd-studio')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('token inválido');
  });
  it('shows reconnect countdown and hides when open', () => {
    const { rerender } = wrap(<ConnectionBanner connection={{ status: 'reconnecting', attempt: 2, delayMs: 2000 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando en 2s');
    rerender(<I18nProvider initial="es"><ConnectionBanner connection={{ status: 'idle' }} /></I18nProvider>);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
```
`apps/studio/src/components/WorkspaceApp.tsx` (la vista `Workspace` llega en Task 7; mientras tanto renderiza el nombre del proyecto):
```tsx
'use client';

import { useEffect, useState } from 'react';
import { resolvePairing, type PairingInfo } from '@/lib/bridge/pairing';
import { I18nProvider, useT } from '@/lib/i18n/i18n';
import { BridgeProvider, useBridge } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { Workspace } from './workspace/Workspace';

function Connected() {
  const { connection, pairing } = useBridge();
  const { t } = useT();
  if (connection.status === 'failed') {
    const message =
      connection.reason === 'unreachable' ? t('conn.unreachable', { port: pairing.port }) : t(`conn.${connection.reason}`);
    return <ConnectScreen error={message} />;
  }
  return (
    <div className="flex h-full flex-col">
      <ConnectionBanner connection={connection} />
      <Workspace />
    </div>
  );
}

export function WorkspaceApp() {
  const [pairing, setPairing] = useState<PairingInfo | null | undefined>(undefined);
  useEffect(() => setPairing(resolvePairing(window)), []);
  return (
    <I18nProvider>
      {pairing === undefined ? null : pairing === null ? (
        <ConnectScreen />
      ) : (
        <BridgeProvider pairing={pairing}>
          <Connected />
        </BridgeProvider>
      )}
    </I18nProvider>
  );
}
```
Crear un `Workspace` provisorio en `apps/studio/src/components/workspace/Workspace.tsx` (Task 7 lo reemplaza):
```tsx
'use client';

import { useStudio } from '../BridgeProvider';

export function Workspace() {
  const project = useStudio((s) => s.snapshot?.project ?? '…');
  return <main className="p-6">{project}</main>;
}
```
`apps/studio/src/app/w/page.tsx`:
```tsx
import { WorkspaceApp } from '@/components/WorkspaceApp';

export default function WorkspacePage() {
  return <WorkspaceApp />;
}
```
`apps/studio/src/app/page.tsx`:
```tsx
'use client';

import { ConnectScreen } from '@/components/ConnectScreen';
import { I18nProvider } from '@/lib/i18n/i18n';

export default function Home() {
  return (
    <I18nProvider>
      <ConnectScreen />
    </I18nProvider>
  );
}
```
Cambiar `<html lang="es">` → `<html lang="es" className="h-full">` y `<body className="h-full antialiased">` en `layout.tsx`.

- [ ] **Step 4: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run bootstrap connection && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web build:local` → PASS.
```bash
git add apps/studio/src
git commit -m "feat(studio): bridge provider, bootstrap sync and connection screens"
```

---

### Task 7: Shell del workspace — sidebar, canal, hilo y timeline

**Tier:** `sonnet` (componentes con criterio visual: seguir la paleta y el layout de la spec §4).

**Files:**
- Create: `apps/studio/src/components/workspace/{Workspace,Sidebar,ChannelView,ThreadView,Timeline,ApprovalCard,AgentAvatar,Markdown,StatusBadge}.tsx`
- Test: `apps/studio/src/components/workspace/{timeline,approval,sidebar}.spec.tsx`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces: `<Workspace />` (layout 3 columnas: Sidebar 260px · centro · RightPanel 320px — RightPanel llega en Task 9, acá un `<aside>` vacío), `type View = { channelId: string; threadId: string | null }`; `<Sidebar view onSelect />`; `<ChannelView channelId onOpenThread />`; `<ThreadView threadId onBack />`; `<Timeline items />`; `<ApprovalCard item onRespond />` con `onRespond(decision: 'allow' | 'deny', scope: 'once' | 'thread', reason?: string)`; `<AgentAvatar agent size? />`; `<Markdown text />`; `<StatusBadge status />`.

- [ ] **Step 1: Tests de componentes (fallan)**

`apps/studio/src/components/workspace/approval.spec.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { ApprovalCard } from './ApprovalCard';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;
const base: Approval = {
  kind: 'approval', id: 'p1', seq: 3, author: { agent: 'sdd-implementor-back', parentToolUseId: 't' },
  tool: 'Bash', summary: '$ pnpm nx test api', decision: 'pending',
};
const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('ApprovalCard', () => {
  it('approves once, always, and denies with a reason', () => {
    const onRespond = vi.fn();
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    expect(screen.getByText('Impl-back quiere usar Bash')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siempre (hilo)' }));
    fireEvent.change(screen.getByPlaceholderText('Motivo (opcional)'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Denegar' }));
    expect(onRespond.mock.calls).toEqual([['allow', 'once', undefined], ['allow', 'thread', undefined], ['deny', 'once', 'no']]);
  });
  it('shows gate warning, diff and truncated input in scrollable blocks', () => {
    wrap(<ApprovalCard item={{ ...base, tool: 'Write', diff: '+export {}', input: 'x'.repeat(20_000), inputTruncated: true, gateWarning: 'SPEC GATE: ojo' }} onRespond={vi.fn()} />);
    expect(screen.getByText('SPEC GATE: ojo')).toBeInTheDocument();
    expect(screen.getByText('+export {}')).toBeInTheDocument();
    expect(screen.getByText('La entrada es muy larga y se muestra recortada.')).toBeInTheDocument();
    expect(screen.getByTestId('approval-input')).toHaveClass('overflow-auto');
  });
  it('renders the resolved state without buttons', () => {
    wrap(<ApprovalCard item={{ ...base, decision: 'deny', reason: 'SPEC GATE: no' }} onRespond={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(screen.getByText(/Denegado/)).toHaveTextContent('SPEC GATE: no');
  });
});
```
`apps/studio/src/components/workspace/timeline.spec.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { Timeline } from './Timeline';

const main = { agent: 'sdd-orchestrator', parentToolUseId: null };
const planner = { agent: 'sdd-planner', parentToolUseId: 'x' };
const items: TimelineItem[] = [
  { kind: 'user', id: 'u', seq: 0, text: 'abrí el ciclo' },
  { kind: 'subagent', id: 's', seq: 1, agentType: 'sdd-planner', phase: 'start' },
  { kind: 'message', id: 'm', seq: 2, author: planner, text: '**plan** listo', done: true },
  { kind: 'tool', id: 't1', seq: 3, author: main, tool: 'Read', summary: 'a.ts', status: 'ok' },
  { kind: 'tool', id: 't2', seq: 4, author: main, tool: 'Grep', summary: 'TODO', status: 'running' },
  { kind: 'usage', id: 'us', seq: 5, usage: { model: 'claude-haiku-4-5-20251001', effort: 'low', tokensIn: 121318, tokensOut: 1152, costUsd: 0.0778 } },
];

describe('Timeline', () => {
  it('attributes subagent output and groups tools', () => {
    render(<I18nProvider initial="es"><Timeline items={items} onRespond={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('abrí el ciclo')).toBeInTheDocument();
    expect(screen.getByText('Planner empezó a trabajar')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('Orchestrator usó 2 herramienta(s)')).toBeInTheDocument();
    expect(screen.getByText('claude-haiku-4-5-20251001 · 121.3k in · 1.2k out · $0.078')).toBeInTheDocument();
  });
});
```
`apps/studio/src/components/workspace/sidebar.spec.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { SidebarView } from './Sidebar';

describe('Sidebar', () => {
  it('lists channels and agents with presence and selects them', () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider initial="es">
        <SidebarView
          project="studio fixture" kitVersion="0.16.0" authMode="local-claude-login"
          channels={[{ id: 'general', kind: 'general', label: 'general' }, { id: 'spec:s1', kind: 'spec', label: 's1', status: 'in-progress' }]}
          dms={[{ id: 'dm:sdd-planner', kind: 'dm', label: 'sdd-planner' }]}
          presence={[{ agent: 'sdd-planner', state: 'working', threadId: 't', specId: null, tool: 'Read' }]}
          activeChannel="general" onSelect={onSelect}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('studio fixture')).toBeInTheDocument();
    expect(screen.getByLabelText('Planner: trabajando')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /# s1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Planner/ }));
    expect(onSelect.mock.calls).toEqual([['spec:s1'], ['dm:sdd-planner']]);
  });
});
```

- [ ] **Step 2: Componentes**

`apps/studio/src/components/workspace/AgentAvatar.tsx`:
```tsx
import { agentMeta } from '@/lib/agents';

export function AgentAvatar({ agent, size = 32 }: { agent: string; size?: number }) {
  const meta = agentMeta(agent);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold text-ink-950"
      style={{ width: size, height: size, backgroundColor: meta.color }}
    >
      {meta.short}
    </span>
  );
}
```
`apps/studio/src/components/workspace/Markdown.tsx`:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-studio space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-ink-800 [&_code]:px-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-ink-950 [&_pre]:p-3 [&_a]:text-accent-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
```
`apps/studio/src/components/workspace/StatusBadge.tsx`:
```tsx
import type { SessionStatus } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';

const COLORS: Record<SessionStatus, string> = {
  queued: 'bg-ink-700 text-ink-300',
  running: 'bg-accent-dim text-accent-300',
  'waiting-approval': 'bg-amberish/15 text-amberish',
  idle: 'bg-ink-800 text-ink-300',
  interrupted: 'bg-ink-700 text-ink-300',
  error: 'bg-roseish/15 text-roseish',
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useT();
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${COLORS[status]}`}>{t(`status.${status}`)}</span>;
}
```
`apps/studio/src/components/workspace/ApprovalCard.tsx`:
```tsx
'use client';

import { ShieldWarning } from '@phosphor-icons/react';
import { useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;
export type RespondFn = (decision: 'allow' | 'deny', scope: 'once' | 'thread', reason?: string) => void;

export function ApprovalCard({ item, onRespond }: { item: Approval; onRespond: RespondFn }) {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const pending = item.decision === 'pending';
  return (
    <div className={`rounded-xl border p-4 ${pending ? 'border-amberish/50 bg-amberish/5' : 'border-ink-700 bg-ink-900'}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldWarning size={18} className="text-amberish" />
        {t('approval.title', { name: agentMeta(item.author.agent).name, tool: item.tool })}
      </div>
      <code className="block break-all font-mono text-xs text-ink-100">{item.summary}</code>
      {item.gateWarning && <p className="mt-2 rounded-md bg-roseish/10 p-2 text-xs text-roseish">{item.gateWarning}</p>}
      {item.diff && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-ink-950 p-2 font-mono text-[11px] leading-snug">{item.diff}</pre>
      )}
      {item.input && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-300">{t('approval.input')}</summary>
          {item.inputTruncated && <p className="mt-1 text-xs text-amberish">{t('approval.truncated')}</p>}
          <pre data-testid="approval-input" className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-ink-950 p-2 font-mono text-[11px]">
            {item.input}
          </pre>
        </details>
      )}
      {pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent-400" onClick={() => onRespond('allow', 'once')}>
            {t('approval.allow')}
          </button>
          <button className="rounded-md border border-ink-700 px-3 py-1.5 text-sm hover:bg-ink-800" onClick={() => onRespond('allow', 'thread')}>
            {t('approval.always')}
          </button>
          <input
            className="min-w-40 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm outline-none focus:border-roseish/60"
            placeholder={t('approval.reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="rounded-md border border-roseish/50 px-3 py-1.5 text-sm text-roseish hover:bg-roseish/10"
            onClick={() => onRespond('deny', 'once', reason.trim() || undefined)}
          >
            {t('approval.deny')}
          </button>
        </div>
      ) : (
        <p className={`mt-3 text-xs ${item.decision === 'allow' ? 'text-accent-300' : 'text-roseish'}`}>
          {item.decision === 'allow' ? t('approval.allowed') : t('approval.denied')}
          {item.reason ? ` — ${item.reason}` : ''}
        </p>
      )}
    </div>
  );
}
```
`apps/studio/src/components/workspace/Timeline.tsx`:
```tsx
'use client';

import { CaretRight, Wrench } from '@phosphor-icons/react';
import { agentMeta } from '@/lib/agents';
import { formatCost, formatTokens } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { groupTimeline } from '@/lib/store/selectors';
import type { TimelineItem } from '@/lib/store/timeline';
import { AgentAvatar } from './AgentAvatar';
import { ApprovalCard, type RespondFn } from './ApprovalCard';
import { Markdown } from './Markdown';

export function Timeline({ items, onRespond }: { items: TimelineItem[]; onRespond: (approvalId: string, ...args: Parameters<RespondFn>) => void }) {
  const { t } = useT();
  return (
    <ol className="space-y-4">
      {groupTimeline(items).map((block) => {
        if (block.kind === 'tools') {
          const meta = agentMeta(block.author.agent);
          return (
            <li key={block.id} className="pl-11">
              <details className="group rounded-lg border border-ink-800 bg-ink-900/60">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-ink-300">
                  <CaretRight size={12} className="transition group-open:rotate-90" />
                  <Wrench size={14} />
                  {t('tools.used', { name: meta.name, count: block.items.length })}
                </summary>
                <ul className="space-y-1 px-3 pb-3">
                  {block.items.map((tool) => (
                    <li key={tool.id} className="font-mono text-[11px]">
                      <span className={tool.status === 'error' ? 'text-roseish' : tool.status === 'running' ? 'text-amberish' : 'text-accent-300'}>
                        {tool.status === 'running' ? '⟳' : tool.status === 'error' ? '✗' : '✓'}
                      </span>{' '}
                      <span className="text-ink-300">{tool.tool}</span> <span className="break-all">{tool.summary}</span>
                      {tool.diff && <pre className="mt-1 max-h-48 overflow-auto rounded bg-ink-950 p-2">{tool.diff}</pre>}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        }
        const item = block.item;
        switch (item.kind) {
          case 'user':
            return (
              <li key={item.id} className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-xs">Vos</span>
                <p className="whitespace-pre-wrap pt-1 text-sm">{item.text}</p>
              </li>
            );
          case 'message': {
            const meta = agentMeta(item.author.agent);
            return (
              <li key={item.id} className="flex gap-3">
                <AgentAvatar agent={item.author.agent} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-sm font-semibold" style={{ color: meta.color }}>{meta.name}</div>
                  <Markdown text={item.text} />
                </div>
              </li>
            );
          }
          case 'approval':
            return (
              <li key={item.id} className="pl-11">
                <ApprovalCard item={item} onRespond={(...args) => onRespond(item.id, ...args)} />
              </li>
            );
          case 'subagent':
            return (
              <li key={item.id} className="pl-11 text-xs text-ink-300">
                {t(item.phase === 'start' ? 'subagent.start' : 'subagent.stop', { name: agentMeta(item.agentType).name })}
              </li>
            );
          case 'usage':
            return (
              <li key={item.id} className="pl-11 font-mono text-[11px] text-ink-500">
                {t('usage.footer', {
                  model: item.usage.model,
                  tokensIn: formatTokens(item.usage.tokensIn),
                  tokensOut: formatTokens(item.usage.tokensOut),
                  cost: formatCost(item.usage.costUsd),
                })}
              </li>
            );
          case 'status':
            return (
              <li key={item.id} className="pl-11 text-xs text-roseish">
                {t(`status.${item.status}`)}
                {item.error ? ` — ${item.error.message}` : ''}
              </li>
            );
          default:
            return null;
        }
      })}
    </ol>
  );
}
```
`apps/studio/src/components/workspace/Sidebar.tsx`:
```tsx
'use client';

import { Hash, SquaresFour } from '@phosphor-icons/react';
import { dmAgentOfChannel, type AuthMode, type Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { channelsOf, dmChannelsOf, type ChannelEntry } from '@/lib/store/selectors';
import { useBridge, useStudio } from '../BridgeProvider';

const DOT: Record<Presence['state'], string> = {
  working: 'bg-accent-400 animate-pulse',
  waiting: 'bg-amberish',
  open: 'bg-accent-500/60',
  idle: 'border border-ink-500',
};
const PRESENCE_KEY = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

export interface SidebarViewProps {
  project: string;
  kitVersion: string | null;
  authMode: AuthMode | null;
  channels: ChannelEntry[];
  dms: ChannelEntry[];
  presence: Presence[];
  activeChannel: string;
  onSelect(channelId: string): void;
}

export function SidebarView(p: SidebarViewProps) {
  const { t, lang, setLang } = useT();
  const stateOf = (agent: string) => p.presence.find((x) => x.agent === agent)?.state ?? 'idle';
  const item = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`;
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto border-r border-ink-800 bg-ink-900 p-3">
      <header>
        <div className="truncate text-base font-semibold">{p.project}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-300">
          <span className="h-2 w-2 rounded-full bg-accent-400" />
          {p.authMode ? t(`auth.${p.authMode}`) : '…'}
          {p.kitVersion && <span>· kit {p.kitVersion}</span>}
          <button className="ml-auto hover:text-ink-100" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{t('lang.switch')}</button>
        </div>
      </header>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.channels')}</h2>
        {p.channels.map((c) => (
          <button key={c.id} className={item(p.activeChannel === c.id)} onClick={() => p.onSelect(c.id)}>
            <Hash size={14} />
            <span className="truncate"># {c.label}</span>
            {c.status === 'in-progress' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400" />}
            {c.status === 'completed' && <span className="ml-auto text-[10px] text-ink-500">✓</span>}
          </button>
        ))}
      </section>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.agents')}</h2>
        {p.dms.map((c) => {
          const agent = dmAgentOfChannel(c.id) ?? c.label;
          const state = stateOf(agent);
          const meta = agentMeta(agent);
          return (
            <button key={c.id} className={item(p.activeChannel === c.id)} onClick={() => p.onSelect(c.id)}>
              <span aria-label={`${meta.name}: ${t(PRESENCE_KEY[state])}`} className={`h-2 w-2 rounded-full ${DOT[state]}`} />
              <span className="truncate">{meta.name}</span>
            </button>
          );
        })}
      </section>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.views')}</h2>
        <div className="flex items-center gap-2 px-2 text-xs text-ink-500">
          <SquaresFour size={14} /> {t('sidebar.viewsSoon')}
        </div>
      </section>
    </nav>
  );
}

export function Sidebar({ activeChannel, onSelect }: { activeChannel: string; onSelect(channelId: string): void }) {
  const { connection } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence);
  const welcome = connection.status === 'open' ? connection.welcome : null;
  return (
    <SidebarView
      project={snapshot?.project ?? welcome?.workspace.project ?? '…'}
      kitVersion={snapshot?.kitVersion ?? null}
      authMode={welcome?.authMode ?? null}
      channels={channelsOf(snapshot)}
      dms={dmChannelsOf(snapshot)}
      presence={presence}
      activeChannel={activeChannel}
      onSelect={onSelect}
    />
  );
}
```
`apps/studio/src/components/workspace/ChannelView.tsx` (el composer llega en Task 8; acá se deja el hueco `{composer}` como prop):
```tsx
'use client';

import { dmAgentOfChannel, specIdOfChannel } from '@sdd-studio/protocol';
import { useEffect, useMemo, type ReactNode } from 'react';
import { agentMeta } from '@/lib/agents';
import { loadBotHistory } from '@/lib/bootstrap';
import { botText } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { cycleForChannel, threadsInChannel } from '@/lib/store/selectors';
import { useBridge, useStudio } from '../BridgeProvider';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';

export function ChannelView({ channelId, onOpenThread, composer }: { channelId: string; onOpenThread(id: string): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const threads = useStudio((s) => s.threads);
  const snapshot = useStudio((s) => s.snapshot);
  const bot = useStudio((s) => s.bot[channelId]);
  const list = useMemo(() => threadsInChannel(threads, channelId), [threads, channelId]);
  const cycle = cycleForChannel(snapshot, channelId);
  const dmAgent = dmAgentOfChannel(channelId);
  const specId = specIdOfChannel(channelId);
  const spec = snapshot?.specs.find((s) => s.id === specId);

  useEffect(() => {
    if (connection.status === 'open' && !dmAgent) void loadBotHistory(client, store, channelId).catch(() => undefined);
  }, [client, store, channelId, connection.status, dmAgent]);

  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-800 px-5 py-3">
        <h1 className="truncate text-lg font-semibold">
          {dmAgent ? t('channel.dmWith', { name: agentMeta(dmAgent).name }) : `# ${spec?.id ?? channelId}`}
        </h1>
        {spec && <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300">{spec.status}</span>}
        {cycle && (
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-300">
            <span>{cycle.cycle} · {cycle.flow}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-accent-400" style={{ width: `${cycle.tasksTotal ? (100 * cycle.tasksDone) / cycle.tasksTotal : 0}%` }} />
            </div>
            <span>{t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</span>
          </div>
        )}
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <section>
          <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('channel.threads')}</h2>
          {list.length === 0 && <p className="text-sm text-ink-300">{t('channel.noThreads')}</p>}
          <ul className="space-y-2">
            {list.map((thread) => (
              <li key={thread.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-left hover:border-ink-700"
                  onClick={() => onOpenThread(thread.id)}
                >
                  <AgentAvatar agent={thread.agent} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{thread.title}</span>
                  <StatusBadge status={thread.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {!dmAgent && (bot?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('channel.bot')}</h2>
            <ul className="space-y-1 font-mono text-xs text-ink-300">
              {[...(bot ?? [])].reverse().map((e, i) => (
                <li key={`${e.botKind}:${i}`}>🤖 {botText(t, e)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {composer}
    </section>
  );
}
```
`apps/studio/src/components/workspace/ThreadView.tsx` (composer llega en Task 8 como prop):
```tsx
'use client';

import { ArrowLeft, StopCircle } from '@phosphor-icons/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { openThread } from '@/lib/bootstrap';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);

export function ThreadView({ threadId, onBack, composer }: { threadId: string; onBack(): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const thread = useStudio((s) => s.threads[threadId]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connection.status === 'open') void openThread(client, store, threadId).catch(() => undefined);
  }, [client, store, threadId, connection.status]);
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'end' }), [thread?.items.length]);

  const info = thread?.info;
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-800 px-5 py-3">
        <button aria-label={t('thread.back')} className="rounded-md p-1 text-ink-300 hover:bg-ink-800" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{info?.title ?? '…'}</h1>
        {info && <StatusBadge status={info.status} />}
        {info && BUSY.has(info.status) && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-roseish/50 px-2 py-1 text-xs text-roseish hover:bg-roseish/10"
            onClick={() => void client.request({ cmd: 'thread.interrupt', threadId }).catch(() => undefined)}
          >
            <StopCircle size={14} /> {t('thread.interrupt')}
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Timeline
          items={thread?.items ?? []}
          onRespond={(approvalId, decision, scope, reason) =>
            void client.request({ cmd: 'approval.respond', approvalId, decision, scope, ...(reason ? { reason } : {}) }).catch(() => undefined)
          }
        />
        <div ref={bottom} />
      </div>
      {composer}
    </section>
  );
}
```
`apps/studio/src/components/workspace/Workspace.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { ChannelView } from './ChannelView';
import { Sidebar } from './Sidebar';
import { ThreadView } from './ThreadView';

export interface View {
  channelId: string;
  threadId: string | null;
}

export function Workspace() {
  const [view, setView] = useState<View>({ channelId: 'general', threadId: null });
  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)_320px]">
      <Sidebar activeChannel={view.channelId} onSelect={(channelId) => setView({ channelId, threadId: null })} />
      <main className="min-h-0">
        {view.threadId ? (
          <ThreadView threadId={view.threadId} onBack={() => setView({ ...view, threadId: null })} composer={null} />
        ) : (
          <ChannelView channelId={view.channelId} onOpenThread={(threadId) => setView({ ...view, threadId })} composer={null} />
        )}
      </main>
      <aside className="border-l border-ink-800 bg-ink-900" />
    </div>
  );
}
```

- [ ] **Step 3: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run workspace && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web build:local` → PASS.
Probar a mano: `pnpm --filter sdd-studio-web dev`, en otra terminal `node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open --root apps/studio-bridge/test/fixtures/workspace --web-url http://localhost:3100` y abrir la URL impresa: se ven canales, agentes y el proyecto. (Borrar luego `apps/studio-bridge/test/fixtures/workspace/.sdd-studio`.)
```bash
git add apps/studio/src
git commit -m "feat(studio): workspace shell with sidebar, channels, threads and timeline"
```

---

### Task 8: Composer (mensajes, opciones de modelo/esfuerzo/permisos y comandos con barra)

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/src/components/workspace/Composer.tsx` (+ `composer.spec.tsx`), `apps/studio/src/components/workspace/RunOutput.tsx`
- Modify: `apps/studio/src/components/workspace/{Workspace,ChannelView}.tsx`

**Interfaces:**
- Consumes: `parseSlash`, `PROMPT_COMMANDS`, `BridgeClient.request`, store `startRun`, `ThreadOptions`, `defaultThreadOptions`, `dmAgentOfChannel`.
- Produces: `<ComposerView mode onSubmit options onOptionsChange agentLocked agents error />` (presentacional, testeable) y `<Composer channelId threadId? onThreadCreated(id) />` (conectado). `onSubmit(text: string)`. Reglas: Enter envía, Shift+Enter nueva línea; esfuerzo deshabilitado con modelo `kit`; agente fijo en DMs y en hilos existentes; en hilo, cambiar opciones → `thread.setOptions`.

- [ ] **Step 1: Test del composer (falla)**

`apps/studio/src/components/workspace/composer.spec.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ComposerView } from './Composer';

function setup(extra: Partial<React.ComponentProps<typeof ComposerView>> = {}) {
  const onSubmit = vi.fn();
  const onOptionsChange = vi.fn();
  render(
    <I18nProvider initial="es">
      <ComposerView
        options={defaultThreadOptions()} onOptionsChange={onOptionsChange} onSubmit={onSubmit}
        agents={['sdd-orchestrator', 'sdd-planner']} agentLocked={false} error={null} {...extra}
      />
    </I18nProvider>,
  );
  return { onSubmit, onOptionsChange, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
}

describe('ComposerView', () => {
  it('sends on Enter, keeps Shift+Enter as newline and clears', () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: 'hola' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('hola');
    expect(box).toHaveValue('');
  });
  it('disables effort when the model is kit and enables it otherwise', () => {
    const { onOptionsChange } = setup();
    expect(screen.getByLabelText('Esfuerzo')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'opus' } });
    expect(onOptionsChange).toHaveBeenCalledWith({ model: 'opus', effort: 'medium' });
  });
  it('locks the agent selector in DMs', () => {
    setup({ agentLocked: true });
    expect(screen.getByLabelText('Agente')).toBeDisabled();
  });
  it('shows a composer error', () => {
    setup({ error: 'Comando desconocido: nope' });
    expect(screen.getByRole('alert')).toHaveTextContent('Comando desconocido: nope');
  });
});
```

- [ ] **Step 2: Implementación**

`apps/studio/src/components/workspace/Composer.tsx`:
```tsx
'use client';

import { PaperPlaneRight } from '@phosphor-icons/react';
import {
  DEFAULT_AGENT,
  defaultThreadOptions,
  dmAgentOfChannel,
  ThreadInfo,
  type Effort,
  type ModelChoice,
  type PermissionModeChoice,
  type ThreadOptions,
} from '@sdd-studio/protocol';
import { useMemo, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { parseSlash } from '@/lib/slash';
import { useBridge, useStudio } from '../BridgeProvider';

const MODELS: ModelChoice[] = ['kit', 'haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const PERMS: PermissionModeChoice[] = ['default', 'acceptEdits', 'plan'];

export interface ComposerViewProps {
  options: ThreadOptions;
  onOptionsChange(patch: Partial<ThreadOptions>): void;
  onSubmit(text: string): void;
  agents: string[];
  agentLocked: boolean;
  error: string | null;
}

export function ComposerView(p: ComposerViewProps) {
  const { t } = useT();
  const [text, setText] = useState('');
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    p.onSubmit(value);
    setText('');
  };
  const select = 'rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-40';
  return (
    <div className="border-t border-ink-800 p-3">
      {p.error && <p role="alert" className="mb-2 text-xs text-roseish">{p.error}</p>}
      <div className="rounded-xl border border-ink-700 bg-ink-900 focus-within:border-accent-500/60">
        <textarea
          className="block max-h-48 min-h-[44px] w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
          placeholder={t('composer.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 px-2 py-1.5">
          <label className="sr-only" htmlFor="composer-agent">{t('composer.agent')}</label>
          <select id="composer-agent" className={select} disabled={p.agentLocked} value={p.options.agent} onChange={(e) => p.onOptionsChange({ agent: e.target.value })}>
            {p.agents.map((a) => <option key={a} value={a}>{agentMeta(a).name}</option>)}
          </select>
          <label className="sr-only" htmlFor="composer-model">{t('composer.model')}</label>
          <select
            id="composer-model"
            className={select}
            value={p.options.model}
            onChange={(e) => {
              const model = e.target.value as ModelChoice;
              p.onOptionsChange(model === 'kit' ? { model, effort: null } : { model, effort: p.options.effort ?? 'medium' });
            }}
          >
            {MODELS.map((m) => <option key={m} value={m}>{m === 'kit' ? t('model.kit') : m}</option>)}
          </select>
          <label className="sr-only" htmlFor="composer-effort">{t('composer.effort')}</label>
          <select
            id="composer-effort"
            className={select}
            disabled={p.options.model === 'kit'}
            value={p.options.effort ?? ''}
            onChange={(e) => p.onOptionsChange({ effort: e.target.value as Effort })}
          >
            {p.options.model === 'kit' && <option value="">—</option>}
            {EFFORTS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <label className="sr-only" htmlFor="composer-perm">{t('composer.permission')}</label>
          <select id="composer-perm" className={select} value={p.options.permissionMode} onChange={(e) => p.onOptionsChange({ permissionMode: e.target.value as PermissionModeChoice })}>
            {PERMS.map((x) => <option key={x} value={x}>{t(`perm.${x}`)}</option>)}
          </select>
          <button aria-label={t('composer.send')} className="ml-auto rounded-md bg-accent-500 p-1.5 text-ink-950 hover:bg-accent-400" onClick={submit}>
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Composer({ channelId, threadId, onThreadCreated }: { channelId: string; threadId: string | null; onThreadCreated(id: string): void }) {
  const { t } = useT();
  const { client, store } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const threadInfo = useStudio((s) => (threadId ? s.threads[threadId]?.info ?? null : null));
  const dmAgent = dmAgentOfChannel(channelId);
  const [draft, setDraft] = useState<ThreadOptions>(() => defaultThreadOptions(dmAgent ?? DEFAULT_AGENT));
  const [error, setError] = useState<string | null>(null);
  const options = threadInfo?.options ?? { ...draft, agent: dmAgent ?? draft.agent };
  const agents = useMemo(() => {
    const ids = snapshot?.agents.map((a) => a.id) ?? [];
    return ids.includes(options.agent) ? ids : [options.agent, ...ids];
  }, [snapshot, options.agent]);

  const send = async (text: string) => {
    if (threadId) {
      await client.request({ cmd: 'thread.send', threadId, text });
    } else {
      const created = ThreadInfo.parse(await client.request({ cmd: 'thread.create', channelId, options, text }));
      onThreadCreated(created.id);
    }
  };

  const onSubmit = (text: string) => {
    setError(null);
    const action = parseSlash(text);
    const run = async () => {
      if (!action) return send(text);
      if (action.kind === 'error') {
        setError(action.reason === 'unknown' ? t('composer.unknownCommand', { name: action.name }) : t('composer.badArgs', { name: action.name }));
        return;
      }
      if (action.kind === 'run') {
        const { runId } = (await client.request({ cmd: 'command.run', name: action.name, args: action.args })) as { runId: string };
        store.getState().startRun({ runId, name: action.name, args: action.args });
        return;
      }
      const file = (await client.request({ cmd: 'workspace.readFile', path: action.path })) as { content: string };
      return send(action.args ? `${file.content}\n\n---\n${action.args}` : file.content);
    };
    void run().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const onOptionsChange = (patch: Partial<ThreadOptions>) => {
    if (threadId) {
      const { agent: _agent, ...allowed } = patch;
      void client.request({ cmd: 'thread.setOptions', threadId, options: allowed }).catch((e: unknown) => setError(String(e)));
    } else {
      setDraft((d) => ({ ...d, ...patch }));
    }
  };

  return (
    <ComposerView
      options={options}
      onOptionsChange={onOptionsChange}
      onSubmit={onSubmit}
      agents={agents}
      agentLocked={dmAgent !== null || threadId !== null}
      error={error}
    />
  );
}
```
`apps/studio/src/components/workspace/RunOutput.tsx`:
```tsx
'use client';

import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../BridgeProvider';

export function RunOutput() {
  const { t } = useT();
  const runs = useStudio((s) => s.runs);
  const list = Object.values(runs).slice(-3).reverse();
  if (list.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-ink-800 px-5 py-3">
      {list.map((run) => (
        <div key={run.runId} className="rounded-lg border border-ink-800 bg-ink-950">
          <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px] text-ink-300">
            <span>{t('run.title', { name: run.name, args: run.args.join(' ') })}</span>
            <span className={run.exitCode === null ? 'text-amberish' : run.exitCode === 0 ? 'text-accent-300' : 'text-roseish'}>
              {run.exitCode === null ? t('run.running') : t('run.exit', { code: run.exitCode })}
            </span>
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 font-mono text-[11px]">{run.output}</pre>
        </div>
      ))}
    </div>
  );
}
```
`Workspace.tsx`: pasar `composer={<><RunOutput /><Composer channelId={view.channelId} threadId={view.threadId} onThreadCreated={(threadId) => setView({ ...view, threadId })} /></>}` tanto a `ChannelView` como a `ThreadView` (con `key={view.channelId + ':' + (view.threadId ?? '')}` en el `Composer` para reiniciar el borrador al cambiar de canal).

- [ ] **Step 3: Verificación y commit**

Run: `pnpm --filter sdd-studio-web exec vitest run composer workspace && pnpm --filter sdd-studio-web typecheck` → PASS.
```bash
git add apps/studio/src/components
git commit -m "feat(studio): composer with model/effort/permission options and slash commands"
```

---

### Task 9: Panel derecho — Actividad y Detalles

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/src/components/workspace/RightPanel.tsx` (+ `rightpanel.spec.tsx`)
- Create: `apps/studio/src/lib/store/activity.ts` (+ `activity.spec.ts`)
- Modify: `apps/studio/src/components/workspace/Workspace.tsx`

**Interfaces:**
- Produces: `activityOf(threads: Record<string, ThreadState>, presence: Presence[]): ActivityEntry[]` con `interface ActivityEntry { threadId: string; title: string; status: SessionStatus; agents: { agent: string; state: Presence['state']; tool: string | null }[] }` (hilos `running` / `waiting-approval` / `queued`; agentes = presencia con ese `threadId`, el agente principal primero); `<RightPanelView activity cycle onOpenThread />`; `<RightPanel channelId onOpenThread />`.

- [ ] **Step 1: Tests (fallan)**

`apps/studio/src/lib/store/activity.spec.ts`:
```ts
import type { ThreadInfo } from '@sdd-studio/protocol';
import { activityOf } from './activity';
import { emptyThread } from './timeline';

const info = (id: string, status: ThreadInfo['status']): ThreadInfo => ({
  id, channelId: 'general', title: id, agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status, createdAt: 'a', lastActivity: 'a',
});

describe('activityOf', () => {
  it('lists busy threads with their agents, main agent first', () => {
    const threads = {
      a: { ...emptyThread(), info: info('a', 'running') },
      b: { ...emptyThread(), info: info('b', 'idle') },
    };
    const presence = [
      { agent: 'sdd-planner', state: 'working' as const, threadId: 'a', specId: null, tool: 'Read' },
      { agent: 'sdd-orchestrator', state: 'working' as const, threadId: 'a', specId: null, tool: null },
      { agent: 'sdd-reviewer', state: 'open' as const, threadId: 'b', specId: null, tool: null },
    ];
    expect(activityOf(threads, presence)).toEqual([
      {
        threadId: 'a', title: 'a', status: 'running',
        agents: [
          { agent: 'sdd-orchestrator', state: 'working', tool: null },
          { agent: 'sdd-planner', state: 'working', tool: 'Read' },
        ],
      },
    ]);
  });
});
```
`apps/studio/src/components/workspace/rightpanel.spec.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { RightPanelView } from './RightPanel';

describe('RightPanelView', () => {
  it('shows activity and the cycle checklist', () => {
    const onOpenThread = vi.fn();
    render(
      <I18nProvider initial="es">
        <RightPanelView
          activity={[{ threadId: 't', title: 'pagos v2', status: 'running', agents: [{ agent: 'sdd-implementor-back', state: 'working', tool: 'Edit' }] }]}
          cycle={{ specId: 's', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: ['apps/api'], tasksTotal: 2, tasksDone: 1, tasks: [
            { id: 'BE-001', title: 'Endpoint', status: 'done', storyPoints: 3 },
            { id: 'BE-002', title: 'Tests', status: 'in-progress', storyPoints: 2 },
          ] }}
          onOpenThread={onOpenThread}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Impl-back')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pagos v2/ }));
    expect(onOpenThread).toHaveBeenCalledWith('t');
  });
  it('shows empty states', () => {
    render(<I18nProvider initial="es"><RightPanelView activity={[]} cycle={null} onOpenThread={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('Nadie está trabajando ahora.')).toBeInTheDocument();
    expect(screen.getByText('Este canal no tiene un ciclo activo.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementación**

`apps/studio/src/lib/store/activity.ts`:
```ts
import type { Presence, SessionStatus } from '@sdd-studio/protocol';
import type { ThreadState } from './timeline';

export interface ActivityEntry {
  threadId: string;
  title: string;
  status: SessionStatus;
  agents: { agent: string; state: Presence['state']; tool: string | null }[];
}

const BUSY = new Set<SessionStatus>(['running', 'waiting-approval', 'queued']);

export function activityOf(threads: Record<string, ThreadState>, presence: Presence[]): ActivityEntry[] {
  return Object.values(threads).flatMap((t) => {
    const info = t.info;
    if (!info || !BUSY.has(info.status)) return [];
    const agents = presence
      .filter((p) => p.threadId === info.id && p.state !== 'idle')
      .map((p) => ({ agent: p.agent, state: p.state, tool: p.tool }))
      .sort((a, b) => Number(b.agent === info.agent) - Number(a.agent === info.agent));
    return [{ threadId: info.id, title: info.title, status: info.status, agents }];
  });
}
```
`apps/studio/src/components/workspace/RightPanel.tsx`:
```tsx
'use client';

import type { CycleSummary } from '@sdd-studio/protocol';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { activityOf, type ActivityEntry } from '@/lib/store/activity';
import { cycleForChannel } from '@/lib/store/selectors';
import { useStudio } from '../BridgeProvider';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';

const MARK: Record<string, string> = { done: '✓', 'in-progress': '▸', skipped: '–' };

export function RightPanelView({ activity, cycle, onOpenThread }: { activity: ActivityEntry[]; cycle: CycleSummary | null; onOpenThread(id: string): void }) {
  const { t } = useT();
  return (
    <aside className="flex h-full flex-col gap-6 overflow-y-auto border-l border-ink-800 bg-ink-900 p-4">
      <section>
        <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('panel.activity')}</h2>
        {activity.length === 0 && <p className="text-sm text-ink-300">{t('panel.noActivity')}</p>}
        <ul className="space-y-3">
          {activity.map((entry) => (
            <li key={entry.threadId} className="rounded-lg border border-ink-800 p-2">
              <button className="flex w-full items-center gap-2 text-left text-sm" onClick={() => onOpenThread(entry.threadId)}>
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <StatusBadge status={entry.status} />
              </button>
              <ul className="mt-2 space-y-1">
                {entry.agents.map((a) => (
                  <li key={a.agent} className="flex items-center gap-2 text-xs">
                    <AgentAvatar agent={a.agent} size={18} />
                    <span>{agentMeta(a.agent).name}</span>
                    {a.state === 'waiting' && <span className="text-amberish">⏸</span>}
                    {a.state === 'working' && <span className="animate-pulse text-accent-400">⟳</span>}
                    {a.tool && <span className="ml-auto font-mono text-ink-300">{a.tool}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('panel.details')}</h2>
        {!cycle ? (
          <p className="text-sm text-ink-300">{t('panel.noCycle')}</p>
        ) : (
          <div className="rounded-lg border border-ink-800 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{cycle.cycle}</span>
              <span className="text-xs text-ink-300">{cycle.flow} · {cycle.status}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-accent-400" style={{ width: `${cycle.tasksTotal ? (100 * cycle.tasksDone) / cycle.tasksTotal : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-300">{t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</p>
            {cycle.apps.length > 0 && <p className="mt-1 font-mono text-[11px] text-ink-500">{cycle.apps.join(', ')}</p>}
            <ul className="mt-3 space-y-1">
              {cycle.tasks.map((task) => (
                <li key={task.id} className="flex gap-2 text-xs">
                  <span className={task.status === 'done' ? 'text-accent-300' : task.status === 'in-progress' ? 'text-amberish' : 'text-ink-500'}>
                    {MARK[task.status] ?? '·'}
                  </span>
                  <span className="font-mono text-ink-300">{task.id}</span>
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </aside>
  );
}

export function RightPanel({ channelId, onOpenThread }: { channelId: string; onOpenThread(id: string): void }) {
  const threads = useStudio((s) => s.threads);
  const presence = useStudio((s) => s.presence);
  const snapshot = useStudio((s) => s.snapshot);
  const activity = useMemo(() => activityOf(threads, presence), [threads, presence]);
  return <RightPanelView activity={activity} cycle={cycleForChannel(snapshot, channelId)} onOpenThread={onOpenThread} />;
}
```
`Workspace.tsx`: reemplazar el `<aside>` vacío por
```tsx
      <RightPanel
        channelId={view.channelId}
        onOpenThread={(threadId) => {
          const channelId = store.getState().threads[threadId]?.info?.channelId ?? view.channelId;
          setView({ channelId, threadId });
        }}
      />
```
(obtener `store` con `useBridge()`).

- [ ] **Step 3: Verificación y commit**

Run: `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web build:local` → PASS.
```bash
git add apps/studio/src
git commit -m "feat(studio): right panel with live activity and cycle details"
```

---

### Task 10: E2E con Playwright contra el puente (`--engine fake --local-ui`)

**Tier:** `sonnet`.

**Files:**
- Create: `apps/studio/playwright.config.ts`, `apps/studio/e2e/start-bridge.mjs`, `apps/studio/e2e/studio.e2e.ts`
- Modify: `.github/workflows/ci.yml` (job `e2e`), `.github/workflows/release-studio.yml` (build de la web antes del puente)

**Interfaces:**
- Consumes: todo lo anterior; el build raíz (`pnpm build`) deja `apps/studio-bridge/dist/web`.

- [ ] **Step 1: Config y arranque del puente**

`apps/studio/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4399', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/start-bridge.mjs',
    url: 'http://127.0.0.1:4399/w/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```
`apps/studio/e2e/start-bridge.mjs`:
```js
// Copia el workspace de prueba del puente y arranca sdd-studio con el motor fake y la web local.
import { spawn } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE = path.resolve(here, '../.e2e-workspace');
const fixture = path.resolve(here, '../../studio-bridge/test/fixtures/workspace');
const bin = path.resolve(here, '../../studio-bridge/bin/sdd-studio.mjs');

await rm(WORKSPACE, { recursive: true, force: true });
await cp(fixture, WORKSPACE, { recursive: true });
const child = spawn(
  process.execPath,
  [bin, '--engine', 'fake', '--no-open', '--port', '4399', '--token', 'e2e-token-0123456789abcdef', '--local-ui', '--root', WORKSPACE],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
```

- [ ] **Step 2: Escenario e2e**

`apps/studio/e2e/studio.e2e.ts`:
```ts
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.e2e-workspace');
const TOKEN = 'e2e-token-0123456789abcdef';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sdd-studio:lang', 'es'));
});

test('pairs, chats with subagents, approves a tool, sees sdd-bot and runs /validate', async ({ page }) => {
  await page.goto(`/w/#bridge=4399&token=${TOKEN}`);
  await expect(page.getByText('studio fixture')).toBeVisible();
  await expect(page).toHaveURL(/\/w\/$/);

  await page.getByPlaceholder('Escribí un mensaje… (/ para comandos)').fill('hola #sub #tool');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Planner empezó a trabajar')).toBeVisible();
  await expect(page.getByText('planned')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText('Aprobado')).toBeVisible();
  await expect(page.getByText('echo: hola #sub #tool')).toBeVisible();

  const tasks = path.join(WORKSPACE, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');
  const json = JSON.parse(await readFile(tasks, 'utf8'));
  json.tasks[1].status = 'done';
  await writeFile(tasks, JSON.stringify(json));
  await page.getByRole('button', { name: /# spec-dev-001-pagos/ }).click();
  await expect(page.getByText(/TASK-BE-002 «Tests de pagos»: pending → done/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('2/2 tasks').first()).toBeVisible();

  await page.getByPlaceholder('Escribí un mensaje… (/ para comandos)').fill('/validate');
  await page.keyboard.press('Enter');
  await expect(page.getByText('validate ok')).toBeVisible();
  await expect(page.getByText('terminó con código 0')).toBeVisible();
});

test('reloading keeps the pairing from sessionStorage', async ({ page }) => {
  await page.goto(`/w/#bridge=4399&token=${TOKEN}`);
  await expect(page.getByText('studio fixture')).toBeVisible();
  await page.reload();
  await expect(page.getByText('studio fixture')).toBeVisible();
});

test('a wrong token shows the pairing error', async ({ page }) => {
  await page.goto('/w/#bridge=4399&token=wrong-token-0000000000');
  await expect(page.getByRole('alert')).toHaveText(/token/i);
});
```

- [ ] **Step 3: CI**

`.github/workflows/ci.yml`: agregar un job (sólo ubuntu):
```yaml
  e2e:
    name: studio e2e (playwright)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm --filter sdd-studio-web exec playwright install --with-deps chromium
      - run: pnpm --filter sdd-studio-web e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/studio/test-results
```
`.github/workflows/release-studio.yml`: en el step `Build`, usar `pnpm --filter sdd-studio-web build:local && pnpm --filter @e-burgos/sdd-studio build` (la web local viaja en `dist/web` del paquete).

- [ ] **Step 4: Verificación y commit**

Run: `pnpm build && pnpm --filter sdd-studio-web exec playwright install chromium && pnpm --filter sdd-studio-web e2e`
Expected: 3 tests PASS.
```bash
git add apps/studio .github/workflows
git commit -m "test(studio): playwright e2e against the fake-engine bridge"
```

---

### Task 11: Deploy a Cloudflare (OpenNext) y documentación

**Tier:** `haiku` (config + docs; contenido dado).

**Files:**
- Create: `apps/studio/open-next.config.ts`, `apps/studio/wrangler.jsonc`, `apps/studio/README.md`, `.github/workflows/deploy-studio.yml`
- Create: `apps/documentation/src/pages/StudioPage.tsx`; Modify: `apps/documentation/src/App.tsx` (registrar la ruta `#/studio` siguiendo el patrón de `ComoUsarloPage`: `useHashRoute`, enlace en la navegación)
- Modify: `README.md` raíz (sección breve "SDD Studio")

- [ ] **Step 1: OpenNext / Wrangler**

`apps/studio/open-next.config.ts`:
```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
```
`apps/studio/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "sdd-studio",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  // El dominio tiene que existir como zona en la misma cuenta de Cloudflare.
  "routes": [{ "pattern": "studio.sdd.estebanburgos.com.ar", "custom_domain": true }]
}
```
Run: `pnpm --filter sdd-studio-web build:worker`
Expected: genera `.open-next/worker.js` sin errores (no despliega).

- [ ] **Step 2: Workflow de deploy**

`.github/workflows/deploy-studio.yml`:
```yaml
name: Deploy Studio

on:
  push:
    branches: [main]
    paths:
      - 'apps/studio/**'
      - 'libs/studio-protocol/**'
      - '.github/workflows/deploy-studio.yml'
  workflow_dispatch:

concurrency:
  group: deploy-studio
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter sdd-studio-web test
      - run: pnpm --filter sdd-studio-web run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 3: README de la app**

`apps/studio/README.md`:
```markdown
# SDD Studio (web)

Interfaz estilo Slack para operar un repo con el kit SDD. Se conecta al puente local
[`@e-burgos/sdd-studio`](../studio-bridge) por WebSocket (127.0.0.1) y nunca ve credenciales.

## Desarrollo

```bash
pnpm --filter sdd-studio-web dev            # http://localhost:3100
node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open \
  --root apps/studio-bridge/test/fixtures/workspace --web-url http://localhost:3100
```

Abrí la URL que imprime el puente (`/w#bridge=…&token=…`).

## Builds

| Script | Resultado |
|---|---|
| `build` | `next build` (Worker vía OpenNext con `build:worker`) |
| `build:local` | export estático en `out/`; el build del puente lo copia a `dist/web` para `--local-ui` |
| `deploy` | OpenNext → Cloudflare Workers (`studio.sdd.estebanburgos.com.ar`) |

## Tests

`pnpm --filter sdd-studio-web test` (vitest) y `pnpm --filter sdd-studio-web e2e` (Playwright contra el puente con `--engine fake --local-ui`; requiere `pnpm build` antes).
```

- [ ] **Step 4: Página "Studio" en la documentación**

`apps/documentation/src/pages/StudioPage.tsx`: seguir la estructura de `ComoUsarloPage.tsx` (mismos componentes `Section`, `CopyCommand`, i18n con `useLang`/el patrón que use esa página) con este contenido:

- es — Título: "SDD Studio". Bajada: "Operá tu repo con el kit SDD desde una interfaz tipo Slack: chateá con el Orchestrator o con cada agente, mirá quién trabaja en vivo y aprobá cada acción." Secciones: **Cómo arrancar** (`npx @e-burgos/sdd-studio` en la raíz del repo; se abre la web emparejada); **Sin internet o con Safari** (`npx @e-burgos/sdd-studio --local-ui`); **Seguridad** (puerto sólo local, token por arranque, SPEC GATE y aprobaciones, la web nunca ve credenciales); **Autenticación** (login local de Claude Code o `ANTHROPIC_API_KEY`; aviso de Anthropic sobre login de suscripción en productos de terceros).
- en — mismas secciones traducidas.

Registrar la ruta `studio` en `App.tsx` como las otras subpáginas y agregar el enlace en la navegación. Verificar: `pnpm --filter sdd-harness-documentation build` → OK.

- [ ] **Step 5: README raíz**

Agregar en `README.md` raíz una sección "SDD Studio" de 3–5 líneas con el comando `npx @e-burgos/sdd-studio`, `--local-ui` y el enlace a `apps/studio/README.md`.

- [ ] **Step 6: Verificación y commit**

Run: `pnpm build && pnpm typecheck && pnpm test && pnpm --filter sdd-studio-web build:worker && pnpm --filter sdd-harness-documentation build`
Expected: PASS.
```bash
git add apps/studio apps/documentation README.md .github/workflows/deploy-studio.yml
git commit -m "chore(studio): Cloudflare deploy via OpenNext and docs page"
```

Pasos del dueño (no automatizables): confirmar que `studio.sdd.estebanburgos.com.ar` es una zona/ruta válida en la cuenta de Cloudflare y que `CLOUDFLARE_API_TOKEN` tiene permiso de Workers; el primer deploy corre al mergear a `main`.

---

## Después de este plan

- Revisión final de toda la rama (`opus`/`high`), con foco en el token (nunca persistido fuera de sessionStorage), el servidor estático del puente y la reconexión.
- Sub-proyecto C (paridad con el visor: Dashboard, Planning, Costos, Contexto, Memoria, Agentes/Skills/Prompts, Arquitectura, Ayuda) — reservado en la sidebar ("Vistas · Próximamente").
