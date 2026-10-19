import { describe, expect, it } from 'vitest';
import { openCommand } from './open-browser';

const url = 'https://x.test/w#bridge=4320&token=abc';
describe('openCommand', () => {
  it('builds a per-platform argv that keeps the & intact', () => {
    expect(openCommand('darwin', url)).toEqual({ cmd: 'open', args: [url] });
    expect(openCommand('win32', url)).toEqual({ cmd: 'rundll32', args: ['url.dll,FileProtocolHandler', url] });
    expect(openCommand('linux', url)).toEqual({ cmd: 'xdg-open', args: [url] });
  });
});
