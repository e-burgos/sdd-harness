import { resolve } from 'node:path';
import { defineCommand } from 'citty';
import fs from 'fs-extra';
import { logger } from '../../utils/logger.js';
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_FILENAME,
} from '../../config/json-schema.js';

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

export const configCommand = defineCommand({
  meta: {
    name: 'config',
    description: 'Inspect the harness config contract',
  },
  subCommands: {
    schema: schemaCommand,
  },
});
