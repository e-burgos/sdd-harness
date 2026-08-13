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
  { kind: 'out', text: '→ Initializing git repository...' },
  { kind: 'ok', text: '✓ Workspace "flexi-market" created successfully.' },
];

export type Mode = {
  id: string;
  label: string;
  command: string;
  claim: string;
  detail: string;
  tree: TreeNode[];
  example: { title: string; lines: string[] };
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
    example: {
      title: 'Un día de trabajo en este modo',
      lines: [
        '$ harness add app nestjs --name payments-api',
        '$ harness add spec payments --author jdoe',
        '# desde tu agente (Claude Code / Copilot):',
        '/start-sdd-cycle.prompt payments',
        '→ orquestador → funcional → planner+arquitecto → implementadores → reviewer',
      ],
    },
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
    example: {
      title: 'Un día de trabajo en este modo',
      lines: [
        '$ npx @e-burgos/sdd-harness init --standalone',
        '? tipo de app → fastify (el código vive en la raíz)',
        '$ harness add spec catalogo --author jdoe',
        '# mismo ciclo SDD, misma trazabilidad — sin capas de más',
      ],
    },
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
    example: {
      title: 'Un día de trabajo en este modo',
      lines: [
        '$ cd mi-repo-legacy',
        '$ npx @e-burgos/sdd-harness configure sdd',
        '→ AGENTS.md previo absorbido — ninguna regla se pierde',
        '$ harness idea "migrar el módulo de reportes a async"',
        '# el agente analiza gaps contra tu stack real y arma el plan',
      ],
    },
  },
];

export type HermesPhase = {
  id: string;
  label: string;
  title: string;
  body: string;
  code: string[];
};

