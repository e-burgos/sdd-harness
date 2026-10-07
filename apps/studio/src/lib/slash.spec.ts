import { parseSlash } from './slash';

describe('parseSlash', () => {
  it('returns null for plain text', () => {
    expect(parseSlash('hola')).toBeNull();
  });
  it('maps script commands with safe args', () => {
    expect(parseSlash('/gate spec-dev-001-pagos cycle-01')).toEqual({ kind: 'run', name: 'gate', args: ['spec-dev-001-pagos', 'cycle-01'] });
    expect(parseSlash('/validate')).toEqual({ kind: 'run', name: 'validate', args: [] });
    expect(parseSlash('/gate a;b')).toEqual({ kind: 'error', reason: 'args', name: 'gate' });
    expect(parseSlash('/gate a b c d e')).toEqual({ kind: 'error', reason: 'args', name: 'gate' });
  });
  it('maps prompt commands to kit prompt files and keeps the rest as args', () => {
    expect(parseSlash('/open-cycle spec-dev-001-pagos\nrefunds')).toEqual({
      kind: 'prompt', name: 'open-cycle', path: 'sdd/prompts/start-sdd-cycle.prompt.md', args: 'spec-dev-001-pagos\nrefunds',
    });
    expect(parseSlash('/review')).toMatchObject({ kind: 'prompt', path: 'sdd/prompts/review-cycle.prompt.md', args: '' });
  });
  it('does not resolve Object prototype keys as commands', () => {
    expect(parseSlash('/constructor')).toEqual({ kind: 'error', reason: 'unknown', name: 'constructor' });
  });
  it('flags unknown commands', () => {
    expect(parseSlash('/nope x')).toEqual({ kind: 'error', reason: 'unknown', name: 'nope' });
  });
});
