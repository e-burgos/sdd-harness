import type { Dict } from '@/lib/i18n/es';
import type { ModuleId } from './module-ids';

export const MODULE_LABEL_KEY: Record<ModuleId, keyof Dict> = {
  home: 'module.home.label',
  specs: 'module.specs.label',
  fixes: 'module.fixes.label',
  agents: 'module.agents.label',
  activity: 'module.activity.label',
  map: 'module.map.label',
  kit: 'module.kit.label',
  architecture: 'module.architecture.label',
  metrics: 'module.metrics.label',
  'new-project': 'module.new-project.label',
};
