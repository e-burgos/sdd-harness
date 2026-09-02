import { resolve } from 'node:path';
import fs from 'fs-extra';
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_FILENAME,
} from '../config/json-schema.js';

export const IDEA_FILENAME = 'harness.idea.md';
export const CONFIG_STUB_FILENAME = 'harness.config.json';

export const EVIDENCE_HEADING = '## Evidencia del descubrimiento';
export const DECISIONS_HEADING = '## Decisiones del dev';

export interface IdeaOptions {
  force?: boolean;
  /** GitHub user del dev: baja a `sdd.author` del stub y de ahí a `add spec` / `sdd.modules`. */
  author?: string;
}

export interface IdeaReport {
  mode: 'greenfield' | 'sdd-workspace';
  created: string[];
  skipped: string[];
}

export interface IdeaSummary {
  registeredAt: string | null;
  status: string | null;
  idea: string;
  /** Filas de la tabla de evidencia (sin la cabecera), tal como están escritas. */
  evidence: string[];
  decisions: string[];
}

/**
 * Materializa la entrada del punta-a-punta hermes: persiste la idea con el
 * protocolo a seguir y, en repos vírgenes, deja listos el stub de config y su
 * JSON Schema para que un agente ejecute `init --config` sin prompts.
 *
 * El archivo es además la bitácora de FASE 1: la evidencia medida (qué fuentes se
 * pudieron leer, cuáles no, qué cifras salieron) y las decisiones del dev viven acá
 * con fecha, y las specs las CITAN en vez de copiarlas a mano una por una.
 *
 * La CLI queda determinista a propósito: el descubrimiento y la decisión de
 * stack son trabajo del agente (protocolo autosuficiente abajo), no de este generador.
 */
export async function generateIdeaFiles(
  cwd: string,
  ideaText: string,
  opts: IdeaOptions = {},
): Promise<IdeaReport> {
  const idea = ideaText.trim();
  if (!idea) {
    throw new Error('The idea text cannot be empty.');
  }
  if (opts.author && !/^[a-z0-9-]+$/.test(opts.author)) {
    throw new Error(
      `--author must be a lowercase GitHub username — got "${opts.author}".`,
    );
  }

  const mode = (await fs.pathExists(resolve(cwd, 'sdd/global.json')))
    ? 'sdd-workspace'
    : 'greenfield';

  const report: IdeaReport = { mode, created: [], skipped: [] };

  const write = async (filename: string, content: string) => {
    const path = resolve(cwd, filename);
    if ((await fs.pathExists(path)) && !opts.force) {
      report.skipped.push(filename);
      return;
    }
    await fs.writeFile(path, content, 'utf-8');
    report.created.push(filename);
  };

  await write(IDEA_FILENAME, renderIdeaFile(idea, mode, opts.author));

  if (mode === 'greenfield') {
    await write(
      CONFIG_STUB_FILENAME,
      `${JSON.stringify(buildConfigStub(opts.author), null, 2)}\n`,
    );
    await write(
      CONFIG_SCHEMA_FILENAME,
      `${JSON.stringify(buildConfigJsonSchema(), null, 2)}\n`,
    );
  }

  return report;
}

/**
 * Lee `harness.idea.md` y devuelve idea, evidencia y decisiones registradas — lo que
 * `harness idea --show` imprime y lo que `hermes-resume` usa para ubicar la FASE.
 */
export async function readIdeaSummary(cwd: string): Promise<IdeaSummary> {
  const path = resolve(cwd, IDEA_FILENAME);
  if (!(await fs.pathExists(path))) {
    throw new Error(`${IDEA_FILENAME} not found in ${cwd}. Run \`harness idea "<idea>"\` first.`);
  }
  const content = await fs.readFile(path, 'utf-8');
  const header = /Registrada:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*Estado:\s*([^\n]+)/.exec(content);

  return {
    registeredAt: header?.[1] ?? null,
    status: header?.[2]?.trim() ?? null,
    idea: sectionBody(content, '## La idea (verbatim)'),
    evidence: tableRows(sectionBody(content, EVIDENCE_HEADING)),
    decisions: bulletLines(sectionBody(content, DECISIONS_HEADING)),
  };
}

