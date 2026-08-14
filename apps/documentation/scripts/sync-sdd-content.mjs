import { copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = resolve(here, '../../cli/templates/sdd');
const content = resolve(here, '../src/content');

for (const lang of ['es', 'en']) {
  copyFileSync(resolve(kit, `documentation/${lang}/README.md`), resolve(content, `sdd-readme.${lang}.md`));
  copyFileSync(resolve(kit, `documentation/${lang}/HOW-TO-USE-SDD.md`), resolve(content, `sdd-how-to.${lang}.md`));
  copyFileSync(resolve(kit, `documentation/${lang}/INSTALL.md`), resolve(content, `sdd-install.${lang}.md`));
}
console.log('SDD docs snapshot synced from apps/cli/templates/sdd/documentation/ (es + en)');
