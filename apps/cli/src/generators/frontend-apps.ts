import { resolve } from "node:path";
import fs from "fs-extra";
import { appEnvPrefix, upstreamEnvVar } from "./app-types.js";

export interface SharedTypesLib {
  name: string;
  alias: string;
}

export interface MfeRef {
  name: string;
  port: number;
  portEnvVar: string;
}

const NEXT_BFF_DEFAULT_UPSTREAM = "http://localhost:3000/api/v1";

function render(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.split(`%${key}%`).join(value),
    template,
  );
}

async function write(path: string, content: string): Promise<void> {
  await fs.ensureDir(resolve(path, ".."));
  await fs.writeFile(path, content, "utf-8");
}

export async function applyNextBff(
  appDir: string,
  name: string,
  options: { tucuUi: boolean; sharedTypes?: SharedTypesLib },
): Promise<void> {
  const root = resolve(appDir, "../..");
  const typesImport = (fromAppRelative: string): string =>
    options.sharedTypes ? options.sharedTypes.alias : fromAppRelative;

  if (options.sharedTypes) {
    await exposeUpstreamHealthType(root, options.sharedTypes);
  } else {
    await write(resolve(appDir, "lib/types.ts"), UPSTREAM_HEALTH_TYPE);
  }

  await write(
    resolve(appDir, "lib/upstream.ts"),
    render(UPSTREAM_TS, {
      ENV: upstreamEnvVar(name),
      DEFAULT_URL: NEXT_BFF_DEFAULT_UPSTREAM,
    }),
  );

  await write(
    resolve(appDir, "app/api/health/route.ts"),
    render(HEALTH_ROUTE_TS, { TYPES: typesImport("../../../lib/types") }),
  );

  await write(
    resolve(appDir, "app/api/health/route.test.ts"),
    render(HEALTH_ROUTE_TEST_TS, { ENV: upstreamEnvVar(name) }),
  );

  await write(
    resolve(appDir, "app/upstream-health.tsx"),
    render(UPSTREAM_HEALTH_TSX, { TYPES: typesImport("../lib/types") }),
  );

  await write(
    resolve(appDir, "app/page.tsx"),
    render(options.tucuUi ? PAGE_TUCU_TSX : PAGE_PLAIN_TSX, {
      NAME: name,
      ENV: upstreamEnvVar(name),
    }),
  );

  await write(
    resolve(appDir, "vitest.config.ts"),
    `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
`,
  );

  const projectJsonPath = resolve(appDir, "project.json");
  const projectJson = await fs.readJSON(projectJsonPath);
  projectJson.targets = {
    ...projectJson.targets,
    test: {
      executor: "nx:run-commands",
      options: {
        command: `vitest run --passWithNoTests --coverage.reportsDirectory=../../coverage/apps/${name}`,
        cwd: `apps/${name}`,
      },
    },
  };
  await fs.writeJSON(projectJsonPath, projectJson, { spaces: 2 });
}

async function exposeUpstreamHealthType(
  root: string,
  lib: SharedTypesLib,
): Promise<void> {
  const libSrc = resolve(root, "libs", lib.name, "src");
  await write(resolve(libSrc, "lib/upstream-health.ts"), UPSTREAM_HEALTH_TYPE);
  const indexPath = resolve(libSrc, "index.ts");
  const exportLine = "export * from './lib/upstream-health';";
  const current = (await fs.pathExists(indexPath))
    ? await fs.readFile(indexPath, "utf-8")
    : "";
  if (current.includes(exportLine)) return;
  await fs.writeFile(
    indexPath,
    `${current.trimEnd()}\n${exportLine}\n`.replace(/^\n/, ""),
    "utf-8",
  );
}

export async function applyMfe(
  appDir: string,
  name: string,
  options: { tucuUi: boolean; shellName?: string },
): Promise<void> {
  const viteConfigPath = resolve(appDir, "vite.config.ts");
  if (await fs.pathExists(viteConfigPath)) {
    const content = await fs.readFile(viteConfigPath, "utf-8");
    await fs.writeFile(
      viteConfigPath,
      content.replace(/base:\s*[^,\n]+,/, `base: '/${name}/',`),
      "utf-8",
    );
  }

  if (!options.tucuUi) return;

  await write(
    resolve(appDir, "src/app/app.tsx"),
    render(MFE_APP_TSX, { NAME: name }),
  );
}

