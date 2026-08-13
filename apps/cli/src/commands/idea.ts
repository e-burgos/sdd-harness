import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import {
  CONFIG_STUB_FILENAME,
  generateIdeaFiles,
  IDEA_FILENAME,
} from '../generators/idea.generator.js';

export const ideaCommand = defineCommand({
  meta: {
    name: 'idea',
    description:
      'Persist a product idea and scaffold the hermes end-to-end entry point (idea file + config stub + JSON schema)',
  },
  args: {
    text: {
      type: 'positional',
      description: 'The idea, in natural language (quote it)',
      required: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing idea/config files',
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness idea ')));

    const text =
      args.text ??
      (await p.text({
        message: 'Your idea (natural language):',
        placeholder: 'e.g., una app para gestionar turnos de una peluquería',
        validate: (value) => (value?.trim() ? undefined : 'The idea is required'),
      }));

    if (p.isCancel(text)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    try {
      const report = await generateIdeaFiles(process.cwd(), text as string, {
        force: args.force,
      });

      for (const file of report.created) logger.success(`Created ${file}`);
      for (const file of report.skipped) {
        logger.warn(`Kept existing ${file} (use --force to overwrite)`);
      }

      const nextSteps =
        report.mode === 'greenfield'
          ? [
              `1. Hand ${IDEA_FILENAME} to your AI agent (protocol inside).`,
              `2. Agent fills ${CONFIG_STUB_FILENAME} (stack decision, human checkpoint).`,
              `3. npx @e-burgos/sdd-harness init --config ./${CONFIG_STUB_FILENAME}`,
              '4. Inside the workspace: skill sdd-hermes drives specs + SDD cycles.',
            ]
          : [
              `1. Hand ${IDEA_FILENAME} to your AI agent in this repo.`,
              '2. Skill sdd-hermes: discovery + gap analysis vs installed stack.',
              '3. harness add app|service|spec for the gaps, then the SDD cycle loop.',
            ];

      p.note(nextSteps.join('\n'), 'Next steps');
      p.outro(
        report.mode === 'greenfield'
          ? pc.green('Idea registered. Your agent takes it from here.')
          : pc.green('Idea registered in this SDD workspace.'),
      );
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }
  },
});
