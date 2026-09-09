import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { warnIfNxRootMismatch } from '../../utils/env.js';
import { registerSubprojectInSDD } from '../../generators/sdd.generator.js';

/**
 * Alta de una tool como subproyecto SDD. A diferencia de `add app`, NO genera
 * código: una tool es lo que el equipo escribe en `tools/<nombre>/` (scripts,
 * CLIs internas, generadores). Lo que este comando aporta es lo que faltaba
 * para que la tool exista para el sistema: su entrada en
 * `sdd/global.json → monorepo.tools` y su contexto en `sdd/context/tools/`,
 * que es lo que el visor descubre y lo que los gates piden al abrir un ciclo
 * que la toque.
 */
export const addToolCommand = defineCommand({
  meta: {
    name: 'tool',
    description:
      'Register a tool as an SDD subproject (global.json + context) — it generates no code',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Tool name (lowercase kebab-case)',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Short description of what it is (default: "tool")',
    },
  },
  async run({ args }) {
    warnIfNxRootMismatch();
    p.intro(pc.bgCyan(pc.black(' harness add tool ')));

    const cwd = process.cwd();
    const globalPath = resolve(cwd, 'sdd/global.json');
    if (!existsSync(globalPath)) {
      logger.error(
        'No SDD installation found. Run `harness configure sdd` (or `harness init`) first.',
      );
      process.exit(1);
    }

    const toolName =
      args.name ??
      (await p.text({
        message: 'Tool name:',
        placeholder: 'qa-flows',
        validate: (value) => {
          if (!value) return 'Tool name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(toolName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const name = String(toolName);
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      logger.error(`Invalid tool name "${name}" — must be lowercase kebab-case.`);
      process.exit(1);
    }

    const globalJson = JSON.parse(readFileSync(globalPath, 'utf-8'));
    if (globalJson.monorepo?.tools?.[name]) {
      logger.error(
        `Tool "${name}" is already registered in sdd/global.json → monorepo.tools`,
      );
      process.exit(1);
    }

    const toolType =
      args.type ??
      (await p.text({
        message: 'What is it? (one line, goes into global.json)',
        placeholder: 'script',
        defaultValue: 'tool',
      }));

    if (p.isCancel(toolType)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    logger.step(`Registering tool: ${name}`);

    try {
      await registerSubprojectInSDD(
        cwd,
        'tools',
        name,
        String(toolType) || 'tool',
      );
      logger.success(
        `Registered in sdd/global.json → monorepo.tools and sdd/context/tools/${name}/`,
      );
      logger.info(
        `No code was generated — write the tool itself under tools/${name}/.`,
      );
      logger.info(
        'Complete the [...] markers in its constitution.md, then run `pnpm sdd:validate`.',
      );
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`Tool "${name}" registered.`));
  },
});
