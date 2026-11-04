import { resolve } from 'node:path';
import { defineCommand } from 'citty';
import fs from 'fs-extra';
import { logger } from '../../utils/logger.js';
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_FILENAME,
} from '../../config/json-schema.js';
import { buildConfigCatalog, formatConfigCatalog } from '../../config/catalog.js';
import {
  ConfigReadError,
  formatConfigValidation,
  readRawConfigFile,
  readRawConfigFromStream,
  validateHarnessConfig,
} from '../../config/validate.js';

export const EXIT_VALID = 0;
export const EXIT_INVALID = 1;
export const EXIT_UNREADABLE = 2;

const schemaCommand = defineCommand({
  meta: {
    name: 'schema',
    description:
      'Print (or write) the JSON Schema for harness.config.json, so agents and editors validate configs without running the CLI',
  },
  args: {
    out: {
      type: 'string',
      description: `Write to a file instead of stdout (e.g. ${CONFIG_SCHEMA_FILENAME})`,
    },
  },
  async run({ args }) {
    const schema = buildConfigJsonSchema();
    const json = `${JSON.stringify(schema, null, 2)}\n`;

    if (args.out) {
      const path = resolve(process.cwd(), args.out);
      await fs.writeFile(path, json, 'utf-8');
      logger.success(`Wrote config JSON Schema to ${args.out}`);
      return;
    }

    process.stdout.write(json);
  },
});

const catalogCommand = defineCommand({
  meta: {
    name: 'catalog',
    description:
      'Print the options the config accepts (app types, services, libs, flags, patterns, ports) as the CLI sees them',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Print the catalog as JSON',
      default: false,
    },
  },
  run({ args }) {
    const catalog = buildConfigCatalog();
    process.stdout.write(
      args.json ? `${JSON.stringify(catalog, null, 2)}\n` : formatConfigCatalog(catalog),
    );
  },
});

const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description:
      'Validate a harness config (schema, topology, init preconditions) and preview what init would resolve. Use "-" to read JSON from stdin. Exit 0 valid, 1 errors, 2 unreadable or invalid usage',
  },
  args: {
    file: {
      type: 'positional',
      description: 'Config file (.json | .mjs | .js) or "-" for JSON on stdin',
      required: false,
    },
    json: {
      type: 'boolean',
      description: 'Print the validation result as JSON',
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    const source = (args.file as string | undefined) ?? (rawArgs.includes('-') ? '-' : undefined);
    if (!source) {
      process.stderr.write('Usage: harness config validate <file|-> [--json]\n');
      process.exitCode = EXIT_UNREADABLE;
      return;
    }
    try {
      const raw =
        source === '-' ? await readRawConfigFromStream(process.stdin) : await readRawConfigFile(source);
      const validation = validateHarnessConfig(raw);
      process.stdout.write(
        args.json ? `${JSON.stringify(validation, null, 2)}\n` : formatConfigValidation(validation),
      );
      process.exitCode = validation.ok ? EXIT_VALID : EXIT_INVALID;
    } catch (err) {
      if (!(err instanceof ConfigReadError)) throw err;
      process.stderr.write(`${err.message}\n`);
      process.exitCode = EXIT_UNREADABLE;
    }
  },
});

export const configCommand = defineCommand({
  meta: {
    name: 'config',
    description: 'Inspect the harness config contract',
  },
  subCommands: {
    schema: schemaCommand,
    catalog: catalogCommand,
    validate: validateCommand,
  },
});
