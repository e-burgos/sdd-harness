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
  it('uses HelpSelect everywhere instead of a native select', () => {
    const offenders = sourceFiles(SRC).filter((f) => !f.endsWith('HelpSelect.tsx') && /<select[\s>]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
