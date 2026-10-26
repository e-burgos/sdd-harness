import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STABLE_PREFIX_MAX_BYTES,
  STABLE_PREFIX_SOURCES,
  composeStablePrefix,
  createStablePrefixLoader,
} from './stable-prefix';

let root: string;

const writeSource = (source: string, content: string): void => {
  const file = path.join(root, source);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const writeAll = (): void => {
  writeSource('sdd/context/context_prompt.md', 'context\n');
  writeSource('sdd/context/constitution.md', 'constitution\n');
  writeSource('sdd/memory/lessons.md', 'lessons\n');
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'stable-prefix-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('composeStablePrefix', () => {
  it('labels each section with its constant relative path and joins them in order', () => {
    const text = composeStablePrefix([
      { source: 'a.md', content: 'A' },
      { source: 'b.md', content: 'B' },
    ]);
    expect(text).toBe(
      '<project-context source="a.md">\nA\n</project-context>\n\n<project-context source="b.md">\nB\n</project-context>',
    );
  });
  it('skips empty sections', () => {
    expect(composeStablePrefix([{ source: 'a.md', content: '' }])).toBe('');
  });
});

describe('createStablePrefixLoader', () => {
  it('is byte for byte identical across two loads (CA-012)', () => {
    writeAll();
    const warn = vi.fn();
    const first = createStablePrefixLoader(root, warn)();
    const second = createStablePrefixLoader(root, warn)();
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(first.length).toBeGreaterThan(0);
  });
  it('reads the sources in the declared order (RN-07)', () => {
    writeAll();
    const text = createStablePrefixLoader(root, vi.fn())();
    const positions = STABLE_PREFIX_SOURCES.map((source) => text.indexOf(`source="${source}"`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });
  it.each(STABLE_PREFIX_SOURCES)('changes when %s changes (CA-013)', (source) => {
    writeAll();
    const before = createStablePrefixLoader(root, vi.fn())();
    writeSource(source, 'edited content');
    expect(createStablePrefixLoader(root, vi.fn())()).not.toBe(before);
  });
  it('omits a missing file, keeps the rest and warns once per file (CA-014)', () => {
    writeSource('sdd/context/context_prompt.md', 'context');
    writeSource('sdd/memory/lessons.md', 'lessons');
    const warn = vi.fn();
    const load = createStablePrefixLoader(root, warn);
    const text = load();
    load();
    expect(text).toContain('source="sdd/context/context_prompt.md"');
    expect(text).toContain('source="sdd/memory/lessons.md"');
    expect(text).not.toContain('constitution.md');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('sdd/context/constitution.md');
  });
  it('returns an empty prefix when nothing exists', () => {
    expect(createStablePrefixLoader(root, vi.fn())()).toBe('');
  });
  it('normalizes CRLF and trims', () => {
    writeSource('sdd/context/context_prompt.md', '\n  line1\r\nline2  \r\n\n');
    const text = createStablePrefixLoader(root, vi.fn())();
    expect(text).toBe('<project-context source="sdd/context/context_prompt.md">\nline1\nline2\n</project-context>');
  });
  it('skips files above the size limit', () => {
    writeSource('sdd/context/context_prompt.md', 'x'.repeat(STABLE_PREFIX_MAX_BYTES + 1));
    const warn = vi.fn();
    expect(createStablePrefixLoader(root, warn)()).toBe('');
    expect(warn).toHaveBeenCalled();
  });
  it('carries no variable data: no absolute path, root, date or session id (CA-016)', () => {
    writeAll();
    const text = createStablePrefixLoader(root, vi.fn())();
    expect(text).not.toContain(root);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/session/i);
  });
  it('does not summarize: content appears verbatim', () => {
    writeSource('sdd/memory/lessons.md', 'a long lesson body');
    expect(createStablePrefixLoader(root, vi.fn())()).toContain('\na long lesson body\n');
  });
});
