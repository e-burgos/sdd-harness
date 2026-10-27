import type { ModuleSlots } from '@/lib/nav/module-slots';
import { SpecsCenter } from './SpecsCenter';
import { SpecsPanel } from './SpecsPanel';
import { SpecsRight } from './SpecsRight';

export const specsModule: ModuleSlots = { Panel: SpecsPanel, Center: SpecsCenter, Right: SpecsRight };
