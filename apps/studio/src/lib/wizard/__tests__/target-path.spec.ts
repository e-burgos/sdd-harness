import { defaultTargetPath } from '../target-path';

describe('defaultTargetPath', () => {
  it('joins the suggested parent and the trimmed project name', () => {
    expect(defaultTargetPath({ suggestedParent: '/home/dev/projects', platform: 'posix' }, ' acme ')).toBe('/home/dev/projects/acme');
  });

  it('does not duplicate a trailing separator and uses backslashes on win32', () => {
    expect(defaultTargetPath({ suggestedParent: '/home/dev/', platform: 'posix' }, 'acme')).toBe('/home/dev/acme');
    expect(defaultTargetPath({ suggestedParent: 'C:\\Users\\dev\\', platform: 'win32' }, 'acme')).toBe('C:\\Users\\dev\\acme');
  });

  it('is empty without a project name', () => {
    expect(defaultTargetPath({ suggestedParent: '/home/dev', platform: 'posix' }, '  ')).toBe('');
  });
});
