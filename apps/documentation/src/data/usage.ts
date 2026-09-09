// Contenido de la página "Cómo usarlo" (ruta #/como-usarlo), en español.
// Cada pestaña es una lista de bloques que la página renderiza genéricamente,
// así el contenido se edita acá y el componente no cambia.
// Espejo obligatorio: src/data/usage.en.ts — si cambia uno, cambia el otro.
import type { TerminalLine } from './content';

export type UsageBlock =
  | { kind: 'heading'; text: string; hint?: string }
  | { kind: 'prose'; text: string }
  | { kind: 'note'; tone?: 'info' | 'warn'; text: string }
  | {
      kind: 'steps';
      title?: string;
      items: { title: string; body: string; command?: string }[];
    }
  | { kind: 'terminal'; title: string; lines: TerminalLine[] }
  | { kind: 'code'; title?: string; lines: string[] }
  | { kind: 'table'; title?: string; head: string[]; rows: string[][] }
  | {
      kind: 'cards';
      title?: string;
      items: { title: string; tag?: string; body: string }[];
    }
  | {
      kind: 'chat';
      title: string;
      turns: { who: 'dev' | 'agent'; name?: string; text: string }[];
    };

export type UsageTab = {
  id: string;
  tab: string;
  kicker: string;
  title: string;
  lead: string;
  blocks: UsageBlock[];
};

// ─── 1. Elegir instalación ────────────────────────────────────────────────────

