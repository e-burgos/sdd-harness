import type { Mode, HermesPhase, Command, Agent, Gate, ViewerShot } from './content';
import type { TreeNode } from './content';

export { TERMINAL_SCRIPT } from './content';
export type { TreeNode, TerminalLine, Mode, HermesPhase, Command, Agent, Gate, ViewerShot } from './content';

const SDD_TREE: TreeNode = {
  name: 'sdd/',
  accent: true,
  note: 'complete SDD system',
  children: [
    { name: 'global.json', note: 'single source of the name' },
    { name: 'agents/', note: '7 cycle agents' },
    { name: 'skills/', note: '18 skills' },
    { name: 'prompts/', note: 'gates as slash commands' },
    { name: 'schemas/', note: 'strict JSON Schema' },
    { name: 'scripts/', note: 'validate · rebuild · setup' },
    { name: 'docs/', note: 'zero-dependency viewer' },
    { name: 'templates/', note: 'scaffolding blueprints' },
    { name: 'dual-harness/', note: 'AGENTS.md + CLAUDE.md' },
    { name: 'specs/ · context/ · fixes/' },
  ],
};

export const MODES: Mode[] = [
  {
    id: 'nx',
    label: 'Nx monorepo',
    command: 'harness init',
    claim: 'A full workspace for teams: multiple apps, shared libs.',
    detail:
      'Root config derived from the portable kit (Nx 23 + pnpm 10, apps/* libs/* tools/* globs). The react and springboot apps come from the kit blueprints; dual-harness symlinks and initial commit included.',
    tree: [
      {
        name: 'flexi-market/',
        children: [
          {
            name: 'apps/',
            children: [
              { name: 'portal/', note: 'react · react-app blueprint' },
              { name: 'orders-api/', note: 'springboot · hexagonal Maven' },
            ],
          },
          { name: 'libs/ · tools/' },
          SDD_TREE,
          { name: 'AGENTS.md → sdd/dual-harness/', note: 'symlink' },
          { name: 'CLAUDE.md → sdd/dual-harness/', note: 'symlink' },
          { name: '.nxignore', note: 'keeps blueprints off the graph' },
          { name: 'nx.json · pnpm-workspace.yaml · tsconfig.base.json' },
        ],
      },
    ],
    example: {
      title: 'A working day in this mode',
      lines: [
        '$ harness add app nestjs --name payments-api',
        '$ harness add spec payments --author jdoe',
        '# from your agent (Claude Code / Copilot):',
        '/start-sdd-cycle.prompt payments',
        '→ orchestrator → functional → planner+architect → implementors → reviewer',
      ],
    },
  },
  {
    id: 'standalone',
    label: 'Standalone',
    command: 'harness init --standalone',
    claim: 'ONE app with its code at the repo root. No Nx, no extra layers.',
    detail:
      'The repo registers in the SDD registries as a single logical app apps/<name> — schemas stay intact and every gate works the same. Seven types: react, springboot, nestjs, nextjs, fastify, hono, python.',
    tree: [
      {
        name: 'orders-api/',
        children: [
          { name: 'src/main/java/…', note: 'code lives at the root' },
          { name: 'pom.xml · checkstyle.xml', note: 'Maven + real lint' },
          SDD_TREE,
          { name: 'package.json', note: 'sdd:* scripts + mvn' },
          { name: 'AGENTS.md → sdd/dual-harness/', note: 'symlink' },
        ],
      },
    ],
    example: {
      title: 'A working day in this mode',
      lines: [
        '$ npx @e-burgos/sdd-harness init --standalone',
        '? app type → fastify (code lives at the root)',
        '$ harness add spec catalog --author jdoe',
        '# same SDD cycle, same traceability — no extra layers',
      ],
    },
  },
  {
    id: 'harness',
    label: 'SDD harness',
    command: 'harness configure sdd',
    claim: 'Just the methodology, on a project that already exists. Without touching your code.',
    detail:
      "Detects the repo shape (Nx vs standalone), merges the sdd:* scripts into your package.json without overwriting anything, and absorbs your existing AGENTS.md/CLAUDE.md into sdd/dual-harness/ before creating the symlinks: no instruction gets lost.",
    tree: [
      {
        name: 'legacy-billing-service/',
        children: [
          { name: 'src/index.js', note: 'your code, untouched' },
          {
            name: 'package.json',
            note: 'your scripts + merged sdd:*',
          },
          SDD_TREE,
          {
            name: 'sdd/dual-harness/AGENTS.md',
            note: 'includes your previous rules, absorbed',
          },
        ],
      },
    ],
    example: {
      title: 'A working day in this mode',
      lines: [
        '$ cd my-legacy-repo',
        '$ npx @e-burgos/sdd-harness configure sdd',
        '→ previous AGENTS.md absorbed — no rule gets lost',
        '$ harness idea "migrate the reports module to async"',
        '# the agent runs a gap analysis vs your real stack and drafts the plan',
      ],
    },
  },
];

