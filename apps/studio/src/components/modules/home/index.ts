import type { ModuleSlots } from '@/lib/nav/module-slots';
import { HomeCenter } from './HomeCenter';
import { HomePanel } from './HomePanel';
import { HomeRight } from './HomeRight';

export const homeModule: ModuleSlots = { Panel: HomePanel, Center: HomeCenter, Right: HomeRight };
