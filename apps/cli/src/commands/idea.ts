import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import {
  CONFIG_STUB_FILENAME,
  generateIdeaFiles,
  IDEA_FILENAME,
  readIdeaSummary,
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
    author: {
      type: 'string',
      description:
        'Your GitHub user — lands in sdd.author of the config stub and signs the specs (add spec / sdd.modules)',
    },
    show: {
      type: 'boolean',
      description:
        'Print the registered idea, discovery evidence and decisions (for hermes-resume) instead of writing',
      default: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing idea/config files',
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness idea ')));

    if (args.show) {
      await showIdea();
      return;
    }

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
        author: args.author,
      });

      for (const file of report.created) logger.success(`Created ${file}`);
      for (const file of report.skipped) {
        logger.warn(`Kept existing ${file} (use --force to overwrite)`);
      }

      const nextSteps =
        report.mode === 'greenfield'
          ? [
              `1. Hand ${IDEA_FILENAME} to your AI agent (self-contained protocol for FASE 1–3 inside).`,
              `2. Agent records the discovery evidence + decisions in ${IDEA_FILENAME} and fills ${CONFIG_STUB_FILENAME} (human checkpoint on the stack).`,
              `3. npx @e-burgos/sdd-harness init --config ./${CONFIG_STUB_FILENAME} -y   # generates HERE, keeps the harness.* files, runs the lint/test/build gate`,
              '4. Inside the workspace: skill sdd-hermes (FASE 4) seeds/edits specs and drives the SDD cycles.',
              `5. Resume later with \`harness idea --show\` + sdd/prompts/hermes-resume.prompt.md.`,
            ]
          : [
              `1. Hand ${IDEA_FILENAME} to your AI agent in this repo.`,
              '2. Skill sdd-hermes: discovery + gap analysis vs installed stack (evidence goes in the idea file).',
              '3. harness add app|service for the gaps, harness add spec per module (born draft), then the SDD cycle loop.',
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

async function showIdea(): Promise<void> {
  try {
    const summary = await readIdeaSummary(process.cwd());
    p.note(summary.idea || pc.dim('(empty)'), `Idea — registered ${summary.registeredAt ?? '?'} · ${summary.status ?? ''}`);
    p.note(
      summary.evidence.length
        ? summary.evidence.join('\n')
        : pc.dim('No evidence rows yet (FASE 1 pending). Table: Fuente | Estado de acceso | Dato medido | Fecha'),
      `Evidencia del descubrimiento (${summary.evidence.length})`,
    );
    p.note(
      summary.decisions.length
        ? summary.decisions.join('\n')
        : pc.dim('No decisions recorded yet.'),
      `Decisiones del dev (${summary.decisions.length})`,
    );
    p.outro(pc.green('Read from harness.idea.md — the registry is the source of truth.'));
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
}