export const HERMES_PHASES: HermesPhase[] = [
  {
    id: 'idea',
    label: '01 · Idea',
    title: 'You register the idea — in natural language',
    body: 'One command versions the idea next to the protocol the agent will follow, with the human checkpoints marked. On an empty repo it also leaves the stack stub and its JSON Schema.',
    code: [
      '$ npx @e-burgos/sdd-harness idea "a booking app',
      '    for hair salons with reminders"',
      '',
      '✓ harness.idea.md             # the idea + the protocol',
      '✓ harness.config.json         # stack stub',
      '✓ harness.config.schema.json  # validate without the CLI',
    ],
  },
  {
    id: 'stack',
    label: '02 · Stack',
    title: 'The agent proposes the stack — you approve',
    body: 'The sdd-hermes skill decision matrix maps needs → pieces (apps, libs, Docker services). Mandatory human checkpoint: nothing is generated without your OK.',
    code: [
      '// harness.config.json — filled in by the agent',
      '{',
      '  "mode": "nx",',
      '  "apps": [{ "name": "api", "type": "nestjs" },',
      '           { "name": "webapp", "type": "react" }],',
      '  "services": [{ "type": "postgres" }]',
      '}',
    ],
  },
  {
    id: 'workspace',
    label: '03 · Workspace',
    title: 'It generates itself — zero prompts',
    body: 'The non-interactive init path: zod-validated config, errors with exact paths, and the full workspace with the SDD system installed, validated and committed.',
    code: [
      '$ npx @e-burgos/sdd-harness init --config ./harness.config.json',
      '',
      '→ Generating nx workspace...',
      '→ Installing SDD system (7 agents, 18 skills)...',
      '✓ sdd:validate OK — registries green',
    ],
  },
  {
    id: 'specs',
    label: '04 · Specs',
    title: 'One spec per module — the contract',
    body: 'The agent drafts one spec per core module from the discovery. The spec is the contract: you approve (or edit) it before the loop implements. SPEC GATE: no spec, no code.',
    code: [
      '$ harness add spec auth --author eburgos',
      '$ harness add spec bookings --author eburgos',
      '',
      'sdd/specs/spec-eburgos-001-auth/',
      'sdd/specs/spec-eburgos-002-bookings/',
    ],
  },
  {
    id: 'loop',
    label: '05 · Loop',
    title: 'The cycle loop runs — and is resumable',
    body: 'Module by module, the 7 agents do their phase with every gate active. State lives in the registries, not the session: any future session resumes exactly where it left off.',
    code: [
      'while there are pending modules:',
      '  orchestrator → brief + cycle.json (SPEC GATE)',
      '  5 agents     → design, tasks, code, review',
      '  close        → context + memory + telemetry',
      '',
      '# session cut short? in the next one:',
      '$ sdd/prompts/hermes-resume.prompt.md',
    ],
  },
];

