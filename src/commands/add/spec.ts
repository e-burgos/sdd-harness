import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { writeRenderedTemplate } from '../../utils/fs.js';

export const addSpecCommand = defineCommand({
  meta: {
    name: 'spec',
    description: 'Add a new specification (spec) to the SDD process',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Specification name (lowercase kebab-case)',
      required: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness add spec ')));

    const cwd = process.cwd();

    // Verify sdd specs directory exists
    const specsDir = resolve(cwd, 'sdd/specs');
    if (!existsSync(specsDir)) {
      logger.error('No sdd/specs directory found. Make sure SDD is configured in this workspace.');
      process.exit(1);
    }

    const specName =
      args.name ??
      (await p.text({
        message: 'Specification name (lowercase kebab-case):',
        placeholder: 'e.g., core-features, push-notifications',
        validate: (value) => {
          if (!value) return 'Specification name is required';
          if (!/^[a-z0-9-]+$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(specName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Determine the next index
    let nextIndex = 1;
    try {
      const files = readdirSync(specsDir);
      let maxNum = 0;
      for (const file of files) {
        const match = file.match(/^(\d+)-.*\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
      nextIndex = maxNum + 1;
    } catch (err) {
      logger.error('Failed to read specs directory: ' + (err as Error).message);
      process.exit(1);
    }

    const numStr = String(nextIndex).padStart(2, '0');
    const targetFile = resolve(specsDir, `${numStr}-${specName}.md`);

    if (existsSync(targetFile)) {
      logger.error(`Specification file already exists at sdd/specs/${numStr}-${specName}.md`);
      process.exit(1);
    }

    const title = await p.text({
      message: 'Specification title:',
      placeholder: `e.g., Core Features (defaults to "${specName}")`,
    });

    if (p.isCancel(title)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const specTitle = (title as string) || (specName as string);

    const description = await p.text({
      message: 'Brief description of the specification:',
      placeholder: 'Scope and objective...',
    });

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    logger.step(`Creating specification file: ${numStr}-${specName}.md`);

    try {
      await writeRenderedTemplate(
        'sdd/specs/spec.md.ejs',
        targetFile,
        {
          spec: {
            number: numStr,
            title: specTitle,
            description: (description as string) || '',
          },
        },
      );
      logger.success(`Specification created at sdd/specs/${numStr}-${specName}.md`);
    } catch (err) {
      logger.error('Failed to create specification: ' + (err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`Specification "${specTitle}" added successfully.`));
  },
});
