import type { ModuleSlots } from '@/lib/nav/module-slots';
import { ActivityScope } from './activity-scope';
import { ActivityCenter } from './ActivityCenter';
import { ActivityPanel } from './ActivityPanel';

export const activityModule: ModuleSlots = { Panel: ActivityPanel, Center: ActivityCenter, Right: null, Scope: ActivityScope };
