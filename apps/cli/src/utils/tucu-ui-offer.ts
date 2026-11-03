export type TucuUiState = 'off' | 'complete' | 'incomplete';
export type TucuUiChoice = 'enable' | 'skip' | 'ask-enable' | 'ask-repair';

const FRONTEND_APP_TYPES = ['react', 'nextjs'];

export function resolveTucuUiChoice(input: {
  flag: boolean | undefined;
  hasFrontend: boolean;
  interactive: boolean;
  current: TucuUiState;
}): TucuUiChoice {
  if (input.flag === true) return 'enable';
  if (input.flag === false) return 'skip';
  if (!input.hasFrontend) return 'skip';
  if (input.current === 'complete') return 'skip';
  if (!input.interactive) return 'skip';
  if (input.current === 'incomplete') return 'ask-repair';
  return 'ask-enable';
}

export function hasFrontendApp(types: readonly string[]): boolean {
  return types.some((type) => FRONTEND_APP_TYPES.includes(type));
}

export function hasConflictingTucuUiFlags(rawArgs: readonly string[]): boolean {
  const names = new Set(rawArgs.filter((arg) => arg.startsWith('--')).map((arg) => arg.split('=')[0]));
  return names.has('--tucu-ui') && names.has('--no-tucu-ui');
}

export const TUCU_UI_CONFLICT_MESSAGE =
  '--tucu-ui and --no-tucu-ui cannot be used together — pass only one.';