function sectionBody(content: string, heading: string): string {
  const start = content.indexOf(`\n${heading}`);
  if (start === -1) return '';
  const from = start + heading.length + 1;
  const next = content.indexOf('\n## ', from);
  return content.slice(from, next === -1 ? undefined : next).trim();
}

/** Filas reales de una tabla markdown: sin cabecera, sin separador, sin la fila de ejemplo. */
function tableRows(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .slice(2)
    .filter((l) => !/^\|\s*\[/.test(l));
}

/** Bullets reales: se descarta solo la fila de ejemplo `- [YYYY-MM-DD] [Decisión…]` (placeholder entre corchetes tras la fecha). */
function bulletLines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s/.test(l) && !/^[-*]\s+\[\d{4}-\d{2}-\d{2}\]\s+\[/.test(l));
}

function buildConfigStub(author?: string): Record<string, unknown> {
  return {
    $schema: `./${CONFIG_SCHEMA_FILENAME}`,
    mode: 'nx',
    project: {
      name: 'my-project',
      description:
        'TODO: una línea derivada de harness.idea.md (FASE 1 de sdd-hermes)',
      packageScope: '@my-project',
    },
    apps: [{ name: 'api', type: 'nestjs', port: 3000 }],
    libs: [],
    services: [{ type: 'postgres' }],
    // sdd.modules: un slug por módulo core (FASE 1) → init siembra una spec draft por cada uno.
    // sdd.author firma esas specs; sin --author queda para completar (fallback: git user.name).
    sdd: author ? { author, modules: [] } : { modules: [] },
  };
}