export const COMMANDS: Command[] = [
  {
    name: 'init',
    usage: 'harness init [--name] [--mode nx|standalone] [--standalone] [--config <file>] [-y]',
    summary: 'Generates a repo from scratch: Nx monorepo or standalone app.',
    points: [
      'Guided prompts: name, description, mode, apps, libs, Docker services.',
      '--config <file .json|.mjs|.js>: 100% non-interactive path for AI agents and CI — zod-validated config (mode, project, apps, libs, services) and zero prompts.',
      'SDD always included — it is not optional.',
      'Finishes with sdd:validate, git init and the initial commit.',
    ],
  },
  {
    name: 'idea',
    usage: 'harness idea "<idea in natural language>" [--force]',
    summary: 'The entry point of the hermes end-to-end flow: from an idea to a product.',
    points: [
      'Persists harness.idea.md with the idea verbatim + the protocol to follow (discovery → stack → specs → SDD cycles, with human checkpoints).',
      'On an empty repo it also leaves the harness.config.json stub and its JSON Schema, ready for init --config.',
      'Inside an existing SDD workspace, the protocol switches to gap analysis (harness add app|service|spec).',
      'The intelligence lives in the kit sdd-hermes skill — the command materializes the deterministic entry point.',
    ],
  },
  {
    name: 'config schema',
    usage: 'harness config schema [--out <file>]',
    summary: 'Prints the JSON Schema of the init --config contract.',
    points: [
      'Derived from the same zod schema the CLI validates with: agents and editors validate configs without running it.',
    ],
  },
  {
    name: 'add app',
    usage: 'harness add app [type] --name <name>',
    summary: 'Adds an app to an existing workspace.',
    points: [
      'react and springboot come from the sdd/templates/ blueprints of the repo itself.',
      'Registers the app in sdd/global.json and creates its subproject context.',
    ],
  },
  {
    name: 'add spec',
    usage: 'harness add spec [slug] --author <gh-user>',
    summary: 'Creates a spec with the multi-developer v2.0 convention.',
    points: [
      'spec-[author]-[NNN]-[slug]/ structure with cycles/ and fixes/.',
      'Per-author NNN counter and registration in sdd/specs/index.json.',
      'Validates the registries when done.',
    ],
  },
  {
    name: 'add skill',
    usage: 'harness add skill [name]',
    summary: 'Creates a new skill under sdd/skills/.',
    points: [
      'Lowercase skill.md file — Linux is case-sensitive.',
      'With name/description frontmatter ready for Claude Code and Copilot.',
    ],
  },
  {
    name: 'add service',
    usage: 'harness add service [type]',
    summary: 'Adds a service to docker-compose.yml.',
    points: ['postgres · redis · rabbitmq · minio, with healthchecks.'],
  },
  {
    name: 'configure sdd',
    usage: 'harness configure sdd',
    summary: 'Installs (or resets) the SDD system on an existing project.',
    points: [
      'Shape detection: Nx monorepo or standalone repo.',
      'Automatic package.json merge + absorption of the previous harness.',
    ],
  },
  {
    name: 'update sdd',
    usage: 'npx @e-burgos/sdd-harness@latest update sdd [-y]',
    summary: 'Updates the installed SDD kit while preserving everything of yours.',
    points: [
      'Hash baseline in sdd/kit.json: untouched files get replaced, customized ones are preserved (the new version lands as .new).',
      'Your data (specs, cycles, fixes, contexts, registries) is never touched.',
      'Finishes with setup:agents, catalog rebuild and sdd:validate.',
    ],
  },
  {
    name: 'configure docker / mcp',
    usage: 'harness configure docker · harness configure mcp',
    summary: 'Regenerates docker-compose or configures MCP servers (.mcp.json).',
    points: ['Multi-select with what is already configured preselected.'],
  },
  {
    name: 'configure memory',
    usage: 'harness configure memory',
    summary: 'Opt-in MCP memory providers on top of the kit portable base.',
    points: [
      'The base (sdd/memory: lessons.md + journal) is versioned files, zero dependencies — this adds optional semantic retrieval.',
      'basic-memory (local-first Markdown) or the official knowledge-graph persisted in sdd/memory/ (travels with git).',
      'Non-destructive .mcp.json merge: other configured servers are not touched.',
    ],
  },
  {
    name: 'info',
    usage: 'harness info',
    summary: 'Workspace X-ray: apps, services, SDD state.',
    points: ['Reads sdd/global.json: completed modules, in progress, registered apps.'],
  },
];

export const AGENTS: Agent[] = [
  { name: 'orchestrator', role: 'Validates the SPEC GATE and opens the cycle', writes: 'brief.yaml · cycle.json' },
  { name: 'functional', role: 'Spec → user stories', writes: 'functional.md' },
  { name: 'planner', role: 'Stories → technical tasks', writes: 'planner.md · tasks.json' },
  { name: 'architect', role: 'Validates design, defines contracts', writes: 'architect.md · schema.json · api.json' },
  { name: 'implementor-back', role: 'Implements the backend, task by task', writes: 'code + api.json' },
  { name: 'implementor-front', role: 'Implements the UI against the contracts', writes: 'code + components.json' },
  { name: 'reviewer', role: 'VALIDATION GATE + cycle close', writes: 'cycle.json · context/**' },
];

