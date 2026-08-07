import { copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = resolve(here, '../../cli/templates/sdd');
const content = resolve(here, '../src/content');

copyFileSync(resolve(kit, 'README.md'), resolve(content, 'sdd-readme.md'));
copyFileSync(resolve(kit, 'HOW-TO-USE-SDD.md'), resolve(content, 'sdd-how-to.md'));
console.log('SDD docs snapshot synced from apps/cli/templates/sdd/');
