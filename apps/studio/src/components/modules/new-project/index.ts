import type { ModuleSlots } from '@/lib/nav/module-slots';
import { NewProjectCenter } from './NewProjectCenter';
import { NewProjectPanel } from './NewProjectPanel';
import { NewProjectRight } from './NewProjectRight';
import { WizardScope } from './wizard-context';

export const newProjectModule: ModuleSlots = { Panel: NewProjectPanel, Center: NewProjectCenter, Right: NewProjectRight, Scope: WizardScope };
