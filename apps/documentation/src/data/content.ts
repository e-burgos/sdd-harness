export type TreeNode = {
  name: string;
  note?: string;
  accent?: boolean;
  children?: TreeNode[];
};

export type TerminalLine = {
  kind: 'cmd' | 'prompt' | 'answer' | 'out' | 'ok';
  text: string;
};

export const TERMINAL_SCRIPT: TerminalLine[] = [
  { kind: 'cmd', text: 'npx @e-burgos/sdd-harness init' },
  { kind: 'prompt', text: 'Project name:' },
  { kind: 'answer', text: 'flexi-market' },
  { kind: 'prompt', text: 'What do you want to generate?' },
  { kind: 'answer', text: 'Nx monorepo — apps/ + libs/ + tools/' },
  { kind: 'prompt', text: 'Which apps do you want to create?' },
  { kind: 'answer', text: 'React SPA · Spring Boot 3' },
  { kind: 'prompt', text: 'Which Docker services do you need?' },
  { kind: 'answer', text: 'PostgreSQL' },
  { kind: 'out', text: '→ Generando archivos de configuración Nx...' },
  { kind: 'out', text: '→ Configurando SDD (Spec-Driven Development)...' },
  { kind: 'out', text: '→ Generando app: portal (react)...' },
  { kind: 'out', text: '→ Generando app: orders-api (springboot)...' },
  { kind: 'out', text: '→ Validando registros SDD (sdd:validate)...' },
  { kind: 'ok', text: '✓ sdd:validate OK — 8 files valid, cross-checks passed' },
  { kind: 'ok', text: '✓ Workspace "flexi-market" creado exitosamente.' },
];

export type Mode = {
  id: string;
  label: string;
  command: string;
  claim: string;
  detail: string;
  tree: TreeNode[];
};

const SDD_TREE: TreeNode = {
  name: 'sdd/',
  accent: true,
  note: 'sistema SDD completo',
  children: [
    { name: 'global.json', note: 'única fuente del nombre' },
    { name: 'agents/', note: '7 agentes del ciclo' },
    { name: 'skills/', note: '16+ skills' },
    { name: 'prompts/', note: 'gates como slash commands' },
    { name: 'schemas/', note: 'JSON Schema estricto' },
    { name: 'scripts/', note: 'validate · rebuild · setup' },
    { name: 'docs/', note: 'visor sin dependencias' },
    { name: 'templates/', note: 'blueprints de scaffolding' },
    { name: 'dual-harness/', note: 'AGENTS.md + CLAUDE.md' },
    { name: 'specs/ · context/ · fixes/' },
  ],
};

