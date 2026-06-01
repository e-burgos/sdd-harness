# @e-burgos/harness

> CLI to bootstrap AI-agent-ready Nx monorepos with SDD (Spec-Driven Development) methodology.

## Features

- **Interactive scaffolding** — guided prompts to configure your entire workspace
- **5 app types** — NestJS, React, Next.js, Fastify, Python
- **5 shared library types** — Types, Utils, UI Kit, API Client, Config
- **4 Docker services** — PostgreSQL, Redis, RabbitMQ, MinIO (with healthchecks)
- **SDD methodology** — built-in Spec-Driven Development agent infrastructure
- **MCP server configuration** — Nx, GitHub, Playwright, Figma, Notion, Filesystem
- **Config-as-code** — optional `harness.config.ts` with Zod validation
- **Incremental** — add apps, services, and skills to existing workspaces

## Installation

```bash
# Run directly with npx (recommended)
npx @e-burgos/harness init

# Or install globally
npm install -g @e-burgos/harness
harness init

# With pnpm
pnpm dlx @e-burgos/harness init
```

**Requirements:** Node.js ≥ 18

## Quick Start

```bash
$ npx @e-burgos/harness init

┌  harness init
│
◆  Project name (Nx workspace): my-saas
◆  Project description: Multi-tenant SaaS platform
◆  npm package scope: @my-saas
◆  Which apps do you want to create?
│  ◻ NestJS API
│  ◻ React SPA
│  ◻ Python Agent
◆  Name for nestjs app: api
◆  Name for react app: webapp
◆  Name for python app: worker
◆  Which shared libraries do you want?
│  ◻ Shared Types
│  ◻ Shared Utils
◆  Which Docker services do you need?
│  ◻ PostgreSQL
│  ◻ Redis
│
◇  Configuration Summary
│
│  Project: my-saas
│  Scope: @my-saas
│  Apps: api (nestjs), webapp (react), worker (python)
│  Libs: shared-types, shared-utils
│  Services: postgres, redis
│  SDD: enabled (always)
│
◆  Proceed with this configuration? Yes
│
└  Done! Your workspace is ready.
```

## Commands

### `harness init`

Initialize a new AI-agent-ready Nx monorepo from scratch.

```bash
harness init [--name <name>] [--config <path>] [-y|--yes]
```

| Flag        | Description                        |
| ----------- | ---------------------------------- |
| `--name`    | Project name, must be kebab-case   |
| `--config`  | Path to a `harness.config.ts` file |
| `-y, --yes` | Skip the confirmation prompt       |

**Interactive prompts:**

1. **Project name** — lowercase kebab-case identifier
2. **Description** — brief project description
3. **Package scope** — npm org scope (e.g. `@my-saas`)
4. **Apps** — multi-select from the app catalog
5. **App names** — name each selected app (with smart defaults)
6. **Libraries** — multi-select from the lib catalog
7. **Lib names** — name each selected library
8. **Docker services** — multi-select infrastructure services
9. **Confirmation** — review summary before generation

**What gets generated:**

```
my-saas/
├── apps/
│   ├── api/                    # NestJS app
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   └── app/
│   │   │       ├── app.module.ts
│   │   │       ├── app.controller.ts
│   │   │       └── app.service.ts
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.app.json
│   └── webapp/                 # React app
│       ├── src/
│       │   ├── main.tsx
│       │   └── app/app.tsx
│       ├── index.html
│       ├── vite.config.ts
│       ├── project.json
│       └── tsconfig.json
├── libs/
│   ├── shared-types/
│   │   ├── src/index.ts
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   └── shared-utils/
│       ├── src/index.ts
│       ├── project.json
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── tsconfig.spec.json
├── sdd/
│   ├── context/
│   │   ├── constitution.md
│   │   └── context_prompt.md
│   ├── agents/
│   │   ├── sdd-orchestrator.agent.md
│   │   └── ...
│   ├── prompts/
│   │   └── ...
│   ├── skills/
│   │   ├── sdd-orchestrator/SKILL.md
│   │   ├── generate-nestjs-module/SKILL.md
│   │   └── generate-react-component/SKILL.md
│   ├── global.json
│   ├── schema.json
│   ├── api.json
│   ├── components.json
│   └── tasks.json
├── docker-compose.yml
├── .env.example
├── AGENTS.md
├── SPEC.md
├── nx.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

### `harness add app`

Add a new application to an existing workspace.

```bash
harness add app [type] [--name <name>]
```

| Argument | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `type`   | (positional, optional) One of: `nestjs`, `react`, `nextjs`, `python`, `fastify` |
| `--name` | App name in kebab-case                                                          |

If arguments are omitted, interactive prompts will guide you.

```bash
# Interactive
harness add app

