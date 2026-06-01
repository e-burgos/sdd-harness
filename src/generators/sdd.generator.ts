import { resolve } from 'node:path';
import fs from 'fs-extra';
import { writeRenderedTemplate } from '../utils/fs.js';
import type { WorkspaceOptions } from './workspace.generator.js';

/**
 * Genera la infraestructura SDD (Spec-Driven Development)
 */
export async function generateSDD(
  root: string,
  opts: WorkspaceOptions,
): Promise<void> {
  // Directorios
  await fs.ensureDir(resolve(root, 'sdd'));
  await fs.ensureDir(resolve(root, 'sdd/context'));
  await fs.ensureDir(resolve(root, 'sdd/specs'));
  await fs.ensureDir(resolve(root, 'sdd/specs/artifacts'));
  await fs.ensureDir(resolve(root, 'sdd/agents'));
  await fs.ensureDir(resolve(root, 'sdd/prompts'));
  await fs.ensureDir(resolve(root, 'sdd/skills'));
  await fs.ensureDir(resolve(root, 'sdd/cycles'));

  // Datos del template
  const templateData = {
    project: {
      name: opts.projectName,
      description: opts.description,
      packageScope: opts.packageScope,
      packageManager: 'pnpm',
      stack: opts.frontendStack || opts.backendStack
        ? `* **Frontend:** ${opts.frontendStack || 'N/A'}\n* **Backend:** ${opts.backendStack || 'N/A'}`
        : null
    },
    apps: opts.apps,
    libs: opts.libs,
    services: opts.services,
  };

  // Constitución y Context Prompt
  await writeRenderedTemplate(
    'sdd/context/context_prompt.md.ejs',
    resolve(root, 'sdd/context/context_prompt.md'),
    templateData,
  );

  await writeRenderedTemplate(
    'sdd/context/constitution.md.ejs',
    resolve(root, 'sdd/context/constitution.md'),
    templateData,
  );

  // Escribir AGENTS.md y CLAUDE.md redireccionando a sdd/context/context_prompt.md
  const redirectMd = `# ${opts.projectName}

Este proyecto utiliza la metodología Spec-Driven Development (SDD).
Toda la información del contexto general, stack tecnológico y reglas de desarrollo se encuentra unificada en:
👉 **[sdd/context/context_prompt.md](sdd/context/context_prompt.md)**

Por favor, lee este archivo antes de realizar cualquier cambio en el repositorio.
`;
  await fs.writeFile(resolve(root, 'AGENTS.md'), redirectMd, 'utf-8');
  await fs.writeFile(resolve(root, 'CLAUDE.md'), redirectMd, 'utf-8');

  // sdd/global.json
  await fs.writeFile(
    resolve(root, 'sdd/global.json'),
    JSON.stringify(
      {
        project: opts.projectName,
        description: opts.description,
        version: '1.0.0',
        current_cycle: 0,
        completed_modules: [],
        in_progress_modules: [],
        pending_modules: [],
        monorepo: {
          tool: 'Nx',
          package_manager: 'pnpm',
          apps: opts.apps.reduce((acc, app) => {
            acc[app.name] = `apps/${app.name} — ${app.type}`;
            return acc;
          }, {} as Record<string, string>),
          libs: 'libs/ — Librerías compartidas',
          tools: 'tools/ — Herramientas del workspace'
        },
        stack: {},
        planned_cycles: [],
        branch: 'main',
        last_updated: new Date().toISOString(),
        specs_dir: 'sdd/specs'
      },
      null,
      2,
    ),
    'utf-8',
  );

  // JSON vacíos de estado
  await fs.writeJSON(resolve(root, 'sdd/schema.json'), { tables: {} }, { spaces: 2 });
  await fs.writeJSON(resolve(root, 'sdd/api.json'), { endpoints: {} }, { spaces: 2 });
  await fs.writeJSON(resolve(root, 'sdd/components.json'), { components: {} }, { spaces: 2 });
  await fs.writeJSON(resolve(root, 'sdd/tasks.json'), { cycles: {} }, { spaces: 2 });

  // Copiar y compilar agentes
  const agents = [
    'sdd-orchestrator', 'sdd-functional', 'sdd-planner', 'sdd-architect',
    'sdd-implementor-back', 'sdd-implementor-front', 'sdd-reviewer'
  ];
  for (const agent of agents) {
    await writeRenderedTemplate(
      `sdd/agents/${agent}.agent.md.ejs`,
      resolve(root, `sdd/agents/${agent}.agent.md`),
      templateData,
    );
  }

  // Copiar y compilar prompts
  const prompts = ['start-sdd-cycle', 'review-cycle'];
  for (const prompt of prompts) {
    await writeRenderedTemplate(
      `sdd/prompts/${prompt}.prompt.md.ejs`,
      resolve(root, `sdd/prompts/${prompt}.prompt.md`),
      templateData,
    );
  }

  // Copiar y compilar skills
  const skills = [
    'sdd-orchestrator', 'sdd-functional', 'sdd-planner', 'sdd-architect',
    'sdd-implementor-back', 'sdd-implementor-front', 'sdd-reviewer',
    'generate-nestjs-module', 'generate-react-component', 'generate-prisma-schema',
    'generate-api-contract'
  ];
  for (const skill of skills) {
    await writeRenderedTemplate(
      `sdd/skills/${skill}/skill.md.ejs`,
      resolve(root, `sdd/skills/${skill}/skill.md`),
      templateData,
    );
  }
}
