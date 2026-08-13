# @e-burgos/sdd-harness

> CLI to bootstrap AI-agent-ready repos with SDD (Spec-Driven Development) methodology.

## Three modes

| Mode             | Command                        | What you get                                                                 |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| **Nx monorepo**  | `harness init` → "Nx monorepo" | Full Nx workspace (`apps/`, `libs/`, `tools/`) + SDD system                   |
| **Standalone**   | `harness init --standalone`    | ONE app with its code at the repo root (no Nx) + SDD system                   |
| **SDD harness**  | `harness configure sdd`        | Only the SDD system + dual harness installed on an **existing** project       |

In standalone (and existing non-monorepo) repos, the project registers itself in the SDD
registries as a single logical app `apps/<name>` — the schemas keep their strict patterns,
every gate works unchanged, and the convention is documented in the generated subproject context.

## Features

- **Interactive scaffolding** — guided prompts to configure your entire workspace
- **7 app types** — NestJS, React, Next.js, Fastify, Hono, Spring Boot 3, Python
- **5 shared library types** — Types, Utils, UI Kit, API Client, Config
- **4 Docker services** — PostgreSQL, Redis, RabbitMQ, MinIO (with healthchecks)
- **Portable SDD system** — the full Spec-Driven Development kit (7 agents, 16+ skills, gate prompts, strict JSON Schemas, validator scripts, docs viewer and scaffolding blueprints) copied verbatim; `sdd/global.json` is the single source of truth for project identity
- **Dual harness via symlinks** — `pnpm setup:agents` exposes agents/skills/prompts to Claude Code and GitHub Copilot from a single source
- **MCP server configuration** — Nx, GitHub, Playwright, Figma, Notion, Filesystem
- **Config-as-code** — optional `harness.config.ts` with Zod validation
- **Incremental** — add apps, services, and skills to existing workspaces
- **3-phase NX bootstrap** — installs and initializes NX before generating any app or lib

## Installation

```bash
# Run directly with npx (recommended)
npx @e-burgos/sdd-harness init

# Or install globally
npm install -g @e-burgos/sdd-harness
harness init

# With pnpm
pnpm dlx @e-burgos/sdd-harness init
```

**Requirements:** Node.js ≥ 18

## Quick Start

