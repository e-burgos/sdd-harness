import { joinLog, stripAnsi } from '../log-text';

describe('log text', () => {
  it('strips color and cursor sequences', () => {
    expect(stripAnsi('\u001b[1;32mok\u001b[0m \u001b[2K\u001b[1Gdone')).toBe('ok done');
  });

  it('joins the chunks in order without ANSI', () => {
    expect(
      joinLog([
        { seq: 1, stream: 'stdout', chunk: 'a\n' },
        { seq: 2, stream: 'stderr', chunk: '\u001b[31mb\u001b[0m\n' },
      ]),
    ).toBe('a\nb\n');
  });
});