export async function applyMfeShell(
  appDir: string,
  name: string,
  mfes: MfeRef[],
  options: { tucuUi: boolean },
): Promise<void> {
  const viteConfigPath = resolve(appDir, "vite.config.ts");
  if (await fs.pathExists(viteConfigPath)) {
    const content = await fs.readFile(viteConfigPath, "utf-8");
    await fs.writeFile(viteConfigPath, withMfeProxy(content, mfes), "utf-8");
  }

  await write(resolve(appDir, "nginx.conf"), shellNginxConf(mfes));
  await write(resolve(appDir, "Dockerfile"), shellDockerfile(name, mfes));
  await write(resolve(appDir, "README.md"), shellReadme(name, mfes));

  if (options.tucuUi) {
    await write(
      resolve(appDir, "src/app/app.tsx"),
      render(SHELL_APP_TUCU_TSX, {
        NAME: name,
        MFES: JSON.stringify(
          mfes.map((mfe) => ({ name: mfe.name, label: mfe.name })),
          null,
          2,
        ),
      }),
    );
    await write(resolve(appDir, "src/pages/MfeRedirect.tsx"), MFE_REDIRECT_TSX);
  } else {
    await write(
      resolve(appDir, "src/app/app.tsx"),
      render(SHELL_APP_PLAIN_TSX, {
        MFES: JSON.stringify(mfes.map((mfe) => mfe.name)),
      }),
    );
  }
}

function withMfeProxy(viteConfig: string, mfes: MfeRef[]): string {
  const entries = mfes
    .map(
      (mfe) => `  '/${mfe.name}/': {
    target: \`http://localhost:\${process.env['${mfe.portEnvVar}'] ?? ${mfe.port}}\`,
    changeOrigin: true,
    ws: true,
  },`,
    )
    .join("\n");
  const proxyConst = `const mfeProxy = {\n${entries}${entries ? "\n" : ""}};\n\n`;
  return viteConfig
    .replace(/export default defineConfig\(/, `${proxyConst}export default defineConfig(`)
    .replace(/(server:\s*\{[^}]*?)host:\s*'localhost'\s*\}/, "$1host: 'localhost', proxy: mfeProxy }");
}

function shellNginxConf(mfes: MfeRef[]): string {
  const locations = mfes
    .map(
      (mfe) => `
    location /${mfe.name}/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /${mfe.name}/ {
        try_files $uri $uri/ /${mfe.name}/index.html;
    }
`,
    )
    .join("");
  return `server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;
${locations}
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
`;
}

function shellDockerfile(name: string, mfes: MfeRef[]): string {
  const projects = [name, ...mfes.map((mfe) => mfe.name)].join(",");
  const copies = mfes
    .map(
      (mfe) =>
        `COPY --from=builder /workspace/dist/apps/${mfe.name} /usr/share/nginx/html/${mfe.name}`,
    )
    .join("\n");
  return `FROM node:20-alpine AS builder
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec nx run-many -t build -p ${projects} --configuration=production

FROM nginx:1.27-alpine

COPY apps/${name}/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/dist/apps/${name} /usr/share/nginx/html
${copies}

EXPOSE 80

HEALTHCHECK CMD wget -q --spider http://localhost/ || exit 1
`;
}

function shellReadme(name: string, mfes: MfeRef[]): string {
  const table = mfes.length
    ? mfes
        .map(
          (mfe) =>
            `| \`${mfe.name}\` | \`/${mfe.name}/\` | \`${mfe.portEnvVar}\` (default ${mfe.port}) |`,
        )
        .join("\n")
    : "| (none yet) | | |";
  const env = appEnvPrefix(name);
  return `# ${name} (mfe-shell)

Shell of a path-based microfrontend setup (no Module Federation): each \`mfe\` app is an
independent Vite build served under \`/<mfe>/\`; this shell links to them from its menu.

| mfe | Path | Dev port |
| --- | --- | --- |
${table}

## Development

Run the shell and every mfe it lists (\`pnpm nx serve <app>\`). The shell's Vite dev server
(\`server.proxy\` in \`vite.config.ts\`) forwards \`/<mfe>/\` to each mfe's dev server, so the whole
site is reachable on the shell's port (\`${env}_PORT\`). Override an mfe port with its
\`<MFE>_PORT\` variable.

## Production

\`nginx.conf\` serves the shell at \`/\` and each mfe's static build at \`/<mfe>/\`
(\`try_files\` falls back to \`/<mfe>/index.html\`). The \`Dockerfile\` builds the shell and all its
mfes and copies each \`dist/apps/<mfe>\` into \`/usr/share/nginx/html/<mfe>/\`:

\`\`\`bash
docker build -f apps/${name}/Dockerfile -t ${name} .
\`\`\`

To serve an mfe from another origin instead, replace its \`location /<mfe>/\` block with a
\`proxy_pass\` to that origin.

Adding an mfe: declare it in \`harness.config.json\` with \`"type": "mfe", "shell": "${name}"\`,
then regenerate or update this app's menu, proxy, \`nginx.conf\` and \`Dockerfile\`.
`;
}

const UPSTREAM_HEALTH_TYPE = `export interface UpstreamHealth {
  status: string;
  timestamp?: string;
}
`;