```bash
$ npx @e-burgos/sdd-harness init

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

> **Running the CLI from an agent or from CI.** Every prompt has a flag, so the whole CLI is
> driveable without a TTY. This is not a convenience: an interactive prompt cannot be answered
> through stdin — @clack appends piped text to the initial value and never submits, so a
> command missing a flag **hangs** instead of failing. Pass the flags, and reach for
> `harness <command> --help` to see the ones you are missing.
>
> | Command             | Unattended form                                                                 |
> | ------------------- | -------------------------------------------------------------------------------- |
> | `init`              | `--config <path>` (the whole wizard as a validated file)                          |
> | `add app`           | `<type> --name <name>`                                                            |
> | `add spec`          | `<slug> --author <user> --title <text> --app apps/<name>`                         |
> | `add skill`         | `<name> --description <text>`                                                     |
> | `add service`       | `<type>`                                                                          |
> | `configure sdd`     | `--name <project> --description <text>` (plus `-y` only to reset an existing kit) |
> | `configure docker`  | `--services postgres,redis`                                                       |
> | `configure mcp`     | `--servers <a,b>`                                                                 |
> | `configure memory`  | `--providers <a,b>`                                                               |
> | `update sdd`        | `-y`                                                                              |
> | `idea`              | `"<text>" [--force]`                                                              |

### `harness init`

Initialize a new AI-agent-ready repo from scratch — Nx monorepo or standalone app.

```bash
harness init [--name <name>] [--mode nx|standalone] [--standalone] [--config <path>] [-y|--yes]
```

| Flag           | Description                                 |
| -------------- | ------------------------------------------- |
| `--name`       | Project name, must be kebab-case            |
| `--mode`       | `nx` (monorepo) or `standalone` (root app)  |
| `--standalone` | Shortcut for `--mode standalone`            |
| `--config`     | Config file (`.json`, `.mjs`, `.js`) — fully non-interactive, agent/CI-friendly |
| `-y, --yes`    | Skip the confirmation prompt                |

**Interactive prompts (Nx monorepo):**

1. **Project name** — lowercase kebab-case identifier
2. **Description** — brief project description
3. **Mode** — Nx monorepo | Standalone app (skipped if `--mode`/`--standalone` given)
4. **Package scope** — npm org scope (e.g. `@my-saas`)
5. **Apps** — multi-select from the app catalog
6. **App names** — name each selected app (with smart defaults)
7. **Libraries** — multi-select from the lib catalog
8. **Lib names** — name each selected library
9. **Docker services** — multi-select infrastructure services
10. **Confirmation** — review summary before generation

**Interactive prompts (standalone):** project name → description → ONE app type → Docker services → confirmation. The app code lands at the repo root (no `apps/`, no `nx.json`): react and springboot come from the kit blueprints root-ified; nestjs uses `@nestjs/cli`, nextjs plain Next, fastify/hono run with `tsx` + `tsc`, python ships `pyproject.toml`. The root `package.json` always carries the `sdd:*` harness scripts (for Java/Python it exists solely for the harness plus `mvn`/`pytest` convenience scripts).

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
│   │   ├── sdd-orchestrator/skill.md
│   │   ├── generate-nestjs-module/skill.md
│   │   └── generate-react-component/skill.md
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

### `harness idea`

The single entry point of the hermes end-to-end flow: persist a product idea in natural
language and scaffold everything an AI agent needs to take it to product.

```bash
harness idea "una app para gestionar turnos de peluquería" [--force]
```

What it writes (never overwrites without `--force`):

- `harness.idea.md` — the idea verbatim + the protocol to follow (discovery → stack →
  specs → SDD cycle loop, with the human checkpoints marked).
- On an empty repo it also writes `harness.config.json` (stub for `init --config`) and
  `harness.config.schema.json` (JSON Schema so the agent validates the config it fills).
- Inside an existing SDD workspace it writes only the idea file, with the gap-analysis
  protocol (`harness add app|service|spec`) instead of `init`.

The intelligence lives in the kit's `sdd-hermes` skill — this command just materializes
the deterministic entry point for it.

### `harness config schema`

Print (or write) the JSON Schema of the `init --config` contract, derived from the same
zod schema the CLI validates with — agents and editors can validate a config without
running the CLI.

```bash
harness config schema                                  # stdout
harness config schema --out harness.config.schema.json # file
```

### `harness add app`

Add a new application to an existing workspace.

```bash
harness add app [type] [--name <name>]
```

| Argument | Description                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `type`   | (positional, optional) One of: `nestjs`, `react`, `nextjs`, `python`, `fastify`, `hono`, `springboot` |
| `--name` | App name in kebab-case                                                                                |

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
harness add skill [name] [--description <text>]
```

| Argument        | Description                                     |
| --------------- | ----------------------------------------------- |
| `name`          | (positional, optional) Skill name in kebab-case |
| `--description` | Skill description — skips the prompt            |

Generates a `skill.md` template:

```bash
$ harness add skill data-import

✓ Skill created at sdd/skills/data-import/skill.md
```

Generated file (`sdd/skills/data-import/skill.md`):

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

> Skills are written as `skill.md` (lowercase) — Linux checkouts are case-sensitive and the SDD kit resolves the lowercase name. Run `pnpm sdd:rebuild-catalog` afterwards so the docs viewer picks it up.

---

### `harness add spec`

Create a new SDD specification with the v2.0 multi-developer structure.

```bash
harness add spec [slug] [--author <gh-user>] [--title <text>] [--app <apps/name>]
```

