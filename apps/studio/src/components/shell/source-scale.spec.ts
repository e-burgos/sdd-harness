import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = [path.resolve(__dirname), path.resolve(__dirname, '../modules')];
const FORBIDDEN = /(?<![\w-])(?:[a-z]+:)*text-(?:(?:xs|sm|base|lg|[2-9]?xl|body)(?![\w-])|\[\d)/;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourcesUnder(full);
    return /\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) && !/test-utils/.test(entry) ? [full] : [];
  });
}

describe('shell and module sources', () => {
  it('only use the Studio type scale tokens', () => {
    const offenders = ROOTS.flatMap(sourcesUnder).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (FORBIDDEN.test(line) ? [`${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