# Non-interactive
harness add app nestjs --name payments-api
```

---

### `harness add service`

Add a Docker service to the workspace. Automatically merges with existing services in `docker-compose.yml`.

```bash
harness add service [type]
```

| Argument | Description                                                             |
| -------- | ----------------------------------------------------------------------- |
| `type`   | (positional, optional) One of: `postgres`, `redis`, `rabbitmq`, `minio` |

- Detects services already in `docker-compose.yml` and excludes them from selection
- Regenerates the full `docker-compose.yml` with existing + new services
- Updates `.env.example` with relevant environment variables

```bash
# Interactive (shows only services not yet configured)
harness add service

# Direct
harness add service rabbitmq
```

---

### `harness add skill`

Create a new custom agent skill in `sdd/skills/`.

```bash
harness add skill [name]
```

| Argument | Description                                     |
| -------- | ----------------------------------------------- |
| `name`   | (positional, optional) Skill name in kebab-case |

Generates a `SKILL.md` template:

```bash
$ harness add skill data-import

✓ Skill created at sdd/skills/data-import/SKILL.md
```

Generated file (`sdd/skills/data-import/SKILL.md`):

```markdown
# data-import

Imports CSV/JSON data into the database

## Trigger

"Usá el skill data-import para [tarea]"

## Workflow

1. Leer contexto relevante del workspace
2. Ejecutar la tarea según las instrucciones
3. Validar el resultado

## Output

