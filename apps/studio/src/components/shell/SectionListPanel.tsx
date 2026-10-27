'use client';

import type { LucideIcon } from 'lucide-react';
import type { ModuleId } from '@/lib/nav/module-ids';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { ModulePanel } from './ModulePanel';
import { PanelGroup } from './PanelGroup';
import { PanelRow } from './PanelRow';

export interface PanelSection<Id extends string> {
  id: Id;
  label: string;
  icon?: LucideIcon;
  count?: number | string;
}

export interface SectionListPanelProps<Id extends string> {
  moduleId: ModuleId;
  groupId?: string;
  groupTitle: string;
  sections: PanelSection<Id>[];
  selected: Id | null;
  onSelect: (id: Id) => void;
}

export function SectionListPanel<Id extends string>({ moduleId, groupId = 'sections', groupTitle, sections, selected, onSelect }: SectionListPanelProps<Id>) {
  const [query] = useModuleQuery(moduleId);
  const shown = sections.filter((section) => matchesQuery(query, section.label));
  return (
    <ModulePanel moduleId={moduleId} hasResults={shown.length > 0}>
      <PanelGroup id={groupId} title={groupTitle} count={shown.length}>
        {shown.map((section) => (
          <PanelRow key={section.id} label={section.label} icon={section.icon} meta={section.count} selected={selected === section.id} onClick={() => onSelect(section.id)} />
        ))}
      </PanelGroup>
    </ModulePanel>
  );
}
