# Changelog

All notable changes to `@e-burgos/sdd-harness` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.3] - 2026-08-20

### Fixed

- **`update sdd` destroyed, on the next run, the very files it had preserved.**
  `sdd/kit.json` was written by hashing the *installed* directory, so a file kept
  as a conflict — the user's `dual-harness/AGENTS.md`, their
  `context/constitution.md` — was recorded with its own local hash. The next
  update compared the file against that baseline, found them equal, concluded
  "not modified by the user" and replaced it with the kit's template. No
  conflict, no `.new`, no warning.

  Hit on a real repo doing two consecutive updates after a legacy install: a
  282-line project constitution came back as the empty kit template. The
  manifest now records what the **kit shipped** (`newManifest`), which is what
  the comparison always meant, so a preserved file keeps differing from its
  baseline and stays preserved.

  Anyone who ran two updates in a row since v0.6.1 should check
  `git diff` on `context/constitution.md`, `context/context_prompt.md` and
  `dual-harness/*` before updating again.

## [0.9.2] - 2026-08-20

### Fixed

- The portability rule matched the project name as a bare substring, so a
  subproject whose name extends the repo's — `inv-trading-api` inside a project
  named `inv-trading` — was reported as a hardcoded leak. Real installs hit
  this on every context document that lists their own apps: 6 of 16 reported
  leaks in a production repo were the app name, not the project name. The check
  now requires a word boundary (`[A-Za-z0-9_-]` on neither side), so
  `shop-api` no longer trips a project called `shop` while a genuine
  `shop` reference still fails.

## [0.9.1] - 2026-08-19

### Fixed

- `validate-sdd` skipped the telemetry warning for a completed cycle whose
  `metrics` is `null`: the check sat inside the `if (c.metrics)` guard, so the
  cycles with the least information were the ones that went unreported. Found
  against a production repo where the aggregated warning said 26 cycles when
  the real count was 28. The check now runs outside the guard — a cycle closed
  with `metrics: null` has no telemetry either, which is exactly what the
  warning is for. Still a warning, never an error.

## [0.9.0] - 2026-08-19

### Fixed — telemetry was structurally optional, so Copilot (and every provider) silently skipped it

A real cycle closed on GitHub Copilot recorded no telemetry at all: `by_tier`
came back Claude-only. The report blamed Copilot, but the audit found the cause
was provider-independent — **no harness gives the reviewer a counter it can
read**. `/stats` (Gemini CLI) and the session usage report (Claude Code) are
client-side commands an agent cannot execute; Copilot and Antigravity expose no
counter at all. Combined with a protocol that said *"an honest approximation is
fine; an invented number is not — when in doubt, omit the field"*, the rational
move for every agent was to omit. Nothing enforced the opposite: the reviewer
**agent file** carried no telemetry step (only the skill did, marked
"best-effort"), `sdd-data-schemas` never documented the `usage` block, and
`validate-sdd` never checked it.

- **The escape hatch is gone.** "When in doubt, omit" is replaced everywhere by
  "when there is no counter, declare an estimate": dual-harness rule
  `sdd-model-budget.md`, `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`, the reviewer skill,
  `sdd-hermes`, `review-cycle` and `hotfix-bypass-gate` prompts. Declaring
  provider/model is now non-negotiable — the model is always known.
- **New ⛔ TELEMETRÍA GATE** in `sdd-reviewer.agent.md` (closing step 11), with a
  per-harness source table and the estimation protocol. The reviewer agent had
  zero telemetry instructions before this release; so did both implementors,
  which now record per-task `usage`.
- **`approx` + `source` in all three `usage` blocks** (`cycle.json →
  metrics.usage` and each `by_tier` entry, per-task `usage`, per-fix `usage`).
  `source` is an enum: `session-report` · `stats-command` · `api-usage` ·
  `declared-estimate`. A cycle mixing a measured provider with an estimated one
  stays honest because `approx`/`source` also live per `by_tier` entry.
- **The viewer shows estimates instead of hiding them**: "Consumo por proveedor"
  gains an **Origen** column rendering `medido` / `estimado` /
  `parcialmente estimado` per provider (both languages).
