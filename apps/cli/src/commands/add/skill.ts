import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fs from 'fs-extra';
import { logger } from '../../utils/logger.js';

export const addSkillCommand = defineCommand({
  meta: {
    name: 'skill',
    description: 'Add a new agent skill to the workspace',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Skill name',
      required: false,
    },
    description: {
      type: 'string',
      description: 'Skill description (skips the prompt)',
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness add skill ')));

    const cwd = process.cwd();

    const skillName =
      args.name ??
      (await p.text({
        message: 'Skill name:',
        placeholder: 'my-custom-skill',
        validate: (value) => {
          if (!value) return 'Skill name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(skillName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const skillDir = resolve(cwd, 'sdd/skills', skillName as string);
    if (existsSync(skillDir)) {
      logger.error(
        `Skill "${skillName}" already exists at sdd/skills/${skillName}`,
      );
      process.exit(1);
    }

    const description =
      args.description ??
      (await p.text({
        message: 'Skill description:',
        placeholder: 'What does this skill do?',
        validate: (value) => {
          if (!value) return 'Description is required';
          return undefined;
        },
      }));

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    if (!(description as string).trim()) {
      logger.error('Skill description cannot be empty.');
      process.exit(1);
    }

    logger.step(`Creating skill: ${skillName}`);

    const skillContent = `---
name: ${skillName}
description: ${description}
---

# Skill: ${skillName}

${description}

## Trigger

"Usá el skill ${skillName} para [tarea]"

## Workflow

1. Leer contexto relevante del workspace
2. Ejecutar la tarea según las instrucciones
3. Validar el resultado

## Output

<!-- Describir qué genera este skill -->
`;

    try {
      await fs.ensureDir(skillDir);
      // Lowercase on purpose: Linux checkouts are case-sensitive and the SDD
      // kit resolves skill.md (see sdd/README.md, "el case importa").
      await fs.writeFile(resolve(skillDir, 'skill.md'), skillContent, 'utf-8');
      logger.success(`Skill created at sdd/skills/${skillName}/skill.md`);
      logger.info('Run `pnpm sdd:rebuild-catalog` so the docs viewer picks it up.');
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`Skill "${skillName}" added.`));
  },
});
