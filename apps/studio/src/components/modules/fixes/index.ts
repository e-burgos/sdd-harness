import type { ModuleSlots } from '@/lib/nav/module-slots';
import { FixesCenter } from './FixesCenter';
import { FixesPanel } from './FixesPanel';
import { FixesRight } from './FixesRight';

export const fixesModule: ModuleSlots = { Panel: FixesPanel, Center: FixesCenter, Right: FixesRight };
