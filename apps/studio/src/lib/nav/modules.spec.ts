import { MODULES } from './modules';
import { MODULE_IDS, isHideable } from './module-ids';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('module registry', () => {
  it('has the ten modules in the documented order', () => {
    expect(MODULE_IDS).toEqual(['home', 'specs', 'fixes', 'agents', 'activity', 'map', 'kit', 'architecture', 'metrics', 'new-project']);
    expect(Object.keys(MODULES)).toEqual([...MODULE_IDS]);
  });

  it('keeps Home as the only module that cannot be hidden', () => {
    expect(MODULE_IDS.filter((id) => !MODULES[id].hideable)).toEqual(['home']);
    expect(isHideable('home')).toBe(false);
  });

  it('has no right panel in Activity, Kit, Architecture and Metrics', () => {
    expect(MODULE_IDS.filter((id) => MODULES[id].Right === null)).toEqual(['activity', 'kit', 'architecture', 'metrics']);
  });

  it('gives every module a panel, a center, an icon and a label in both languages', () => {
    MODULE_IDS.forEach((id) => {
      const module = MODULES[id];
      expect(module.Panel).toBeTypeOf('function');
      expect(module.Center).toBeTypeOf('function');
      expect(module.icon).toBeDefined();
      expect(es[module.labelKey]).toBeTruthy();
      expect(en[module.labelKey]).toBeTruthy();
    });
  });
});
