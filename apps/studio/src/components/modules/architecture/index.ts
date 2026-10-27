import type { ModuleSlots } from '@/lib/nav/module-slots';
import { ArchitectureCenter } from './ArchitectureCenter';
import { ArchitecturePanel } from './ArchitecturePanel';

export const architectureModule: ModuleSlots = { Panel: ArchitecturePanel, Center: ArchitectureCenter, Right: null };
