'use client';

import { Globe, Layers, Puzzle, Server, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { useClaude } from './ClaudeProvider';
import { CLAUDE_SECTIONS, rowCount, sectionOf, type ClaudeSection } from './claude-model';

const SECTION_ICON: Record<ClaudeSection, LucideIcon> = { sources: Layers, plugins: Puzzle, mcp: Server, browser: Globe };

export function ClaudePanel() {
  const { t } = useT();
  const { supported, open, inventory } = useClaude();
  const [query] = useModuleQuery('claude');
  const active = sectionOf(useNav((s) => s.selection.claude));
  const select = useNav((s) => s.select);
  const sections = CLAUDE_SECTIONS.filter((section) => matchesQuery(query, t(`module.claude.section.${section}`)));
  return (
    <ModulePanel moduleId="claude" hasResults={sections.length > 0}>
      {open && !supported && <PanelNotice role="status" message={t('module.claude.unsupported')} />}
      <PanelGroup id="sections" title={t('module.claude.group')} count={sections.length}>
        {sections.map((section) => (
          <PanelRow key={section} label={t(`module.claude.section.${section}`)} icon={SECTION_ICON[section]} meta={rowCount(section, inventory)} selected={active === section} onClick={() => select('claude', section)} />
        ))}
      </PanelGroup>
    </ModulePanel>
  );
}
