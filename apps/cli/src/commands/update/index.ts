import { defineCommand } from 'citty';
import { updateSddCommand } from './sdd.js';

export const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description: 'Update harness-managed pieces of the workspace',
  },
  subCommands: {
    sdd: updateSddCommand,
  },
});
