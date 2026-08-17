import { resolve } from 'node:path';
import fs from 'fs-extra';
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_FILENAME,
} from '../config/json-schema.js';

export const IDEA_FILENAME = 'harness.idea.md';
export const CONFIG_STUB_FILENAME = 'harness.config.json';

export interface IdeaOptions {
  force?: boolean;
}

export interface IdeaReport {
  mode: 'greenfield' | 'sdd-workspace';
  created: string[];
  skipped: string[];
}

/**
 * Materializa la entrada del punta-a-punta hermes: persiste la idea con el
 * protocolo a seguir y, en repos vírgenes, deja listos el stub de config y su
 * JSON Schema para que un agente ejecute `init --config` sin prompts.
 * La CLI queda determinista a propósito: el descubrimiento y la decisión de
 * stack son trabajo de la skill sdd-hermes, no de este generador.
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

  await write(IDEA_FILENAME, renderIdeaFile(idea, mode));

  if (mode === 'greenfield') {
    await write(
      CONFIG_STUB_FILENAME,
      `${JSON.stringify(buildConfigStub(), null, 2)}\n`,
    );
    await write(
      CONFIG_SCHEMA_FILENAME,
      `${JSON.stringify(buildConfigJsonSchema(), null, 2)}\n`,
    );
  }

  return report;
}

function buildConfigStub(): Record<string, unknown> {
  return {
    $schema: `./${CONFIG_SCHEMA_FILENAME}`,
    mode: 'nx',
    project: {
      name: 'my-project',
      description:
        'TODO: una línea derivada de harness.idea.md (FASE 1 de sdd-hermes)',
      packageScope: '@my-project',
    },
    apps: [{ name: 'api', type: 'nestjs' }],
    libs: [],
    services: [{ type: 'postgres' }],
  };
}

function renderIdeaFile(idea: string, mode: IdeaReport['mode']): string {
  const date = new Date().toISOString().slice(0, 10);
  const protocol =
    mode === 'greenfield'
      ? `## Protocolo (repo vacío → producto)

> Entregale este archivo a tu agente AI. El protocolo completo es la skill
> **sdd-hermes** (\`sdd/skills/sdd-hermes/SKILL.md\` una vez instalado el kit).

1. **Descubrimiento** — extraer de la idea: dominio y usuarios, 3–7 módulos core con
   nombre propio, y necesidades técnicas (persistencia, tiempo real, colas, archivos,
   auth, UI, API pública). UNA ronda de preguntas máximo, solo si algo bloquea el stack.
2. **Stack** — completar \`${CONFIG_STUB_FILENAME}\` (validable con
   \`${CONFIG_SCHEMA_FILENAME}\`): una sola app → \`"mode": "standalone"\`; front + back o
   multi-servicio → \`"mode": "nx"\`. Ante la duda, la pieza más simple. **Checkpoint
   humano: el stack se aprueba antes de generar.**
3. **Generar** — \`npx @e-burgos/sdd-harness init --config ./${CONFIG_STUB_FILENAME}\`
   (cero prompts). Verificar \`pnpm sdd:validate\` en verde dentro del workspace.
4. **Continuar dentro del workspace** — invocar la skill \`sdd-hermes\` desde su FASE 4:
   una spec por módulo (\`harness add spec\`) con checkpoint humano, y el loop de ciclos
   SDD hasta agotar el backlog.`
      : `## Protocolo (workspace SDD existente)

> Entregale este archivo a tu agente AI en este repo.

1. Invocar la skill **sdd-hermes** (\`sdd/skills/sdd-hermes/SKILL.md\`) desde su FASE 1:
   descubrimiento sobre esta idea + análisis de gaps contra el stack ya instalado
   (\`sdd/global.json\`).
2. Piezas faltantes → \`harness add app|service\` (checkpoint humano si cambia el stack).
3. Una spec por módulo nuevo (\`harness add spec\`, checkpoint humano) y loop de ciclos
   SDD hasta agotar el backlog. Ningún gate se bypassea.`;

  return `# Idea — entrada del punta-a-punta hermes

> Registrada: ${date} | Estado: pendiente de descubrimiento (FASE 1 de sdd-hermes)

## La idea (verbatim)

${idea}

${protocol}
`;
}
