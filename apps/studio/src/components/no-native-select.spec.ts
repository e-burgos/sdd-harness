import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.spec\./.test(name) ? [path] : [];
  });
}

describe('selectors', () => {
  it('has no native select or option element anywhere in the components', () => {
    const offenders = sourceFiles(SRC).filter((f) => /<(select|option|optgroup)[\s>]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('routes every selector through HelpSelect', () => {
    const offenders = sourceFiles(SRC).filter((f) => !f.endsWith('HelpSelect.tsx') && /<Select[\s>]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