function renderIdeaFile(
  idea: string,
  mode: IdeaReport['mode'],
  author?: string,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const authorLine = author ? ` | Autor: \`${author}\`` : '';

  const evidenceSections = `${EVIDENCE_HEADING}

> Bitácora de FASE 1. Cada fuente consultada va acá, con lo que se pudo medir — accesible o
> no. Las specs **citan** estas filas (fuente + fecha), no las copian.

| Fuente | Estado de acceso | Dato medido | Fecha |
| ------ | ---------------- | ----------- | ----- |
| [repo/API/doc/persona consultada] | [accesible · bloqueado (motivo) · parcial] | [cifra, conteo, versión, hallazgo] | ${date} |

${DECISIONS_HEADING}

> Decisiones que acotan el producto o el stack, con fecha. Si una spec depende de una
> decisión, la cita por fecha. El costo de FASE 1–4 (fuera de ciclo) se anota acá como
> línea de consumo declarado si no hay otro registro.

- [${date}] [Decisión y motivo — quién la tomó]
`;

  const protocol =
    mode === 'greenfield'
      ? `## Protocolo (repo vacío → producto)

> Entregale este archivo a tu agente AI. Es **autosuficiente para FASE 1–3**: en un repo
> vacío la skill \`sdd-hermes\` todavía no existe — llega con el kit en FASE 3 y desde ahí
> (\`sdd/skills/sdd-hermes/SKILL.md\`) manda para FASE 4 y 5.

### FASE 1 — Descubrimiento (una ronda de preguntas, máximo)

Extraer de la idea: dominio y usuarios, **3–7 módulos core con nombre propio** (serán las
specs), y necesidades técnicas (persistencia, tiempo real, colas/jobs, archivos, auth, UI,
API pública, integraciones). Registrar TODO lo consultado en **Evidencia del
descubrimiento** (fuentes accesibles y bloqueadas, cifras) y lo decidido en **Decisiones del
dev**. UNA ronda de preguntas, solo si algo bloquea el stack.

### FASE 2 — Stack (matriz → propuesta → checkpoint humano)

| Necesidad detectada                          | Pieza                                        |
| -------------------------------------------- | -------------------------------------------- |
| API con dominio rico, websockets, jobs       | app \`nestjs\`                                 |
| API liviana / microservicio simple           | app \`fastify\` o \`hono\`                       |
| Scripting, datos, ML, integraciones Python   | app \`python\`                                 |
| API Java corporativa                         | app \`springboot\`                             |
| UI web SPA (dashboard, admin, tool interna)  | app \`react\`                                  |
| UI web con SSR/SEO (producto público)        | app \`nextjs\`                                 |
| Persistencia relacional                      | service \`postgres\`                           |
| Cache, sesiones, rate-limit, pub/sub simple  | service \`redis\`                              |
| Colas/eventos entre servicios                | service \`rabbitmq\`                           |
| Archivos/media (S3-compatible)               | service \`minio\`                              |
| Front + back en el stack                     | libs \`shared-types\` + \`api-client\`           |
| ≥2 apps TypeScript                           | lib \`shared-utils\`; UI compartida → \`ui-kit\` |

Reglas: **una sola app → \`"mode": "standalone"\`**; front + back o multi-servicio →
\`"mode": "nx"\`. Ante la duda, la pieza más simple (\`harness add app|service\` existe para
cuando una spec lo exija). Completar \`${CONFIG_STUB_FILENAME}\` (validable con
\`${CONFIG_SCHEMA_FILENAME}\`): \`project\` (name kebab-case = nombre de este directorio),
\`apps[]\` con \`port\`, \`libs[]\`, \`services[]\`, \`sdd.author\` (tu GitHub user) y
\`sdd.modules\` (los slugs de FASE 1 — \`init\` siembra una spec \`draft\` por cada uno),
\`npm.scopes[]\` si hay registries privados. **Checkpoint humano: el stack se aprueba antes de
generar.**

### FASE 3 — Generar (cero prompts) y verificar

\`\`\`bash
npx @e-burgos/sdd-harness init --config ./${CONFIG_STUB_FILENAME} -y
\`\`\`

Genera **en este directorio** (el config vive acá; también vale \`--here\`), sin volver a
hacer \`git init\` si ya es un repo — commitea en la rama actual — y conserva este archivo y
el config dentro del workspace. Termina ejecutando el gate: \`sdd:validate\` +
\`nx run-many -t lint test build\`; si algo está rojo el comando **falla** (no dar por verde lo
que no se corrió). Si \`NX_WORKSPACE_ROOT_PATH\` apunta a otro repo, todo \`nx …\` corre contra
ESE repo: la CLI lo avisa en la primera línea — desactivarla antes.

### FASE 4 y 5 — Dentro del workspace

Invocar la skill \`sdd-hermes\` desde su FASE 4: una spec por módulo
(\`harness add spec <slug> --author <gh-user> --title "<t>" --app apps/<x> [--apps …] [--depends-on …]\`
registra índice + \`pending_modules\`; las sembradas por \`sdd.modules\` ya están) con
checkpoint humano por spec, y el loop de ciclos SDD hasta agotar el backlog. Para retomar en
otra sesión: \`sdd/prompts/hermes-resume.prompt.md\` (lee este archivo para ubicar la FASE) y
\`harness idea --show\`.`
      : `## Protocolo (workspace SDD existente)

> Entregale este archivo a tu agente AI en este repo.

1. Invocar la skill **sdd-hermes** (\`sdd/skills/sdd-hermes/SKILL.md\`) desde su FASE 1:
   descubrimiento sobre esta idea + análisis de gaps contra el stack ya instalado
   (\`sdd/global.json\`). Registrar fuentes y cifras en **Evidencia del descubrimiento** y lo
   decidido en **Decisiones del dev** (arriba).
2. Piezas faltantes → \`harness add app|service\` (checkpoint humano si cambia el stack).
3. Una spec por módulo nuevo (\`harness add spec … --app … [--apps …] [--depends-on …]\`,
   nace \`draft\` y queda en \`pending_modules\`; checkpoint humano) y loop de ciclos SDD
   hasta agotar el backlog. Ningún gate se bypassea.`;

  return `# Idea — entrada del punta-a-punta hermes

> Registrada: ${date} | Estado: pendiente de descubrimiento (FASE 1 de sdd-hermes)${authorLine}

## La idea (verbatim)

${idea}

${evidenceSections}
${protocol}
`;
}
