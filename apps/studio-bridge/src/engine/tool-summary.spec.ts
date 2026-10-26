import { describe, expect, it } from 'vitest';
import { BASH_SUMMARY_MAX, diffFor, summarizeTool, summarizeToolDetailed, truncate } from './tool-summary';

describe('summarizeTool', () => {
  it.each([
    ['Bash', { command: 'pnpm test' }, '$ pnpm test'],
    ['Edit', { file_path: '/r/a.ts' }, '/r/a.ts'],
    ['NotebookEdit', { notebook_path: '/r/n.ipynb' }, '/r/n.ipynb'],
    ['Grep', { pattern: 'TODO' }, 'Grep TODO'],
    ['Agent', { subagent_type: 'sdd-planner', description: 'plan' }, 'sdd-planner: plan'],
    ['WebFetch', { url: 'x' }, 'WebFetch'],
  ])('%s', (name, input, expected) => {
    expect(summarizeTool(name, input)).toBe(expected);
  });
  it('keeps Grep and Agent summaries at 160 chars', () => {
    expect(summarizeTool('Grep', { pattern: 'x'.repeat(500) })).toHaveLength(160);
    expect(summarizeTool('Agent', { description: 'x'.repeat(500) })).toHaveLength(160);
  });
});

describe('summarizeToolDetailed Bash', () => {
  const bash = (command: string) => summarizeToolDetailed('Bash', { command });

  it('keeps a command of up to 600 chars whole', () => {
    const command = `echo ${'x'.repeat(BASH_SUMMARY_MAX - 7)}`;
    const result = bash(command);
    expect(result).toEqual({ summary: `$ ${command}`, truncated: false });
    expect(result.summary).toHaveLength(BASH_SUMMARY_MAX);
  });

  it('cuts the head at a word boundary and keeps referenced sdd paths whole', () => {
    const filler = Array.from({ length: 120 }, (_, i) => `arg${i}`).join(' ');
    const command = `${filler} sdd/specs/spec-a-001/cycles/cycle-01/tasks.json "./sdd/memory/lessons.md"`;
    const result = bash(command);
    expect(result.truncated).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(BASH_SUMMARY_MAX);
    expect(result.summary).toContain(' … ');
    expect(result.summary.endsWith('sdd/specs/spec-a-001/cycles/cycle-01/tasks.json ./sdd/memory/lessons.md')).toBe(true);
    const head = result.summary.split(' … ')[0];
    expect(head.length).toBeLessThanOrEqual(360);
    expect(command.startsWith(head.slice(2))).toBe(true);
    expect(`${command} `.slice(head.length - 2).startsWith(' ')).toBe(true);
  });

  it('does not repeat a path already in the head', () => {
    const command = `cat sdd/a.md ${'y '.repeat(400)}sdd/a.md`;
    const result = bash(command);
    expect(result.summary.match(/sdd\/a\.md/g)).toHaveLength(1);
    expect(result.summary.endsWith('…')).toBe(true);
  });

  it('ends in an ellipsis when no referenced path fits', () => {
    const result = bash(`${'z '.repeat(400)}sdd/${'p'.repeat(300)}`);
    expect(result.truncated).toBe(true);
    expect(result.summary.endsWith('…')).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(BASH_SUMMARY_MAX);
  });

  it('hard-cuts a single oversized token with a trailing ellipsis', () => {
    const result = bash('x'.repeat(900));
    expect(result.truncated).toBe(true);
    expect(result.summary.endsWith('…')).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(BASH_SUMMARY_MAX);
  });

  it('never contains line breaks', () => {
    expect(bash('echo a\n  echo b\r\necho c').summary).toBe('$ echo a echo b echo c');
    const long = bash(`${'line one\n'.repeat(200)}sdd/z.md`);
    expect(long.summary).not.toMatch(/[\r\n]/);
    expect(long.truncated).toBe(true);
  });

  it('reports non-Bash tools as not truncated unless clipped', () => {
    expect(summarizeToolDetailed('Edit', { file_path: '/r/a.ts' })).toEqual({ summary: '/r/a.ts', truncated: false });
    expect(summarizeToolDetailed('Grep', { pattern: 'x'.repeat(500) }).truncated).toBe(true);
  });
});

describe('diffFor', () => {
  it('builds a +/- diff for Edit and a + diff for Write', () => {
    expect(diffFor('Edit', { old_string: 'a\nb', new_string: 'c' })).toBe('-a\n-b\n+c');
    expect(diffFor('Write', { content: 'x\ny' })).toBe('+x\n+y');
    expect(diffFor('Bash', { command: 'ls' })).toBeUndefined();
  });
  it('caps diffs at 4000 chars', () => {
    expect(diffFor('Write', { content: 'y'.repeat(10_000) })!.length).toBe(4000);
  });
});

describe('truncate', () => {
  it('adds an ellipsis only when needed', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdef', 4)).toBe('abc…');
  });
});
