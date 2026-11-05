import type { WizardState } from './state';

export type HermesLang = 'es' | 'en';

const FALLBACK: Record<HermesLang, string> = {
  es: '¿Por dónde empezamos? Describí la primera funcionalidad.',
  en: 'Where do we start? Describe the first feature.',
};

const withDescription: Record<HermesLang, (name: string, description: string, apps: string) => string> = {
  es: (name, description, apps) => `Arrancamos ${name}: ${description}. ¿Cuál es la primera funcionalidad para ${apps}?`,
  en: (name, description, apps) => `We are starting ${name}: ${description}. What is the first feature for ${apps}?`,
};

const withModule: Record<HermesLang, (module: string, apps: string) => string> = {
  es: (module, apps) => `Armá la primera spec del módulo ${module} para ${apps}.`,
  en: (module, apps) => `Draft the first spec for the ${module} module for ${apps}.`,
};

const withoutFinalPeriod = (text: string) => text.trim().replace(/[.\s]+$/, '');

export function buildHermesIdea(state: Pick<WizardState, 'modules' | 'apps' | 'project'>, lang: HermesLang): string {
  if (state.apps.length === 0) return FALLBACK[lang];
  const apps = state.apps.map((app) => app.name).join(', ');
  const module = state.modules[0]?.trim() ?? '';
  if (module !== '') return withModule[lang](module, apps);
  const description = withoutFinalPeriod(state.project.description);
  if (description !== '') return withDescription[lang](state.project.name.trim(), description, apps);
  return FALLBACK[lang];
}