export const MODES: Mode[] = [
  {
    id: 'nx',
    label: 'Nx monorepo',
    command: 'harness init',
    claim: 'Workspace completo para equipos: múltiples apps, libs compartidas.',
    detail:
      'Config raíz derivada del kit portable (Nx 23 + pnpm 10, globs apps/* libs/* tools/*). Las apps react y springboot salen de los blueprints del kit; symlinks del arnés dual y commit inicial incluidos.',
    tree: [
      {
        name: 'flexi-market/',
        children: [
          {
            name: 'apps/',
            children: [
              { name: 'portal/', note: 'react · blueprint react-app' },
              { name: 'orders-api/', note: 'springboot · Maven hexagonal' },
            ],
          },
          { name: 'libs/ · tools/' },
          SDD_TREE,
          { name: 'AGENTS.md → sdd/dual-harness/', note: 'symlink' },
          { name: 'CLAUDE.md → sdd/dual-harness/', note: 'symlink' },
          { name: '.nxignore', note: 'blueprints fuera del graph' },
          { name: 'nx.json · pnpm-workspace.yaml · tsconfig.base.json' },
        ],
      },
    ],
  },
  {
    id: 'standalone',
    label: 'Standalone',
    command: 'harness init --standalone',
    claim: 'UNA app con el código en la raíz del repo. Sin Nx, sin capas de más.',
    detail:
      'El repo se registra en los registros SDD como app lógica única apps/<nombre> — los schemas quedan intactos y todos los gates funcionan igual. Siete tipos: react, springboot, nestjs, nextjs, fastify, hono, python.',
    tree: [
      {
        name: 'orders-api/',
        children: [
          { name: 'src/main/java/…', note: 'el código vive en la raíz' },
          { name: 'pom.xml · checkstyle.xml', note: 'Maven + lint real' },
          SDD_TREE,
          { name: 'package.json', note: 'scripts sdd:* + mvn' },
          { name: 'AGENTS.md → sdd/dual-harness/', note: 'symlink' },
        ],
      },
    ],
  },
  {
    id: 'harness',
    label: 'SDD harness',
    command: 'harness configure sdd',
    claim: 'Solo la metodología, sobre un proyecto que ya existe. Sin tocar tu código.',
    detail:
      'Detecta la forma del repo (Nx vs standalone), mergea los scripts sdd:* en tu package.json sin pisar nada, y absorbe tus AGENTS.md/CLAUDE.md previos dentro de sdd/dual-harness/ antes de crear los symlinks: ninguna instrucción se pierde.',
    tree: [
      {
        name: 'legacy-billing-service/',
        children: [
          { name: 'src/index.js', note: 'tu código, intacto' },
          {
            name: 'package.json',
            note: 'scripts propios + sdd:* mergeados',
          },
          SDD_TREE,
          {
            name: 'sdd/dual-harness/AGENTS.md',
            note: 'incluye tus reglas previas, absorbidas',
          },
        ],
      },
    ],
  },
];

export type Command = {
  name: string;
  usage: string;
  summary: string;
  points: string[];
};

export const COMMANDS: Command[] = [
  {
    name: 'init',
    usage: 'harness init [--name] [--mode nx|standalone] [--standalone] [-y]',
    summary: 'Genera un repo desde cero: monorepo Nx o app standalone.',
    points: [
      'Prompts guiados: nombre, descripción, modo, apps, libs, servicios Docker.',
      'SDD siempre incluido — no es opcional.',
      'Cierra con sdd:validate, git init y commit inicial.',
    ],
  },
  {
    name: 'add app',
    usage: 'harness add app [tipo] --name <nombre>',
    summary: 'Agrega una app a un workspace existente.',
    points: [
      'react y springboot desde los blueprints de sdd/templates/ del propio repo.',
      'Registra la app en sdd/global.json y crea su contexto de subproyecto.',
    ],
  },
  {
    name: 'add spec',
    usage: 'harness add spec [slug] --author <gh-user>',
    summary: 'Crea una spec con la convención multi-developer v2.0.',
    points: [
      'Estructura spec-[autor]-[NNN]-[slug]/ con cycles/ y fixes/.',
      'Contador NNN per-autor y registro en sdd/specs/index.json.',
      'Valida los registros al terminar.',
    ],
  },
  {
    name: 'add skill',
    usage: 'harness add skill [nombre]',
    summary: 'Crea una skill nueva en sdd/skills/.',
    points: [
      'Archivo skill.md en minúscula — Linux es case-sensitive.',
      'Con frontmatter name/description listo para Claude Code y Copilot.',
    ],
  },
  {
    name: 'add service',
    usage: 'harness add service [tipo]',
    summary: 'Suma un servicio al docker-compose.yml.',
    points: ['postgres · redis · rabbitmq · minio, con healthchecks.'],
  },
  {
    name: 'configure sdd',
    usage: 'harness configure sdd',
    summary: 'Instala (o resetea) el sistema SDD en un proyecto existente.',
    points: [
      'Detección de forma: monorepo Nx o repo standalone.',
      'Merge automático de package.json + absorción del arnés previo.',
    ],
  },
  {
    name: 'update sdd',
    usage: 'npx @e-burgos/sdd-harness@latest update sdd [-y]',
    summary: 'Actualiza el kit SDD instalado preservando todo lo tuyo.',
    points: [
      'Baseline de hashes en sdd/kit.json: lo no tocado se reemplaza, lo customizado se preserva (la versión nueva queda como .new).',
      'Tus datos (specs, ciclos, fixes, contextos, registros) jamás se tocan.',
      'Cierra con setup:agents, rebuild del catálogo y sdd:validate.',
    ],
  },
  {
    name: 'configure docker / mcp',
    usage: 'harness configure docker · harness configure mcp',
    summary: 'Regenera docker-compose o configura servidores MCP (.mcp.json).',
    points: ['Multi-select con lo ya configurado preseleccionado.'],
  },
  {
    name: 'info',
    usage: 'harness info',
    summary: 'Radiografía del workspace: apps, servicios, estado SDD.',
    points: ['Lee sdd/global.json: módulos completados, en progreso, apps registradas.'],
  },
];

