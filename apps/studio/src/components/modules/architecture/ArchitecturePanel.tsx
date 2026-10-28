'use client';

import { Boxes, Database, Network, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { ARCHITECTURE_SECTIONS, useNav, type ArchitectureSection } from '@/lib/nav/use-nav';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelRow } from '../../shell/PanelRow';
import { filterComponents, filterEndpoints, filterTables } from './architecture-model';
import { useRegistries, type RegistryState } from './use-registries';

const SECTION_ICON: Record<ArchitectureSection, LucideIcon> = { db: Database, api: Network, components: Boxes };

const countOf = (state: RegistryState<unknown>, shown: number): string | undefined => (state.status === 'ready' ? String(shown) : undefined);

export function useActiveSection(): ArchitectureSection {
  return useNav((s) => s.selection.architecture) ?? 'db';
}

export function ArchitecturePanel() {
  const { t } = useT();
  const registries = useRegistries();
  const [query] = useModuleQuery('architecture');
  const active = useActiveSection();
  const select = useNav((s) => s.select);
  const shown: Record<ArchitectureSection, number> = {
    db: registries.db.status === 'ready' ? filterTables(query, registries.db.items).length : 0,
    api: registries.api.status === 'ready' ? filterEndpoints(query, registries.api.items).length : 0,
    components: registries.components.status === 'ready' ? filterComponents(query, registries.components.items).length : 0,
  };
  return (
    <ModulePanel moduleId="architecture">
      <PanelGroup id="registries" title={t('architecture.panel.group')} count={ARCHITECTURE_SECTIONS.length}>
        {ARCHITECTURE_SECTIONS.map((section) => (
          <PanelRow
            key={section}
            label={t(`architecture.section.${section}` as keyof Dict)}
            icon={SECTION_ICON[section]}
            meta={countOf(registries[section], shown[section])}
            selected={active === section}
            onClick={() => select('architecture', section)}
          />
        ))}
      </PanelGroup>
    </ModulePanel>
  );
}
