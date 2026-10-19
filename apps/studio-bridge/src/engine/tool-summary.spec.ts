import { describe, expect, it } from 'vitest';
import { diffFor, summarizeTool, truncate } from './tool-summary';

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
  it('truncates long commands to 160 chars', () => {
    expect(summarizeTool('Bash', { command: 'x'.repeat(500) })).toHaveLength(160);
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
