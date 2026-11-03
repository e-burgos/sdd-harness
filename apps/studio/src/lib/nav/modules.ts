import { Activity, BarChart3, Bot, Boxes, FileText, Home, Network, Package, Wrench, type LucideIcon } from 'lucide-react';
import type { Dict } from '@/lib/i18n/es';
import { activityModule } from '@/components/modules/activity';
import { agentsModule } from '@/components/modules/agents';
import { architectureModule } from '@/components/modules/architecture';
import { fixesModule } from '@/components/modules/fixes';
import { homeModule } from '@/components/modules/home';
import { kitModule } from '@/components/modules/kit';
import { mapModule } from '@/components/modules/map';
import { metricsModule } from '@/components/modules/metrics';
import { specsModule } from '@/components/modules/specs';
import { MODULE_LABEL_KEY } from './module-labels';
import { isHideable, MODULE_IDS, type ModuleId } from './module-ids';
import type { ModuleSlots } from './module-slots';

export interface ModuleDefinition extends ModuleSlots {
  id: ModuleId;
  icon: LucideIcon;
  labelKey: keyof Dict;
  hideable: boolean;
}

const ICONS: Record<ModuleId, LucideIcon> = {
  home: Home,
  specs: FileText,
  fixes: Wrench,
  agents: Bot,
  activity: Activity,
  map: Network,
  kit: Package,
  architecture: Boxes,
  metrics: BarChart3,
};

const SLOTS: Record<ModuleId, ModuleSlots> = {
  home: homeModule,
  specs: specsModule,
  fixes: fixesModule,
  agents: agentsModule,
  activity: activityModule,
  map: mapModule,
  kit: kitModule,
  architecture: architectureModule,
  metrics: metricsModule,
};

export const MODULES: Record<ModuleId, ModuleDefinition> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, { id, icon: ICONS[id], labelKey: MODULE_LABEL_KEY[id], hideable: isHideable(id), ...SLOTS[id] }]),
) as Record<ModuleId, ModuleDefinition>;

export const MODULE_ICONS = ICONS;
