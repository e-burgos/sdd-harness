export interface TargetDefaults {
  suggestedParent: string;
  platform: 'posix' | 'win32';
}

export function defaultTargetPath(info: TargetDefaults, projectName: string): string {
  const name = projectName.trim();
  if (name === '') return '';
  const separator = info.platform === 'win32' ? '\\' : '/';
  const parent = info.suggestedParent.replace(/[\\/]+$/, '');
  return `${parent}${separator}${name}`;
}