Creates `sdd/specs/spec-[author]-[NNN]-[slug]/` (spec file + `cycles/` + `fixes/`), computes the per-author `NNN` counter, registers the entry in `sdd/specs/index.json` and runs `sdd:validate`.

| Argument   | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| `slug`     | (positional, optional) Spec slug in kebab-case                               |
| `--author` | GitHub username — the per-author counter keys off this                       |
| `--title`  | Spec title — skips the prompt, defaults to the slug                          |
| `--app`    | Main subproject affected, `(apps\|libs\|tools)/<name>` — SPEC GATE needs it   |

```bash
$ harness add spec user-onboarding --author jdoe --title "User onboarding" --app apps/core-api
# → sdd/specs/spec-jdoe-001-user-onboarding/spec-jdoe-001-user-onboarding.spec.md
```

---

### `harness update sdd`

Update the installed SDD kit to the version bundled with the CLI — **preserving everything that
is yours**. Works identically in the three modes.

```bash
npx @e-burgos/sdd-harness@latest update sdd [-y]
```

How it decides, file by file (against the hash baseline in `sdd/kit.json`, written at install):

| Situation                                        | Action                                         |
| ------------------------------------------------ | ---------------------------------------------- |
| Kit file you never touched, new kit changed it   | Replaced with the new version                  |
| Kit file you modified, kit did not change it     | Kept as-is                                     |
| Kit file you modified AND the kit changed it     | Yours is kept; new version lands as `<file>.new` + conflict report |
| File you added (custom skills, etc.)             | Never touched                                  |
| Your data (`global.json`, `specs/`, `fixes/`, `context/**`, registries) | **Never touched, ever**  |

Then it re-merges the `sdd:*` scripts into `package.json`, refreshes the harness symlinks
(`setup:agents`, so new skills become visible), regenerates `catalog.json` and runs
`sdd:validate` — if new schemas are stricter than your existing registries, the report tells you
exactly what to migrate.

Installations made before the manifest existed run a one-time **conservative mode** (asks for
confirmation): pure kit dirs are replaced, hybrids (`dual-harness/`, global
`constitution.md`/`context_prompt.md`) are never overwritten, and the manifest is written so the
next update is surgical.

---

### `harness configure docker`

Regenerate `docker-compose.yml` with a new selection of services. Replaces the entire file.

```bash
harness configure docker [--services postgres,redis,rabbitmq,minio]
```

Presents a multi-select with all 4 services, pre-selecting any already configured. Useful to remove services or start fresh. With `--services` it runs unattended; unknown values fail with the valid list.

---

### `harness configure sdd`

Configure or reset the SDD (Spec-Driven Development) agent infrastructure.

```bash
harness configure sdd [--name <project>] [--description <text>] [-y]
```

| Argument        | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `--name`        | Project name — skips the prompt (defaults to `package.json` name or the directory) |
| `--description` | Project description — skips the prompt                                             |
| `-y`, `--yes`   | Skip the reset confirmation. **Destructive** when `sdd/` already exists            |

- **Shape detection**: Nx monorepo (`nx.json`/`apps/`) → registers every app in `apps/`; otherwise the repo registers as a single logical app (standalone convention). App types are inferred from stack markers (`pom.xml`, `nest-cli.json`, `vite.config.ts`, ...)
- **Automatic `package.json` merge**: injects the `sdd:*` + `setup:agents` scripts and `ajv`/`ajv-formats` devDependencies without touching your existing scripts — and creates a minimal `package.json` if the repo has none (pure Java/Python repos)
- **Absorbs your existing `AGENTS.md`/`CLAUDE.md`**: their content is preserved under an "Instrucciones previas del proyecto" section inside `sdd/dual-harness/` before the root files become symlinks — nothing is lost
- If `sdd/global.json` already exists, asks for confirmation before resetting the whole `sdd/` directory (or warns and proceeds with `-y`)
- After install: run `pnpm install` (so `sdd:validate` finds ajv) and fill the `[...]` markers in `sdd/context/`

