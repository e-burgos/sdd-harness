import type { ModuleSlots } from '@/lib/nav/module-slots';
import { ArchitectureCenter } from './ArchitectureCenter';
import { ArchitecturePanel } from './ArchitecturePanel';
import { RegistriesProvider } from './use-registries';

export const architectureModule: ModuleSlots = { Panel: ArchitecturePanel, Center: ArchitectureCenter, Right: null, Scope: RegistriesProvider };