export const GATES: Gate[] = [
  {
    name: 'SPEC GATE',
    rule: 'Not a single line of code without spec, brief, plan, architecture and tasks.',
    how: 'A checklist of 10 checks against real cycle files. If one says NO, everything stops.',
  },
  {
    name: 'FIX GATE',
    rule: 'Urgent bugs do not wait for a full cycle — but they get registered.',
    how: '[HOTFIX] [BUGFIX] [FIX] [IMPROVEMENT] prefixes trigger a lightweight bypass with traceability in fixes.json.',
  },
  {
    name: 'CONTEXTO GATE',
    rule: 'A cycle does not close with stale context.',
    how: 'Additive per-cycle fragments in context/**/updates/ — unique by construction, zero merge conflicts.',
  },
  {
    name: 'MEMORIA GATE',
    rule: 'What one cycle learned is never paid for twice.',
    how: 'Distilled lessons in memory/lessons.md (120-line cap, read at session start) + an append-only episodic journal the orchestrator distills at ≥5 entries.',
  },
];

export const APP_CATALOG = [
  { type: 'react', stack: 'React 19 + Vite + Tailwind', origin: 'react-app blueprint' },
  { type: 'springboot', stack: 'Spring Boot 3.5 + Java 21, hexagonal', origin: 'java-api blueprint (Maven)' },
  { type: 'nestjs', stack: 'NestJS 11', origin: 'built-in generator' },
  { type: 'nextjs', stack: 'Next.js 15 (App Router)', origin: 'built-in generator' },
  { type: 'fastify', stack: 'Fastify 5', origin: 'built-in generator' },
  { type: 'hono', stack: 'Hono 4 + node-server', origin: 'built-in generator' },
  { type: 'python', stack: 'Python 3.11 + pyproject', origin: 'built-in generator' },
];

export const LIB_CATALOG = ['shared-types', 'shared-utils', 'ui-kit', 'api-client', 'config'];

export const SERVICE_CATALOG = ['postgres', 'redis', 'rabbitmq', 'minio'];

export const SDD_SCRIPTS = [
  { cmd: 'pnpm sdd:validate', what: 'Validates ALL registries against their schemas + cross-checks + the portability rule' },
  { cmd: 'pnpm sdd:docs', what: 'The SDD system viewer — vanilla JS, zero dependencies, works offline' },
  { cmd: 'pnpm setup:agents', what: 'Dual-harness symlinks: .claude/, .github/, AGENTS.md, CLAUDE.md' },
  { cmd: 'pnpm sdd:rebuild-tasks-index', what: 'Regenerates the tasks index from the per-cycle tasks.json files' },
  { cmd: 'pnpm sdd:rebuild-catalog', what: 'Regenerates the manifest the viewer consumes' },
];

export const PORTABILITY_POINTS = [
  {
    title: 'global.json is the single source of the name',
    body: 'No other kit file hardcodes the project name or description. sdd:validate fails if they leak. That is why the kit copies verbatim between repos, with no template rendering.',
  },
  {
    title: 'Strict schemas, trustworthy registries',
    body: 'Every JSON in sdd/ validates against a schema with additionalProperties: false. A commit that leaves sdd:validate red is an invalid commit.',
  },
  {
    title: 'One harness, two assistants',
    body: 'Claude Code and GitHub Copilot read the same agents, skills and prompts via symlinks. You edit in sdd/, both see it.',
  },
];

