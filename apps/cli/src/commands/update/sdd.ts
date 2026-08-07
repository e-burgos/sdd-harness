import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { updateSDD } from '../../generators/update.generator.js';
import { readManifest } from '../../generators/kit-manifest.js';
import { version } from '../../version.js';

export const updateSddCommand = defineCommand({
  meta: {
    name: 'sdd',
    description:
      'Update the installed SDD kit to the version bundled with this CLI, preserving all project data',
  },
  args: {
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation prompts',
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness update sdd ')));

    const cwd = process.cwd();
    if (!existsSync(resolve(cwd, 'sdd/global.json'))) {
      logger.error(
        'No SDD installation found. Run `harness configure sdd` (or `harness init`) first.',
      );
      process.exit(1);
    }

    const manifest = await readManifest(resolve(cwd, 'sdd'));
    if (manifest) {
      p.log.info(
        `Installed kit: v${manifest.kit_version} (${manifest.installed_at}) → updating to v${version}`,
      );
    } else if (!args.yes) {
      p.log.warn(
        'This installation has no kit manifest (installed with an older CLI). Conservative mode:\n' +
          '  · pure kit dirs (agents, skills, prompts, schemas, docs, scripts, templates) get replaced\n' +
          '  · dual-harness and global constitution/context_prompt are NEVER touched\n' +
          '  · your data (specs, cycles, fixes, contexts, registries) is never touched\n' +
          '  · a manifest is written so the next update is surgical',
      );
      const confirm = await p.confirm({
        message: 'Continue with the conservative update?',
        initialValue: true,
      });
      if (!confirm || p.isCancel(confirm)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
    }

    logger.step('Updating SDD kit...');

    try {
      const report = await updateSDD(cwd);

      if (report.updated.length) {
        logger.success(`Updated ${report.updated.length} kit file(s)`);
      }
      if (report.added.length) {
        logger.success(`Added ${report.added.length} new kit file(s)`);
        for (const f of report.added) p.log.message(pc.dim(`  + sdd/${f}`));
      }
      if (report.removedStale.length) {
        logger.info(`Removed ${report.removedStale.length} stale kit file(s)`);
      }
      if (report.keptCustom.length) {
        logger.info(
          `Kept ${report.keptCustom.length} locally customized file(s) untouched`,
        );
      }
      if (report.conflicts.length) {
        logger.warn(
          `${report.conflicts.length} conflict(s) — your version was kept, the new one is next to it as *.new:`,
        );
        for (const f of report.conflicts) {
          p.log.message(pc.yellow(`  ~ sdd/${f}  →  sdd/${f}.new`));
        }
        p.log.message(
          pc.dim('  Merge manually and delete the .new files when done.'),
        );
      }
      if (
        !report.updated.length &&
        !report.added.length &&
        !report.conflicts.length &&
        !report.removedStale.length
      ) {
        logger.success('Kit already up to date — nothing to change.');
      }

      logger.success('Harness symlinks refreshed (setup:agents)');
      if (report.validateOk === true) {
        logger.success('sdd:validate OK');
      } else if (report.validateOk === false) {
        logger.warn(
          'sdd:validate reported problems — run `pnpm sdd:validate` to see the details. New schemas may require migrating existing registries.',
        );
      }
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green('SDD kit updated.'));
  },
});
