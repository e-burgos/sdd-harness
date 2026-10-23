import { applyMention, detectMention } from './mention';

describe('detectMention', () => {
  it('opens @ at the start or after whitespace with the query up to the cursor', () => {
    expect(detectMention('@sdd', 4)).toEqual({ trigger: '@', query: 'sdd', start: 0 });
    expect(detectMention('mirá @src/a', 11)).toEqual({ trigger: '@', query: 'src/a', start: 5 });
    expect(detectMention('mirá @', 6)).toEqual({ trigger: '@', query: '', start: 5 });
    expect(detectMention('a@b', 3)).toBeNull();
    expect(detectMention('mirá @x y', 9)).toBeNull();
  });

  it('opens / only at position 0', () => {
    expect(detectMention('/ga', 3)).toEqual({ trigger: '/', query: 'ga', start: 0 });
    expect(detectMention('hola /ga', 8)).toBeNull();
    expect(detectMention('/gate spec', 10)).toBeNull();
  });
});

describe('applyMention', () => {
  const at = { trigger: '@' as const, query: 'pl', start: 5 };
  it('inserts a file path without @ and quotes paths with spaces', () => {
    expect(applyMention('mirá @pl y más', at, 8, { kind: 'file', id: 'a', path: 'src/plan.ts' })).toEqual({ text: 'mirá src/plan.ts  y más', cursor: 17 });
    expect(applyMention('mirá @pl', at, 8, { kind: 'file', id: 'a', path: 'my docs/a.md' }).text).toBe('mirá `my docs/a.md` ');
  });

  it('inserts @id for agents and /id for commands and skills', () => {
    expect(applyMention('@pl', { ...at, start: 0 }, 3, { kind: 'agent', id: 'sdd-planner', description: '' }).text).toBe('@sdd-planner ');
    expect(applyMention('/ga', { trigger: '/', query: 'ga', start: 0 }, 3, { kind: 'command', id: 'gate', description: '' })).toEqual({ text: '/gate ', cursor: 6 });
    expect(applyMention('/ge', { trigger: '/', query: 'ge', start: 0 }, 3, { kind: 'skill', id: 'generate:react', description: '', skillKind: 'skill' }).text).toBe('/generate:react ');
  });
});