export const VIEWER_SHOTS: ViewerShot[] = [
  {
    id: 'costs',
    tab: 'Costos ★',
    caption:
      'The star view: approximate agentic cost (tokens × per-tier rate) against the traditional task estimation, projected savings, tokens per cycle and an exact table. It updates itself while the loop works.',
  },
  {
    id: 'dashboard',
    tab: 'Dashboard',
    caption:
      'Project state on one screen: specs, cycles, fixes, registered apps and the global.json monorepo block — with LOCAL · LIVE indicator and live sync.',
  },
  {
    id: 'agents',
    tab: 'Agentes',
    caption:
      'The 7 cycle agents with their full definitions rendered — the same .agent.md Claude Code and Copilot read, browsable.',
  },
  {
    id: 'skills',
    tab: 'Skills',
    caption:
      'The complete kit skill catalog, read from the filesystem via catalog.json — orchestration, workspace, code generators.',
  },
  {
    id: 'schemas',
    tab: 'Schemas JSON',
    caption:
      'The strict JSON Schemas of every registry, explorable field by field. What sdd:validate demands, self-documented.',
  },
  {
    id: 'help',
    tab: 'Metodología',
    caption:
      'The complete SDD system documentation (README, HOW-TO, gates) rendered inside the viewer itself.',
  },
];

export const VIEWER_SECTIONS = [
  { section: 'Overview', views: ['Dashboard', 'Planificación', 'Costos'] },
  { section: 'SDD', views: ['Specs', 'Ciclos', 'Tareas', 'Fixes', 'Contexto'] },
  { section: 'SDD tooling', views: ['Agentes', 'Skills', 'Prompts'] },
  { section: 'Architecture', views: ['Schema', 'API', 'Componentes', 'Schemas JSON'] },
  { section: 'Help', views: ['Documentación SDD'] },
];

export const VIEWER_PRINCIPLES = [
  {
    title: 'Zero dependencies, zero build',
    body: 'Vanilla JS + a server built on node:* modules only. No viewer npm install, no build step, no framework going stale. You open the port and it is there.',
  },
  {
    title: 'Reads the registries live — and updates itself',
    body: 'It does not generate static HTML: it consumes global.json, specs/index.json, tasks.json and catalog.json straight from the filesystem. Locally it polls a PER-AREA fingerprint every 4s: it only re-renders your view if something it depends on changed, preserving expanded sections, searches and scroll.',
  },
  {
    title: 'The Costs dashboard',
    body: 'Tokens and time per task, cycle and spec (cycle.json/tasks.json telemetry) against the traditional task estimation: approximate agentic cost per model tier, projected savings, and editable rates in sdd/pricing.json.',
  },
  {
    title: 'Travels with the kit',
    body: 'sdd/docs/ is part of the sdd/ folder — copying the kit to another repo carries the methodology AND its viewer. Vendored fonts: works offline, no CDN.',
  },
  {
    title: 'A server restricted by design',
    body: 'serve.mjs only exposes /sdd/** on 127.0.0.1 — it cannot serve your app code nor listen outside localhost.',
  },
];