export type Agent = { name: string; role: string; writes: string };

export const AGENTS: Agent[] = [
  { name: 'orchestrator', role: 'Valida el SPEC GATE y abre el ciclo', writes: 'brief.yaml · cycle.json' },
  { name: 'functional', role: 'Spec → historias de usuario', writes: 'functional.md' },
  { name: 'planner', role: 'Historias → tareas técnicas', writes: 'planner.md · tasks.json' },
  { name: 'architect', role: 'Valida diseño, define contratos', writes: 'architect.md · schema.json · api.json' },
  { name: 'implementor-back', role: 'Implementa el backend, task por task', writes: 'código + api.json' },
  { name: 'implementor-front', role: 'Implementa la UI contra los contratos', writes: 'código + components.json' },
  { name: 'reviewer', role: 'VALIDATION GATE + cierre del ciclo', writes: 'cycle.json · context/**' },
];

export type Gate = { name: string; rule: string; how: string };

export const GATES: Gate[] = [
  {
    name: 'SPEC GATE',
    rule: 'Ni una línea de código sin spec, brief, plan, arquitectura y tasks.',
    how: 'Checklist de 10 verificaciones sobre archivos reales del ciclo. Si una da NO, se detiene todo.',
  },
  {
    name: 'FIX GATE',
    rule: 'Los bugs urgentes no esperan un ciclo completo — pero quedan registrados.',
    how: 'Prefijos [HOTFIX] [BUGFIX] [FIX] [IMPROVEMENT] activan un bypass liviano con trazabilidad en fixes.json.',
  },
  {
    name: 'CONTEXTO GATE',
    rule: 'Un ciclo no cierra con el contexto desactualizado.',
    how: 'Fragmentos aditivos por ciclo en context/**/updates/ — únicos por construcción, cero merge conflicts.',
  },
];

export const APP_CATALOG = [
  { type: 'react', stack: 'React 19 + Vite + Tailwind', origin: 'blueprint react-app' },
  { type: 'springboot', stack: 'Spring Boot 3.5 + Java 21, hexagonal', origin: 'blueprint java-api (Maven)' },
  { type: 'nestjs', stack: 'NestJS 11', origin: 'generador propio' },
  { type: 'nextjs', stack: 'Next.js 15 (App Router)', origin: 'generador propio' },
  { type: 'fastify', stack: 'Fastify 5', origin: 'generador propio' },
  { type: 'hono', stack: 'Hono 4 + node-server', origin: 'generador propio' },
  { type: 'python', stack: 'Python 3.11 + pyproject', origin: 'generador propio' },
];

export const LIB_CATALOG = ['shared-types', 'shared-utils', 'ui-kit', 'api-client', 'config'];

export const SERVICE_CATALOG = ['postgres', 'redis', 'rabbitmq', 'minio'];

