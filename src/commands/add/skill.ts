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

    const description = await p.text({
      message: 'Skill description:',
      placeholder: 'What does this skill do?',
      validate: (value) => {
        if (!value) return 'Description is required';
        return undefined;
      },
    });

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    logger.step(`Creating skill: ${skillName}`);

    const skillContent = `# ${skillName}

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
      await fs.writeFile(resolve(skillDir, 'SKILL.md'), skillContent, 'utf-8');
      logger.success(`Skill created at sdd/skills/${skillName}/SKILL.md`);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`Skill "${skillName}" added.`));
  },
});