- **`skipped` is a resolved task, not a pending one.** New optional
  `metrics.tasks_skipped`; a cycle closes when
  `tasks_completed + tasks_skipped == tasks_total`. The reviewer used to be told
  to mark *all* tasks `done`, which forced it to either lie or break the gate.
  Tasks/Planning views count skipped as resolved and surface the count.
- **`validate-sdd` warns, never fails**, on a completed cycle without
  `metrics.usage` or without `by_tier`, and on `skipped` tasks not reflected in
  `tasks_skipped`. Warnings are aggregated into one line so an existing repo does
  not get a wall of them.
- **`pricing.json` is merged, not replaced**: the viewer now layers a customized
  `pricing.json` over the kit defaults, so models added by later kit versions get
  priced instead of silently falling back to the assumed tier.
- **Antigravity records under `gemini/*`** (it runs Gemini models) — documented
  in the schemas, the rule and both languages of the kit docs, so its cost is not
  fragmented away from Gemini's.

### Backward compatibility

Every new field is **optional and additive**; nothing moved to `required` and no
existing check became stricter. Verified against a production install (21
`cycle.json`, 19 `tasks.json`, 62 fixes): all validate green against the new
schemas, and a simulated `update sdd` over that data produced **0 new errors and
1 aggregated warning**.

## [0.8.0] - 2026-08-18

### Added — sdd-steward: the kit's concierge and single entry point

The kit had seven cycle agents and Hermes, but nobody owned operations on the
kit itself — "what's the SDD status?", "update the library", "kick off this
idea" landed on whatever generic agent was around, which had to rediscover the
kit every time.

- **New agent `sdd-steward`** (`sdd/agents/sdd-steward.agent.md`, `model:
  sonnet`) + skill (`sdd/skills/sdd-steward/SKILL.md`) + prompt
  (`/sdd-steward`, exposed automatically in all four harnesses: Claude Code
  slash command, Copilot prompt, Antigravity workflow, Gemini CLI TOML
  command — with no args it runs the status playbook).
- **Router, not a second orchestrator**: a hard routing table classifies any
  incoming request. The steward executes only operations with no other owner
  (harness/SDD status report, `update sdd` with its post-update checklist,
  cost/telemetry queries, harness health, methodology questions) and delegates
  the rest untouched — ideas to `sdd-hermes`, cycles/specs to
  `sdd-orchestrator`, urgent fixes to the FIX GATE. It never writes
  implementation code and never bypasses a gate.
- **Surgical reading map**: the skill encodes which registry answers which
  question (kit.json, global.json, specs index, fixes, lessons, catalog,
  pricing) so the steward "knows the whole kit" without ever loading it into
  context — economy tier by default per the ⚙️ rule.
- Kit counts: 8 agents, 19 skills, 6 prompts (catalog regenerated; docs and
  site updated in both languages).

## [0.7.0] - 2026-08-18

### Added — Gemini/Antigravity as third harness provider, provider-aware costs, bilingual viewer

The harness was dual (Claude Code + GitHub Copilot) and its model/effort rule, cost
telemetry and viewer were Claude-only. This release makes Gemini (Antigravity IDE +
Gemini CLI) a first-class provider and generalizes the whole cost pipeline.

- **New harness surfaces** (created by `pnpm setup:agents`): root `GEMINI.md`
  (`sdd/dual-harness/GEMINI.md`, absorbed like AGENTS/CLAUDE on `configure sdd`);
  condensed always-on Antigravity rules in `.agents/rules/` (sources in
  `sdd/dual-harness/rules/`, each under the 12k-char cap); SDD skills exposed at
  `.agents/skills/` (shared SKILL.md standard: Antigravity + Gemini CLI); SDD prompts as
  Antigravity workflows in `.agent/workflows/` and as generated Gemini CLI TOML commands
  in `.gemini/commands/`; `.gemini/settings.json` merged so Gemini CLI also reads
  `AGENTS.md`. PowerShell mirror included; user files are never clobbered.
- **Per-provider model/effort rule**: the ⚙️ section of the three harness files now
  carries one canonical tier table (económico/estándar/alto/máximo) with Claude
  (`model`/`effort`), Gemini (model/`thinking_level`) and Copilot equivalences, plus
  per-provider enforcement — programmatic in Claude Code, `model:` frontmatter pinned in
  the 7 SDD agents for Copilot (Claude aliases; map once to your org's same-tier
  models), explicit dropdown-check-and-ask in Antigravity, per-session model + `/stats`
  in Gemini CLI.