<!-- Describir qué genera este skill -->
```

---

### `harness configure docker`

Regenerate `docker-compose.yml` with a new selection of services. Replaces the entire file.

```bash
harness configure docker
```

Presents a multi-select with all 4 services, pre-selecting any already configured. Useful to remove services or start fresh.

---

### `harness configure sdd`

Configure or reset the SDD (Spec-Driven Development) agent infrastructure.

```bash
harness configure sdd
```

- Detects existing apps in `apps/` automatically
- If `sdd/global.json` already exists, asks for confirmation before resetting
- Regenerates: `sdd/*.json`, `AGENTS.md`, `CLAUDE.md`, `sdd/context/` and agents/skills/prompts

---

### `harness configure mcp`

Configure MCP (Model Context Protocol) servers for AI agent integration.

```bash
harness configure mcp
```

Presents a multi-select from the MCP catalog, pre-selecting any already in `.mcp.json`. Generates a `.mcp.json` file at workspace root.

**Available MCP servers:**

| Server       | Description              | Package                                   |
| ------------ | ------------------------ | ----------------------------------------- |
| `nx-mcp`     | Nx workspace tools       | `nx-mcp`                                  |
| `github`     | Issues, PRs, repos       | `@modelcontextprotocol/server-github`     |
| `playwright` | Browser automation       | `@playwright/mcp@latest`                  |
| `figma`      | Design file access       | `@anthropic/mcp-server-figma`             |
| `notion`     | Notion pages & databases | `@notionhq/mcp-server`                    |
| `filesystem` | File read/write ops      | `@modelcontextprotocol/server-filesystem` |

---

### `harness info`

Display workspace information at a glance.

```bash
harness info
```

Example output:

```
┌  harness info
│
◇  Project
│  Name: @my-saas/source
│  Scope: @my-saas
│  Version: 0.1.0
│
◇  Apps (2)
│    • api
│    • webapp
│
◇  Libs (2)
│    • shared-types
│    • shared-utils
│
◇  Docker Services (2)
│    • postgres
│    • redis
│
◇  SDD Status
│  Project: my-saas
│  Current Cycle: 1
│  Status: active
│  Completed: auth, users
│
│  ✓ Nx workspace detected
│
└
```

---

## App Catalog

| Type      | Default Name   | Framework            | Targets                  | Key Files Generated                                               |
| --------- | -------------- | -------------------- | ------------------------ | ----------------------------------------------------------------- |
| `nestjs`  | `api`          | NestJS 10+           | build, serve, lint, test | `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts` |
| `react`   | `webapp`       | React 19 + Vite      | build, serve, lint, test | `main.tsx`, `app.tsx`, `index.html`, `vite.config.ts`             |
| `nextjs`  | `web`          | Next.js (App Router) | build, serve, lint       | `app/layout.tsx`, `app/page.tsx`, `next.config.js`                |
| `fastify` | `api`          | Fastify + esbuild    | build, serve, lint       | `main.ts` with health endpoint                                    |
| `python`  | (same as type) | Python 3.11+         | serve, lint, test        | `__main__.py`, `pyproject.toml`, `tests/`                         |

## Lib Catalog

| Type           | Tags                             | Targets    | Description                   |
| -------------- | -------------------------------- | ---------- | ----------------------------- |
| `shared-types` | `scope:shared, type:types`       | lint       | TypeScript interfaces & DTOs  |
| `shared-utils` | `scope:shared, type:utils`       | lint, test | Helper functions & validators |
| `ui-kit`       | `scope:shared, type:ui`          | lint, test | Shared React components (JSX) |
| `api-client`   | `scope:shared, type:data-access` | lint, test | Typed HTTP client for backend |
| `config`       | `scope:shared, type:config`      | lint       | Env vars, constants, schemas  |

## Docker Services Catalog

| Service    | Image                          | Ports           | Environment Variables               | Healthcheck                    |
| ---------- | ------------------------------ | --------------- | ----------------------------------- | ------------------------------ |
| `postgres` | `postgres:16-alpine`           | `5432:5432`     | `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `pg_isready -U $POSTGRES_USER` |
| `redis`    | `redis:7-alpine`               | `6379:6379`     | —                                   | `redis-cli ping`               |
| `rabbitmq` | `rabbitmq:3-management-alpine` | `5672`, `15672` | `RABBITMQ_USER`, `RABBITMQ_PASS`    | `rabbitmq-diagnostics -q ping` |
| `minio`    | `minio/minio:latest`           | `9000`, `9001`  | `MINIO_USER`, `MINIO_PASSWORD`      | —                              |

All services include `restart: unless-stopped` and named volumes where applicable.

## SDD (Spec-Driven Development)

SDD is a methodology where every feature goes through a structured cycle of specialized AI agents before code is written. Harness generates the full infrastructure for this workflow.

### What Gets Generated

| File/Dir                 | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `AGENTS.md` / `CLAUDE.md`| Redirections to main context prompt        |
| `sdd/context/`           | Project constitution and context prompt    |
| `sdd/specs/`             | Standard numbered project specifications   |
| `sdd/global.json`        | Current cycle state and completed modules  |
| `sdd/schema.json`        | Database tables defined so far             |
| `sdd/api.json`           | API endpoints implemented                  |
| `sdd/components.json`    | Frontend components created                |
| `sdd/tasks.json`         | Technical tasks organized by cycle         |
| `sdd/skills/`            | Agent skill definitions                    |
| `sdd/agents/`            | Agent configurations                       |
| `sdd/prompts/`           | Prompts for starting/reviewing cycles      |

### The SDD Cycle

```
1. Orchestrator  → Reads SPEC.md, prepares cycle brief
2. Functional    → Generates user stories & requirements
3. Planner       → Creates estimated technical tasks
4. Architect     → Defines DB schema & API contracts
5. Implementor (Back)  → Implements backend code
6. Implementor (Front) → Implements frontend code
7. Reviewer      → Validates quality, closes cycle
```

### Generated Skills

- `sdd-orchestrator` — Starts and manages cycles
- `generate-nestjs-module` — Scaffolds NestJS modules
- `generate-react-component` — Scaffolds React pages/components

## Configuration File (`harness.config.ts`)

For repeatable setups, define a config file:

```typescript
import { defineConfig } from '@e-burgos/harness';

export default defineConfig({
  project: {
    name: 'my-saas',
    description: 'Multi-tenant SaaS platform',
    packageScope: '@my-saas',
  },
  apps: [
    { name: 'api', type: 'nestjs', port: 3000, features: [] },
    { name: 'webapp', type: 'react', port: 4200, features: [] },
    { name: 'worker', type: 'python', features: [] },
  ],
  services: [
    { type: 'postgres', port: 5432 },
    { type: 'redis', port: 6379 },
  ],
  sdd: {
    enabled: true,
    modules: ['auth', 'users', 'billing'],
    cycles: [
      { cycle: 1, modules: ['auth', 'users'], weeks: 2 },
      { cycle: 2, modules: ['billing'], weeks: 1 },
    ],
    skills: {
      include: ['sdd-*', 'generate-*', 'nx-*'],
      custom: ['data-import'],
    },
    agents: {
      instructionFile: 'AGENTS.md',
      claudeFile: 'CLAUDE.md',
      copilotInstructions: true,
    },
  },
  nx: {
    plugins: ['@nx/webpack', '@nx/vite', '@nx/eslint'],
    defaultProject: 'api',
  },
  infra: {
    provider: 'digitalocean',
  },
});
```

Then run:

```bash
harness init --config harness.config.ts
```

### Config Schema

The configuration is validated with Zod. Key constraints:

- `project.name` — non-empty string
- `project.packageScope` — must start with `@`
- `apps[].name` — lowercase kebab-case
- `apps[].type` — one of: `nestjs`, `react`, `nextjs`, `python`, `fastify`
- `services[].type` — one of: `postgres`, `redis`, `rabbitmq`, `minio`
- `services[].port` — between 1000 and 65535
- `infra.provider` — one of: `digitalocean`, `aws`, `gcp`, `vercel`, `railway`

## Contributing / Development

```bash
# Clone and install
git clone https://github.com/e-burgos/harness
cd harness
pnpm install

# Build
pnpm nx build harness

# Run locally (from monorepo root)
node dist/tools/harness/bin/harness.mjs init

# Run tests
pnpm nx test harness

# Lint
pnpm nx lint harness
```

### Adding a New Generator

1. Create `src/generators/<name>.generator.ts` with an exported async function
2. Wire it into `src/generators/index.ts`
3. If it needs a command, add to `src/commands/` and register in the CLI

### Adding a New Command

1. Create the command file using `defineCommand` from `citty`
2. Use `@clack/prompts` for interactive UX
3. Register in the appropriate parent command (root, `add`, or `configure`)

## License

MIT © [e-burgos](https://github.com/e-burgos)

````

### `harness configure`

Configure workspace features.

```bash
harness configure sdd      # Set up SDD methodology
harness configure mcp      # Configure MCP servers
harness configure docker   # Generate/update Docker Compose
````

### `harness info`

Display workspace information — detected stack, installed services, SDD status.

```bash
harness info
```

## Programmatic API

```typescript
import { defineConfig } from '@e-burgos/harness';

export default defineConfig({
  name: 'my-project',
  scope: '@my-org',
  apps: [
    { name: 'api', type: 'nestjs', port: 3000 },
    { name: 'webapp', type: 'react', port: 4200 },
  ],
  services: [
    { type: 'postgres', port: 5432 },
    { type: 'redis', port: 6379 },
  ],
  sdd: {
    enabled: true,
    cycles: [{ cycle: 1, modules: ['auth', 'users'] }],
  },
  infra: { provider: 'digitalocean' },
});
```

## What is SDD?

**Spec-Driven Development** is a methodology where AI agents follow a structured pipeline to implement features:

1. **Orchestrator** — reads the spec and prepares context
2. **Functional** — converts business goals into user stories
3. **Planner** — breaks stories into ordered technical tasks
4. **Architect** — defines DB schema and API contracts
5. **Implementor (Back)** — implements the backend (NestJS/Prisma)
6. **Implementor (Front)** — implements the frontend (React)
7. **Reviewer** — validates quality and closes the cycle

The harness configures your workspace so AI coding agents can operate autonomously within this pipeline.

## Requirements

- Node.js >= 18
- pnpm >= 9

## Tech Stack Generated

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React 19, Vite, Zustand, TanStack Query |
| Backend  | NestJS v10, Prisma v5, PostgreSQL 16    |
| Device   | Python 3.11 (optional)                  |
| Infra    | Docker Compose, DigitalOcean/AWS/GCP    |
| Monorepo | Nx, pnpm workspaces                     |

## License

MIT © [e-burgos](https://github.com/e-burgos)