---

### `harness configure mcp`

Configure MCP (Model Context Protocol) servers for AI agent integration.

```bash
harness configure mcp [--servers <a,b,c>]
```

Presents a multi-select from the MCP catalog, pre-selecting any already in `.mcp.json`. Generates a `.mcp.json` file at workspace root. `--servers` takes catalog keys and runs unattended.

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

### `harness configure memory`

Opt-in memory providers (MCP) **on top of** the kit's portable base layer. The base —
`sdd/memory/lessons.md` + `sdd/memory/journal/` (MEMORIA GATE) — is plain versioned
files and needs no runtime; these providers add optional semantic retrieval.

```bash
harness configure memory [--providers <a,b,c>]
```

Merges into `.mcp.json` without touching other configured MCP servers (deselecting a
provider removes only that provider). `--providers` takes catalog keys and runs
unattended. No API keys, no paid services:

| Provider          | What it adds                              | Runtime            |
| ----------------- | ----------------------------------------- | ------------------ |
| `basic-memory`    | Markdown notes + wikilinks, local-first   | `uvx basic-memory` |
| `knowledge-graph` | Entity/relation graph persisted **inside the repo** at `sdd/memory/knowledge-graph.json` | `npx @modelcontextprotocol/server-memory` |

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

| Type         | Default Name | Framework                  | NX Plugin    | Targets                                               | Key Files Generated                                                       |
| ------------ | ------------ | -------------------------- | ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `nestjs`     | `api`        | NestJS 10+                 | `@nx/nest`   | build, serve, lint, test                              | `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`         |
| `react`      | `webapp`     | React 19 + Vite (blueprint `react-app`) | `@nx/react`  | build, serve, lint, test                 | `main.tsx`, `app/` + `pages/` with react-router, `vite.config.ts`, `Dockerfile`, `nginx.conf` |
| `nextjs`     | `web`        | Next.js (App Router)       | `@nx/next`   | build, serve, lint                                    | `app/layout.tsx`, `app/page.tsx`, `next.config.js`                        |
| `fastify`    | `api`        | Fastify + esbuild          | `@nx/node`   | build, serve, lint                                    | `main.ts` with health endpoint                                            |
| `hono`       | `api`        | Hono 4 + @hono/node-server | `@nx/node`   | build, serve, lint, test                              | `main.ts`, `vite.config.ts`, tsconfig files                               |
| `springboot` | `service`    | Spring Boot 3.5 + Java 21 (blueprint `java-api`) | — (Maven vía `nx:run-commands`) | build, test, serve, lint, coverage | Hexagonal architecture (`domain/`, `infrastructure/`), `pom.xml`, `Dockerfile` |
| `python`     | (same)       | Python 3.11+               | —            | serve, lint, test                                     | `__main__.py`, `pyproject.toml`, `tests/`                                 |

> **Spring Boot**: el blueprint `sdd/templates/apps/java-api` integra Maven a Nx vía `nx:run-commands` (`build`/`test`/`serve`/`lint`/`coverage` → `mvn`): la app queda visible para `nx affected` y `nx run-many` sin plugin de Gradle/Maven. Requiere Java 21 y Maven instalados.
> **Hono**: usa `@nx/vite:build` en modo librería con `target: node18`. Las dependencias `hono` y `@hono/node-server` se añaden a `dependencies` del workspace.

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

SDD is a methodology where every feature goes through a structured cycle of specialized AI agents before code is written. Harness installs the **portable SDD kit** verbatim from `templates/sdd/` — the same folder documented by its own `sdd/README.md`, `sdd/INSTALL.md` and `sdd/HOW-TO-USE-SDD.md` once installed.

The kit is portable by design: **`sdd/global.json` is the single source of truth for the project name and description**. No other kit file hardcodes them, and `pnpm sdd:validate` fails if they leak. That is what allows the CLI to copy the kit without rendering templates.

### What Gets Generated