export const HERMES_PHASES: HermesPhase[] = [
  {
    id: 'idea',
    label: '01 · Idea',
    title: 'Registrás la idea — en lenguaje natural',
    body: 'Un comando deja la idea versionada junto al protocolo que el agente va a seguir, con los checkpoints humanos marcados. En un repo vacío también deja el stub del stack y su JSON Schema.',
    code: [
      '$ npx @e-burgos/sdd-harness idea "una app de turnos',
      '    para peluquerías con recordatorios"',
      '',
      '✓ harness.idea.md             # la idea + el protocolo',
      '✓ harness.config.json         # stub del stack',
      '✓ harness.config.schema.json  # validable sin la CLI',
    ],
  },
  {
    id: 'stack',
    label: '02 · Stack',
    title: 'El agente propone el stack — vos aprobás',
    body: 'La matriz de decisión de la skill sdd-hermes mapea necesidades → piezas (apps, libs, servicios Docker). Checkpoint humano obligatorio: nada se genera sin tu OK.',
    code: [
      '// harness.config.json — completado por el agente',
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
    title: 'Se genera solo — cero prompts',
    body: 'La vía no interactiva de init: config validada con zod, errores con path exacto, y el workspace completo con el sistema SDD instalado, validado y commiteado.',
    code: [
      '$ npx @e-burgos/sdd-harness init --config ./harness.config.json',
      '',
      '→ Generando workspace nx...',
      '→ Instalando sistema SDD (7 agentes, 18 skills)...',
      '✓ sdd:validate OK — registros verdes',
    ],
  },
  {
    id: 'specs',
    label: '04 · Specs',
    title: 'Una spec por módulo — el contrato',
    body: 'El agente redacta una spec por módulo core desde el descubrimiento. La spec es el contrato: la aprobás (o editás) antes de que el loop implemente. SPEC GATE: sin spec no hay código.',
    code: [
      '$ harness add spec auth --author eburgos',
      '$ harness add spec turnos --author eburgos',
      '',
      'sdd/specs/spec-eburgos-001-auth/',
      'sdd/specs/spec-eburgos-002-turnos/',
    ],
  },
  {
    id: 'loop',
    label: '05 · Loop',
    title: 'El loop de ciclos corre — y es retomable',
    body: 'Módulo por módulo, los 7 agentes hacen su fase con todos los gates activos. El estado vive en los registros, no en la sesión: cualquier sesión futura retoma exactamente donde quedó.',
    code: [
      'mientras queden módulos pendientes:',
      '  orquestador  → brief + cycle.json (SPEC GATE)',
      '  5 agentes    → diseño, tasks, código, review',
      '  cierre       → contexto + memoria + telemetría',
      '',
      '# ¿se cortó la sesión? en la próxima:',
      '$ sdd/prompts/hermes-resume.prompt.md',
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
    usage: 'harness init [--name] [--mode nx|standalone] [--standalone] [--config <file>] [-y]',
    summary: 'Genera un repo desde cero: monorepo Nx o app standalone.',
    points: [
      'Prompts guiados: nombre, descripción, modo, apps, libs, servicios Docker.',
      '--config <archivo .json|.mjs|.js>: vía 100% no interactiva para agentes AI y CI — config validada con zod (mode, project, apps, libs, services) y cero prompts.',
      'SDD siempre incluido — no es opcional.',
      'Cierra con sdd:validate, git init y commit inicial.',
    ],
  },
  {
    name: 'idea',
    usage: 'harness idea "<idea en lenguaje natural>" [--force]',
    summary: 'Entrada del punta-a-punta hermes: de una idea a producto.',
    points: [
      'Persiste harness.idea.md con la idea verbatim + el protocolo a seguir (descubrimiento → stack → specs → ciclos SDD, con checkpoints humanos).',
      'En repo vacío deja también el stub harness.config.json y su JSON Schema, listos para init --config.',
      'En un workspace SDD existente, el protocolo cambia a análisis de gaps (harness add app|service|spec).',
      'La inteligencia vive en la skill sdd-hermes del kit — el comando materializa la entrada determinista.',
    ],
  },
  {
    name: 'config schema',
    usage: 'harness config schema [--out <archivo>]',
    summary: 'Imprime el JSON Schema del contrato de init --config.',
    points: [
      'Derivado del mismo schema zod con el que valida la CLI: agentes y editores validan configs sin ejecutarla.',
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
    usage: 'harness add spec [slug] --author <gh-user> --title <t> --app apps/<n>',
    summary: 'Crea una spec con la convención multi-developer v2.0.',
    points: [
      'Estructura spec-[autor]-[NNN]-[slug]/ con cycles/ y fixes/.',
      'Contador NNN per-autor y registro en sdd/specs/index.json.',
      'Valida los registros al terminar.',
    ],
  },
  {
    name: 'add skill',
    usage: 'harness add skill [nombre] --description <texto>',
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
    usage: 'harness configure sdd --name <n> --description <d>',
    summary: 'Instala (o resetea) el sistema SDD en un proyecto existente.',
    points: [
      'Detección de forma: monorepo Nx o repo standalone.',
      'Merge automático de package.json + absorción del arnés previo.',
      'Sin prompts con --name y --description: un agente puede correrlo.',
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
    name: 'configure memory',
    usage: 'harness configure memory',
    summary: 'Proveedores de memoria MCP opt-in sobre la base portable del kit.',
    points: [
      'La base (sdd/memory: lessons.md + journal) es archivos versionados, cero dependencias — esto agrega recuperación semántica opcional.',
      'basic-memory (Markdown local-first) o knowledge-graph oficial persistido en sdd/memory/ (viaja con git).',
      'Merge no destructivo de .mcp.json: no toca otros servidores configurados.',
    ],
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
  {
    name: 'MEMORIA GATE',
    rule: 'Lo aprendido en un ciclo no se vuelve a pagar en el siguiente.',
    how: 'Lecciones destiladas en memory/lessons.md (cap 120 líneas, leído al iniciar sesión) + journal episódico append-only que el orquestador destila con ≥5 entradas.',
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
    id: 'costs',
    tab: 'Costos ★',
    caption:
      'La vista estrella: costo agéntico aproximado (tokens × tarifa por tier) contra la estimación tradicional de las tasks, ahorro proyectado, tokens por ciclo y tabla exacta. Se actualiza sola mientras el loop trabaja.',
  },
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
  { section: 'Visión general', views: ['Dashboard', 'Planificación', 'Costos'] },
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
    title: 'Lee los registros en vivo — y se actualiza solo',
    body: 'No genera HTML estático: consume global.json, specs/index.json, tasks.json y catalog.json directamente del filesystem. En local pollea un fingerprint POR ÁREA cada 4s: solo re-renderiza tu vista si cambió algo de lo que depende, y preserva secciones expandidas, búsquedas y scroll.',
  },
  {
    title: 'Dashboard de Costos',
    body: 'Tokens y tiempos por task, ciclo y spec (telemetría de cycle.json/tasks.json) contra la estimación tradicional de las tasks: costo agéntico aproximado por tier de modelo, ahorro proyectado, y tarifas editables en sdd/pricing.json.',
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

export const UI = {
  nav: {
    items: [
      { id: 'modos', label: 'Los 3 modos' },
      { id: 'hermes', label: 'Idea → producto' },
      { id: 'en-vivo', label: 'Costos en vivo' },
      { id: 'comandos', label: 'Comandos' },
      { id: 'metodologia', label: 'Metodología SDD' },
      { id: 'catalogo', label: 'Catálogo' },
      { id: 'kit', label: 'El kit portable' },
      { id: 'empezar', label: 'Empezar' },
    ],
    guiaLabel: 'guía sdd',
    sddDocsMenu: 'sdd:docs — el visor',
    guiaMenu: 'guía sdd — el manual completo',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
  },
  hero: {
    kicker: 'Spec-Driven Development CLI',
    title1: 'Repos listos para agentes.',
    title2: ' Specs antes que código.',
    body: ' genera repos con la metodología SDD integrada: 7 agentes especializados, gates que impiden codear sin diseño, registros validados por schema y un arnés dual que Claude Code y GitHub Copilot leen por igual.',
    cta: 'Ver los 3 modos',
    chips: ['7 agentes SDD', '18 skills', '4 gates', 'schemas estrictos', 'costos en vivo', 'memoria portable', 'Nx · standalone · existente'],
  },
  modes: {
    kicker: '01 — los tres modos',
    title: 'Un producto, tres formas de entrar',
    lead: 'Monorepo nuevo, app suelta, o un proyecto que ya existe: el sistema SDD que se instala es exactamente el mismo.',
  },
  hermes: {
    kicker: '02 — hermes, el punta a punta',
    title: 'De una idea en una frase a un producto con specs',
    lead: 'Le pasás una idea en lenguaje natural y el sistema configura el stack, siembra el backlog y conduce el loop de ciclos — con checkpoints humanos donde importa y sin bypassear un solo gate.',
    loopNotePre: 'Y cada ciclo deja lecciones en ',
    loopNotePost: ': el sistema aprende del proyecto y no vuelve a pagar dos veces el mismo descubrimiento.',
  },
  live: {
    kicker: '03 — la feature estrella',
    title: 'Un tablero que trabaja mientras los agentes trabajan',
    lead: 'Cada ciclo registra tokens y tiempos. El visor los convierte en una comparativa de costos contra la estimación tradicional — y en local se actualiza solo, mientras el loop corre. Dale play:',
    features: [
      { t: 'Telemetría honesta', d: 'Al cerrar cada ciclo se registran tokens por tier de modelo y minutos en cycle.json → metrics.usage. El costo agéntico sale de tarifas editables en sdd/pricing.json; la estimación tradicional, de las horas que ya estiman tus tasks.' },
      { t: 'Reactividad quirúrgica', d: 'El visor pollea un fingerprint POR ÁREA de los registros cada 4 segundos. Solo re-renderiza tu vista si cambió un área de la que depende: cerrar un ciclo actualiza Costos y Ciclos, pero no te toca la vista de Agentes.' },
      { t: 'Tu UI queda intacta', d: 'Secciones expandidas, búsquedas escritas y posición de scroll se preservan en cada actualización. Y si tenés un documento abierto o la pestaña oculta, el refresh espera. En hosting estático, el botón Actualizar de siempre.' },
    ],
    cta: 'Ver el visor completo, con capturas reales',
    demo: {
      live: 'local · live',
      tagline: '— el visor mientras el loop trabaja',
      replay: 'replay',
      pause: 'Pausar simulación',
      resume: 'Reanudar simulación',
      kpiTasks: 'tasks done',
      kpiTokens: 'tokens',
      kpiCost: 'costo agéntico',
      kpiSaving: 'ahorro',
      legendTraditional: 'tradicional',
      legendAgentic: 'agéntico',
      activity: 'actividad del loop',
      steps: [
        { actor: 'sdd-orchestrator', feed: 'SPEC GATE OK · abre cycle-01 (auth) · brief + cycle.json' },
        { actor: 'sdd-implementor-back', feed: 'TASK-001 done · modelo de usuario · 352k tokens (sonnet)' },
        { actor: 'sdd-implementor-back', feed: 'TASK-002 done · endpoints login/refresh · 608k tokens (sonnet)' },
        { actor: 'sdd-architect', feed: 'TASK-003 done · revisión y hardening · 171k tokens (opus)' },
        { actor: 'sdd-reviewer', feed: 'cierra cycle-01 ✓ · CONTEXTO + MEMORIA GATE · lección → journal' },
      ],
      footnote: 'tradicional = 20 h estimadas × US$ 50/h · agéntico = tokens × tarifa por tier (sdd/pricing.json)',
      donePre: 'Ciclo cerrado: el dashboard lo reflejó ',
      doneEm: 'solo',
      doneMid: ' — sin recargar, sin tocar nada, y sin perder lo que tenías expandido. Ahorro proyectado del ciclo: ',
      donePost: '.',
    },
  },
  commands: {
    kicker: '04 — referencia',
    title: 'Comandos',
    lead: 'Todo interactivo con prompts guiados; todo automatizable con flags y -y.',
  },
  methodology: {
    kicker: '05 — la metodología',
    title: 'Siete agentes, cuatro gates, cero improvisación',
    lead: 'Cada feature atraviesa un ciclo de diseño antes de tocar código. Los agentes escriben artefactos verificables; los gates los exigen.',
    footnote1: 'specs por autor: spec-jdoe-001-user-onboarding / cycles/cycle-01/',
    footnote2: '6 artefactos por ciclo — brief · functional · planner · architect · tasks · cycle',
  },
  catalog: {
    kicker: '06 — catálogo',
    title: 'Lo que puede generar',
    apps: 'Apps — 7 tipos',
    libs: 'Libs compartidas',
    services: 'Servicios Docker',
    dockerNote: 'docker-compose.yml con healthchecks, listo para levantar la infraestructura local del ciclo.',
  },
  kit: {
    kicker: '07 — el corazón',
    title: 'El kit SDD portable',
    lead: 'Todo lo que la CLI instala vive en una sola carpeta sdd/ copiada verbatim — diseñada para moverse entre repos sin editar un solo archivo.',
    scripts: 'Scripts que viajan con el kit',
    linkPre: 'Conocé ',
    linkPost: ' a fondo — capturas reales y las 16 vistas',
    update: {
      kicker: 'Actualizar el kit — sin miedo',
      title: 'Un comando trae todo lo nuevo. Lo tuyo no se toca.',
      p1: 'El update se gobierna por los hashes de ',
      p2: ': sabe exactamente qué archivo es del kit, cuál es tuyo y cuál modificaste. Al cierre regenera el catálogo, refresca los symlinks y corre ',
      p3: '.',
      rows: [
        { k: 'Tus datos', v: 'specs, ciclos, fixes, contextos, memoria — jamás se tocan' },
        { k: 'Kit sin modificar', v: 'se reemplaza por la versión nueva, silenciosamente' },
        { k: 'Archivos nuevos', v: 'se agregan solos (memoria, pricing, skills nuevas…)' },
        { k: 'Lo que editaste', v: 'queda intacto; la versión nueva aterriza al lado como *.new para fundir a mano' },
      ],
    },
  },
  start: {
    kicker: '08 — empezar',
    title: 'Tres comandos y estás adentro',
    steps: [
      { n: '01', t: 'Generá o instalá', c: 'npx @e-burgos/sdd-harness init', d: 'Monorepo Nx o standalone. Para un repo existente: harness configure sdd.' },
      { n: '02', t: 'Escribí tu primera spec — o tirá una idea', c: 'harness add spec mi-feature', d: 'El QUÉ antes del cómo. O harness idea "..." para que el agente arme todo el plan (flujo hermes).' },
      { n: '03', t: 'Arrancá el ciclo', c: '/start-sdd-cycle.prompt', d: 'Desde Claude Code o Copilot: el orquestador toma la spec y el ciclo corre solo.' },
    ],
  },
  footer: { by: 'Desarrollado por ' },
  viewer: {
    back: 'volver a la documentación',
    kicker: 'sdd:docs — la herramienta estrella',
    h1a: 'El sistema SDD tiene su propia cara.',
    h1b: ' Y vive dentro del kit.',
    b1: 'Los registros de SDD son JSON pensados para máquinas. ',
    b2: ' es su cara humana: un visor que lee global.json, specs, ciclos, tareas y catálogos ',
    bLive: 'en vivo',
    b3: ' y los convierte en un dashboard navegable — sin instalar nada, sin build, sin CDN.',
    cmdNote: '→ http://127.0.0.1:4310/sdd/docs/',
    shotAltPre: 'Vista ',
    shotAltPost: ' del visor sdd:docs',
    realNote: 'Capturas reales del visor corriendo sobre un workspace generado con harness init.',
    usage: {
      kicker: 'cómo se usa',
      title: 'Un comando, dieciséis vistas',
      lead: 'El visor se instala solo — viene adentro de sdd/docs/ en cada repo generado. No hay setup.',
      steps: [
        { n: '01', t: 'Levantalo', c: 'pnpm sdd:docs', d: 'Un server de solo módulos node:* sirve el visor en el puerto 4310. Sin npm install extra, sin build.' },
        { n: '02', t: 'Navegá por hash', c: '#/costs · #/cycles · #/agents', d: 'Router por hash con 16 vistas en 5 secciones. Cada spec, ciclo, task y fix con su detalle.' },
        { n: '03', t: 'Trabajá — se actualiza solo', c: '__state → re-render selectivo', d: 'En local pollea los registros por área cada 4s: cerrás un ciclo y la vista activa lo refleja sin recargar, preservando tu UI. El validador lo mantiene honesto.' },
      ],
      viewsHeading: 'Las 16 vistas',
    },
    principles: {
      kicker: 'por qué es así',
      title: 'Portable a propósito',
      lead: 'Cada decisión del visor sale de la misma regla que gobierna el kit: copiar sdd/ a otro repo tiene que funcionar sin editar nada.',
      footNote: 'Todo repo generado trae el visor adentro.',
    },
  },
  guia: {
    back: 'volver a la documentación',
    kicker: 'guía sdd — la documentación que viaja con el kit',
    h1a: 'El manual completo del sistema,',
    h1b: ' antes de instalarlo.',
    body: 'Estos dos documentos viven dentro de sdd/ en cada repo generado — acá los podés leer completos: la referencia del sistema (gates, agentes, registros, reglas) y la guía paso a paso para el día a día de un dev.',
    tabs: [
      { id: 'readme', tab: 'README — el sistema' },
      { id: 'how-to', tab: 'HOW-TO — paso a paso' },
    ],
    installedNote: ' — se instala tal cual en cada repo',
    tocHeading: 'En este documento',
    langNote: null as string | null,
  },
} as const;