- **Provider-namespaced cost telemetry**: `metrics.usage.by_tier`, `usage.model_tier`
  and `pricing.json` keys now take the `provider/model` form (`claude/opus`,
  `gemini/pro`, `copilot/gpt-5-mini`); bare legacy tiers remain valid and are read as
  `claude/*`. `pricing.json` ships per-provider rates (Gemini API tiers, Copilot
  usage-based token rates behind AI Credits).
- **Fixes join the cost registry**: optional `usage` (tokens, duration, model_tier) per
  fix in `sdd/fixes.json`, requested at fix close by the FIX GATE prompt and by the
  sdd-reviewer checklist.
- **Viewer**: bilingual ES/EN with a persisted language toggle (localStorage +
  `navigator.language` default; the docs tab follows the active language into
  `sdd/documentation/{es,en}/`); Costs view adds per-provider aggregation and a fixes
  cost table on top of the existing comparison.
- **sdd-hermes decoupled from concrete tiers**: phase budgets now use the abstract
  tiers and reference the canonical table; the loop-automation section covers all four
  harnesses (Claude Code, Copilot, Gemini CLI, Antigravity) and cycle close requires
  provider-namespaced telemetry.

## [0.6.1] - 2026-08-17

### Fixed — skills are `SKILL.md` again, so Claude Code can actually find them

The kit shipped its 18 skills as lowercase `skill.md`. That satisfied the viewer, but broke
the one consumer that cannot be configured: Claude Code only discovers Agent Skills at
`.claude/skills/*/SKILL.md`, and on case-sensitive filesystems (Linux, cloud agents, WSL)
the lowercase file is simply not found — installed projects ended up with all skills
invisible to the agent.

- **All 18 kit skills renamed to `SKILL.md`** (uppercase — the Agent Skills standard), and
  every resolver aligned to the same case: `catalog.json` + `rebuild-catalog.mjs`,
  `catalog.schema.json` (`file` is now `const: "SKILL.md"`), the `sdd/docs` viewer, agents,
  prompts, context templates and both documentation editions.
- **`harness add skill` now writes `SKILL.md`** for user-created skills.
- **`harness update sdd` migrates existing installs**: unmodified lowercase `skill.md` files
  are removed as stale kit files and the uppercase editions take their place; `catalog.json`
  is regenerated. User-created skills are untouched (rename them to `SKILL.md` by hand so
  Claude Code picks them up too).
- The kit README's warning block taught the lowercase convention as a hard rule; it now
  explains the real constraint: git versions `SKILL.md` and every resolver must match that
  case — macOS hiding case mismatches is the trap, not the uppercase name.

## [0.6.0] - 2026-08-14

### Changed — the kit's documentation is now bilingual and lives in one place

The three methodology documents sat loose at the root of `sdd/` and existed only in Spanish —
and the site's English guide page was serving the Spanish text.

- **New layout**: `sdd/documentation/{es,en}/{INSTALL,HOW-TO-USE-SDD,README}.md`. The root
  `sdd/README.md` is now a short bilingual index pointing at both editions.
- **Full English editions** of the three documents (the English README summarizes the
  historical changelog with a pointer to the Spanish original, which remains the record).
- **The viewer's Help view** now offers the three documents — INSTALL first, since how to
  install and update the framework is the most important one — from the new paths.
- **The site's `guía sdd` page** follows the language switch (English pages get English
  manuals), adds the INSTALL tab, and drops the "manuals are Spanish-only" apology.
- `harness update sdd` migrates old installs cleanly: the root `HOW-TO-USE-SDD.md` and
  `INSTALL.md` are removed as stale kit files (if unmodified) and the new tree is added.

## [0.5.0] - 2026-08-14

### Added — the loop activity feed, for real

The docs site demoed an "actividad del loop" feed that did not exist in the product. Now it
does: the `sdd:docs` viewer's cycle detail (Ciclos → open a cycle → **Actividad del ciclo**)
reconstructs the feed **exclusively from the registries** — nothing is invented, a line only
appears if its data exists:

