import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const FABRICATED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'literal session id', pattern: /["'`]session-(?!title["'`])/ },
  { name: 'demo swarm scripts', pattern: /SWARM_SCRIPTS_BY_SPEC/ },
  { name: 'telemetry baseline figure', pattern: /6611605|6[.,]611[.,]605/ },
  { name: 'fixed Gemini model row', pattern: /Gemini Flash/ },
  { name: 'fixed provider display name', pattern: /Google Gemini|GitHub Copilot/ },
  { name: 'fixed default spec', pattern: /spec-e-burgos-004-studio-gates-topology/ },
];

const isTestFile = (path: string): boolean => /\.spec\.[cm]?[jt]sx?$/.test(path);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry) && !isTestFile(path) ? [path] : [];
  });
}

const findViolations = (files: string[]): string[] =>
  files.flatMap((file) => {
    const content = readFileSync(file, 'utf8');
    return FABRICATED_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ name }) => `${relative(SRC_ROOT, file)}: ${name}`);
  });

describe('no fabricated data in the web source', () => {
  it('scans the application source and skips test files', () => {
    const files = sourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((file) => isTestFile(file))).toBe(false);
    expect(files.some((file) => file.endsWith('conversation.ts'))).toBe(true);
  });

  it('contains no scripted dialogues, invented session ids, baseline telemetry or fixed providers', () => {
    expect(findViolations(sourceFiles(SRC_ROOT))).toEqual([]);
  });

  it('flags each pattern when it appears', () => {
    const samples = ["const id = 'session-spec-003';", 'SWARM_SCRIPTS_BY_SPEC', 'totalTokens: 6611605', '"Gemini Flash"', 'Google Gemini', 'GitHub Copilot'];
    for (const sample of samples) {
      expect(FABRICATED_PATTERNS.some(({ pattern }) => pattern.test(sample))).toBe(true);
    }
  });

  it('does not flag legitimate identifiers', () => {
    expect(FABRICATED_PATTERNS.some(({ pattern }) => pattern.test('data-testid="conversation-session-info"'))).toBe(false);
  });
});
