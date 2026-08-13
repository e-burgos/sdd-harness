# Changelog

All notable changes to `@e-burgos/sdd-harness` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-08-13

### Added — every prompt has a flag, so agents and CI can drive the whole CLI

An interactive prompt cannot be answered through stdin: @clack appends piped text to the
initial value and never submits, so any command missing a flag **hangs** rather than failing.
That made several commands unreachable for an AI agent or a CI job.

- **`configure sdd` is now scriptable**: `--name`, `--description` and `-y`. Installing SDD
  onto an existing repo was previously impossible without a TTY — it always asked for the
  project name and description with no way to skip.
- **`add spec`**: `--title` and `--app`, the two prompts that had no flag. `--app` is
  validated against `(apps|libs|tools)/<name>` before anything is written.
- **`add skill`**: `--description`.
- **`configure docker`**: `--services postgres,redis`. **`configure mcp`**: `--servers`.
  **`configure memory`**: `--providers`. All three take a comma-separated list validated
  against the catalog, and fail with the valid values instead of prompting.
- **`init --config` covers all seven app types**: `springboot` and `hono` were offered by the
  wizard and by `add app`, but the config schema stopped at `fastify`, so the path documented
  as "fully non-interactive init for AI agents and CI" could not generate the two
  blueprint-backed types. The JSON Schema export follows automatically — it derives from the
  same Zod schema.

### Fixed

- **`init` no longer dies when git has no identity.** It ends with `git init` + an initial
  commit; on a runner with no `user.email` that aborts with `fatal: empty ident name` and took
  the whole generation down with it, discarding a workspace that was already complete. The
  commit is now best-effort: it warns and leaves the workspace in place.
- **`harness add` announced a `libs` subcommand that does not exist** — libraries are declared
  in `libs[]` of `init --config`.
- **The CLI README documented skills as `SKILL.md`** in six places while the generator writes
  `skill.md`. On a case-sensitive checkout the uppercase name leaves the skill unreadable,
  which is the exact failure the lowercase rule exists to prevent.

## [0.4.0] - 2026-08-13

### Changed — English CLI output + bilingual docs site

- **CLI console output is now fully English.** The interactive wizard prompts were
  already English; the generator progress logs (`Creating directory structure...`,
  `Generating app: ...`, `Workspace "..." created successfully.`) and the
  `configure memory` notes/hints now match, so the CLI no longer mixes languages.