const INSTALL: UsageTab = {
  id: 'instalacion',
  tab: 'Elegir instalación',
  kicker: '01 — instalar',
  title: 'Elegí cómo entra el sistema a tu repo',
  lead: 'Tres modos, un mismo kit sdd/. Lo que decide no es el tamaño del equipo: es qué tenés en la mano — un repo que todavía no existe con varias apps, una sola app, o código que ya existe y no se toca.',
  blocks: [
    {
      kind: 'cards',
      title: '¿Cuál te toca?',
      items: [
        {
          title: 'Nx monorepo',
          tag: 'npx @e-burgos/sdd-harness@latest init',
          body: 'Repo nuevo con más de una app (front + API, o varias APIs) y librerías compartidas. Genera apps/, libs/, tools/, la config raíz de Nx 23 + pnpm 10 y el sistema SDD completo.',
        },
        {
          title: 'Standalone',
          tag: 'npx @e-burgos/sdd-harness@latest init --standalone',
          body: 'Repo nuevo con UNA sola app: el código vive en la raíz, sin Nx. Siete tipos de app disponibles. El mismo sistema SDD, los mismos gates, sin capas de más.',
        },
        {
          title: 'SDD harness',
          tag: 'npx @e-burgos/sdd-harness@latest configure sdd',
          body: 'Ya tenés un repo con código. Instala solo la metodología: no toca tu código, mergea tus scripts en package.json y absorbe tus AGENTS.md/CLAUDE.md previos antes de linkear.',
        },
      ],
    },
    {
      kind: 'prose',
      text: 'Los tres se corren con npx — no hay nada que instalar globalmente, y @latest garantiza que el kit que se copia sea el de la última versión publicada.',
    },
    { kind: 'heading', text: 'Modo 1 — Nx monorepo', hint: 'npx @e-burgos/sdd-harness@latest init' },
    {
      kind: 'terminal',
      title: 'El wizard, de punta a punta',
      lines: [
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest init' },
        { kind: 'prompt', text: 'Project name:' },
        { kind: 'answer', text: 'flexi-market' },
        { kind: 'prompt', text: 'Project description:' },
        { kind: 'answer', text: 'Marketplace de órdenes: portal React + API Spring Boot' },
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
        { kind: 'out', text: '→ nx run-many -t lint test build   (gate de FASE 3)' },
        { kind: 'out', text: '→ Initializing git repository...' },
        { kind: 'ok', text: '✓ Workspace "flexi-market" created successfully.' },
      ],
    },
    {
      kind: 'table',
      title: 'Qué se elige en cada prompt (y cómo saltearlo)',
      head: ['Prompt', 'Opciones reales', 'Flag que lo evita'],
      rows: [
        ['Project name:', 'kebab-case obligatorio (a-z, dígitos y guiones)', '--name <nombre>'],
        ['Project description:', 'texto libre — va a sdd/global.json', '—'],
        ['What do you want to generate?', 'Nx monorepo · Standalone app', '--mode nx | --standalone'],
        ['npm package scope:', 'scope de los paquetes del monorepo (ej. @flexi-market)', '--config'],
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
      text: 'Multiselección: espacio marca/desmarca, enter confirma. Se puede seguir sin elegir ninguna lib ni ningún servicio — el SDD se instala igual, siempre.',
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Al cerrar, init corre el gate de FASE 3 (sdd:validate + nx run-many -t lint test build) y falla si algo queda rojo. --skipVerify lo saltea. --here genera en el directorio actual en vez de ./<nombre>, y --dir <ruta> apunta a otro destino.',
    },
    { kind: 'heading', text: 'Modo 2 — Standalone', hint: 'npx @e-burgos/sdd-harness@latest init --standalone' },
    {
      kind: 'terminal',
      title: 'Una sola app, el código en la raíz',
      lines: [
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest init --standalone' },
        { kind: 'prompt', text: 'Project name:' },
        { kind: 'answer', text: 'pulse-api' },
        { kind: 'prompt', text: 'Project description:' },
        { kind: 'answer', text: 'API de métricas en tiempo real' },
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
      text: 'En standalone el repo se registra en los registros SDD como una única app lógica apps/<nombre>. Los schemas quedan intactos y todos los gates funcionan igual que en el monorepo: no hay una versión “recortada” de la metodología.',
    },
    {
      kind: 'heading',
      text: 'Modo 3 — SDD harness sobre un repo que ya existe',
      hint: 'npx @e-burgos/sdd-harness@latest configure sdd',
    },
    {
      kind: 'terminal',
      title: 'Se corre desde adentro del repo, sin tocar el código',
      lines: [
        { kind: 'cmd', text: 'cd mi-repo-legacy' },
        { kind: 'cmd', text: 'npx @e-burgos/sdd-harness@latest configure sdd' },
        { kind: 'prompt', text: 'Project name (stored only in sdd/global.json):' },
        { kind: 'answer', text: 'legacy-shop' },
        { kind: 'prompt', text: 'Project description (stored only in sdd/global.json):' },
        { kind: 'answer', text: 'E-commerce heredado — migración progresiva' },
        { kind: 'out', text: '┌ Install plan' },
        { kind: 'out', text: '│ Layout: Nx monorepo' },
        { kind: 'out', text: '│ Apps registradas: storefront (react), checkout-api (nestjs)' },
        { kind: 'out', text: '│ package.json: merge de scripts sdd:* + ajv' },
        { kind: 'out', text: '│ AGENTS.md/CLAUDE.md previos: se absorben en sdd/dual-harness' },
        { kind: 'out', text: '│ .claude/.github/.agents propios: se conservan; toda colisión queda como *.new' },
        { kind: 'out', text: '└' },
        { kind: 'ok', text: '✓ sdd/ installed (agents, skills, prompts, schemas, docs viewer, templates)' },
        { kind: 'ok', text: '✓ package.json updated: sdd:* scripts + ajv/ajv-formats' },
        { kind: 'ok', text: '✓ Harness symlinks created — tus agentes y skills se conservaron' },
      ],
    },
    {
      kind: 'cards',
      title: 'Lo que este modo garantiza que NO se pierde',
      items: [
        {
          title: 'Tu código',
          body: 'configure sdd no escribe una sola línea dentro de src/. Solo agrega sdd/, los symlinks del arnés y las entradas nuevas del package.json.',
        },
        {
          title: 'Tu package.json',
          body: 'Se mergea, no se pisa: se agregan los scripts sdd:* y ajv/ajv-formats. Si el repo no es Node (Java o Python puros), se crea uno mínimo solo para el arnés.',
        },
        {
          title: 'Tus AGENTS.md / CLAUDE.md',
          body: 'Se absorben dentro de sdd/dual-harness/ ANTES de reemplazarlos por symlinks. Ninguna instrucción previa desaparece.',
        },
        {
          title: 'Tus agentes y skills propios',
          body: 'Los directorios reales de .claude/, .github/ y .agents/ se conservan; el kit se enlaza al lado y cada colisión de nombre queda como <nombre>.new para que la fundas vos.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Si el repo YA tiene sdd/, configure sdd pregunta antes: vuelve a instalar el kit RESETEANDO todo sdd/ (specs, ciclos y fixes incluidos). Para actualizar sin perder datos el comando es otro — está en la pestaña “Actualización del kit”. Con --yes y sin TTY, el reset ocurre sin preguntar.',
    },
    {
      kind: 'chat',
      title: 'Y si la instalación dejó colisiones, se las pedís al steward',
      turns: [
        {
          who: 'dev',
          text: '/sdd-steward la instalación dejó varios *.new en .claude/ y .github/. ¿Podés revisarlos y fundir lo que aporte, sin pisar lo nuestro?',
        },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Encontré 3. (1) .claude/skills/sdd-reviewer/SKILL.md.new: tenías una skill propia con ese mismo nombre, son distintas y hoy compiten. (2) .github/agents/sdd-orchestrator.md.new: no tenías uno propio con ese nombre, el del kit entra tal cual. (3) AGENTS.md.new: tu arnés previo ya quedó absorbido dentro de sdd/dual-harness/AGENTS.md, así que este no aporta nada nuevo. Propongo aplicar (2), descartar (3) y que (1) la decidas vos. ¿Aplico?',
        },
        { who: 'dev', text: 'Aplicá 2 y 3. La skill la miro yo, quiero conservar el nombre.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Hecho: entró el agente del kit, borré los dos .new resueltos y dejé SKILL.md.new intacto, anotado en el reporte para que no se pierda. pnpm setup:agents y pnpm sdd:validate en verde.',
        },
      ],
    },
    { kind: 'heading', text: 'Después de generar — los tres modos' },
    {
      kind: 'steps',
      items: [
        {
          title: 'Instalar dependencias',
          body: 'sdd:validate necesita ajv, que la CLI declaró en el package.json pero no instaló.',
          command: 'pnpm install',
        },
        {
          title: 'Regenerar las superficies del arnés',
          body: 'Crea los symlinks de .claude/, .github/, .agents/, .agent/, .gemini/ y los AGENTS.md / CLAUDE.md / GEMINI.md de la raíz. Es idempotente: se puede correr siempre.',
          command: 'pnpm setup:agents',
        },
        {
          title: 'Verificar que los registros están sanos',
          body: 'Valida todos los JSON de sdd/ contra sus schemas estrictos y corre las reglas cruzadas. Tiene que quedar verde antes de empezar a trabajar.',
          command: 'pnpm sdd:validate',
        },
        {
          title: 'Abrir el visor (opcional)',
          body: 'Sirve sdd/docs en 127.0.0.1: agentes, skills, schemas, specs y el dashboard de Costos, leyendo los registros en vivo y sin build.',
          command: 'pnpm sdd:docs',
        },
      ],
    },
    {
      kind: 'code',
      title: 'Los mismos pasos, pedidos en lenguaje natural',
      lines: [
        '# verificar que la instalación quedó sana, sin correr nada a mano',
        '/sdd-steward acabo de instalar el kit: ¿está todo bien? ¿faltan symlinks o hay registros en rojo?',
        '',
        '# entender cómo quedó registrado un repo que ya existía',
        '/sdd-steward ¿cómo quedó este repo en global.json? Layout, apps registradas y perfil.',
        '',
        '# arrancar de una vez, sin escribir una spec a mano (hermes conduce, el steward hace el intake)',
        '/sdd-hermes tengo una idea: <una frase>. Dejame listo para abrir el primer ciclo.',
      ],
    },
    { kind: 'heading', text: 'Sin wizard — para agentes y CI', hint: 'npx @e-burgos/sdd-harness@latest init --config' },
    {
      kind: 'prose',
      text: 'Todo el wizard cabe en un archivo de configuración. Es la vía que usan los agentes (y CI) para generar un workspace sin un solo prompt interactivo.',
    },
    {
      kind: 'code',
      title: 'harness.config.json',
      lines: [
        '{',
        '  "project": {',
        '    "name": "flexi-market",',
        '    "description": "Marketplace de órdenes",',
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
      title: 'Y se genera así',
      lines: [
        '# genera en ./flexi-market, sin preguntar nada',
        'npx @e-burgos/sdd-harness@latest init --config harness.config.json',
        '',
        '# o dentro del directorio actual (repo ya git init-eado)',
        'npx @e-burgos/sdd-harness@latest init --config harness.config.json --here',
      ],
    },
    {
      kind: 'note',
      text: 'El perfil de trabajo se fija acá o por flag: --profile solo | team en init y en configure sdd (con --config gana sdd.profile). Qué cambia cada perfil está en la pestaña “Spec Gate”.',
    },
  ],
};

// ─── 2. Actualización del kit ────────────────────────────────────────────────

const UPDATE: UsageTab = {
  id: 'actualizacion',
  tab: 'Actualización del kit',
  kicker: '02 — actualizar',
  title: 'Subir de versión sin perder nada tuyo',
  lead: 'Un comando, o un pedido en lenguaje natural al sdd-steward. En los dos casos la frontera es la misma y la decide sdd/kit.json: los archivos del kit se reemplazan, tus datos no se tocan nunca.',
  blocks: [
    { kind: 'heading', text: 'Vía A — el comando', hint: 'npx @e-burgos/sdd-harness@latest update sdd' },
    {
      kind: 'steps',
      items: [
        {
          title: 'Correrlo desde la raíz del repo',
          body: 'No hace falta reinstalar nada: @latest baja la CLI del momento y actualiza el kit instalado a la versión que esa CLI trae adentro.',
          command: 'npx @e-burgos/sdd-harness@latest update sdd',
        },
      ],
    },
    {
      kind: 'table',
      title: 'Qué le pasa a cada archivo',
      head: ['Tipo de archivo', 'Qué hace el update'],
      rows: [
        [
          'Tus datos — global.json, specs, ciclos, fixes, contexto, memory/journal/',
          'No se tocan nunca',
        ],
        [
          'Archivos del kit sin modificar localmente — agentes, skills, prompts, schemas, scripts, visor',
          'Se reemplazan por la versión nueva',
        ],
        ['Archivos del kit nuevos en esta versión', 'Se agregan solos'],
        [
          'Archivos del kit que vos editaste (típico: dual-harness/AGENTS.md)',
          'Tu versión queda intacta; la nueva aterriza al lado como *.new',
        ],
        ['Archivos del kit que ya no existen en la versión nueva', 'Se eliminan como stale, si no los editaste'],
      ],
    },
    {
      kind: 'terminal',
      title: 'Cómo se ve el reporte',
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
      title: 'Checklist post-update (en este orden)',
      items: [
        {
          title: 'Leer el reporte',
          body: 'Qué se reemplazó, qué se agregó y qué quedó como *.new. Si aparece modificado algo que es dato tuyo (una spec, un ciclo, un fix), pará y reportalo: eso es un bug, no un comportamiento esperado.',
        },
        {
          title: 'Fundir los *.new',
          body: 'Son archivos del kit que tu equipo había editado. Traé a mano lo que te sirva de la versión nueva y borrá el .new — no dejarlos huérfanos: el próximo update vuelve a generarlos.',
        },
        {
          title: 'Refrescar las superficies del arnés',
          body: 'El update ya lo corre, pero volver a correrlo es gratis y confirma que los cuatro arneses quedaron enlazados.',
          command: 'pnpm setup:agents',
        },
        {
          title: 'Dejar los registros en verde',
          body: 'Si la versión nueva trajo schemas más estrictos, acá aparece qué registro hay que migrar. El mismo check corre en CI.',
          command: 'pnpm sdd:validate',
        },
      ],
    },
    {
      kind: 'note',
      text: 'Si la instalación es vieja y no tiene sdd/kit.json (baseline de hashes), el update entra en modo conservador y pide confirmación: reemplaza solo los directorios puros del kit, nunca toca dual-harness ni la constitución global, y escribe el manifiesto para que el próximo update sea quirúrgico.',
    },
    { kind: 'heading', text: 'Vía B — pedírselo al sdd-steward' },
    {
      kind: 'prose',
      text: 'El steward es el conserje del kit: la puerta de entrada para todo lo que es el kit en sí — estado, versión, costos, salud de los arneses, perfil de trabajo. No implementa código y no bypassea ningún gate; para actualizar corre exactamente el mismo comando y después el checklist de arriba.',
    },
    {
      kind: 'chat',
      title: 'Una conversación real',
      turns: [
        { who: 'dev', text: '/sdd-steward ¿en qué estado está el kit?' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Kit v0.12.1 instalado (npm latest: v0.13.0 → hay update). Perfil: team (ciclos full). Módulos: 2 pending, 1 in-progress, 4 completed. Ciclos en vuelo: spec-jdoe-003 cycle-02, flow full, 4/7 tasks. Fixes abiertos: 1 (FIX-jdoe-003-2, BUGFIX, medium). Memoria: 3 fragmentos sin destilar. sdd:validate: OK. Arneses: los 5 symlinks presentes. rtk: activo, binario v0.4.2.',
        },
        { who: 'dev', text: 'Actualizalo.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Corriendo npx @e-burgos/sdd-harness@latest update sdd… v0.12.1 → v0.13.0: 34 archivos reemplazados, 3 nuevos (spec-gate.mjs, sdd-gates.md, sdd-gate.prompt.md), 1 conflicto en dual-harness/AGENTS.md — tu versión quedó y la nueva está como AGENTS.md.new. Tus specs, ciclos y fixes no se tocaron. setup:agents y sdd:validate en verde. ¿Fundo el AGENTS.md.new o lo mirás vos?',
        },
        {
          who: 'dev',
          text: '/sdd-steward ¿podrías fundir los *.new o conflictos que encuentres?',
        },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Hay uno solo: dual-harness/AGENTS.md.new. El delta contra tu versión son tres bloques: SPEC GATE como comando (pnpm sdd:gate), la regla de perfil team|solo, y un cambio de wording en la tabla de agentes. Tus dos secciones propias (convención de commits y la nota de despliegue) no existen en la versión del kit, así que las conservo tal cual. Propongo incorporar los tres bloques nuevos y dejar lo tuyo al final. ¿Lo aplico?',
        },
        { who: 'dev', text: 'Dale, y borrá el .new cuando termines.' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Fundido y .new borrado: +48 líneas del kit, 0 líneas tuyas eliminadas. Corrí pnpm setup:agents (los tres arneses raíz siguen apuntando al mismo archivo) y pnpm sdd:validate: verde.',
        },
      ],
    },
    {
      kind: 'code',
      title: 'Pedidos que resuelven el post-update',
      lines: [
        '# lo único que el update deja pendiente: los conflictos',
        '/sdd-steward ¿podrías fundir los *.new o conflictos que encuentres?',
        '/sdd-steward mostrame el diff de AGENTS.md.new contra el mío antes de tocar nada',
        '',
        '# la versión nueva trajo schemas más estrictos y la validación quedó en rojo:',
        '# el steward diagnostica (no escribe registros), y la migración va a su dueño',
        '/sdd-steward sdd:validate falla después del update: ¿qué registro cambió de schema y qué hay que ajustar?',
        '/sdd-orchestrator Migrá los cycle.json y specs/index.json que el validador marca al schema nuevo.',
        '/sdd-reviewer Migrá los registros de cierre (schema.json, api.json, components.json) que quedaron fuera de schema.',
        '',
        '# decidir si conviene actualizar ahora',
        '/sdd-steward ¿qué trae la versión nueva respecto de la que tengo instalada?',
        '',
        '# dejar los cuatro arneses enlazados otra vez',
        '/sdd-steward regenerá las superficies del arnés y confirmame que quedaron todos los symlinks',
      ],
    },
    {
      kind: 'table',
      title: 'Otras cosas que el steward resuelve solo (sin abrir un ciclo)',
      head: ['Pedido', 'Qué hace'],
      rows: [
        ['“¿qué versión tengo?”', 'Lee sdd/kit.json y lo compara contra npm view @e-burgos/sdd-harness version'],
        ['“¿cuánto llevamos gastado?”', 'Agrega el usage de ciclos, tasks y fixes con las tarifas de sdd/pricing.json'],
        ['“¿los arneses están sanos?”', 'Verifica los symlinks de los cuatro proveedores y ofrece pnpm setup:agents'],
        ['“pasame a perfil solo”', 'Escribe sdd/global.json → profile y deja sdd:validate en verde'],
        ['“¿cuánto ahorró rtk?”', 'node sdd/scripts/setup-rtk.mjs --status y la pestaña RTK del visor'],
        ['“¿cómo funciona el FIX GATE?”', 'Responde desde sdd/documentation/ — lectura quirúrgica, sin cargar el kit entero'],
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Lo que el steward nunca hace: escribir código de implementación, tocar registros de un ciclo en curso, o bypassear SPEC GATE / FIX GATE / CONTEXTO GATE / MEMORIA GATE. Si tu pedido termina en código, lo rutea al flujo con gates.',
    },
  ],
};

// ─── 3. Spec Gate ────────────────────────────────────────────────────────────

const SPEC_GATE: UsageTab = {
  id: 'spec-gate',
  tab: 'Spec Gate',
  kicker: '03 — spec gate',
  title: 'El gate que no deja codear sin diseño',
  lead: 'SPEC GATE no es una checklist que el agente recita: es un comando que responde APPROVED o BLOCKED, con una línea por condición. Corre en dos momentos — A al abrir el ciclo, B antes de la primera línea de código.',
  blocks: [
    {
      kind: 'code',
      title: 'Los dos momentos, el mismo comando',
      lines: [
        '# GATE A — ¿puedo abrir un ciclo para esta spec?',
        'pnpm sdd:gate <spec-id|slug>',
        '',
        '# GATE B — ¿puedo empezar a escribir código en este ciclo?',
        'pnpm sdd:gate <spec-id|slug> cycle-01',
        '',
        '# salida estructurada, para agentes y CI',
        'pnpm sdd:gate <spec-id|slug> --json',
      ],
    },
    {
      kind: 'table',
      title: 'Invariantes — valen en todo flow y todo perfil',
      head: ['#', 'Invariante'],
      rows: [
        ['1', 'La spec existe y está registrada en sdd/specs/index.json'],
        ['2', 'El módulo está en sdd/global.json (pending para abrir, in_progress para implementar)'],
        ['3', 'Existe cycle.json con status "in-progress" antes de la primera línea de código'],
        ['4', 'Existe tasks.json con tasks, y ninguna task pasa a done sin su usage (telemetría)'],
      ],
    },
    {
      kind: 'prose',
      text: 'Nada de lo que sigue relaja esos cuatro puntos. Lo que cambia entre perfiles y flows es la forma — cuántos documentos y cuántos roles —, nunca la trazabilidad.',
    },
    { kind: 'heading', text: 'GATE A — apertura de ciclo' },
    {
      kind: 'table',
      head: ['#', 'Condición'],
      rows: [
        ['A1', 'Spec registrada en specs/index.json y su archivo .spec.md existe'],
        ['A2', 'Módulo en pending_modules o in_progress_modules (nunca en completed_modules)'],
        ['A3', 'Ningún otro ciclo de esa spec está in-progress — un ciclo activo por spec'],
        ['A4', 'Las dependencias de la spec (depends_on) están completed'],
        ['A5', 'La spec no está completed ni cancelled'],
      ],
    },
    {
      kind: 'terminal',
      title: 'Salida real de un GATE A aprobado',
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
      text: 'El script viaja verbatim dentro del kit e imprime en inglés, así su salida es idéntica en todos los repos que lo instalan — se pega tal cual como reporte del gate.',
    },
    { kind: 'heading', text: 'GATE B — implementación' },
    {
      kind: 'table',
      head: ['#', 'Condición'],
      rows: [
        ['B1', 'cycle.json existe con status "in-progress"'],
        ['B2', 'Módulo en in_progress_modules de global.json'],
        ['B3', 'tasks.json del ciclo con al menos una task'],
        [
          'B4',
          'Documentos del flow: full → brief/functional/planner/architect · reduced → brief · lite → plan.md',
        ],
        ['B5', 'cycle.json → apps[] no vacío y constitution.md de cada subproyecto listado'],
      ],
    },
    {
      kind: 'terminal',
      title: 'Salida real de un GATE B bloqueado',
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
      text: 'BLOCKED en GATE B significa cero líneas de código. El script dice qué falta; recién ahí se lee el template de ese artefacto — no antes, para no cargar contexto que todavía no hace falta.',
    },
    {
      kind: 'code',
      title: 'Pedidos que destraban un gate bloqueado',
      lines: [
        '# el gate dice QUÉ falta; vos elegís A QUIÉN se lo pedís: al dueño de ese artefacto',
        '',
        '# B4 — faltan planner.md y architect.md: un agente por documento',
        '/sdd-planner Generar planner.md para el Ciclo 01 — spec-jdoe-001-market-data-feed.',
        '/sdd-architect Generar architect.md para el Ciclo 01 — spec-jdoe-001-market-data-feed.',
        '',
        '# B3 — falta tasks.json (lo deriva el planner de su propia descomposición)',
        '/sdd-planner El GATE B bloquea por B3: creá tasks.json del cycle-01 desde planner.md.',
        '',
        '# A1/A2 — la spec o el módulo no están registrados: es del orquestador',
        '/sdd-orchestrator El GATE A bloquea por A2: no hay ModuleEntry para market-data-feed.',
        'Registrá el módulo en pending_modules y volvé a correr pnpm sdd:gate.',
        '',
        '# B5 — falta la constitution.md de un subproyecto del ciclo',
        '/sdd-orchestrator El GATE B bloquea por B5: tools/qa-flows no tiene constitution.md.',
        '',
        '# A3/A4 — diagnóstico primero: por qué está bloqueado y quién lo destraba',
        '/sdd-steward hay un ciclo in-progress que nadie toca: decime cuál es y qué falta para cerrarlo.',
        '/sdd-steward ¿por qué spec-jdoe-002 bloquea a spec-jdoe-005? Mostrame el depends_on y el estado de cada una.',
      ],
    },
    { kind: 'heading', text: 'El perfil: team o solo' },
    {
      kind: 'prose',
      text: 'sdd/global.json → profile decide con qué flow se abren los ciclos nuevos. Es la única palanca que cambia la forma del gate, y el único que la toca es el sdd-steward, a pedido explícito del dev.',
    },
    {
      kind: 'table',
      head: ['Perfil', 'Flow por defecto', 'Qué cambia'],
      rows: [
        [
          'team (default — se puede omitir la clave)',
          'full',
          'Un rol por documento: orquestador (brief.yaml), funcional (functional.md), planner (planner.md), arquitecto (architect.md); después implementores y reviewer. FIX GATE con cuestionario de 6 preguntas.',
        ],
        [
          'solo',
          'lite',
          'Un solo actor con tres sombreros: abre, implementa y cierra. plan.md reemplaza a los cuatro documentos. Sin fan-out de subagentes: el contexto se lee una vez. FIX GATE sin cuestionario y con template mínimo.',
        ],
      ],
    },
    {
      kind: 'code',
      title: 'Tres formas de fijarlo',
      lines: [
        '# 1. Pedírselo al steward — es el único agente que toca el perfil',
        '/sdd-steward pasame a perfil solo',
        '',
        '# 2. Al generar el repo, o reconfigurándolo después',
        'npx @e-burgos/sdd-harness@latest init --profile solo',
        'npx @e-burgos/sdd-harness@latest configure sdd --profile team',
        '',
        '# 3. Para un pedido puntual, sin tocar el perfil — el prefijo gana',
        '[LITE] Implementá el filtro de fechas del listado de órdenes.',
        '[FULL] Implementá el módulo de pagos.',
        '',
        '# y si no sabés cuál te conviene, preguntá antes de tocar nada',
        '/sdd-steward trabajo solo pero esta spec crea endpoints nuevos: ¿lite o full?',
      ],
    },
    {
      kind: 'note',
      text: 'Los ciclos ya abiertos conservan el flow escrito en su cycle.json: cambiar el perfil solo afecta a los ciclos nuevos.',
    },
    { kind: 'heading', text: 'Cómo se construye un ciclo full', hint: 'perfil team' },
    {
      kind: 'steps',
      items: [
        {
          title: 'GATE A',
          body: 'Se corre y se pega la salida como reporte del gate en el mensaje al orquestador. APPROVED imprime además el próximo cycle-XX y el flow sugerido.',
          command: 'pnpm sdd:gate market-data-feed',
        },
        {
          title: 'El orquestador abre el ciclo',
          body: 'Crea el .spec.md si no existe, lo registra en specs/index.json y en pending_modules, y escribe cycle-01/cycle.json con status "in-progress", flow "full" y metrics.usage.by_agent: []. Mueve el módulo a in_progress_modules. No implementa nada.',
        },
        {
          title: 'sdd-functional escribe functional.md',
          body: 'Las historias de usuario y los criterios de aceptación (CA-001, CA-002…) contra los que después se valida el ciclo.',
        },
        {
          title: 'sdd-planner y sdd-architect, en paralelo',
          body: 'planner.md descompone en tasks; architect.md define contratos, entidades y endpoints. Si el ciclo toca schema.json, api.json o components.json, se declaran acá.',
        },
        {
          title: 'GATE B',
          body: 'Con los cuatro documentos y tasks.json en su lugar. BLOCKED → cero código.',
          command: 'pnpm sdd:gate market-data-feed cycle-01',
        },
        {
          title: 'Implementación task por task',
          body: 'Una task por conversación, sin agrupar: primero sdd-implementor-back, después sdd-implementor-front (que verifica que los endpoints que consume estén "implemented" en sdd/api.json). Cada task cierra en done con files[] y su usage.',
        },
        {
          title: 'sdd-reviewer cierra',
          body: 'Valida los criterios de aceptación uno por uno, pasa el ciclo a completed, mueve el módulo a completed_modules, escribe el fragmento del CONTEXTO GATE y deja sdd:validate en verde.',
        },
      ],
    },
    { kind: 'heading', text: 'Cómo se construye un ciclo lite', hint: 'perfil solo' },
    {
      kind: 'steps',
      items: [
        {
          title: 'GATE A — el mismo',
          body: 'Idéntico al full: las cinco condiciones no se relajan. La salida sugiere flow lite porque el perfil es solo.',
          command: 'pnpm sdd:gate market-data-feed',
        },
        {
          title: 'Abrir el ciclo',
          body: 'cycle.json con status "in-progress", flow "lite" y metrics.usage.by_agent: []; el módulo pasa a in_progress_modules. Lo hace el mismo actor que va a implementar.',
        },
        {
          title: 'Escribir plan.md',
          body: 'Un solo documento con cuatro secciones fijas: objetivo · historias · tasks en prosa · decisiones técnicas. La última es obligatoria si el ciclo toca schema.json, api.json o components.json — y esos registros se actualizan igual que en full.',
        },
        {
          title: 'Crear tasks.json',
          body: 'Con flow "lite" (user_stories puede ir vacío) y regenerar el índice con pnpm sdd:rebuild-tasks-index.',
        },
        {
          title: 'GATE B',
          body: 'Exige plan.md en vez de los cuatro documentos: lee el flow del ciclo y pide los documentos de ESE flow.',
          command: 'pnpm sdd:gate market-data-feed cycle-01',
        },
        {
          title: 'Implementar y cerrar, el mismo actor',
          body: 'Task por task, cada una a done con su usage. Al cerrar: cycle.json en completed con reviewer_report, CONTEXTO GATE (fragmento aditivo), MEMORIA GATE si hubo lección, y sdd:validate en verde.',
        },
      ],
    },
    {
      kind: 'cards',
      title: 'Qué NO se recorta en lite',
      items: [
        {
          title: 'Los cuatro invariantes',
          body: 'Spec registrada, módulo en global.json, cycle.json in-progress antes del código, tasks.json con tasks y ninguna task done sin usage.',
        },
        {
          title: 'Los gates de cierre',
          body: 'CONTEXTO GATE (fragmento aditivo), MEMORIA GATE si hubo lección real, y pnpm sdd:validate en verde.',
        },
        {
          title: 'La telemetría',
          body: 'usage en cada task, más una sola entrada en cycle.json → metrics.usage.by_agent[] con agent "orchestrator" y label "solo", que cubre plan y revisión.',
        },
        {
          title: 'Los registros de contrato',
          body: 'Si el ciclo crea tablas o endpoints, schema.json / api.json / components.json se actualizan igual que en un ciclo full.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Excepciones: aunque el perfil sea solo, el ciclo se abre full si la spec declara contratos que otro subproyecto consume (tablas o endpoints nuevos) o si tiene dependientes (otras specs la declaran en depends_on). Y si un ciclo lite igual terminó creando tablas o endpoints, sdd:validate deja un warning: el próximo ciclo de esa spec se abre full.',
    },
  ],
};

// ─── 4. Fix Gate ─────────────────────────────────────────────────────────────

const FIX_GATE: UsageTab = {
  id: 'fix-gate',
  tab: 'Fix Gate',
  kicker: '04 — fix gate',
  title: 'Cuando el trabajo no puede esperar un ciclo',
  lead: 'El FIX GATE es un bypass controlado del SPEC GATE: no lo elimina, lo reemplaza por un proceso más liviano pero igual de trazable. Donde el SPEC GATE exige spec, ciclo y cuatro documentos, el FIX GATE exige justificación, registro y documentación.',
  blocks: [
    {
      kind: 'cards',
      title: 'Cuándo usarlo',
      items: [
        {
          title: 'Producción rota',
          body: 'Una regresión bloquea a los usuarios y no hay tiempo de abrir un ciclo con sus documentos. [HOTFIX].',
        },
        {
          title: 'Bug confirmado',
          body: 'Un error reproducible en desarrollo o testing, sobre código que ya existe y que no cambia ningún contrato. [BUGFIX].',
        },
        {
          title: 'Mejora menor fuera de spec',
          body: 'Wording, un estado de carga que faltaba, una query lenta. Nada que ninguna spec haya prometido. [IMPROVEMENT].',
        },
        {
          title: 'Cuándo NO usarlo',
          body: 'Funcionalidad nueva, un endpoint nuevo, una entidad de dominio nueva, o un cambio que toca más de 5 archivos: eso es un ciclo SDD, no un fix.',
        },
      ],
    },
    {
      kind: 'table',
      title: 'Los cuatro prefijos',
      head: ['Prefijo', 'Cuándo usarlo', 'Severidad esperada'],
      rows: [
        ['[HOTFIX]', 'Producción bloqueada, regresión crítica, dato corrupto', 'critical / high'],
        ['[BUGFIX]', 'Error confirmado en desarrollo o testing, no bloquea producción', 'medium / low'],
        ['[FIX]', 'Alias genérico — el orquestador pide clasificar', 'cualquiera'],
        ['[IMPROVEMENT]', 'Mejora menor out-of-spec (UX, wording, performance puntual)', 'low'],
      ],
    },
    {
      kind: 'note',
      text: 'Sin prefijo también cuenta: cualquier pedido de cambio sobre código que ya existe activa el FIX GATE. El prefijo solo evita la pregunta de clasificación.',
    },
    { kind: 'heading', text: 'El proceso, paso a paso' },
    {
      kind: 'steps',
      items: [
        {
          title: '1 — Detener e identificar',
          body: 'El orquestador muestra el aviso de bloqueo y no escribe una sola línea de código hasta terminar el registro. Implementar antes del registro es una violación del gate.',
        },
        {
          title: '2 — Recolectar los datos',
          body: 'Tipo exacto, título (máx 80 chars), descripción del problema, justificación de por qué no puede esperar un ciclo, módulos y archivos afectados, y si existe un test que valida el fix.',
        },
        {
          title: '3 — Validar elegibilidad',
          body: 'No modifica el contrato de API, no agrega módulo ni entidad de dominio, no agrega tablas a schema.json, afecta ≤ 5 archivos, y un [HOTFIX] tiene severidad critical o high.',
        },
        {
          title: '4 — Determinar el ciclo asociado',
          body: 'Si hay un ciclo in-progress, el fix se asocia a ese ciclo. Si no, queda con cycle: null y debe absorberse en el próximo ciclo de la spec.',
        },
        {
          title: '5 — Registrar en sdd/fixes.json',
          body: 'Entrada con ID FIX-[gh-user]-[spec-NNN]-[seq] (o FIX-[gh-user]-[seq] si es repo-level), validando contra fixes.schema.json. Recién acá se autoriza a implementar.',
        },
        {
          title: '6 — Escribir el documento del fix',
          body: 'sdd/specs/<spec-id>/fixes/fix-....md si el fix es de una spec, o sdd/fixes/fix-....md si es repo-level.',
        },
        {
          title: '7 — Implementar, registrar usage y cerrar',
          body: 'Con el fix resuelto: usage registrado, fragmento aditivo de contexto, y pnpm sdd:validate en verde. El reviewer del próximo ciclo lo marca validated o absorbed.',
        },
      ],
    },
    {
      kind: 'terminal',
      title: 'El aviso que corta la implementación',
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
    { kind: 'heading', text: 'Ejemplo 1 — un HOTFIX que pasa' },
    {
      kind: 'chat',
      title: 'Producción bloqueada, perfil team',
      turns: [
        {
          who: 'dev',
          text: '[HOTFIX] El WebSocket de precios se cae cuando el proveedor manda un heartbeat vacío y no reconecta. Los clientes quedan sin datos hasta refrescar.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: '⛔ FIX GATE ACTIVADO. Antes de tocar código necesito: severidad (asumo critical, producción bloqueada), justificación, archivos afectados y si hay test. ¿Confirmás critical y que el alcance es apps/orders-api/src/ws/price-stream.ts + su test?',
        },
        { who: 'dev', text: 'Sí, critical. Los archivos son esos dos.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Elegibilidad OK: no cambia el contrato de API, no agrega entidad, 2 archivos. Hay un ciclo in-progress (spec-jdoe-001 cycle-02) → asocio el fix ahí. Registrado FIX-jdoe-001-3 en sdd/fixes.json + documento en sdd/specs/spec-jdoe-001-market-data-feed/fixes/fix-jdoe-001-3.md. sdd:validate en verde. Ahora sí implemento.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Resuelto: el handler ignora frames vacíos y el reconnect entra con backoff. Test agregado que reproduce el heartbeat vacío. usage registrado en el fix, fragmento de contexto escrito en context/apps/orders-api/updates/. El reviewer del cycle-02 lo va a marcar validated al cerrar.',
        },
      ],
    },
    { kind: 'heading', text: 'Ejemplo 2 — un IMPROVEMENT que el gate rechaza' },
    {
      kind: 'chat',
      title: 'El bypass tiene límite',
      turns: [
        {
          who: 'dev',
          text: '[IMPROVEMENT] Agreguemos un endpoint /alerts para que el portal muestre notificaciones de precio.',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: '⛔ FIX GATE ACTIVADO, pero la elegibilidad falla: un endpoint nuevo es contrato de API, y eso exige ciclo SDD. Para [IMPROVEMENT] y [BUGFIX] la regla es detener y redirigir (solo un [HOTFIX] puede avanzar con advertencia). Lo correcto: abrir una spec para alertas de precio. Corro el GATE A cuando me confirmes el nombre del módulo.',
        },
        { who: 'dev', text: 'Dale: módulo price-alerts, autor jdoe.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'pnpm sdd:gate price-alerts → BLOCKED en A1/A2 (la spec no existe todavía). La creo: spec-jdoe-004-price-alerts, registrada en specs/index.json y en pending_modules. Vuelvo a correr el gate → APPROVED, próximo ciclo cycle-01, flow full. ¿Arranco el ciclo?',
        },
      ],
    },
    {
      kind: 'table',
      title: 'Elegibilidad — qué chequea el gate antes de dejarte pasar',
      head: ['Condición', 'Si falla'],
      rows: [
        ['No modifica el contrato de API (endpoints nuevos → ciclo SDD)', '[HOTFIX] avisa pero sigue; el resto se detiene'],
        ['No agrega un módulo o entidad de dominio nueva', '[HOTFIX] avisa pero sigue; el resto se detiene'],
        ['No agrega tablas nuevas a sdd/schema.json', '[HOTFIX] avisa pero sigue; el resto se detiene'],
        ['Afecta ≤ 5 archivos', 'Reconsiderar ciclo SDD'],
        ['[HOTFIX] tiene severidad critical o high', 'Se degrada a [BUGFIX]'],
      ],
    },
    {
      kind: 'code',
      title: 'Pedidos típicos del FIX GATE — quién los recibe',
      lines: [
        '# clasificar antes de empezar: eso sí es del steward (rutea, no escribe)',
        '/sdd-steward tengo que cambiar el cálculo de comisiones en dos archivos. ¿Es fix o ciclo?',
        '',
        '# el FIX GATE lo corre el ORQUESTADOR: es quien escribe fixes.json y el documento',
        '/sdd-orchestrator [BUGFIX] El listado de órdenes pagina mal cuando el filtro de fecha está vacío.',
        'Registralo con el FIX GATE y mostrame la entrada de fixes.json antes de implementar.',
        '',
        '# el gate lo rechazó: la alternativa correcta también es suya',
        '/sdd-orchestrator El FIX GATE rechazó esto por contrato de API. Abrí la spec que corresponde y corré el GATE A.',
        '',
        '# fixes colgando: el steward los lista, el reviewer los cierra al cerrar el ciclo',
        '/sdd-steward ¿qué fixes están sin validar y a qué ciclo hay que absorberlos?',
        '/sdd-reviewer Al cerrar el cycle-02, marcá validated o absorbed los fixes implementados.',
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Abuso del FIX GATE: si un [IMPROVEMENT] o [BUGFIX] implica más de 3 archivos modificados o un cambio de contrato de API, el orquestador DEBE rechazarlo y redirigir al flujo SDD normal. El bypass existe para no perder trazabilidad, no para evitar el diseño.',
    },
    {
      kind: 'note',
      text: 'Con profile: solo el FIX GATE se acorta: el paso 2 no es un cuestionario (el actor completa los datos desde el pedido y pregunta solo lo que no puede deducir), el paso 3 se reduce a “no crea contratos ni entidades nuevas”, y el documento usa el template mínimo (problema · solución · archivos). El registro en fixes.json, el usage, el fragmento de contexto y sdd:validate no se recortan.',
    },
  ],
};

// ─── 5. Trabajando con el kit ────────────────────────────────────────────────

const WORKING: UsageTab = {
  id: 'trabajando',
  tab: 'Trabajando con el kit',
  kicker: '05 — el día a día',
  title: 'Una spec de punta a punta, y a quién se le pide cada cosa',
  lead: 'Cada registro del kit tiene un dueño, y el pedido se le hace a ese agente. El sdd-steward es la puerta cuando no sabés a quién pedirle —clasifica y rutea—, pero no escribe registros de ciclo: pedirle a él lo que le toca al orquestador o al reviewer es la forma más común de quedarse esperando. Lo que sigue es una spec completa con los pedidos textuales, cada uno dirigido al agente que sí puede resolverlo.',
  blocks: [
    {
      kind: 'prose',
      text: 'El steward es el conserje del kit, no un segundo orquestador: resuelve él solo las operaciones que no tienen otro dueño (status, update, costos, perfil, rtk, dudas de metodología) y delega todo lo demás. Su única escritura de registro propia es sdd/global.json → profile.',
    },
    {
      kind: 'table',
      title: 'Tabla de ruteo — qué hace con tu pedido',
      head: ['Le pedís…', 'Y él…'],
      rows: [
        ['Status del kit, versión, costos, salud de los arneses, perfil', 'Lo resuelve él mismo, leyendo solo los registros que la pregunta necesita'],
        ['Una idea u objetivo en lenguaje natural', 'Hace el intake y delega en sdd-hermes / npx @e-burgos/sdd-harness@latest idea'],
        ['Una feature nueva, o retomar una spec', 'Hace el pre-check y delega en sdd-orchestrator, que corre el SPEC GATE'],
        ['[HOTFIX] [BUGFIX] [FIX] [IMPROVEMENT]', 'Clasifica y manda al FIX GATE'],
        ['Escribir o editar código', 'Nunca lo hace: rutea al ciclo SDD completo, sin excepción'],
      ],
    },
    {
      kind: 'table',
      title: 'Quién escribe qué — la tabla que decide a quién le pedís',
      head: ['Artefacto o registro', 'Agente dueño'],
      rows: [
        [
          '.spec.md · specs/index.json · brief.yaml · cycle.json (apertura) · global.json → pending/in_progress_modules',
          'sdd-orchestrator',
        ],
        ['functional.md — historias y criterios de aceptación', 'sdd-functional'],
        ['planner.md — descomposición en tasks', 'sdd-planner'],
        ['architect.md — contratos, entidades, endpoints', 'sdd-architect'],
        [
          'El código, y cada task a done con files[] y su usage',
          'sdd-implementor-back · sdd-implementor-front',
        ],
        [
          'El cierre: cycle.json completed · completed_modules · schema.json · api.json · components.json · CONTEXTO GATE',
          'sdd-reviewer',
        ],
        ['fixes.json y el documento del fix (FIX GATE)', 'sdd-orchestrator'],
        ['Destilar memory/journal/ en lessons.md (≥5 entradas)', 'sdd-orchestrator'],
        ['Consolidar fragmentos de contexto (≥5)', 'sdd-reviewer, o el orquestador al abrir el próximo ciclo'],
        ['global.json → profile · tools.json (rtk) · update del kit · costos · status', 'sdd-steward'],
        ['De una idea en prosa a specs registradas', 'sdd-hermes'],
      ],
    },
    {
      kind: 'note',
      text: 'Ese reparto no es burocracia: es lo que hace que el kit sea auditable. Un registro escrito por quien no es su dueño se salta el gate que lo protege, y sdd:validate lo detecta tarde — cuando ya hay código encima.',
    },
    { kind: 'heading', text: 'Punta a punta — de un pedido en prosa a un ciclo cerrado' },
    {
      kind: 'chat',
      title: 'Paso 0 — dónde estoy parado',
      turns: [
        { who: 'dev', text: '/sdd-steward quiero arrancar el feed de precios en tiempo real. ¿Cómo estamos?' },
        {
          who: 'agent',
          name: 'sdd-steward',
          text: 'Kit v0.13.0, al día. Perfil: team → los ciclos nuevos se abren full. No hay ninguna spec de market data registrada todavía, y no hay ciclos en vuelo que te bloqueen. sdd:validate OK. Esto es feature nueva, así que no me corresponde: te lo llevo al sdd-orchestrator, que va a correr el SPEC GATE. ¿Le paso el pedido?',
        },
      ],
    },
    {
      kind: 'chat',
      title: 'Paso 1 — describir la funcionalidad al orquestador',
      turns: [
        {
          who: 'dev',
          text: 'Quiero implementar el módulo de Market Data Feed para la app orders-api.\n\nObjetivo: consumir precios en tiempo real desde el proveedor Plug y exponerlos vía WebSocket a los clientes del portal.\n\nReferencias adjuntas:\n- docs/artifacts/plug/api-spec.pdf (contrato del proveedor)\n- sdd/api.json (endpoints ya implementados)\n- sdd/context/apps/orders-api/constitution.md',
        },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'Corro pnpm sdd:gate market-data-feed → BLOCKED en A1/A2: la spec no existe. La creo y la registro. Vuelvo a correr → APPROVED, próximo ciclo cycle-01, flow full (profile: team).\n\nGeneré: el .spec.md con objetivo, alcance y criterios de aceptación; la entrada en specs/index.json; el módulo en pending_modules; cycle-01/brief.yaml; y cycle-01/cycle.json en in-progress. sdd:validate en verde. Revisá la spec antes de que sigamos.',
        },
        { who: 'dev', text: 'El alcance está bien, pero sacá la persistencia histórica: eso va en otra spec.' },
      ],
    },
    {
      kind: 'note',
      text: 'El dev no crea archivos SDD a mano en ningún momento. Describe en prosa, adjunta referencias, y revisa lo que el agente generó. Si algo no refleja lo que querés, corregís el pedido y lo volvés a pedir — antes de que haya código.',
    },
    {
      kind: 'code',
      title: 'Pasos 2 y 3 — los documentos del ciclo (flow full)',
      lines: [
        '# funcional: historias de usuario y criterios de aceptación',
        'Generar functional.md para el Ciclo 01 — spec-jdoe-001-market-data-feed.',
        '',
        '# planner y arquitecto, en paralelo',
        'Generar planner.md para el Ciclo 01 — spec-jdoe-001-market-data-feed.',
        'Generar architect.md para el Ciclo 01 — spec-jdoe-001-market-data-feed.',
      ],
    },
    {
      kind: 'chat',
      title: 'Paso 4 — el gate antes del código, y la implementación',
      turns: [
        { who: 'dev', text: 'Corré el GATE B y si pasa arrancá con la TASK-001.' },
        {
          who: 'agent',
          name: 'sdd-orchestrator',
          text: 'pnpm sdd:gate market-data-feed cycle-01 → APPROVED (flow full; brief, functional, planner y architect completos; 6 tasks; constitution.md de apps/orders-api presente).',
        },
        { who: 'dev', text: 'Implementar TASK-001 del Ciclo 01 — spec-jdoe-001-market-data-feed.' },
        {
          who: 'agent',
          name: 'sdd-implementor-back',
          text: 'Leí la task en cycle-01/tasks.json, el contrato en architect.md y la constitution.md de orders-api. Implementé el cliente del proveedor + tests. TASK-001 a "done" con files[] y su usage. Corrí sdd:rebuild-tasks-index y sdd:validate: verde. Siguiente: TASK-002.',
        },
      ],
    },
    {
      kind: 'note',
      tone: 'warn',
      text: 'Una task por conversación, sin agrupar. Vos revisás el código tarea a tarea: si algo no cumple la spec, se lo decís antes de pasar a la siguiente. El frontend va después del backend, y el implementor de front verifica primero que los endpoints que consume estén "implemented" en sdd/api.json.',
    },
    {
      kind: 'chat',
      title: 'Paso 5 — review y cierre',
      turns: [
        { who: 'dev', text: 'Revisar el Ciclo 01 — spec-jdoe-001-market-data-feed — Módulo market-data-feed.' },
        {
          who: 'agent',
          name: 'sdd-reviewer',
          text: 'VALIDATION GATE previo: sdd:validate OK. Criterios de aceptación: CA-001 a CA-005 en PASS, CA-006 en FAIL — el reconnect no reintenta después de 3 fallos consecutivos y la spec lo pide. Devuelvo al implementador antes de cerrar.',
        },
        { who: 'dev', text: 'Corregilo y volvé a revisar.' },
        {
          who: 'agent',
          name: 'sdd-reviewer',
          text: 'CA-006 en PASS. cycle.json → completed con completed_at, metrics y reviewer_report. Módulo movido a completed_modules; era el último ciclo, así que la spec queda completed. schema.json / api.json / components.json verificados. CONTEXTO GATE: escribí context/apps/orders-api/updates/2026-09-09-spec-jdoe-001-market-data-feed-cycle-01.md y toqué solo la fila de orders-api en las tablas globales. MEMORIA GATE: hubo lección (el mock del proveedor no simula timeouts) → entrada en memory/journal/. sdd:validate final en verde.',
        },
      ],
    },
    {
      kind: 'code',
      title: 'Cheat sheet — a quién le pedís cada cosa',
      lines: [
        '# el kit en sí: estado, versión, costos, perfil, arneses → steward',
        '/sdd-steward status',
        '/sdd-steward ¿cuánto costó spec-jdoe-001, por ciclo y por agente?',
        '',
        '# una idea todavía sin spec → hermes (el steward hace el intake y delega)',
        '/sdd-hermes tengo una idea: <descripción en una frase>',
        '',
        '# abrir o retomar una spec, y el FIX GATE → orquestador',
        '/sdd-orchestrator quiero implementar <módulo> en <app>. <objetivo + referencias>',
        '/sdd-orchestrator [HOTFIX] <qué se rompió y a quién afecta>',
        '',
        '# los documentos del ciclo → uno por dueño',
        '/sdd-functional Generar functional.md para el Ciclo 01 — <spec-id>.',
        '/sdd-planner Generar planner.md para el Ciclo 01 — <spec-id>.',
        '/sdd-architect Generar architect.md para el Ciclo 01 — <spec-id>.',
        '',
        '# implementar y cerrar',
        '/sdd-implementor-back Implementar TASK-001 del Ciclo 01 — <spec-id>.',
        '/sdd-reviewer Revisar el Ciclo 01 — <spec-id> — Módulo <nombre>.',
        '',
        '# los prefijos van en el pedido al orquestador, no a otro agente',
        '[LITE] Implementá <cambio acotado>.',
        '[FULL] Implementá <módulo con contratos nuevos>.',
        '',
        '# los comandos que corrés vos, no el agente',
        'pnpm sdd:gate <spec-id> [cycle-XX]   # el gate, determinístico',
        'pnpm sdd:validate                     # registros en verde',
        'pnpm sdd:docs                         # visor + dashboard de Costos',
      ],
    },
    { kind: 'heading', text: 'Cuando algo se desvía — el pedido que lo resuelve' },
    {
      kind: 'prose',
      text: 'Casi nada de esto necesita que abras un archivo. Son pedidos en lenguaje natural: el steward los clasifica y los rutea al agente que sí puede escribir ese registro, y el gate que corresponda sigue corriendo igual.',
    },
    {
      kind: 'table',
      title: 'Necesidad → a quién se lo pedís',
      head: ['Lo que te pasa', 'El pedido, al agente que lo puede escribir'],
      rows: [
        [
          'La spec generada no dice lo que querías',
          '/sdd-orchestrator Corregí el alcance de spec-jdoe-001: sacá la persistencia histórica y actualizá los criterios de aceptación. — es el dueño del .spec.md y de specs/index.json',
        ],
        [
          'Una task quedó a medias y no sabés dónde',
          '/sdd-steward ¿qué tasks del cycle-01 están sin cerrar y qué archivos tocó cada una? — el steward lee y reporta; retomarla es del implementor',
        ],
        [
          'Un ciclo quedó abierto hace semanas',
          '/sdd-steward decime qué falta para cerrar el cycle-02 → y con esa lista, /sdd-reviewer Revisar el Ciclo 02 — spec-jdoe-003.',
        ],
        [
          'El reviewer marcó un criterio de aceptación en FAIL',
          '/sdd-implementor-back CA-006 quedó en FAIL: corregí la implementación de TASK-004. → después /sdd-reviewer Revisar de nuevo el Ciclo 01.',
        ],
        [
          'El journal acumuló entradas sin destilar',
          '/sdd-orchestrator Hay 6 entradas en memory/journal/: destilalas en lessons.md y borrá lo destilado. — la destilación es suya, no del steward',
        ],
        [
          'El contexto del subproyecto quedó desactualizado',
          '/sdd-reviewer Hay 5 fragmentos sin consolidar en context/apps/orders-api/updates/: consolidalos. — o queda para el orquestador al abrir el próximo ciclo',
        ],
        [
          'sdd:validate quedó en rojo después de un update',
          '/sdd-steward ¿qué registro cambió de schema? → y la migración, a su dueño: el orquestador para cycle.json y specs, el reviewer para los registros de cierre',
        ],
        [
          'No sabés cuánto costó lo que llevás hecho',
          '/sdd-steward ¿cuánto costó spec-jdoe-001, por ciclo y por agente? — costos y telemetría son suyos',
        ],
        [
          'Querés la forma corta para algo chico, sin cambiar el perfil',
          '/sdd-orchestrator [LITE] Agregá el filtro por estado al listado de órdenes. — el prefijo lo lee el orquestador al abrir el ciclo',
        ],
      ],
    },
    {
      kind: 'cards',
      title: 'Las cuatro cosas que no cambian nunca',
      items: [
        {
          title: 'El gate lo responde un comando',
          body: 'pnpm sdd:gate, no la memoria del agente. Si el agente dice APPROVED sin salida del script, no hay gate.',
        },
        {
          title: 'Cero código antes del cycle.json',
          body: 'La primera línea de código llega después de que el ciclo existe en in-progress y el GATE B pasó.',
        },
        {
          title: 'Ninguna task done sin usage',
          body: 'La telemetría no es opcional: es lo que alimenta el dashboard de Costos y lo que hace comparable un ciclo con otro.',
        },
        {
          title: 'El contexto se cierra con el ciclo',
          body: 'Fragmento aditivo en updates/, nunca editar la constitution.md del subproyecto durante un ciclo. Y sdd:validate en verde: el mismo check corre en CI.',
        },
      ],
    },
    {
      kind: 'note',
      text: 'El manual completo de cada paso (templates de cada documento, naming, schemas campo a campo) viaja dentro del kit en sdd/documentation/ y se puede leer entero en la página “guía sdd”.',
    },
  ],
};

export const USAGE_TABS: UsageTab[] = [INSTALL, UPDATE, SPEC_GATE, FIX_GATE, WORKING];