const UPSTREAM_TS = `const DEFAULT_UPSTREAM_URL = '%DEFAULT_URL%';

export function upstreamBaseUrl(): string {
  return (process.env['%ENV%'] ?? DEFAULT_UPSTREAM_URL).replace(/\\/+$/, '');
}

export function upstreamUrl(path: string): string {
  return \`\${upstreamBaseUrl()}/\${path.replace(/^\\/+/, '')}\`;
}
`;

const HEALTH_ROUTE_TS = `import type { UpstreamHealth } from '%TYPES%';
import { upstreamUrl } from '../../../lib/upstream';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(upstreamUrl('/health'), { cache: 'no-store' });
    const body = (await upstream.json()) as UpstreamHealth;
    return Response.json(body, { status: upstream.status });
  } catch {
    const unreachable: UpstreamHealth = { status: 'unreachable' };
    return Response.json(unreachable, { status: 502 });
  }
}
`;

const HEALTH_ROUTE_TEST_TS = `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  beforeEach(() => {
    process.env['%ENV%'] = 'http://upstream.test/api/';
  });

  afterEach(() => {
    delete process.env['%ENV%'];
    vi.unstubAllGlobals();
  });

  it('proxies the upstream health payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: 'ok' }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://upstream.test/api/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers 502 when the upstream is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ status: 'unreachable' });
  });
});
`;

const UPSTREAM_HEALTH_TSX = `'use client';

import { useEffect, useState } from 'react';
import type { UpstreamHealth } from '%TYPES%';

export function UpstreamHealthStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json() as Promise<UpstreamHealth>)
      .then((body) => setStatus(body.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return <strong>{status}</strong>;
}
`;

const PAGE_TUCU_TSX = `import { Card } from '@e-burgos/tucu-ui';
import { UpstreamHealthStatus } from './upstream-health';

export default function Home() {
  return (
    <div className="space-y-6">
      <Card
        title="%NAME%"
        description="Backend for frontend: app/api/* route handlers call the service at %ENV%."
      >
        <p>
          Upstream health: <UpstreamHealthStatus />
        </p>
      </Card>
    </div>
  );
}
`;

const PAGE_PLAIN_TSX = `import { UpstreamHealthStatus } from './upstream-health';

export default function Home() {
  return (
    <main>
      <h1>Welcome to %NAME%</h1>
      <p>
        Upstream health (%ENV%): <UpstreamHealthStatus />
      </p>
    </main>
  );
}
`;

const MFE_APP_TSX = `import { LucideIcons, ThemeProvider } from '@e-burgos/tucu-ui';
import { HomePage } from '../pages/HomePage';

const basePath = '/%NAME%';

const menuItems = [
  {
    name: 'Home',
    path: basePath,
    icon: <LucideIcons.LayoutDashboard />,
  },
  {
    name: 'Shell',
    path: '/',
    href: '/',
    icon: <LucideIcons.Home />,
  },
];

const appRoutesConfig = [
  { key: 'home', path: basePath, element: <HomePage /> },
];

export function App() {
  return (
    <ThemeProvider
      architecturalPatterns="mfe"
      basePath={basePath}
      appRoutesConfig={appRoutesConfig}
      logo={{ name: '%NAME%' }}
      layout="minimal"
      brandColor="Blue"
      menuItems={menuItems}
      isAuthenticated
      loginUrl="/"
    />
  );
}
`;

const SHELL_APP_TUCU_TSX = `import { LucideIcons, ThemeProvider } from '@e-burgos/tucu-ui';
import { HomePage } from '../pages/HomePage';
import { MfeRedirect } from '../pages/MfeRedirect';

const mfes: Array<{ name: string; label: string }> = %MFES%;

const menuItems = [
  {
    name: 'Home',
    path: '/',
    icon: <LucideIcons.LayoutDashboard />,
    component: <HomePage />,
  },
  ...mfes.map((mfe) => ({
    name: mfe.label,
    path: \`/\${mfe.name}\`,
    href: \`/\${mfe.name}/\`,
    icon: <LucideIcons.LayoutDashboard />,
    component: <MfeRedirect href={\`/\${mfe.name}/\`} />,
  })),
];

export function App() {
  return (
    <ThemeProvider
      logo={{ name: '%NAME%' }}
      layout="minimal"
      brandColor="Blue"
      menuItems={menuItems}
      isAuthenticated
    />
  );
}
`;

const MFE_REDIRECT_TSX = `import { useEffect } from 'react';

export function MfeRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return null;
}
`;

const SHELL_APP_PLAIN_TSX = `import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';

const mfes: string[] = %MFES%;

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <nav>
        {mfes.map((name) => (
          <a key={name} href={\`/\${name}/\`}>
            {name}
          </a>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
`;