export const SDD_SCRIPTS = [
  { cmd: 'pnpm sdd:validate', what: 'Valida TODOS los registros contra sus schemas + reglas cruzadas + regla de portabilidad' },
  { cmd: 'pnpm sdd:docs', what: 'Visor del sistema SDD — vanilla JS, cero dependencias, funciona offline' },
  { cmd: 'pnpm setup:agents', what: 'Symlinks del arnés dual: .claude/, .github/, AGENTS.md, CLAUDE.md' },
  { cmd: 'pnpm sdd:rebuild-tasks-index', what: 'Regenera el índice de tasks desde los tasks.json per-cycle' },
  { cmd: 'pnpm sdd:rebuild-catalog', what: 'Regenera el manifest que consume el visor' },
];

export const PORTABILITY_POINTS = [
  {
    title: 'global.json es la única fuente del nombre',
    body: 'Ningún otro archivo del kit hardcodea el nombre o la descripción del proyecto. sdd:validate falla si se filtran. Por eso el kit se copia verbatim entre repos, sin renderizar templates.',
  },
  {
    title: 'Schemas estrictos, registros confiables',
    body: 'Cada JSON de sdd/ valida contra un schema con additionalProperties: false. Un commit que deja sdd:validate en rojo es un commit inválido.',
  },
  {
    title: 'Un solo arnés, dos asistentes',
    body: 'Claude Code y GitHub Copilot leen los mismos agentes, skills y prompts vía symlinks. Editás en sdd/, lo ven los dos.',
  },
];

export type ViewerShot = {
  id: string;
  tab: string;
  caption: string;
};

export const VIEWER_SHOTS: ViewerShot[] = [
  {
    id: 'dashboard',
    tab: 'Dashboard',
    caption:
      'Estado del proyecto en una pantalla: specs, ciclos, fixes, apps registradas y el bloque monorepo de global.json — con indicador LOCAL · LIVE y sincronización en vivo.',
  },
  {
    id: 'agents',
    tab: 'Agentes',
    caption:
      'Los 7 agentes del ciclo con sus definiciones completas renderizadas — el mismo .agent.md que leen Claude Code y Copilot, navegable.',
  },
  {
    id: 'skills',
    tab: 'Skills',
    caption:
      'El catálogo completo de skills del kit, leído del filesystem vía catalog.json — orquestación, workspace, generadores de código.',
  },
  {
    id: 'schemas',
    tab: 'Schemas JSON',
    caption:
      'Los JSON Schema estrictos de cada registro, explorables campo por campo. Lo que sdd:validate exige, documentado solo.',
  },
  {
    id: 'help',
    tab: 'Metodología',
    caption:
      'La documentación completa del sistema SDD (README, HOW-TO, gates) renderizada dentro del propio visor.',
  },
];

export const VIEWER_SECTIONS = [
  { section: 'Visión general', views: ['Dashboard', 'Planificación'] },
  { section: 'SDD', views: ['Specs', 'Ciclos', 'Tareas', 'Fixes', 'Contexto'] },
  { section: 'Herramientas SDD', views: ['Agentes', 'Skills', 'Prompts'] },
  { section: 'Arquitectura', views: ['Schema', 'API', 'Componentes', 'Schemas JSON'] },
  { section: 'Ayuda', views: ['Documentación SDD'] },
];

export const VIEWER_PRINCIPLES = [
  {
    title: 'Cero dependencias, cero build',
    body: 'JS vanilla + un server con solo módulos node:*. No hay npm install del visor, no hay paso de compilación, no hay framework que se desactualice. Abrís el puerto y está.',
  },
  {
    title: 'Lee los registros en vivo',
    body: 'No genera HTML estático: consume global.json, specs/index.json, tasks.json y catalog.json directamente del filesystem. Cerrás un ciclo, tocás Actualizar, y el dashboard lo refleja.',
  },
  {
    title: 'Viaja con el kit',
    body: 'sdd/docs/ es parte de la carpeta sdd/ — copiar el kit a otro repo lleva la metodología Y su visor. Fuentes vendorizadas: funciona offline, sin CDN.',
  },
  {
    title: 'Server restringido por diseño',
    body: 'serve.mjs solo expone /sdd/** en 127.0.0.1 — no puede servir código de tu app ni escuchar fuera de localhost.',
  },
];