| File/Dir                  | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `sdd/global.json`         | Central project state (name, description, modules) — single source of truth |
| `sdd/context/`            | Global constitution + context prompt (with `[...]` markers to fill)      |
| `sdd/context/apps\|libs/` | Per-subproject context (constitution, context prompt, additive `updates/`) |
| `sdd/specs/`              | Spec registry (`index.json`) + one folder per spec with its cycles/fixes |
| `sdd/schemas/`            | Strict JSON Schemas for every registry (`additionalProperties: false`)   |
| `sdd/schema.json` / `api.json` / `components.json` / `fixes.json` / `tasks.json` | State registries, all schema-validated |
| `sdd/agents/`             | The 7 SDD cycle agents                                                   |
| `sdd/skills/`             | 16+ skills (cycle, scaffold-nx, init-nx-workspace, code generators)      |
| `sdd/prompts/`            | Gate prompts (SPEC GATE, FIX GATE, start/review cycle)                   |
| `sdd/templates/`          | Scaffolding blueprints: nx-workspace, java-api, react-app, ts-lib        |
| `sdd/scripts/`            | `validate-sdd.mjs`, `rebuild-tasks-index.mjs`, `rebuild-catalog.mjs`, `setup-agents` |
| `sdd/docs/`               | Zero-dependency docs viewer (`pnpm sdd:docs`) — includes the **Costos** dashboard (agentic vs traditional cost) and live auto-refresh on registry changes |
| `sdd/memory/`             | Portable self-learning layer: `lessons.md` (distilled, read every session) + `journal/` (episodic, MEMORIA GATE) |
| `sdd/pricing.json`        | Editable rates feeding the Costos dashboard (hourly rate + $/MTok per model tier) |
| `sdd/dual-harness/`       | Source of truth for root `AGENTS.md` / `CLAUDE.md`                       |
| `AGENTS.md` / `CLAUDE.md` | **Symlinks** to `sdd/dual-harness/` (created by `pnpm setup:agents`)     |
| `.claude/` / `.github/`   | Symlinks exposing agents, skills and prompts to Claude Code & Copilot    |
| `.nxignore`               | Keeps `sdd/templates` blueprints out of the Nx project graph             |

The root `package.json` ships the kit scripts: `setup:agents`, `sdd:docs`, `sdd:validate`, `sdd:rebuild-tasks-index`, `sdd:rebuild-catalog` (plus `ajv`/`ajv-formats` as devDependencies for the validator).

### The SDD Cycle

```
1. Orchestrator  → Validates SPEC GATE, creates brief.yaml + cycle.json
2. Functional    → Generates user stories & requirements     ┐
3. Planner       → Creates cycle tasks.json + planner.md     ├ (parallel)
4. Architect     → Defines DB schema & API contracts         ┘
5. Implementor (Back)  → Implements backend tasks
6. Implementor (Front) → Implements frontend tasks
7. Reviewer      → VALIDATION GATE + CONTEXTO GATE, closes cycle
```

Specs follow the v2.0 multi-developer convention: `sdd/specs/spec-[gh-user]-[NNN]-[slug]/` with per-spec cycles and per-author counters. `harness add spec` creates the structure and registers it in `sdd/specs/index.json`.

### Scaffolding Blueprints

`react` and `springboot` apps and TS libs are generated from the kit's own blueprints (`sdd/templates/apps/react-app`, `sdd/templates/apps/java-api`, `sdd/templates/libs/ts-lib`) with token renaming — the same overlay the `scaffold-nx` skill documents. Spring Boot integrates with Nx through Maven via `nx:run-commands` (no Gradle required).

## Configuration File (`init --config`)

For repeatable setups — and for AI agents / CI, which cannot answer interactive
prompts — define a config file. Formats: plain `.json`, or `.mjs`/`.js` with a default
export via `defineConfig` (TypeScript configs must be compiled first). `harness idea`
scaffolds a JSON stub plus its JSON Schema; `harness config schema` prints the schema.

