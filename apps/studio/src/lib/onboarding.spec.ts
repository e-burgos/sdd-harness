import { hiddenGuideKey, onboardingSteps, readGuideHidden, writeGuideHidden, type OnboardingInput, type OnboardingStatus } from './onboarding';

const base: OnboardingInput = { claudeConnected: false, projectOpen: false, githubSupported: true, githubConnected: false, firstWorkDone: false };
const statuses = (over: Partial<OnboardingInput>): OnboardingStatus[] => onboardingSteps({ ...base, ...over }).map((s) => s.status);

describe('onboardingSteps', () => {
  it('keeps the four steps in order', () => {
    expect(onboardingSteps(base).map((s) => s.id)).toEqual(['claude', 'project', 'github', 'first-work']);
  });

  it.each([
    ['nothing done', {}, ['current', 'pending', 'pending', 'pending']],
    ['claude connected', { claudeConnected: true }, ['done', 'current', 'pending', 'pending']],
    ['project open without claude', { projectOpen: true }, ['current', 'done', 'pending', 'pending']],
    ['claude and project', { claudeConnected: true, projectOpen: true }, ['done', 'done', 'current', 'pending']],
    ['github unavailable', { claudeConnected: true, projectOpen: true, githubSupported: false }, ['done', 'done', 'unavailable', 'current']],
    ['github connected', { claudeConnected: true, projectOpen: true, githubConnected: true }, ['done', 'done', 'done', 'current']],
    ['github connected even if unsupported later', { githubSupported: false, githubConnected: true }, ['current', 'pending', 'done', 'pending']],
    ['everything done', { claudeConnected: true, projectOpen: true, githubConnected: true, firstWorkDone: true }, ['done', 'done', 'done', 'done']],
    ['unavailable github does not take current', { githubSupported: false, claudeConnected: true, projectOpen: true, firstWorkDone: true }, ['done', 'done', 'unavailable', 'done']],
  ] as Array<[string, Partial<OnboardingInput>, OnboardingStatus[]]>)('%s', (_name, over, expected) => {
    expect(statuses(over)).toEqual(expected);
  });
});

describe('guide hidden persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('is per project root', () => {
    writeGuideHidden('/a');
    expect(readGuideHidden('/a')).toBe(true);
    expect(readGuideHidden('/b')).toBe(false);
    expect(window.localStorage.getItem(hiddenGuideKey('/a'))).toBe('1');
  });

  it('reads as not hidden and does not throw when storage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readGuideHidden('/a')).toBe(false);
    expect(() => writeGuideHidden('/a')).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });
});
