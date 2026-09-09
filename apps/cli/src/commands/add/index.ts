import { defineCommand } from 'citty';
import { addAppCommand } from './app.js';
import { addSkillCommand } from './skill.js';
import { addServiceCommand } from './service.js';
import { addSpecCommand } from './spec.js';
import { addToolCommand } from './tool.js';

export const addCommand = defineCommand({
  meta: {
    name: 'add',
    // Libs no tiene subcomando: se declaran en `libs[]` de `init --config`.
    description: 'Add apps, tools, skills, services or specs to the workspace',
  },
  subCommands: {
    app: addAppCommand,
    tool: addToolCommand,
    skill: addSkillCommand,
    service: addServiceCommand,
    spec: addSpecCommand,
  },
});