```javascript
// harness.config.mjs
import { defineConfig } from "@e-burgos/sdd-harness";

export default defineConfig({
  mode: "nx", // or "standalone" (exactly one app, code at repo root)
  project: {
    name: "my-saas",
    description: "Multi-tenant SaaS platform",
    packageScope: "@my-saas",
  },
  apps: [
    { name: "api", type: "nestjs", port: 3000, features: [] },
    { name: "webapp", type: "react", port: 4200, features: [] },
    { name: "worker", type: "python", features: [] },
  ],
  libs: [
    { name: "shared-types", type: "shared-types" },
    { name: "api-client", type: "api-client" },
  ],
  services: [
    { type: "postgres", port: 5432 },
    { type: "redis", port: 6379 },
  ],
  sdd: {
    enabled: true,
    modules: ["auth", "users", "billing"],
    cycles: [
      { cycle: 1, modules: ["auth", "users"], weeks: 2 },
      { cycle: 2, modules: ["billing"], weeks: 1 },
    ],
    skills: {
      include: ["sdd-*", "generate-*", "nx-*"],
      custom: ["data-import"],
    },
    agents: {
      instructionFile: "AGENTS.md",
      claudeFile: "CLAUDE.md",
      copilotInstructions: true,
    },
  },
  nx: {
    plugins: ["@nx/webpack", "@nx/vite", "@nx/eslint"],
    defaultProject: "api",
  },
  infra: {
    provider: "digitalocean",
  },
});
```

Then run (no prompts at all — validation errors report the exact config path):

```bash
harness init --config harness.config.mjs   # or harness.config.json
```

### Config Schema

The configuration is validated with Zod (JSON Schema export: `harness config schema`).
Key constraints:

- `mode` — `nx` (default) or `standalone` (requires exactly one app)
- `project.name` — lowercase kebab-case
- `project.packageScope` — npm scope like `@my-project`
- `apps[].name` — lowercase kebab-case
- `apps[].type` — one of: `nestjs`, `react`, `nextjs`, `python`, `fastify`, `springboot`, `hono` (the same seven the wizard offers)
- `libs[].type` — one of: `shared-types`, `shared-utils`, `ui-kit`, `api-client`, `config`
- `services[].type` — one of: `postgres`, `redis`, `rabbitmq`, `minio`
- `services[].port` — optional, between 1000 and 65535 (catalog defaults apply)
- `infra.provider` — one of: `digitalocean`, `aws`, `gcp`, `vercel`, `railway`

## Contributing / Development

The CLI lives in `apps/cli/` of the [sdd-harness](https://github.com/e-burgos/sdd-harness) workspace.

```bash
# Clone and install (workspace root)
git clone https://github.com/e-burgos/sdd-harness
cd sdd-harness
pnpm install

# Build, typecheck and test (root scripts proxy to apps/cli)
pnpm build
pnpm typecheck
pnpm test

# Run locally
node apps/cli/bin/harness.mjs init
```

Real end-to-end trials go under `examples/` (gitignored) — see `AGENTS.md` at the repo root
for the working rules.

### Adding a New Generator

1. Create `apps/cli/src/generators/<name>.generator.ts` with an exported async function
2. Wire it into `apps/cli/src/generators/index.ts`
3. If it needs a command, add to `apps/cli/src/commands/` and register in the CLI

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
import { defineConfig } from "@e-burgos/sdd-harness";

export default defineConfig({
  name: "my-project",
  scope: "@my-org",
  apps: [
    { name: "api", type: "nestjs", port: 3000 },
    { name: "webapp", type: "react", port: 4200 },
  ],
  services: [
    { type: "postgres", port: 5432 },
    { type: "redis", port: 6379 },
  ],
  sdd: {
    enabled: true,
    cycles: [{ cycle: 1, modules: ["auth", "users"] }],
  },
  infra: { provider: "digitalocean" },
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
