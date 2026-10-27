import type { ModuleSlots } from '@/lib/nav/module-slots';
import { AgentsCenter } from './AgentsCenter';
import { AgentsPanel } from './AgentsPanel';
import { AgentsRight } from './AgentsRight';

export const agentsModule: ModuleSlots = { Panel: AgentsPanel, Center: AgentsCenter, Right: AgentsRight };
