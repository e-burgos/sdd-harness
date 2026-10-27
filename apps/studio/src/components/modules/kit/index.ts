import type { ModuleSlots } from '@/lib/nav/module-slots';
import { KitCenter } from './KitCenter';
import { KitPanel } from './KitPanel';

export const kitModule: ModuleSlots = { Panel: KitPanel, Center: KitCenter, Right: null };
