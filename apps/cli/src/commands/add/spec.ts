import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { exec } from '../../utils/exec.js';
import { warnIfNxRootMismatch } from '../../utils/env.js';
import { createSpec, detectGitHubUser } from '../../generators/spec.generator.js';

const SUBPROJECT_RE = /^(apps|libs|tools)\/[a-z][a-z0-9-]*$/;

/** citty entrega un flag repetido como array y uno solo como string; también se acepta "a,b". */
function listFlag(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Crea una spec con la estructura jerárquica v2.0 del sistema SDD:
 * sdd/specs/spec-[author]-[NNN]-[slug]/ con su .spec.md, cycles/ y fixes/,
 * registrada en sdd/specs/index.json (status draft, contador NNN per-author) y
 * como módulo pendiente en sdd/global.json — el orquestador la toma desde ahí.
 */
export const addSpecCommand = defineCommand({
  meta: {
    name: 'spec',
    description:
      'Add a new SDD specification (spec-[author]-[NNN]-[slug], born draft, registered in pending_modules)',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Specification slug (lowercase kebab-case)',
      required: false,
    },
    author: {
      type: 'string',
      description: 'Author (GitHub username)',
    },
    title: {
      type: 'string',
      description: 'Specification title (skips the prompt, defaults to the slug)',
    },
    app: {
      type: 'string',
      description:
        'Main subproject affected, e.g. apps/my-api (skips the prompt)',
    },
    apps: {
      type: 'string',
      description:
        'Every subproject the module touches, comma-separated or repeated (apps/a,libs/b) — the main --app is always included',
    },
    dependsOn: {
      type: 'string',
      alias: 'depends-on',
      description:
        'Spec ids or slugs this spec depends on, comma-separated or repeated (resolved against sdd/specs/index.json)',
    },
    description: {
      type: 'string',
      description: 'One-liner for the pending_modules entry (defaults to the title)',
    },
  },
  async run({ args }) {
    warnIfNxRootMismatch();
    p.intro(pc.bgCyan(pc.black(' harness add spec ')));

    const cwd = process.cwd();

    const indexPath = resolve(cwd, 'sdd/specs/index.json');
    if (!existsSync(indexPath)) {
      logger.error(
        'No sdd/specs/index.json found. Make sure SDD is configured in this workspace.',
      );
      process.exit(1);
    }

    const slug =
      args.name ??
      (await p.text({
        message: 'Specification slug (lowercase kebab-case):',
        placeholder: 'e.g., user-onboarding, push-notifications',
        validate: (value) => {
          if (!value) return 'Specification slug is required';
          if (!/^[a-z0-9-]+$/.test(value)) return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(slug)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const author =
      args.author ??
      (await p.text({
        message: 'Author (GitHub username):',
        initialValue: detectGitHubUser(),
        validate: (value) => {
          if (!value) return 'Author is required';
          if (!/^[a-z0-9-]+$/.test(value))
            return 'Must be lowercase alphanumeric/dashes (GitHub username)';
          return undefined;
        },
      }));

    if (p.isCancel(author)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const title =
      args.title ??
      (await p.text({
        message: 'Specification title:',
        placeholder: `e.g., Core Features (defaults to "${slug}")`,
      }));

    if (p.isCancel(title)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    if (args.app && !SUBPROJECT_RE.test(args.app)) {
      logger.error(
        `--app must match (apps|libs|tools)/[name] — got "${args.app}".`,
      );
      process.exit(1);
    }

    const app =
      args.app ??
      (await p.text({
        message: 'Main app/lib affected (e.g., apps/my-api):',
        placeholder: 'apps/my-api',
        validate: (value) => {
          if (!value) return 'Required — SPEC GATE needs a target subproject';
          if (!SUBPROJECT_RE.test(value))
            return 'Must match (apps|libs|tools)/[name]';
          return undefined;
        },
      }));

    if (p.isCancel(app)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const apps = listFlag(args.apps);
    const dependsOn = listFlag(args.dependsOn);

    try {
      const result = await createSpec(cwd, {
        slug: slug as string,
        author: author as string,
        title: (title as string) || undefined,
        app: app as string,
        apps,
        dependsOn,
        description: args.description,
      });

      logger.success(`Spec created at ${result.file}`);
      logger.success('Registered in sdd/specs/index.json (status: draft)');
      logger.success(
        `Registered module "${result.module}" in sdd/global.json → pending_modules (${result.apps.join(', ')})`,
      );
      if (result.dependsOn.length) {
        logger.info(`depends_on: ${result.dependsOn.join(', ')}`);
      }

      try {
        exec('node sdd/scripts/validate-sdd.mjs', { cwd, silent: true });
        logger.success('sdd:validate OK');
      } catch {
        logger.warn('Run `pnpm sdd:validate` to check the SDD registries.');
      }

      p.outro(
        pc.green(
          `Spec "${result.specId}" ready (draft). Next: write the .spec.md, then sdd/prompts/start-sdd-cycle.prompt.md — the orchestrator moves it to in-progress.`,
        ),
      );
    } catch (err) {
      logger.error('Failed to create specification: ' + (err as Error).message);
      process.exit(1);
    }
  },
});