- **Bilingual documentation site (ES/EN).** sdd.estebanburgos.com.ar now ships a
  language switch in the header (persisted in `localStorage`, defaulting to the
  browser language). All sections, the live-costs demo, the sdd:docs viewer page and
  the guide page chrome are fully translated; the kit manuals themselves remain in
  Spanish (the kit's working language) with an explanatory note in English mode.
  The hero terminal animation now replays the **real** `harness init` wizard
  end-to-end (prompts, generator steps, `sdd:validate`, git init).

### Changed — selective viewer reactivity + end-to-end documentation

- **Selective live sync in the SDD viewer.** `/sdd/docs/__state` now reports a sha1
  fingerprint **per registry area** (`global`, `specs`, `tasks`, `fixes`, `context`,
  `memory`, `arch`, `pricing`, `catalog`, …) alongside the global one. Each viewer
  view declares its area dependencies; a change only re-renders the active view when
  it touches an area the view depends on (closing a cycle refreshes Costos/Ciclos
  without touching Agentes), while the data cache is always invalidated so navigation
  stays fresh. Re-renders now **preserve UI state**: expanded sections and tabs are
  restored by replaying their real toggles, and search inputs and scroll position are
  restored in place. Backwards compatible with an older `serve.mjs` (single
  fingerprint → treated as "everything changed").
- **Documentation overhaul.** Kit docs gained the hermes-era chapters: HOW-TO section
  10 (idea → producto, memoria, telemetría y Costos con ejemplos concretos), kit
  README MEMORIA GATE section + `memory/`/`pricing.json` in the structure tree.
  The full Spanish guide (`docs/README.md`) documents `harness idea`,
  `config schema`, `configure memory` and `update sdd` with examples. The published
  docs site gained two sections: **Idea → producto** (interactive 5-phase hermes
  walkthrough with real commands) and **Costos en vivo** (an animated simulation of
  the live dashboard closing a cycle), per-mode working-session examples in the
  three-modes section, and the real Costos screenshot as the featured sdd:docs shot.

### Added — Hermes phases 3–5: usage telemetry, loop automation, opt-in memory, Costs dashboard

- **Usage telemetry (F3).** Optional, strictly-typed `usage` fields in the kit schemas:
  per-task (`cycle-tasks.schema.json` → `tokens_in`/`tokens_out`/`duration_minutes`/
  `model_tier`) and per-cycle aggregate (`cycle.schema.json` → `metrics.usage` with
  `by_tier`). Backwards compatible — existing registries validate unchanged. The
  sdd-reviewer records it at cycle close (new checklist item); the dual-harness ⚙️
  section documents the rule. New `sdd/pricing.json` (hybrid — local edits win on
  update) with editable traditional hourly rate and $/MTok per model tier, validated
  by the new `pricing.schema.json`.
- **Loop automation (F3).** New `sdd/prompts/hermes-resume.prompt.md`: standalone
  resume prompt that re-enters the hermes loop from the registries alone (position
  diagnosis, cut conditions, budget-first). The sdd-hermes skill documents optional
  Claude Code automation: `/loop`, Routines, and a `SessionStart` hook snippet that
  injects `memory/lessons.md`.
- **`harness configure memory` (F4).** Opt-in MCP memory providers on top of the
  portable `sdd/memory/` base: `basic-memory` (local-first Markdown) and the official
  `@modelcontextprotocol/server-memory` knowledge graph persisted inside the repo at
  `sdd/memory/knowledge-graph.json`. Non-destructive `.mcp.json` merge; no API keys.
- **Costs dashboard in the SDD viewer (F5).** New `Costos` view: KPI tiles (estimated
  hours, traditional cost, tokens, approximate agentic cost, projected savings),
  per-spec traditional-vs-agentic comparison bars, stacked in/out tokens per cycle,
  a precise per-cycle table, and a methodology card with the editable rates. Computed
  live from the registries (no generated intermediate) with a CVD-validated palette,
  hover tooltips and direct labels. Untier-ed tokens are priced at the `sonnet` rate
  and flagged.
- **Live auto-refresh (F5).** `serve.mjs` gains a `/sdd/docs/__state` endpoint (sha1
  fingerprint over registry mtimes, `docs/`/`templates/` excluded); the viewer polls
  it every 4s on localhost and re-renders the active view when the SDD state changes —
  task done, cycle closed or spec completed shows up without reloading. Static/prod
  hosting keeps the previous manual-refresh behavior; polling pauses while a modal is
  open or the tab is hidden, and stops after repeated failures.

### Added — Hermes phase 2: single idea entry point + inspectable config contract

- **`harness idea "<text>"`** — the deterministic entry point of the hermes end-to-end
  flow. Persists `harness.idea.md` (idea verbatim + the protocol with human checkpoints)
  and, on an empty repo, scaffolds `harness.config.json` + `harness.config.schema.json`
  ready for `init --config`. Inside an existing SDD workspace it switches to the
  gap-analysis protocol (`harness add app|service|spec`). Never overwrites without
  `--force`.
- **`harness config schema [--out <file>]`** — prints (or writes) the JSON Schema of the
  `init --config` contract, derived from the same zod schema the CLI validates with
  (via `zod-to-json-schema`), so agents and editors validate configs without running
  the CLI.
- `project.packageScope` validation is now a clean regex (`@scope`) instead of zod's
  `.startsWith()`, whose generated JSON-Schema pattern (`^\@`) was rejected by ajv.

### Added — Hermes phase 1: portable memory, non-interactive init, end-to-end loop skill

- **Portable memory system (`sdd/memory/` — MEMORIA GATE 🧠).** The kit now ships a
  versioned, agent-agnostic self-learning layer: `memory/lessons.md` (distilled lessons,
  hard 120-line cap, read whole at every session start) + `memory/journal/` (append-only
  episodic entries written at cycle/fix close, never bulk-read — grep on demand). Same
  unique-by-construction naming and single-actor merge pattern as the additive context
  fragments: the orchestrator distills the journal into `lessons.md` at ≥5 entries.
  Enforced across the kit: new 🧠 section in `dual-harness/AGENTS.md`/`CLAUDE.md`,
  reviewer checklist item + close step, orchestrator distillation step, and
  `validate-sdd.mjs` checks (journal entry naming, distillation threshold warning,
  lessons line-cap warning — all tolerant of pre-memory installs). Update boundary:
  `memory/lessons.md` is hybrid (local edits win by hash), `memory/journal/` is user
  data (`harness update sdd` never touches it); existing installs receive `memory/`
  automatically on update.
- **`harness init --config <file>` actually works now** — the flag existed but was never
  consumed. Fully non-interactive, agent/CI-friendly init: JSON (or `.mjs`/`.js` with
  `defineConfig`) validated with zod — clear per-path errors — and mapped straight to the
  generators. Schema gains `mode: "nx" | "standalone"` and `libs`; `nx` block and service
  `port` are now optional (generator defaults apply). New `HarnessConfigInput`/`LibConfig`
  exports in the programmatic API.
- **New kit skill `sdd-hermes`** — the end-to-end conductor: natural-language idea →
  discovery (max one round of questions) → stack decision matrix + human checkpoint →
  workspace configuration via `init --config` / `harness add` → one spec per module +
  human checkpoint → chained SDD cycles until the backlog is done. Declares a
  model/effort budget per phase and mandatory stop conditions (repeated red validation,
  out-of-spec product decisions, exhausted usage budget) — all state lives in the SDD
  registries so any future session can resume the loop. Never bypasses SPEC/CONTEXTO/
  MEMORIA gates.
- Architecture & roadmap document for the initiative: `docs/hermes.md` (root repo docs).

## [0.3.1] - 2026-08-10

### Fixed

- **`monorepo.libs` ahora es un mapa `nombre -> descripción`, igual que `monorepo.apps`.** Antes era
  un string fijo (`"libs/ — Shared libraries"`), así que el visor de `pnpm sdd:docs` no tenía de
  dónde sacar las libs: las únicas que listaba venían de un array `contextSeeds` hardcodeado con
  nombres del repo del que se extrajo el kit (`api-client`, `config`, `sdd-docs`). En un workspace
  real eso significaba libs ausentes del dashboard y cuatro 404 por carga de página.
  - `schemas/global.schema.json`: `libs` acepta el mapa. El string sigue siendo válido para que los
    kits instalados antes de este cambio no fallen la validación (en esa forma las libs no se
    listan en `sdd:docs`).
  - `docs/app.js`: `collectContextCandidates()` lee `monorepo.libs` y `contextSeeds` queda vacío —
    los subproyectos salen de los datos, no de nombres horneados en el visor.
  - `sdd.generator.ts`: `registerSubprojectInSDD()` registraba solo apps; ahora registra ambas
    categorías, y el `global.json` inicial se siembra con las libs elegidas por el usuario.

## [0.3.0] - 2026-08-07

### Added — the three product modes

- **Standalone mode** (`harness init --standalone` or the new mode selector in `init`): generates ONE
  app with its code at the repo root — no Nx, no `apps/` — plus the full SDD system. All 7 app types
  supported: `react` and `springboot` from the kit blueprints root-ified (Nx-only artifacts stripped,
  self-contained configs), `nestjs` via `@nestjs/cli`, plain `nextjs`, `fastify`/`hono` with
  `tsx` + `tsc` + vitest, `python` with `pyproject.toml`. The repo registers itself in the SDD
  registries as a single logical app `apps/<name>` — the strict schemas stay untouched, every gate
  works unchanged, and the convention is documented in the generated subproject context.
- **SDD-harness mode** (`harness configure sdd`, hardened): installs the SDD system on an existing
  project without touching its code. Detects the repo shape (Nx monorepo vs standalone), infers app
  types from stack markers, auto-merges the `sdd:*` + `setup:agents` scripts and `ajv`/`ajv-formats`
  into the existing `package.json` (or creates a minimal one for pure Java/Python repos), and
  **absorbs pre-existing `AGENTS.md`/`CLAUDE.md`** into `sdd/dual-harness/` under an
  "Instrucciones previas del proyecto" section before replacing them with symlinks.
- **`harness update sdd`** — updates the installed kit to the CLI's bundled version preserving all
  project data. Hash baseline in `sdd/kit.json` (written on every install) distinguishes
  user-modified kit files from kit-changed ones: untouched → replaced, customized → kept (with the
  new version as `<file>.new` + conflict report), user-added → never touched, data
  (`global.json`, `specs/`, `fixes/`, `context/**`, registries) → never touched. Finishes with
  script re-merge, `setup:agents`, catalog rebuild and `sdd:validate`. Legacy installs (no
  manifest) get a one-time conservative mode that never overwrites hybrids.
- `examples/` folder with the three modes generated for real: `test-sdd-nx-workspace`,
  `test-sdd-standalone`, `test-sdd-harness`.
- Integration tests for both new modes (real `setup-agents.sh` + `validate-sdd.mjs` + absorption).
- **Documentation site** (`apps/documentation`, deployed at https://sdd.estebanburgos.com.ar):
  interactive docs for the CLI — live terminal demo, the three modes with generated file trees,
  command reference, SDD methodology, `sdd:docs` viewer showcase with real screenshots, and the
  full kit manual (README + HOW-TO) rendered in-site.

### Changed

- **Repo reorganized as a pnpm workspace** — the publishable package moved from the repo root to
  `apps/cli/` (source, blueprints, portable kit, build config). Root keeps a private workspace
  `package.json` whose `build`/`test`/`typecheck` scripts proxy via `pnpm --filter`, plus the
  repo-level dual harness (`AGENTS.md`/`CLAUDE.md`) and `examples/`. The release workflow now
  publishes with `pnpm --filter @e-burgos/sdd-harness publish` (pnpm 10).
- **Portable SDD kit as single source of truth** — `templates/sdd/` is now a verbatim copy of the
  portable SDD system (7 agents, 16+ skills, gate prompts, strict JSON Schemas, validator scripts,
  zero-dependency docs viewer, dual-harness and scaffolding blueprints). The generator copies it
  as-is and only writes `sdd/global.json`, which is the **single source of truth** for project
  name/description (`pnpm sdd:validate` fails if they leak into any kit file). All `sdd/*.ejs`
  templates were removed and the `ejs` dependency dropped.
- **Root workspace config from the kit** — `package.json`, `nx.json`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `.gitignore` and `.npmrc` now derive from `templates/sdd/templates/nx-workspace/`
  (Nx 23.1.1 + pnpm 10, globs `apps/* libs/* tools/*`, `onlyBuiltDependencies`), adjusted
  programmatically per selected stack. Ships the `sdd:*` scripts + `setup:agents` and
  `ajv`/`ajv-formats` for the validator.
- **`springboot` apps migrated from Gradle to Maven** — generated from the `sdd/templates/apps/java-api`
  blueprint (hexagonal architecture) integrated with Nx via `nx:run-commands` → `mvn`. Removed
  `settings.gradle`, `gradle.properties`, `@nx/gradle` and the Gradle wrapper bootstrap.
- **`react` apps and TS libs from blueprints** — `sdd/templates/apps/react-app` (Vite + react-router +
  Docker/nginx) and `sdd/templates/libs/ts-lib`, with token renaming per the `scaffold-nx` skill.
- **`AGENTS.md`/`CLAUDE.md` are now symlinks** to `sdd/dual-harness/`, created by `setup-agents`
  (also links `.claude/` and `.github/` agents, skills and prompts).
- **`harness add spec` rewritten for the v2.0 convention** — `spec-[author]-[NNN]-[slug]/` folders,
  per-author counters and registration in `sdd/specs/index.json`.
- **`harness add app` registers the app in SDD** — updates `sdd/global.json` (`monorepo.apps`) and
  creates `sdd/context/apps/[name]/` with its additive `updates/` directory.
- **`harness add skill` writes `skill.md`** (lowercase, with frontmatter) — Linux checkouts are
  case-sensitive and the kit resolves the lowercase name.

### Added

- `.nxignore` with `sdd/templates` so blueprint `project.json` files stay out of the Nx project graph.
- Final `sdd:validate` run after workspace generation.
- Integration test that runs the real `setup-agents.sh` and `validate-sdd.mjs` against a generated workspace.

### Fixed (found in the end-to-end trial)

- Generated root `package.json` now includes `@nx/eslint-plugin` + `typescript-eslint` — the CLI ships
  its own `eslint.config.mjs` (the kit assumes `create-nx-workspace` generates both), so `nx lint`
  failed with `Cannot find package '@nx/eslint-plugin'`.
- **Kit blueprint `react-app`**: `project.json` `test` target used `@nx/vite:test`,
  an executor that no longer exists in Nx 23 (`@nx/vite` only ships `build`/`dev-server`/`preview-server`).
  Replaced with `nx:run-commands` → `vitest run --passWithNoTests`, same pattern `java-api` uses for Maven.
- **Kit blueprint `java-api`**: `src/test/resources/application.yml` shadows the main
  one on the test classpath and defined `TOKEN_SIGNER_KEY` as a flat YAML key, which `@Value("${token.signer.key}")`
  cannot resolve (relaxed binding only applies to real environment variables) — `mvn test` failed to start
  the Spring context. It now defines `token.signer.key` directly.
- `harness info` no longer reports the removed `current_cycle` field (cycles are per-spec in v2.0);
  it now shows module lists and registered apps from `global.json`.
- `hono` apps (Nx mode) had the same dead `@nx/vite:test` executor in their `test` target —
  replaced with `nx:run-commands` → `vitest run --passWithNoTests`.
- **Kit blueprint `java-api`**: `nx lint` (`mvn checkstyle:check`) reported 422
  violations because the plugin ran with the default `sun_checks.xml` — a ruleset that demands Javadoc
  everywhere (incompatible with the kit's "no code comments" rule) and enforces brace/80-column style
  the blueprint never used. The blueprint now ships its own `checkstyle.xml` (real-defect checks:
  unused imports, `equals` without `hashCode`, string `==`, missing braces, line length 140, naming),
  wired via `configLocation` in `pom.xml` with `includeTestSourceDirectory`. The genuine findings it
  surfaced were fixed in the sources: 3 braceless `if` statements and 200+-char Swagger annotation
  lines. `nx lint orders-api` → 0 violations.

## [0.2.0] - 2026-06-02

### Added

- **`springboot` app type** — Spring Boot 3.5 + Java 21 scaffold using **Gradle** and `@nx/gradle`
  - `build.gradle` con Groovy DSL, Spring Boot 3.5, Java 21 toolchain
  - `project.json` mínimo (targets inferidos por `@nx/gradle` automáticamente)
  - `Application.java`, `HealthController.java`, `application.properties`, `ApplicationTests.java`
  - `Dockerfile` multi-stage con `eclipse-temurin:21-jdk-alpine`
  - `settings.gradle` raíz con plugin `dev.nx.gradle.project-graph v1.4.0`
  - `gradle.properties` con configuración de daemon y caché paralela
  - Gradle wrapper generado automáticamente (`gradle wrapper 8.14`)
  - `@nx/gradle` añadido a `devDependencies` del workspace
- **`hono` app type** — API ultra-rápida con [Hono](https://hono.dev) sobre Node.js usando `@nx/node + vite`
  - `main.ts` con `Hono` + `@hono/node-server`, endpoint `/api/v1/health`
  - `project.json` con targets `build` (`@nx/vite`), `serve` (`@nx/js:node`), `lint`, `test`
  - `vite.config.ts` en modo lib, target `node18`, externals `hono` y `@hono/node-server`
  - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`
  - `hono ^4.7.0` y `@hono/node-server ^1.14.0` añadidos a `dependencies` del workspace
- **Nx workspace bootstrap en 3 fases** — garantiza que NX esté completamente inicializado antes de generar apps y libs
  - **Fase 1**: creación de directorios + config files + `pnpm install` + `nx reset`
  - **Fase 2**: `process.chdir(root)` + generación selectiva (Docker, SDD, apps, libs, Gradle setup)
  - **Fase 3**: `git init` + commit inicial
- **`pnpm-workspace.yaml`** corregido — YAML con formato correcto (lista indentada)
- **`@nx/gradle`** en `nx.json` con `include: ["apps/**/*"]` y opciones `testTargetName` / `ciTestTargetName`
- **Plugins NX condicionales** en `package.json` del workspace generado — solo se incluyen los plugins necesarios según las apps seleccionadas

### Fixed

- **YAML malformado** en `pnpm-workspace.yaml.ejs` — `packages` estaba en una sola línea, causaba error `bad indentation of a mapping entry` al ejecutar `pnpm install`
- **Orden de inicialización** — las dependencias de NX se instalan antes de generar apps/libs, evitando referencias a `node_modules/nx/schemas/project-schema.json` inexistentes
- **CWD incorrecto** en generadores de apps/libs — `process.chdir(root)` asegura que los comandos NX y las rutas relativas operen desde dentro del proyecto generado

## [0.1.2] - 2026-06-01

### Added

- **GitHub Actions Workflow** for automated NPM publishing using Trusted Publishing (OIDC).
- **TypeScript Typings Generation** integrated directly into the build command, outputting declaration files (`.d.ts`) directly inside `dist/`.

### Fixed

- **Module Resolution**: Switched compiled JS files extension to `.js` under ESM configuration and updated entrypoints in `package.json`.
- **CLI Import Path**: Updated binary launcher `bin/harness.mjs` to target the correct built path at `dist/cli.js`.
- **Clean Distribution**: Removed duplicate `bin/` and `templates/` folders from the compiled output `dist/`.

## [0.1.0] - 2025-05-20

### Added

- **CLI framework** with citty — subcommand architecture (`init`, `add`, `configure`, `info`)
- **`harness init`** — interactive workspace bootstrapping with @clack/prompts
  - Project name, description, and npm scope configuration
  - Multi-app selection (NestJS, React, Next.js, Python, Fastify) with individual naming
  - Infrastructure services (PostgreSQL, Redis, RabbitMQ, MinIO)
  - SDD methodology toggle
  - Configuration summary with confirmation
- **`harness add app`** — add a new app to an existing workspace
- **`harness add skill`** — add SDD agent skills
- **`harness add service`** — add infrastructure services
- **`harness configure sdd`** — configure SDD methodology
- **`harness configure mcp`** — configure MCP servers
- **`harness configure docker`** — generate Docker Compose
- **`harness info`** — display workspace information
- **Programmatic API** — `defineConfig()` with Zod schema validation
- **EJS templates** — workspace scaffolding templates (`nx.json`, `package.json`, `pnpm-workspace.yaml`)
- **ESM build** — esbuild-bundled output targeting Node 18+

### Notes

- Generator implementations are placeholder — actual file generation coming in v0.2.0
- Templates library will be expanded in upcoming releases

[0.2.0]: https://github.com/e-burgos/sdd-harness/releases/tag/v0.2.0
[0.1.2]: https://github.com/e-burgos/sdd-harness/releases/tag/v0.1.2
[0.1.0]: https://github.com/e-burgos/harness/releases/tag/v0.1.0

### Added

- **GitHub Actions Workflow** for automated NPM publishing using Trusted Publishing (OIDC).
- **TypeScript Typings Generation** integrated directly into the build command, outputting declaration files (`.d.ts`) directly inside `dist/`.

### Fixed

- **Module Resolution**: Switched compiled JS files extension to `.js` under ESM configuration and updated entrypoints in `package.json`.
- **CLI Import Path**: Updated binary launcher `bin/harness.mjs` to target the correct built path at `dist/cli.js`.
- **Clean Distribution**: Removed duplicate `bin/` and `templates/` folders from the compiled output `dist/`.

## [0.1.0] - 2025-05-20

### Added

- **CLI framework** with citty — subcommand architecture (`init`, `add`, `configure`, `info`)
- **`harness init`** — interactive workspace bootstrapping with @clack/prompts
  - Project name, description, and npm scope configuration
  - Multi-app selection (NestJS, React, Next.js, Python, Fastify) with individual naming
  - Infrastructure services (PostgreSQL, Redis, RabbitMQ, MinIO)
  - SDD methodology toggle
  - Configuration summary with confirmation
- **`harness add app`** — add a new app to an existing workspace
- **`harness add skill`** — add SDD agent skills
- **`harness add service`** — add infrastructure services
- **`harness configure sdd`** — configure SDD methodology
- **`harness configure mcp`** — configure MCP servers
- **`harness configure docker`** — generate Docker Compose
- **`harness info`** — display workspace information
- **Programmatic API** — `defineConfig()` with Zod schema validation
- **EJS templates** — workspace scaffolding templates (`nx.json`, `package.json`, `pnpm-workspace.yaml`)
- **ESM build** — esbuild-bundled output targeting Node 18+

### Notes

- Generator implementations are placeholder — actual file generation coming in v0.2.0
- Templates library will be expanded in upcoming releases

[0.1.0]: https://github.com/e-burgos/harness/releases/tag/v0.1.0
