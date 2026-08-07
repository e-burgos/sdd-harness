import { defineCommand } from 'citty';
import { addAppCommand } from './app.js';
import { addSkillCommand } from './skill.js';
import { addServiceCommand } from './service.js';
import { addSpecCommand } from './spec.js';

export const addCommand = defineCommand({
  meta: {
    name: 'add',
    description: 'Add apps, skills, services, specs, or libs to the workspace',
  },
  subCommands: {
    app: addAppCommand,
    skill: addSkillCommand,
    service: addServiceCommand,
    spec: addSpecCommand,
  },
});