export const UI = {
  nav: {
    items: [
      { id: 'modos', label: 'The 3 modes' },
      { id: 'hermes', label: 'Idea → product' },
      { id: 'en-vivo', label: 'Live costs' },
      { id: 'comandos', label: 'Commands' },
      { id: 'metodologia', label: 'SDD methodology' },
      { id: 'catalogo', label: 'Catalog' },
      { id: 'kit', label: 'The portable kit' },
      { id: 'empezar', label: 'Get started' },
    ],
    guiaLabel: 'sdd guide',
    sddDocsMenu: 'sdd:docs — the viewer',
    guiaMenu: 'sdd guide — the full manual',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  hero: {
    kicker: 'Spec-Driven Development CLI',
    title1: 'Agent-ready repos.',
    title2: ' Specs before code.',
    body: ' generates repos with the SDD methodology built in: 7 specialized agents, gates that make it impossible to code without design, schema-validated registries and a dual harness that Claude Code and GitHub Copilot read alike.',
    cta: 'See the 3 modes',
    chips: ['7 SDD agents', '18 skills', '4 gates', 'strict schemas', 'live costs', 'portable memory', 'Nx · standalone · existing'],
  },
  modes: {
    kicker: '01 — the three modes',
    title: 'One product, three ways in',
    lead: 'A new monorepo, a single app, or a project that already exists: the SDD system that gets installed is exactly the same.',
  },
  hermes: {
    kicker: '02 — hermes, the end-to-end',
    title: 'From a one-sentence idea to a product with specs',
    lead: 'You hand it an idea in natural language and the system configures the stack, seeds the backlog and drives the cycle loop — with human checkpoints where they matter and without bypassing a single gate.',
    loopNotePre: 'And every cycle leaves lessons in ',
    loopNotePost: ': the system learns from the project and never pays for the same discovery twice.',
  },
  live: {
    kicker: '03 — the star feature',
    title: 'A dashboard that works while the agents work',
    lead: 'Every cycle records tokens and time. The viewer turns them into a cost comparison against the traditional estimation — and locally it updates itself while the loop runs. Hit play:',
    features: [
      { t: 'Honest telemetry', d: 'At every cycle close, tokens per model tier and minutes are recorded in cycle.json → metrics.usage. The agentic cost comes from editable rates in sdd/pricing.json; the traditional estimation, from the hours your tasks already estimate.' },
      { t: 'Surgical reactivity', d: 'The viewer polls a PER-AREA fingerprint of the registries every 4 seconds. It only re-renders your view if an area it depends on changed: closing a cycle refreshes Costs and Cycles, but never touches your Agents view.' },
      { t: 'Your UI stays intact', d: 'Expanded sections, typed searches and scroll position survive every refresh. And if you have a document open or the tab hidden, the refresh waits. On static hosting, the usual Refresh button.' },
    ],
    cta: 'See the full viewer, with real screenshots',
    demo: {
      live: 'local · live',
      tagline: '— the viewer while the loop works',
      replay: 'replay',
      pause: 'Pause simulation',
      resume: 'Resume simulation',
      kpiTasks: 'tasks done',
      kpiTokens: 'tokens',
      kpiCost: 'agentic cost',
      kpiSaving: 'savings',
      legendTraditional: 'traditional',
      legendAgentic: 'agentic',
      activity: 'loop activity',
      steps: [
        { actor: 'sdd-orchestrator', feed: 'SPEC GATE OK · opens cycle-01 (auth) · brief + cycle.json' },
        { actor: 'sdd-implementor-back', feed: 'TASK-001 done · user model · 352k tokens (sonnet)' },
        { actor: 'sdd-implementor-back', feed: 'TASK-002 done · login/refresh endpoints · 608k tokens (sonnet)' },
        { actor: 'sdd-architect', feed: 'TASK-003 done · review and hardening · 171k tokens (opus)' },
        { actor: 'sdd-reviewer', feed: 'closes cycle-01 ✓ · CONTEXT + MEMORY GATE · lesson → journal' },
      ],
      footnote: 'traditional = 20 estimated hours × US$ 50/h · agentic = tokens × per-tier rate (sdd/pricing.json)',
      donePre: 'Cycle closed: the dashboard reflected it ',
      doneEm: 'on its own',
      doneMid: " — no reload, no clicks, and without losing what you had expanded. The cycle's projected savings: ",
      donePost: '.',
    },
  },
  commands: {
    kicker: '04 — reference',
    title: 'Commands',
    lead: 'Everything interactive with guided prompts; everything automatable with flags and -y.',
  },
  methodology: {
    kicker: '05 — the methodology',
    title: 'Seven agents, four gates, zero improvisation',
    lead: 'Every feature goes through a design cycle before touching code. The agents write verifiable artifacts; the gates demand them.',
    footnote1: 'specs per author: spec-jdoe-001-user-onboarding / cycles/cycle-01/',
    footnote2: '6 artifacts per cycle — brief · functional · planner · architect · tasks · cycle',
  },
  catalog: {
    kicker: '06 — catalog',
    title: 'What it can generate',
    apps: 'Apps — 7 types',
    libs: 'Shared libs',
    services: 'Docker services',
    dockerNote: 'docker-compose.yml with healthchecks, ready to bring up the local infrastructure of the cycle.',
  },
  kit: {
    kicker: '07 — the heart',
    title: 'The portable SDD kit',
    lead: 'Everything the CLI installs lives in a single sdd/ folder copied verbatim — designed to move between repos without editing a single file.',
    scripts: 'Scripts that travel with the kit',
    linkPre: 'Get to know ',
    linkPost: ' in depth — real screenshots and the 16 views',
    update: {
      kicker: 'Updating the kit — fearlessly',
      title: 'One command brings everything new. Yours is never touched.',
      p1: 'The update is governed by the hashes in ',
      p2: ': it knows exactly which file belongs to the kit, which is yours and which one you modified. At the end it rebuilds the catalog, refreshes the symlinks and runs ',
      p3: '.',
      rows: [
        { k: 'Your data', v: 'specs, cycles, fixes, contexts, memory — never touched' },
        { k: 'Unmodified kit', v: 'silently replaced by the new version' },
        { k: 'New files', v: 'added on their own (memory, pricing, new skills…)' },
        { k: 'What you edited', v: 'stays intact; the new version lands next to it as *.new for a manual merge' },
      ],
    },
  },
  start: {
    kicker: '08 — get started',
    title: 'Three commands and you are in',
    steps: [
      { n: '01', t: 'Generate or install', c: 'npx @e-burgos/sdd-harness init', d: 'Nx monorepo or standalone. For an existing repo: harness configure sdd.' },
      { n: '02', t: 'Write your first spec — or throw an idea', c: 'harness add spec my-feature', d: 'The WHAT before the how. Or harness idea "..." and the agent drafts the whole plan (hermes flow).' },
      { n: '03', t: 'Start the cycle', c: '/start-sdd-cycle.prompt', d: 'From Claude Code or Copilot: the orchestrator takes the spec and the cycle runs on its own.' },
    ],
    examples: {
      title: 'Rather read it first?',
      lead: 'The CLI output lives in its own repo — an Nx monorepo (React + Spring Boot) and a standalone Fastify app, both with the full SDD kit. A workflow regenerates them from the published package on every release, so they never lag behind npm.',
      cta: 'Browse the examples',
    },
  },
  footer: { by: 'Built by ' },
  viewer: {
    back: 'back to the documentation',
    kicker: 'sdd:docs — the star tool',
    h1a: 'The SDD system has its own face.',
    h1b: ' And it lives inside the kit.',
    b1: 'SDD registries are JSON built for machines. ',
    b2: ' is their human face: a viewer that reads global.json, specs, cycles, tasks and catalogs ',
    bLive: 'live',
    b3: ' and turns them into a navigable dashboard — nothing to install, no build, no CDN.',
    cmdNote: '→ http://127.0.0.1:4310/sdd/docs/',
    shotAltPre: 'The ',
    shotAltPost: ' view of the sdd:docs viewer',
    realNote: 'Real screenshots of the viewer running on a workspace generated with harness init.',
    usage: {
      kicker: 'how it is used',
      title: 'One command, sixteen views',
      lead: 'The viewer installs itself — it ships inside sdd/docs/ in every generated repo. There is no setup.',
      steps: [
        { n: '01', t: 'Bring it up', c: 'pnpm sdd:docs', d: 'A node:*-modules-only server serves the viewer on port 4310. No extra npm install, no build.' },
        { n: '02', t: 'Navigate by hash', c: '#/costs · #/cycles · #/agents', d: 'Hash router with 16 views in 5 sections. Every spec, cycle, task and fix with its detail.' },
        { n: '03', t: 'Work — it updates itself', c: '__state → selective re-render', d: 'Locally it polls the registries per area every 4s: close a cycle and the active view reflects it without reloading, preserving your UI. The validator keeps it honest.' },
      ],
      viewsHeading: 'The 16 views',
    },
    principles: {
      kicker: 'why it is like this',
      title: 'Portable on purpose',
      lead: 'Every viewer decision comes from the same rule that governs the kit: copying sdd/ to another repo has to work without editing anything.',
      footNote: 'Every generated repo ships the viewer inside.',
    },
  },
  guia: {
    back: 'back to the documentation',
    kicker: 'sdd guide — the documentation that travels with the kit',
    h1a: 'The full system manual,',
    h1b: ' before installing it.',
    body: 'These two documents live inside sdd/ in every generated repo — here you can read them in full: the system reference (gates, agents, registries, rules) and the step-by-step guide for a dev day-to-day.',
    tabs: [
      { id: 'readme', tab: 'README — the system' },
      { id: 'how-to', tab: 'HOW-TO — step by step' },
    ],
    installedNote: ' — installs verbatim in every repo',
    tocHeading: 'In this document',
    langNote: 'These manuals ship inside the kit and are maintained in Spanish (the kit’s working language). An English kit edition is on the roadmap.' as string | null,
  },
} as const;
