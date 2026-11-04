import type { WizardState } from './state';

export type HermesLang = 'es' | 'en';

const FALLBACK: Record<HermesLang, string> = {
  es: '¿Por dónde empezamos? Describí la primera funcionalidad.',
  en: 'Where do we start? Describe the first feature.',
};

const withModule: Record<HermesLang, (module: string, apps: string) => string> = {
  es: (module, apps) => `Armá la primera spec del módulo ${module} para ${apps}.`,
  en: (module, apps) => `Draft the first spec for the ${module} module for ${apps}.`,
};

export function buildHermesIdea(state: Pick<WizardState, 'modules' | 'apps'>, lang: HermesLang): string {
  const module = state.modules[0];
  if (module === undefined || module.trim() === '' || state.apps.length === 0) return FALLBACK[lang];
  const apps = state.apps.map((app) => app.name).join(', ');
  return withModule[lang](module, apps);
}
