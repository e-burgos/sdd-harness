import type { ModuleSlots } from '@/lib/nav/module-slots';
import { KitCenter } from './KitCenter';
import { KitPanel } from './KitPanel';
import { KitProvider } from './KitProvider';

export { KIT_TOOLS_SELECTION } from './kit-model';

export const kitModule: ModuleSlots = { Panel: KitPanel, Center: KitCenter, Right: null, Scope: KitProvider };