- `sdd-orchestrator` opens the cycle (cycle.json).
- One line per design document present in `cycle.documents` (functional / planner / architect).
- One line per task from the cycle's `tasks.json`, with its status and — when the implementor
  recorded `usage` — its tokens and model tier (`352 k tokens (sonnet)`).
- `sdd-reviewer` closes it, with the `reviewer_report` verdict, on completed cycles.

The site demo now points at the real feature instead of floating free.

### Changed — the site's file trees now match the real output, file by file

The `sdd/` tree shown in "Los tres modos" omitted a third of what the CLI actually installs —
including `memory/` (the MEMORIA GATE base), `kit.json`, `pricing.json`, the six architecture
and index registries, and the three methodology documents. The three mode trees are now
complete and mirror the real examples repo directories (`flexi-market/`, `pulse-api/`,
`legacy-shop/`), each with a pointer to its example, in both languages.

## [0.4.4] - 2026-08-13

### Fixed — `add app` now updates the root package.json like `init --config` does

An app added after the workspace existed was silently second-class: `harness add app` generated
the app and registered it in the SDD registries, but never touched the root `package.json`. The
app got none of the four nx convenience scripts, and — worse — none of its runtime dependencies:
`add app hono` produced an app that could not even start, because `hono` and
`@hono/node-server` were nowhere in the workspace. Found by diffing the two paths for the same
Spring Boot app in the examples repo.

Both paths now share one source (`generators/root-package.ts`) for what each app type
contributes to the root `package.json`:

- The four scripts (`<name>`, `build:<name>`, `test:<name>`, `lint:<name>`).
- The type's runtime and dev dependencies, **additive only** — a version already present is
  never overwritten.
- Adding a `react`/`nextjs` app to a workspace that was generated without the react family
  restores it, taking versions from the kit's own `sdd/templates/nx-workspace/package.json`.
- `springboot` and `python` contribute scripts only, as in `init` — they integrate via
  Maven/pyproject and ask nothing of the root `package.json`.

## [0.4.3] - 2026-08-13

### Added — the examples repo is now cited where users actually arrive

[e-burgos/sdd-harness-examples](https://github.com/e-burgos/sdd-harness-examples) (one real,
regenerated-from-npm example per mode) was only linked from the GitHub README and the docs
site — the surfaces where nobody lands first. Now it is referenced from:

- **This README** — the page npmjs.com shows.
- **The kit's `sdd/README.md`** — what the user reads inside their own generated repo.
- **The CLI itself** — every `harness init` path closes with a "See more examples" note.
- **The `sdd:docs` viewer** — an "Ejemplos completos" card in the Help view.

### Fixed

- **The docs site was horizontally clipped on phones.** The
  `npx @e-burgos/sdd-harness@latest update sdd` copy button cannot wrap, and as a grid item its
  automatic minimum size is the full one-line width of the command — so at 375–430px the layout
  viewport was forced to 461px and the whole page panned sideways, cutting content off at the
  left edge. `min-w-0` on the button and its grid column lets the existing `truncate` do its job.
- The npm README still advertised "16+ skills"; the kit ships 18.

## [0.4.2] - 2026-08-13

### Changed — the `sdd:docs` viewer uses the width it has

- **`--content-max` 1024px → 1360px.** The viewer is tables and cards, not prose: on a normal
  screen the content sat squeezed in the middle with dead margins on both sides. Long-form text
  is unaffected — markdown documents render inside a modal already capped at 896px.
- **Costs cards.** The saving cell packed the amount and the percentage into one string
  (`US$ 994,80 (99%)`), which wrapped onto two lines in a narrow card. The percentage is now its
  own badge under the value, the amount never wraps, and the KPI grid asks for 180px per card
  instead of 150px.
- **The bar chart label no longer truncates.** `eburgos-001-auth · cycle-01` did not fit the
  fixed 148px column; it is now `clamp(148px, 20%, 240px)`, so it grows on wide screens without
  squeezing the bar on narrow ones.

### Fixed

- **The two Costs tables were rendered without the `data-table` class**, so they got none of the
  table styling: no cell padding, no header treatment, columns running into each other.
- **The dashboard told a finished project that it had not started.** The "El ciclo SDD aún no ha
  iniciado" note keyed off `pending_modules` and `in_progress_modules` being empty, ignoring
  `completed_modules` — so a project with every module completed hit that branch and was told all
  its modules were `pending`.

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
