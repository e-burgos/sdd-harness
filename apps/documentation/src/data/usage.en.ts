// Content for the "How to use it" page (route #/como-usarlo), in English.
// Mirror of src/data/usage.ts — if one changes, the other changes.
import type { UsageTab } from './usage';

// ─── 1. Choose an install ────────────────────────────────────────────────────

const INSTALL: UsageTab = {
  id: 'instalacion',
  tab: 'Choose an install',
  kicker: '01 — install',
  title: 'Pick how the system enters your repo',
  lead: 'Three modes, one sdd/ kit. What decides is not team size: it is what you have in hand — a repo that does not exist yet with several apps, a single app, or code that already exists and must not be touched.',
  blocks: [
    {
      kind: 'cards',
      title: 'Which one is yours?',
      items: [
        {
          title: 'Nx monorepo',
          tag: 'npx @e-burgos/sdd-harness@latest init',
          body: 'A new repo with more than one app (front + API, or several APIs) and shared libraries. Generates apps/, libs/, tools/, the Nx 23 + pnpm 10 root config and the full SDD system.',
        },
        {
          title: 'Standalone',
          tag: 'npx @e-burgos/sdd-harness@latest init --standalone',
          body: 'A new repo with ONE app: the code lives at the root, no Nx. Seven app types available. Same SDD system, same gates, no extra layers.',
        },
        {
          title: 'SDD harness',
          tag: 'npx @e-burgos/sdd-harness@latest configure sdd',
          body: 'You already have a repo with code. It installs the methodology only: it does not touch your code, merges your scripts into package.json and absorbs your existing AGENTS.md/CLAUDE.md before symlinking.',
        },
      ],
    },
    {
      kind: 'prose',
      text: 'All three run through npx — there is nothing to install globally, and @latest guarantees the kit being copied is the one from the latest published version.',
    },
    { kind: 'heading', text: 'Mode 1 — Nx monorepo', hint: 'npx @e-burgos/sdd-harness@latest init' },
    {
      kind: 'terminal',
      title: 'The wizard, end to end',
      lines: [
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest init' },
        { kind: 'prompt', text: 'Project name:' },
        { kind: 'answer', text: 'flexi-market' },
        { kind: 'prompt', text: 'Project description:' },
        { kind: 'answer', text: 'Orders marketplace: React portal + Spring Boot API' },
        { kind: 'prompt', text: 'What do you want to generate?' },
        { kind: 'answer', text: '● Nx monorepo — apps/ + libs/ + tools/' },
        { kind: 'answer', text: '○ Standalone app — ONE app at the repo root, no Nx' },
        { kind: 'prompt', text: 'npm package scope:' },
        { kind: 'answer', text: '@flexi-market' },
        { kind: 'prompt', text: 'Which apps do you want to create?' },
        { kind: 'answer', text: '◼ React SPA   ◼ Spring Boot 3   ◻ NestJS API   ◻ Next.js' },
        { kind: 'answer', text: '◻ Fastify API   ◻ Hono API   ◻ Python Agent' },
        { kind: 'prompt', text: 'Name for react app:' },
        { kind: 'answer', text: 'portal' },
        { kind: 'prompt', text: 'Name for springboot app:' },
        { kind: 'answer', text: 'orders-api' },
        { kind: 'prompt', text: 'Which shared libraries do you want?' },
        { kind: 'answer', text: '◼ Shared Types   ◻ Shared Utils   ◻ UI Kit   ◻ API Client   ◻ Config' },
        { kind: 'prompt', text: 'Name for shared-types lib:' },
        { kind: 'answer', text: 'shared-types' },
        { kind: 'prompt', text: 'Which Docker services do you need?' },
        { kind: 'answer', text: '◼ PostgreSQL   ◻ Redis   ◻ RabbitMQ   ◻ MinIO' },
        { kind: 'prompt', text: 'Proceed with this configuration?' },
        { kind: 'answer', text: 'Yes' },
        { kind: 'out', text: '→ Creating directory structure...' },
        { kind: 'out', text: '→ Generating Nx configuration files...' },
        { kind: 'out', text: '→ Generating Docker Compose...' },
        { kind: 'out', text: '→ Configuring SDD (Spec-Driven Development)...' },
        { kind: 'out', text: '→ Generating app: portal (react)...' },
        { kind: 'out', text: '→ Generating app: orders-api (springboot)...' },
        { kind: 'out', text: '→ Validating SDD registries (sdd:validate)...' },
        { kind: 'ok', text: '✓ sdd:validate OK — 8 files valid, cross-checks passed' },
        { kind: 'out', text: '→ nx run-many -t lint test build   (PHASE 3 gate)' },
        { kind: 'out', text: '→ Initializing git repository...' },
        { kind: 'ok', text: '✓ Workspace "flexi-market" created successfully.' },
      ],
    },
    {
      kind: 'table',
      title: 'What each prompt offers (and how to skip it)',
      head: ['Prompt', 'Real options', 'Flag that skips it'],
      rows: [
        ['Project name:', 'kebab-case required (a-z, digits and dashes)', '--name <name>'],
        ['Project description:', 'free text — it lands in sdd/global.json', '—'],
        ['What do you want to generate?', 'Nx monorepo · Standalone app', '--mode nx | --standalone'],
        ['npm package scope:', 'scope for the monorepo packages (e.g. @flexi-market)', '--config'],
        [
          'Which apps do you want to create?',
          'React SPA · Next.js · NestJS API · Fastify API · Hono API · Spring Boot 3 · Python Agent',
          '--config',
        ],
        [
          'Which shared libraries do you want?',
          'Shared Types · Shared Utils · UI Kit · API Client · Config',
          '--config',
        ],
        ['Which Docker services do you need?', 'PostgreSQL · Redis · RabbitMQ · MinIO', '--config'],
        ['Proceed with this configuration?', 'Yes · No', '--yes'],
      ],
    },
    {
      kind: 'note',
      text: 'Multi-select: space toggles, enter confirms. You can move on without picking any lib or any service — SDD is installed regardless, always.',
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'On the way out, init runs the PHASE 3 gate (sdd:validate + nx run-many -t lint test build) and fails if anything is red. --skipVerify skips it. --here generates into the current directory instead of ./<name>, and --dir <path> points somewhere else.',
    },
    { kind: 'heading', text: 'Mode 2 — Standalone', hint: 'npx @e-burgos/sdd-harness@latest init --standalone' },
    {
      kind: 'terminal',
      title: 'One app, code at the root',
      lines: [
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest init --standalone' },
        { kind: 'prompt', text: 'Project name:' },
        { kind: 'answer', text: 'pulse-api' },
        { kind: 'prompt', text: 'Project description:' },
        { kind: 'answer', text: 'Real-time metrics API' },
        { kind: 'prompt', text: 'App type (code lives at the repo root):' },
        { kind: 'answer', text: '● Fastify API — Lightweight Node.js API' },
        { kind: 'answer', text: '○ React SPA · Next.js · NestJS API · Hono API · Spring Boot 3 · Python Agent' },
        { kind: 'prompt', text: 'Which Docker services do you need?' },
        { kind: 'answer', text: '◼ PostgreSQL   ◼ Redis   ◻ RabbitMQ   ◻ MinIO' },
        { kind: 'prompt', text: 'Proceed with this configuration?' },
        { kind: 'answer', text: 'Yes' },
        { kind: 'out', text: '→ Generating standalone repo...' },
        { kind: 'out', text: '→ Configuring SDD (Spec-Driven Development)...' },
        { kind: 'ok', text: '✓ Done! Your standalone repo is ready.' },
      ],
    },
    {
      kind: 'prose',
      text: 'In standalone the repo registers in the SDD registries as a single logical app, apps/<name>. The schemas stay untouched and every gate works exactly as in the monorepo: there is no "trimmed down" version of the methodology.',
    },
    {
      kind: 'heading',
      text: 'Mode 3 — SDD harness on an existing repo',
      hint: 'npx @e-burgos/sdd-harness@latest configure sdd',
    },
    {
      kind: 'terminal',
      title: 'Run it from inside the repo — your code is never touched',
      lines: [
        { kind: 'cmd', text: 'cd my-legacy-repo' },
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest configure sdd' },
        { kind: 'prompt', text: 'Project name (stored only in sdd/global.json):' },
        { kind: 'answer', text: 'legacy-shop' },
        { kind: 'prompt', text: 'Project description (stored only in sdd/global.json):' },
        { kind: 'answer', text: 'Inherited e-commerce — progressive migration' },
        { kind: 'out', text: '┌ Install plan' },
        { kind: 'out', text: '│ Layout: Nx monorepo' },
        { kind: 'out', text: '│ Registered apps: storefront (react), checkout-api (nestjs)' },
        { kind: 'out', text: '│ package.json: merge of sdd:* scripts + ajv' },
        { kind: 'out', text: '│ Existing AGENTS.md/CLAUDE.md: absorbed into sdd/dual-harness' },
        { kind: 'out', text: '│ Your own .claude/.github/.agents: kept; every collision lands as *.new' },
        { kind: 'out', text: '└' },
        { kind: 'ok', text: '✓ sdd/ installed (agents, skills, prompts, schemas, docs viewer, templates)' },
        { kind: 'ok', text: '✓ package.json updated: sdd:* scripts + ajv/ajv-formats' },
        { kind: 'ok', text: '✓ Harness symlinks created — your own agents and skills were kept' },
      ],
    },
    {
      kind: 'cards',
      title: 'What this mode guarantees you do NOT lose',
      items: [
        {
          title: 'Your code',
          body: 'configure sdd does not write a single line inside src/. It only adds sdd/, the harness symlinks and the new package.json entries.',
        },
        {
          title: 'Your package.json',
          body: 'It is merged, not overwritten: the sdd:* scripts and ajv/ajv-formats are added. If the repo is not Node (pure Java or Python), a minimal one is created just for the harness.',
        },
        {
          title: 'Your AGENTS.md / CLAUDE.md',
          body: 'They are absorbed into sdd/dual-harness/ BEFORE being replaced by symlinks. No previous instruction disappears.',
        },
        {
          title: 'Your own agents and skills',
          body: 'Real directories under .claude/, .github/ and .agents/ are kept; the kit is linked next to them and every name collision lands as <name>.new for you to merge.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'If the repo ALREADY has sdd/, configure sdd asks first: it reinstalls the kit by RESETTING all of sdd/ (specs, cycles and fixes included). Updating without losing data is a different command — see the "Updating the kit" tab. With --yes and no TTY, the reset happens without asking.',
    },
    {
      kind: 'chat',
      title: 'And if the install left collisions, you hand them to the steward',
      turns: [
        {
          who: 'dev',
          text: '/sdd-steward the install left several *.new files under .claude/ and .github/. Can you review them and merge whatever adds value, without overwriting ours?',
        },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Found 3. (1) .claude/skills/sdd-reviewer/SKILL.md.new: you already had your own skill with that exact name, they are different and today they compete. (2) .github/agents/sdd-orchestrator.md.new: you had none of your own with that name, the kit one goes in as is. (3) AGENTS.md.new: your previous harness was already absorbed into sdd/dual-harness/AGENTS.md, so this one adds nothing. I propose applying (2), discarding (3) and leaving (1) to you. Shall I apply?',
        },
        { who: 'dev', text: 'Apply 2 and 3. I will look at the skill myself, I want to keep the name.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Done: the kit agent went in, I deleted the two resolved .new files and left SKILL.md.new untouched, flagged in the report so it does not get lost. pnpm setup:agents and pnpm sdd:validate are green.',
        },
      ],
    },
    { kind: 'heading', text: 'After generating — all three modes' },
    {
      kind: 'steps',
      items: [
        {
          title: 'Install dependencies',
          body: 'sdd:validate needs ajv, which the CLI declared in package.json but did not install.',
          command: 'pnpm install',
        },
        {
          title: 'Regenerate the harness surfaces',
          body: 'Creates the symlinks for .claude/, .github/, .agents/, .agent/, .gemini/ and the root AGENTS.md / CLAUDE.md / GEMINI.md. It is idempotent: safe to run any time.',
          command: 'pnpm setup:agents',
        },
        {
          title: 'Check the registries are healthy',
          body: 'Validates every JSON under sdd/ against its strict schema and runs the cross-checks. It must be green before you start working.',
          command: 'pnpm sdd:validate',
        },
        {
          title: 'Open the viewer (optional)',
          body: 'Serves sdd/docs on 127.0.0.1: agents, skills, schemas, specs and the Costs dashboard, reading the registries live and with no build step.',
          command: 'pnpm sdd:docs',
        },
      ],
    },
    {
      kind: 'code',
      title: 'The same steps, asked for in plain language',
      lines: [
        '# check the install is healthy without running anything by hand',
        '/sdd-steward I just installed the kit: is everything fine? Any missing symlinks or red registries?',
        '',
        '# understand how an existing repo ended up registered',
        '/sdd-steward how did this repo end up in global.json? Layout, registered apps and profile.',
        '',
        '# get going without writing a spec by hand (hermes drives it; the steward does the intake)',
        '/sdd-hermes I have an idea: <one sentence>. Get me ready to open the first cycle.',
      ],
    },
    { kind: 'heading', text: 'No wizard — for agents and CI', hint: 'npx @e-burgos/sdd-harness@latest init --config' },
    {
      kind: 'prose',
      text: 'The whole wizard fits in a config file. This is the path agents (and CI) use to generate a workspace without a single interactive prompt.',
    },
    {
      kind: 'code',
      title: 'harness.config.json',
      lines: [
        '{',
        '  "project": {',
        '    "name": "flexi-market",',
        '    "description": "Orders marketplace",',
        '    "packageScope": "@flexi-market"',
        '  },',
        '  "mode": "nx",',
        '  "apps": [',
        '    { "name": "portal", "type": "react" },',
        '    { "name": "orders-api", "type": "springboot" }',
        '  ],',
        '  "libs": [{ "name": "shared-types", "type": "shared-types" }],',
        '  "services": [{ "type": "postgres" }],',
        '  "npm": { "scopes": [{ "scope": "@flexi-market" }] },',
        '  "sdd": { "author": "jdoe", "profile": "solo", "modules": ["market-data-feed"] }',
        '}',
      ],
    },
    {
      kind: 'code',
      title: 'And this is how you run it',
      lines: [
        '# generates into ./flexi-market, asking nothing',
        'npx @e-burgos/sdd-harness@latest init --config harness.config.json',
        '',
        '# or into the current directory (repo already git init-ed)',
        'npx @e-burgos/sdd-harness@latest init --config harness.config.json --here',
      ],
    },
    {
      kind: 'note',
      text: 'The working profile is set here or by flag: --profile solo | team on init and on configure sdd (with --config, sdd.profile wins). What each profile changes is in the "Spec Gate" tab.',
    },
  ],
};

// ─── 2. Updating the kit ─────────────────────────────────────────────────────

const UPDATE: UsageTab = {
  id: 'actualizacion',
  tab: 'Updating the kit',
  kicker: '02 — update',
  title: 'Move up a version without losing anything of yours',
  lead: 'One command, or a plain-language request to the sdd-steward. Either way the boundary is the same and sdd/kit.json decides it: kit files get replaced, your data is never touched.',
  blocks: [
    { kind: 'heading', text: 'Path A — the command', hint: 'npx @e-burgos/sdd-harness@latest update sdd' },
    {
      kind: 'steps',
      items: [
        {
          title: 'Run it from the repo root',
          body: 'Nothing to reinstall: @latest pulls the current CLI and updates the installed kit to the version that CLI ships inside.',
          command: 'npx @e-burgos/sdd-harness@latest update sdd',
        },
      ],
    },
    {
      kind: 'table',
      title: 'What happens to each file',
      head: ['File type', 'What the update does'],
      rows: [
        [
          'Your data — global.json, specs, cycles, fixes, context, memory/journal/',
          'Never touched',
        ],
        [
          'Kit files you have not modified locally — agents, skills, prompts, schemas, scripts, viewer',
          'Replaced with the new version',
        ],
        ['Kit files that are new in this version', 'Added automatically'],
        [
          'Kit files you edited (typically dual-harness/AGENTS.md)',
          'Your version stays intact; the new one lands next to it as *.new',
        ],
        ['Kit files that no longer exist in the new version', 'Removed as stale, unless you edited them'],
      ],
    },
    {
      kind: 'terminal',
      title: 'What the report looks like',
      lines: [
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest update sdd' },
        { kind: 'out', text: 'Installed kit: v0.12.1 (2026-08-28) → updating to v0.13.0' },
        { kind: 'out', text: '→ Updating SDD kit...' },
        { kind: 'ok', text: '✓ Updated 34 kit file(s)' },
        { kind: 'ok', text: '✓ Added 3 new kit file(s)' },
        { kind: 'out', text: '  + sdd/scripts/spec-gate.mjs' },
        { kind: 'out', text: '  + sdd/dual-harness/rules/sdd-gates.md' },
        { kind: 'out', text: '  + sdd/prompts/sdd-gate.prompt.md' },
        { kind: 'out', text: 'Kept 2 locally customized file(s) untouched' },
        { kind: 'out', text: '1 conflict(s) — your version was kept, the new one is next to it as *.new:' },
        { kind: 'out', text: '  ~ sdd/dual-harness/AGENTS.md  →  sdd/dual-harness/AGENTS.md.new' },
        { kind: 'ok', text: '✓ Harness symlinks refreshed (setup:agents)' },
        { kind: 'ok', text: '✓ sdd:validate OK' },
        { kind: 'ok', text: '✓ SDD kit updated.' },
      ],
    },
    {
      kind: 'steps',
      title: 'Post-update checklist (in this order)',
      items: [
        {
          title: 'Read the report',
          body: 'What was replaced, what was added and what landed as *.new. If anything of yours shows up modified (a spec, a cycle, a fix), stop and report it: that is a bug, not expected behaviour.',
        },
        {
          title: 'Merge the *.new files',
          body: 'These are kit files your team had edited. Pull in by hand whatever is useful from the new version and delete the .new — do not leave them orphaned: the next update will produce them again.',
        },
        {
          title: 'Refresh the harness surfaces',
          body: 'The update already runs it, but running it again is free and confirms all four harnesses are linked.',
          command: 'pnpm setup:agents',
        },
        {
          title: 'Leave the registries green',
          body: 'If the new version brought stricter schemas, this is where you see which registry needs migrating. The same check runs in CI.',
          command: 'pnpm sdd:validate',
        },
      ],
    },
    {
      kind: 'note',
      text: 'If the installation is old and has no sdd/kit.json (the hash baseline), the update goes conservative and asks for confirmation: it replaces only the pure kit directories, never touches dual-harness or the global constitution, and writes the manifest so the next update is surgical.',
    },
    { kind: 'heading', text: 'Path B — just ask the sdd-steward' },
    {
      kind: 'prose',
      text: 'The steward is the kit concierge: the entry point for anything about the kit itself — status, version, costs, harness health, working profile. It never implements code and never bypasses a gate; to update it runs exactly the same command and then the checklist above.',
    },
    {
      kind: 'chat',
      title: 'A real conversation',
      turns: [
        { who: 'dev', text: '/sdd-steward what state is the kit in?' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Kit v0.12.1 installed (npm latest: v0.13.0 → update available). Profile: team (full cycles). Modules: 2 pending, 1 in-progress, 4 completed. Cycles in flight: spec-jdoe-003 cycle-02, flow full, 4/7 tasks. Open fixes: 1 (FIX-jdoe-003-2, BUGFIX, medium). Memory: 3 undistilled fragments. sdd:validate: OK. Harnesses: all 5 symlinks present. rtk: active, binary v0.4.2.',
        },
        { who: 'dev', text: 'Update it.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Running npx @e-burgos/sdd-harness@latest update sdd… v0.12.1 → v0.13.0: 34 files replaced, 3 new (spec-gate.mjs, sdd-gates.md, sdd-gate.prompt.md), 1 conflict on dual-harness/AGENTS.md — yours was kept and the new one is AGENTS.md.new. Your specs, cycles and fixes were untouched. setup:agents and sdd:validate are green. Want me to merge AGENTS.md.new or will you look at it?',
        },
        {
          who: 'dev',
          text: '/sdd-steward could you merge any *.new files or conflicts you find?',
        },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'There is only one: dual-harness/AGENTS.md.new. The delta against your version is three blocks: SPEC GATE as a command (pnpm sdd:gate), the team|solo profile rule, and a wording change in the agents table. Your two own sections (commit convention and the deployment note) do not exist in the kit version, so I keep them verbatim. I propose bringing in the three new blocks and leaving yours at the end. Shall I apply it?',
        },
        { who: 'dev', text: 'Go ahead, and delete the .new when you are done.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Merged and .new deleted: +48 lines from the kit, 0 of your lines removed. Ran pnpm setup:agents (the three root harnesses still point at the same file) and pnpm sdd:validate: green.',
        },
      ],
    },
    {
      kind: 'code',
      title: 'Requests that clear the post-update work',
      lines: [
        '# the only thing the update leaves pending: the conflicts',
        '/sdd-steward could you merge any *.new files or conflicts you find?',
        '/sdd-steward show me the diff of AGENTS.md.new against mine before touching anything',
        '',
        '# the new version brought stricter schemas and validation went red:',
        '# the steward diagnoses (it writes no registries), the migration goes to the owner',
        '/sdd-steward sdd:validate fails after the update: which registry changed schema and what needs adjusting?',
        '/sdd-orchestrator Migrate the cycle.json and specs/index.json the validator flags to the new schema.',
        '/sdd-reviewer Migrate the closing registries (schema.json, api.json, components.json) that fell out of schema.',
        '',
        '# decide whether to update now at all',
        '/sdd-steward what does the new version bring compared to the one I have installed?',
        '',
        '# get the four harnesses linked again',
        '/sdd-steward refresh the harness surfaces and confirm every symlink is in place',
      ],
    },
    {
      kind: 'table',
      title: 'Other things the steward resolves on its own (no cycle needed)',
      head: ['Request', 'What it does'],
      rows: [
        ['"which version am I on?"', 'Reads sdd/kit.json and compares it with npm view @e-burgos/sdd-harness version'],
        ['"how much have we spent?"', 'Aggregates usage from cycles, tasks and fixes against the rates in sdd/pricing.json'],
        ['"are the harnesses healthy?"', 'Checks the symlinks for all four providers and offers pnpm setup:agents'],
        ['"switch me to solo profile"', 'Writes sdd/global.json → profile and leaves sdd:validate green'],
        ['"how much did rtk save?"', 'node sdd/scripts/setup-rtk.mjs --status and the viewer’s RTK tab'],
        ['"how does the FIX GATE work?"', 'Answers from sdd/documentation/ — surgical reading, never loading the whole kit'],
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'What the steward never does: write implementation code, touch registries of a cycle in flight, or bypass SPEC GATE / FIX GATE / CONTEXT GATE / MEMORY GATE. If your request ends in code, it routes it to the gated flow.',
    },
  ],
};

// ─── 3. Spec Gate ────────────────────────────────────────────────────────────

const SPEC_GATE: UsageTab = {
  id: 'spec-gate',
  tab: 'Spec Gate',
  kicker: '03 — spec gate',
  title: 'The gate that will not let you code without design',
  lead: 'SPEC GATE is not a checklist the agent recites: it is a command that answers APPROVED or BLOCKED, one line per condition. It runs at two moments — A when opening the cycle, B before the first line of code.',
  blocks: [
    {
      kind: 'code',
      title: 'Two moments, one command',
      lines: [
        '# GATE A — can I open a cycle for this spec?',
        'pnpm sdd:gate <spec-id|slug>',
        '',
        '# GATE B — can I start writing code in this cycle?',
        'pnpm sdd:gate <spec-id|slug> cycle-01',
        '',
        '# structured output, for agents and CI',
        'pnpm sdd:gate <spec-id|slug> --json',
      ],
    },
    {
      kind: 'table',
      title: 'Invariants — true in every flow and every profile',
      head: ['#', 'Invariant'],
      rows: [
        ['1', 'The spec exists and is registered in sdd/specs/index.json'],
        ['2', 'The module is in sdd/global.json (pending to open, in_progress to implement)'],
        ['3', 'cycle.json exists with status "in-progress" before the first line of code'],
        ['4', 'tasks.json exists with tasks, and no task goes to done without its usage (telemetry)'],
      ],
    },
    {
      kind: 'prose',
      text: 'Nothing below relaxes those four. What changes between profiles and flows is the shape — how many documents and how many roles — never the traceability.',
    },
    { kind: 'heading', text: 'GATE A — opening a cycle' },
    {
      kind: 'table',
      head: ['#', 'Condition'],
      rows: [
        ['A1', 'Spec registered in specs/index.json and its .spec.md file exists'],
        ['A2', 'Module in pending_modules or in_progress_modules (never in completed_modules)'],
        ['A3', 'No other cycle of that spec is in-progress — one active cycle per spec'],
        ['A4', 'The spec dependencies (depends_on) are completed'],
        ['A5', 'The spec is neither completed nor cancelled'],
      ],
    },
    {
      kind: 'terminal',
      title: 'Real output of an approved GATE A',
      lines: [
        { kind: 'cmd', text: 'pnpm sdd:gate market-data-feed' },
        { kind: 'out', text: 'SPEC GATE A — opening a cycle · spec-jdoe-001-market-data-feed' },
        { kind: 'ok', text: '  ✔ A1. Spec registered in specs/index.json and its file exists' },
        { kind: 'out', text: '      sdd/specs/spec-jdoe-001-market-data-feed/spec-jdoe-001-market-data-feed.spec.md' },
        { kind: 'ok', text: '  ✔ A2. Module in pending_modules or in_progress_modules of global.json' },
        { kind: 'out', text: '      market-data-feed → pending_modules' },
        { kind: 'ok', text: '  ✔ A3. No other cycle of this spec is in-progress' },
        { kind: 'out', text: '      no open cycles' },
        { kind: 'ok', text: '  ✔ A4. Spec dependencies (depends_on) completed' },
        { kind: 'out', text: '      no pending dependencies' },
        { kind: 'ok', text: '  ✔ A5. The spec is neither completed nor cancelled' },
        { kind: 'out', text: '      status: draft' },
        {
          kind: 'ok',
          text: '→ APPROVED — next cycle: cycle-01, suggested flow: full (profile: team; [LITE]/[FULL] in the request override it)',
        },
      ],
    },
    {
      kind: 'note',
      text: 'The script ships verbatim inside the kit and prints in English, so its output is identical in every repo that installs it — paste it as-is into your gate report.',
    },
    { kind: 'heading', text: 'GATE B — implementation' },
    {
      kind: 'table',
      head: ['#', 'Condition'],
      rows: [
        ['B1', 'cycle.json exists with status "in-progress"'],
        ['B2', 'Module in in_progress_modules of global.json'],
        ['B3', 'The cycle tasks.json has at least one task'],
        [
          'B4',
          'Documents required by the flow: full → brief/functional/planner/architect · reduced → brief · lite → plan.md',
        ],
        ['B5', 'cycle.json → apps[] is not empty and every listed subproject has its constitution.md'],
      ],
    },
    {
      kind: 'terminal',
      title: 'Real output of a blocked GATE B',
      lines: [
        { kind: 'cmd', text: 'pnpm sdd:gate market-data-feed cycle-01' },
        { kind: 'out', text: 'SPEC GATE B — implementation · spec-jdoe-001-market-data-feed · cycle-01 (flow: full)' },
        { kind: 'ok', text: '  ✔ B1. cycle.json exists with status in-progress' },
        { kind: 'out', text: '      status: in-progress' },
        { kind: 'ok', text: '  ✔ B2. Module in in_progress_modules of global.json' },
        { kind: 'out', text: '      market-data-feed → in_progress_modules' },
        { kind: 'out', text: '  ✘ B3. Cycle tasks.json with at least one task' },
        { kind: 'out', text: '      missing specs/spec-jdoe-001-market-data-feed/cycles/cycle-01/tasks.json' },
        { kind: 'out', text: '  ✘ B4. Cycle documents required by flow full: brief.yaml, functional.md, planner.md, architect.md' },
        { kind: 'out', text: '      missing: planner.md, architect.md' },
        { kind: 'ok', text: '  ✔ B5. constitution.md of every subproject in the cycle' },
        { kind: 'out', text: '      apps/orders-api' },
        { kind: 'out', text: '→ BLOCKED — 2 pending condition(s). Complete them before continuing.' },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'BLOCKED on GATE B means zero lines of code. The script says what is missing; only then do you read the template for that artifact — not before, so you never load context you do not need yet.',
    },
    {
      kind: 'code',
      title: 'Requests that unblock a blocked gate',
      lines: [
        '# the gate says WHAT is missing; you choose WHO to ask: the owner of that artifact',
        '',
        '# B4 — planner.md and architect.md are missing: one agent per document',
        '/sdd-planner Generate planner.md for Cycle 01 — spec-jdoe-001-market-data-feed.',
        '/sdd-architect Generate architect.md for Cycle 01 — spec-jdoe-001-market-data-feed.',
        '',
        '# B3 — tasks.json is missing (the planner derives it from its own breakdown)',
        '/sdd-planner GATE B is blocked on B3: create cycle-01 tasks.json from planner.md.',
        '',
        '# A1/A2 — the spec or the module are not registered: that is the orchestrator',
        '/sdd-orchestrator GATE A is blocked on A2: there is no ModuleEntry for market-data-feed.',
        'Register the module in pending_modules and re-run pnpm sdd:gate.',
        '',
        '# B5 — a subproject in the cycle has no constitution.md',
        '/sdd-orchestrator GATE B is blocked on B5: tools/qa-flows has no constitution.md.',
        '',
        '# A3/A4 — diagnose first: why it is blocked and who unblocks it',
        '/sdd-steward there is an in-progress cycle nobody is touching: tell me which one and what it needs to close.',
        '/sdd-steward why does spec-jdoe-002 block spec-jdoe-005? Show me the depends_on and the status of each.',
      ],
    },
    { kind: 'heading', text: 'The profile: team or solo' },
    {
      kind: 'prose',
      text: 'sdd/global.json → profile decides which flow new cycles open with. It is the only lever that changes the shape of the gate, and the only one who touches it is the sdd-steward, at the developer’s explicit request.',
    },
    {
      kind: 'table',
      head: ['Profile', 'Default flow', 'What changes'],
      rows: [
        [
          'team (default — the key can be omitted)',
          'full',
          'One role per document: orchestrator (brief.yaml), functional (functional.md), planner (planner.md), architect (architect.md); then implementors and reviewer. FIX GATE with its 6-question form.',
        ],
        [
          'solo',
          'lite',
          'A single actor wearing three hats: opens, implements and closes. plan.md replaces the four documents. No subagent fan-out: context is read once. FIX GATE with no questionnaire and a minimal template.',
        ],
      ],
    },
    {
      kind: 'code',
      title: 'Three ways to set it',
      lines: [
        '# 1. Ask the steward — the only agent that touches the profile',
        '/sdd-steward switch me to solo profile',
        '',
        '# 2. When generating the repo, or reconfiguring it later',
        'npx @e-burgos/sdd-harness@latest init --profile solo',
        'npx @e-burgos/sdd-harness@latest configure sdd --profile team',
        '',
        '# 3. For a one-off request, without touching the profile — the prefix wins',
        '[LITE] Implement the date filter on the orders list.',
        '[FULL] Implement the payments module.',
        '',
        '# and if you are not sure which fits, ask before changing anything',
        '/sdd-steward I work alone but this spec creates new endpoints: lite or full?',
      ],
    },
    {
      kind: 'note',
      text: 'Cycles already open keep the flow written in their cycle.json: changing the profile only affects new cycles.',
    },
    { kind: 'heading', text: 'How a full cycle is built', hint: 'team profile' },
    {
      kind: 'steps',
      items: [
        {
          title: 'GATE A',
          body: 'Run it and paste the output as the gate report in your message to the orchestrator. APPROVED also prints the next cycle-XX and the suggested flow.',
          command: 'pnpm sdd:gate market-data-feed',
        },
        {
          title: 'The orchestrator opens the cycle',
          body: 'Creates the .spec.md if missing, registers it in specs/index.json and in pending_modules, and writes cycle-01/cycle.json with status "in-progress", flow "full" and metrics.usage.by_agent: []. Moves the module to in_progress_modules. It implements nothing.',
        },
        {
          title: 'sdd-functional writes functional.md',
          body: 'The user stories and the acceptance criteria (CA-001, CA-002…) the cycle is later validated against.',
        },
        {
          title: 'sdd-planner and sdd-architect, in parallel',
          body: 'planner.md breaks the work into tasks; architect.md defines contracts, entities and endpoints. If the cycle touches schema.json, api.json or components.json, it is declared here.',
        },
        {
          title: 'GATE B',
          body: 'With the four documents and tasks.json in place. BLOCKED → zero code.',
          command: 'pnpm sdd:gate market-data-feed cycle-01',
        },
        {
          title: 'Implementation, task by task',
          body: 'One task per conversation, never batched: sdd-implementor-back first, then sdd-implementor-front (which checks the endpoints it consumes are "implemented" in sdd/api.json). Each task closes as done with files[] and its usage.',
        },
        {
          title: 'sdd-reviewer closes',
          body: 'Validates the acceptance criteria one by one, moves the cycle to completed, moves the module to completed_modules, writes the CONTEXT GATE fragment and leaves sdd:validate green.',
        },
      ],
    },
    { kind: 'heading', text: 'How a lite cycle is built', hint: 'solo profile' },
    {
      kind: 'steps',
      items: [
        {
          title: 'GATE A — identical',
          body: 'Exactly the same as full: the five conditions are not relaxed. The output suggests flow lite because the profile is solo.',
          command: 'pnpm sdd:gate market-data-feed',
        },
        {
          title: 'Open the cycle',
          body: 'cycle.json with status "in-progress", flow "lite" and metrics.usage.by_agent: []; the module moves to in_progress_modules. Done by the same actor who will implement.',
        },
        {
          title: 'Write plan.md',
          body: 'A single document with four fixed sections: goal · stories · tasks in prose · technical decisions. The last one is mandatory if the cycle touches schema.json, api.json or components.json — and those registries are updated exactly as in full.',
        },
        {
          title: 'Create tasks.json',
          body: 'With flow "lite" (user_stories may be empty) and regenerate the index with pnpm sdd:rebuild-tasks-index.',
        },
        {
          title: 'GATE B',
          body: 'It requires plan.md instead of the four documents: it reads the cycle flow and demands the documents of THAT flow.',
          command: 'pnpm sdd:gate market-data-feed cycle-01',
        },
        {
          title: 'Implement and close, same actor',
          body: 'Task by task, each one to done with its usage. On close: cycle.json completed with reviewer_report, CONTEXT GATE (additive fragment), MEMORY GATE if there was a lesson, and sdd:validate green.',
        },
      ],
    },
    {
      kind: 'cards',
      title: 'What lite does NOT trim',
      items: [
        {
          title: 'The four invariants',
          body: 'Spec registered, module in global.json, cycle.json in-progress before the code, tasks.json with tasks and no task done without usage.',
        },
        {
          title: 'The closing gates',
          body: 'CONTEXT GATE (additive fragment), MEMORY GATE if there was a real lesson, and pnpm sdd:validate green.',
        },
        {
          title: 'Telemetry',
          body: 'usage on every task, plus a single entry in cycle.json → metrics.usage.by_agent[] with agent "orchestrator" and label "solo", covering plan and review.',
        },
        {
          title: 'The contract registries',
          body: 'If the cycle creates tables or endpoints, schema.json / api.json / components.json are updated exactly as in a full cycle.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Exceptions: even on the solo profile the cycle opens full if the spec declares contracts another subproject consumes (new tables or endpoints) or if it has dependents (other specs list it in depends_on). And if a lite cycle ended up creating tables or endpoints anyway, sdd:validate leaves a warning: the next cycle of that spec opens full.',
    },
  ],
};

// ─── 4. Fix Gate ─────────────────────────────────────────────────────────────

const FIX_GATE: UsageTab = {
  id: 'fix-gate',
  tab: 'Fix Gate',
  kicker: '04 — fix gate',
  title: 'When the work cannot wait for a cycle',
  lead: 'The FIX GATE is a controlled bypass of the SPEC GATE: it does not remove it, it replaces it with a lighter but equally traceable process. Where the SPEC GATE demands a spec, a cycle and four documents, the FIX GATE demands justification, registration and documentation.',
  blocks: [
    {
      kind: 'cards',
      title: 'When to use it',
      items: [
        {
          title: 'Production is broken',
          body: 'A regression is blocking users and there is no time to open a cycle with its documents. [HOTFIX].',
        },
        {
          title: 'Confirmed bug',
          body: 'A reproducible error in development or testing, on code that already exists and that changes no contract. [BUGFIX].',
        },
        {
          title: 'Minor out-of-spec improvement',
          body: 'Wording, a missing loading state, one slow query. Nothing any spec ever promised. [IMPROVEMENT].',
        },
        {
          title: 'When NOT to use it',
          body: 'New functionality, a new endpoint, a new domain entity, or a change touching more than 5 files: that is an SDD cycle, not a fix.',
        },
      ],
    },
    {
      kind: 'table',
      title: 'The four prefixes',
      head: ['Prefix', 'When to use it', 'Expected severity'],
      rows: [
        ['[HOTFIX]', 'Production blocked, critical regression, corrupted data', 'critical / high'],
        ['[BUGFIX]', 'Confirmed error in dev or testing, does not block production', 'medium / low'],
        ['[FIX]', 'Generic alias — the orchestrator will ask you to classify', 'any'],
        ['[IMPROVEMENT]', 'Minor out-of-spec improvement (UX, wording, one-off performance)', 'low'],
      ],
    },
    {
      kind: 'note',
      text: 'No prefix still counts: any change request on code that already exists triggers the FIX GATE. The prefix only saves you the classification question.',
    },
    { kind: 'heading', text: 'The process, step by step' },
    {
      kind: 'steps',
      items: [
        {
          title: '1 — Stop and identify',
          body: 'The orchestrator prints the blocking notice and writes no code until the registration is complete. Implementing before registering is a gate violation.',
        },
        {
          title: '2 — Collect the data',
          body: 'Exact type, title (max 80 chars), problem description, justification for why it cannot wait for a cycle, affected modules and files, and whether a test validates the fix.',
        },
        {
          title: '3 — Check eligibility',
          body: 'Does not modify the API contract, does not add a module or domain entity, does not add tables to schema.json, touches ≤ 5 files, and a [HOTFIX] has critical or high severity.',
        },
        {
          title: '4 — Determine the associated cycle',
          body: 'If a cycle is in-progress the fix attaches to it. Otherwise it gets cycle: null and must be absorbed by the spec’s next cycle.',
        },
        {
          title: '5 — Register it in sdd/fixes.json',
          body: 'An entry with ID FIX-[gh-user]-[spec-NNN]-[seq] (or FIX-[gh-user]-[seq] for repo-level), validating against fixes.schema.json. Only now is implementation authorized.',
        },
        {
          title: '6 — Write the fix document',
          body: 'sdd/specs/<spec-id>/fixes/fix-....md when the fix belongs to a spec, or sdd/fixes/fix-....md when it is repo-level.',
        },
        {
          title: '7 — Implement, record usage and close',
          body: 'With the fix resolved: usage recorded, additive context fragment written, and pnpm sdd:validate green. The next cycle’s reviewer marks it validated or absorbed.',
        },
      ],
    },
    {
      kind: 'terminal',
      title: 'The notice that stops implementation',
      lines: [
        { kind: 'out', text: '⛔ FIX GATE ACTIVADO — IMPLEMENTACIÓN BLOQUEADA' },
        { kind: 'out', text: '───────────────────────────────────────────────────' },
        { kind: 'out', text: 'Detecté una solicitud de fix/mejora sobre código existente.' },
        { kind: 'out', text: 'La implementación está BLOQUEADA hasta completar el registro.' },
        { kind: 'out', text: '' },
        { kind: 'out', text: 'Prefijo detectado: [HOTFIX]' },
        { kind: 'out', text: '' },
        { kind: 'out', text: 'Antes de escribir UNA SOLA LÍNEA de código debo:' },
        { kind: 'out', text: '  1. Registrar el fix en sdd/fixes.json' },
        { kind: 'out', text: '  2. Crear el documento del fix' },
        { kind: 'out', text: '───────────────────────────────────────────────────' },
      ],
    },
    { kind: 'heading', text: 'Example 1 — a HOTFIX that passes' },
    {
      kind: 'chat',
      title: 'Production blocked, team profile',
      turns: [
        {
          who: 'dev',
          text: '[HOTFIX] The price WebSocket dies when the provider sends an empty heartbeat and never reconnects. Clients are left with no data until they refresh.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: '⛔ FIX GATE TRIGGERED. Before touching code I need: severity (I assume critical, production blocked), justification, affected files and whether there is a test. Do you confirm critical, and that the scope is apps/orders-api/src/ws/price-stream.ts plus its test?',
        },
        { who: 'dev', text: 'Yes, critical. Those two files.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Eligibility OK: no API contract change, no new entity, 2 files. There is a cycle in-progress (spec-jdoe-001 cycle-02) → I attach the fix there. Registered FIX-jdoe-001-3 in sdd/fixes.json plus the document under sdd/specs/spec-jdoe-001-market-data-feed/fixes/fix-jdoe-001-3.md. sdd:validate green. Now I implement.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Resolved: the handler ignores empty frames and reconnect now uses backoff. Added a test that reproduces the empty heartbeat. usage recorded on the fix, context fragment written under context/apps/orders-api/updates/. The cycle-02 reviewer will mark it validated on close.',
        },
      ],
    },
    { kind: 'heading', text: 'Example 2 — an IMPROVEMENT the gate rejects' },
    {
      kind: 'chat',
      title: 'The bypass has a limit',
      turns: [
        {
          who: 'dev',
          text: '[IMPROVEMENT] Let’s add an /alerts endpoint so the portal can show price notifications.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: '⛔ FIX GATE TRIGGERED, but eligibility fails: a new endpoint is an API contract, and that requires an SDD cycle. For [IMPROVEMENT] and [BUGFIX] the rule is stop and redirect (only a [HOTFIX] may proceed with a warning). The right move: open a spec for price alerts. I will run GATE A once you confirm the module name.',
        },
        { who: 'dev', text: 'Go ahead: module price-alerts, author jdoe.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'pnpm sdd:gate price-alerts → BLOCKED on A1/A2 (the spec does not exist yet). Creating it: spec-jdoe-004-price-alerts, registered in specs/index.json and in pending_modules. Re-running the gate → APPROVED, next cycle cycle-01, flow full. Shall I open the cycle?',
        },
      ],
    },
    {
      kind: 'table',
      title: 'Eligibility — what the gate checks before letting you through',
      head: ['Condition', 'If it fails'],
      rows: [
        ['Does not modify the API contract (new endpoints → SDD cycle)', '[HOTFIX] warns but proceeds; everything else stops'],
        ['Does not add a new module or domain entity', '[HOTFIX] warns but proceeds; everything else stops'],
        ['Does not add new tables to sdd/schema.json', '[HOTFIX] warns but proceeds; everything else stops'],
        ['Touches ≤ 5 files', 'Reconsider an SDD cycle'],
        ['[HOTFIX] has critical or high severity', 'Downgraded to [BUGFIX]'],
      ],
    },
    {
      kind: 'code',
      title: 'Typical FIX GATE requests — who receives them',
      lines: [
        '# classifying before you start is the steward\'s job (it routes, it does not write)',
        '/sdd-steward I need to change the commission calculation in two files. Fix or cycle?',
        '',
        '# the FIX GATE is run by the ORCHESTRATOR: it writes fixes.json and the document',
        '/sdd-orchestrator [BUGFIX] The orders list paginates wrong when the date filter is empty.',
        'Register it through the FIX GATE and show me the fixes.json entry before implementing.',
        '',
        '# the gate rejected it: the right alternative is also its call',
        '/sdd-orchestrator The FIX GATE rejected this as an API contract change. Open the right spec and run GATE A.',
        '',
        '# fixes left hanging: the steward lists them, the reviewer closes them with the cycle',
        '/sdd-steward which fixes are unvalidated, and which cycle should absorb them?',
        '/sdd-reviewer When closing cycle-02, mark the implemented fixes validated or absorbed.',
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'FIX GATE abuse: if an [IMPROVEMENT] or [BUGFIX] means more than 3 modified files or an API contract change, the orchestrator MUST reject it and redirect to the normal SDD flow. The bypass exists so you do not lose traceability, not so you can skip design.',
    },
    {
      kind: 'note',
      text: 'With profile: solo the FIX GATE is shorter: step 2 is not a questionnaire (the actor fills the data from the request itself and only asks what cannot be inferred), step 3 shrinks to "creates no new contracts or entities", and the document uses the minimal template (problem · solution · files). Registration in fixes.json, usage, the context fragment and sdd:validate are not trimmed.',
    },
  ],
};

// ─── 5. Working with the kit ─────────────────────────────────────────────────

const WORKING: UsageTab = {
  id: 'trabajando',
  tab: 'Working with the kit',
  kicker: '05 — day to day',
  title: 'A spec end to end, and who you ask for each thing',
  lead: 'Every registry in the kit has an owner, and the request goes to that agent. The sdd-steward is the door when you do not know who to ask — it classifies and routes — but it does not write cycle registries: asking it for what belongs to the orchestrator or the reviewer is the most common way to end up waiting. What follows is a complete spec with the literal requests, each addressed to the agent that can actually resolve it.',
  blocks: [
    {
      kind: 'prose',
      text: 'The steward is the kit concierge, not a second orchestrator: it resolves on its own the operations that have no other owner (status, update, costs, profile, rtk, methodology questions) and delegates everything else. The only registry write of its own is sdd/global.json → profile.',
    },
    {
      kind: 'table',
      title: 'Routing table — what it does with your request',
      head: ['You ask for…', 'And it…'],
      rows: [
        ['Kit status, version, costs, harness health, profile', 'Resolves it itself, reading only the registries the question needs'],
        ['An idea or goal in plain language', 'Does the intake and delegates to sdd-hermes / npx @e-burgos/sdd-harness@latest idea'],
        ['A new feature, or resuming a spec', 'Runs the pre-check and delegates to sdd-orchestrator, which runs the SPEC GATE'],
        ['[HOTFIX] [BUGFIX] [FIX] [IMPROVEMENT]', 'Classifies it and sends it to the FIX GATE'],
        ['Writing or editing code', 'Never does it: routes to the full SDD cycle, no exceptions'],
      ],
    },
    {
      kind: 'table',
      title: 'Who writes what — the table that decides who you ask',
      head: ['Artifact or registry', 'Owning agent'],
      rows: [
        [
          '.spec.md · specs/index.json · brief.yaml · cycle.json (opening) · global.json → pending/in_progress_modules',
          'sdd-orchestrator',
        ],
        ['functional.md — stories and acceptance criteria', 'sdd-functional'],
        ['planner.md — breakdown into tasks', 'sdd-planner'],
        ['architect.md — contracts, entities, endpoints', 'sdd-architect'],
        [
          'The code, and every task to done with files[] and its usage',
          'sdd-implementor-back · sdd-implementor-front',
        ],
        [
          'The close: cycle.json completed · completed_modules · schema.json · api.json · components.json · CONTEXT GATE',
          'sdd-reviewer',
        ],
        ['fixes.json and the fix document (FIX GATE)', 'sdd-orchestrator'],
        ['Distilling memory/journal/ into lessons.md (≥5 entries)', 'sdd-orchestrator'],
        ['Consolidating context fragments (≥5)', 'sdd-reviewer, or the orchestrator when opening the next cycle'],
        ['global.json → profile · tools.json (rtk) · kit update · costs · status', 'sdd-steward'],
        ['From an idea in prose to registered specs', 'sdd-hermes'],
      ],
    },
    {
      kind: 'note',
      text: 'That split is not bureaucracy: it is what makes the kit auditable. A registry written by someone who does not own it skips the gate protecting it, and sdd:validate catches that late — once there is already code on top.',
    },
    { kind: 'heading', text: 'End to end — from a prose request to a closed cycle' },
    {
      kind: 'chat',
      title: 'Step 0 — where do I stand',
      turns: [
        { who: 'dev', text: '/sdd-steward I want to start the real-time price feed. Where are we?' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Kit v0.13.0, up to date. Profile: team → new cycles open full. No market data spec registered yet, and no cycles in flight blocking you. sdd:validate OK. This is new functionality, so it is not mine: I hand it to sdd-orchestrator, which will run the SPEC GATE. Shall I pass the request along?',
        },
      ],
    },
    {
      kind: 'chat',
      title: 'Step 1 — describe the functionality to the orchestrator',
      turns: [
        {
          who: 'dev',
          text: 'I want to implement the Market Data Feed module for the orders-api app.\n\nGoal: consume real-time prices from the Plug provider and expose them over WebSocket to the portal clients.\n\nAttached references:\n- docs/artifacts/plug/api-spec.pdf (provider contract)\n- sdd/api.json (already implemented endpoints)\n- sdd/context/apps/orders-api/constitution.md',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Running pnpm sdd:gate market-data-feed → BLOCKED on A1/A2: the spec does not exist. Creating and registering it. Re-running → APPROVED, next cycle cycle-01, flow full (profile: team).\n\nGenerated: the .spec.md with goal, scope and acceptance criteria; the entry in specs/index.json; the module in pending_modules; cycle-01/brief.yaml; and cycle-01/cycle.json in-progress. sdd:validate green. Review the spec before we continue.',
        },
        { who: 'dev', text: 'Scope looks right, but drop historical persistence: that belongs to another spec.' },
      ],
    },
    {
      kind: 'note',
      text: 'The developer never creates SDD files by hand. You describe in prose, attach references, and review what the agent generated. If something does not reflect what you want, you correct the request and ask again — before there is any code.',
    },
    {
      kind: 'code',
      title: 'Steps 2 and 3 — the cycle documents (full flow)',
      lines: [
        '# functional: user stories and acceptance criteria',
        'Generate functional.md for Cycle 01 — spec-jdoe-001-market-data-feed.',
        '',
        '# planner and architect, in parallel',
        'Generate planner.md for Cycle 01 — spec-jdoe-001-market-data-feed.',
        'Generate architect.md for Cycle 01 — spec-jdoe-001-market-data-feed.',
      ],
    },
    {
      kind: 'chat',
      title: 'Step 4 — the gate before the code, and the implementation',
      turns: [
        { who: 'dev', text: 'Run GATE B and if it passes start on TASK-001.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'pnpm sdd:gate market-data-feed cycle-01 → APPROVED (flow full; brief, functional, planner and architect complete; 6 tasks; constitution.md for apps/orders-api present).',
        },
        { who: 'dev', text: 'Implement TASK-001 of Cycle 01 — spec-jdoe-001-market-data-feed.' },
        {
          who: 'agent',
          name: 'sdd-implementor-back',
          text: 'Read the task in cycle-01/tasks.json, the contract in architect.md and the orders-api constitution.md. Implemented the provider client plus tests. TASK-001 to "done" with files[] and its usage. Ran sdd:rebuild-tasks-index and sdd:validate: green. Next: TASK-002.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'One task per conversation, never batched. You review the code task by task: if something does not meet the spec, you say so before moving on. Frontend comes after backend, and the front implementor first checks that the endpoints it consumes are "implemented" in sdd/api.json.',
    },
    {
      kind: 'chat',
      title: 'Step 5 — review and close',
      turns: [
        { who: 'dev', text: 'Review Cycle 01 — spec-jdoe-001-market-data-feed — Module market-data-feed.' },
        {
          who: 'agent',
          name: 'sdd-reviewer',
          text: 'Pre-review VALIDATION GATE: sdd:validate OK. Acceptance criteria: CA-001 through CA-005 PASS, CA-006 FAIL — reconnect does not retry after 3 consecutive failures and the spec requires it. Sending it back to the implementor before closing.',
        },
        { who: 'dev', text: 'Fix it and review again.' },
        {
          who: 'agent',
          name: 'sdd-reviewer',
          text: 'CA-006 PASS. cycle.json → completed with completed_at, metrics and reviewer_report. Module moved to completed_modules; it was the last cycle, so the spec is completed. schema.json / api.json / components.json verified. CONTEXT GATE: wrote context/apps/orders-api/updates/2026-09-09-spec-jdoe-001-market-data-feed-cycle-01.md and touched only the orders-api row in the global tables. MEMORY GATE: there was a lesson (the provider mock does not simulate timeouts) → entry in memory/journal/. Final sdd:validate green.',
        },
      ],
    },
    {
      kind: 'code',
      title: 'Cheat sheet — who you ask for each thing',
      lines: [
        '# the kit itself: status, version, costs, profile, harnesses → steward',
        '/sdd-steward status',
        '/sdd-steward how much did spec-jdoe-001 cost, per cycle and per agent?',
        '',
        '# an idea with no spec yet → hermes (the steward does the intake and delegates)',
        '/sdd-hermes I have an idea: <one-sentence description>',
        '',
        '# opening or resuming a spec, and the FIX GATE → orchestrator',
        '/sdd-orchestrator I want to implement <module> in <app>. <goal + references>',
        '/sdd-orchestrator [HOTFIX] <what broke and who it affects>',
        '',
        '# the cycle documents → one agent per document',
        '/sdd-functional Generate functional.md for Cycle 01 — <spec-id>.',
        '/sdd-planner Generate planner.md for Cycle 01 — <spec-id>.',
        '/sdd-architect Generate architect.md for Cycle 01 — <spec-id>.',
        '',
        '# implement and close',
        '/sdd-implementor-back Implement TASK-001 of Cycle 01 — <spec-id>.',
        '/sdd-reviewer Review Cycle 01 — <spec-id> — Module <name>.',
        '',
        '# the prefixes go in the request to the orchestrator, not to another agent',
        '[LITE] Implement <narrow change>.',
        '[FULL] Implement <module with new contracts>.',
        '',
        '# the commands you run yourself, not the agent',
        'pnpm sdd:gate <spec-id> [cycle-XX]   # the gate, deterministic',
        'pnpm sdd:validate                     # registries green',
        'pnpm sdd:docs                         # viewer + Costs dashboard',
      ],
    },
    { kind: 'heading', text: 'When something drifts — the request that fixes it' },
    {
      kind: 'prose',
      text: 'Almost none of this needs you to open a file. These are plain-language requests: the steward classifies them and routes them to the agent that can actually write that registry, and the relevant gate still runs.',
    },
    {
      kind: 'table',
      title: 'Need → who you ask',
      head: ['What happened to you', 'The request, to the agent that can write it'],
      rows: [
        [
          'The generated spec does not say what you wanted',
          '/sdd-orchestrator Fix the scope of spec-jdoe-001: drop historical persistence and update the acceptance criteria. — it owns the .spec.md and specs/index.json',
        ],
        [
          'A task was left half done and you do not know where',
          '/sdd-steward which cycle-01 tasks are still open, and which files did each one touch? — the steward reads and reports; resuming it belongs to the implementor',
        ],
        [
          'A cycle has been open for weeks',
          '/sdd-steward tell me what cycle-02 needs to close → and with that list, /sdd-reviewer Review Cycle 02 — spec-jdoe-003.',
        ],
        [
          'The reviewer marked an acceptance criterion as FAIL',
          '/sdd-implementor-back CA-006 came back FAIL: fix the implementation of TASK-004. → then /sdd-reviewer Review Cycle 01 again.',
        ],
        [
          'The journal piled up undistilled entries',
          '/sdd-orchestrator There are 6 entries in memory/journal/: distil them into lessons.md and delete what you distilled. — distillation is its job, not the steward\'s',
        ],
        [
          'The subproject context went stale',
          '/sdd-reviewer There are 5 unconsolidated fragments in context/apps/orders-api/updates/: consolidate them. — or it waits for the orchestrator to open the next cycle',
        ],
        [
          'sdd:validate went red after an update',
          '/sdd-steward which registry changed schema? → and the migration to its owner: the orchestrator for cycle.json and specs, the reviewer for the closing registries',
        ],
        [
          'You do not know what the work so far cost',
          '/sdd-steward how much did spec-jdoe-001 cost, per cycle and per agent? — costs and telemetry are its own',
        ],
        [
          'You want the short shape for something small, without changing the profile',
          '/sdd-orchestrator [LITE] Add the status filter to the orders list. — the orchestrator reads the prefix when opening the cycle',
        ],
      ],
    },
    {
      kind: 'cards',
      title: 'The four things that never change',
      items: [
        {
          title: 'A command answers the gate',
          body: 'pnpm sdd:gate, not the agent’s memory. If an agent says APPROVED with no script output, there was no gate.',
        },
        {
          title: 'Zero code before cycle.json',
          body: 'The first line of code comes after the cycle exists in-progress and GATE B passed.',
        },
        {
          title: 'No task done without usage',
          body: 'Telemetry is not optional: it is what feeds the Costs dashboard and what makes one cycle comparable to another.',
        },
        {
          title: 'Context closes with the cycle',
          body: 'Additive fragment under updates/, never edit the subproject constitution.md during a cycle. And sdd:validate green: the same check runs in CI.',
        },
      ],
    },
    {
      kind: 'note',
      text: 'The full manual for every step (each document template, naming, schemas field by field) travels inside the kit under sdd/documentation/ and can be read end to end on the "sdd guide" page.',
    },
  ],
};

export const USAGE_TABS: UsageTab[] = [INSTALL, UPDATE, SPEC_GATE, FIX_GATE, WORKING];
