'use client';

import { Button } from '@e-burgos/tucu-ui';
import { BookOpen, Bot, Braces, Brain, FileText, FolderTree, ListChecks, ScrollText, Sparkles, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { useKitIndex } from './KitProvider';
import { DOC_FILES, contextScopeCount, entriesOf, kitAgents, kitSearchTerms, kitSelectionOf, kitSkills, resolveDoc, type KitView } from './kit-model';

interface Row {
  view: KitView;
  label: string;
  icon: LucideIcon;
  meta?: ReactNode;
}

interface Group {
  id: string;
  title: string;
  rows: Row[];
}

const DOC_ICONS: LucideIcon[] = [BookOpen, ListChecks, FileText];

function toolsMeta(tools: { status: string; gate: 'block' | 'warn' | null } | undefined, t: TFunction): string | undefined {
  if (!tools) return t('module.kit.panel.toolsMissing');
  if (tools.status !== 'ok') return t(tools.status === 'invalid' ? 'module.kit.panel.toolsStatus.invalid' : 'module.kit.panel.toolsStatus.missing');
  return tools.gate ? t(`module.kit.tools.${tools.gate}`) : undefined;
}

export function KitPanel() {
  const { t, lang } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const { status, index, reload } = useKitIndex();
  const selected = useNav((s) => s.selection.kit);
  const select = useNav((s) => s.select);
  const [query] = useModuleQuery('kit');
  const entries = index?.entries ?? null;

  const groups = useMemo<Group[]>(() => {
    const docRows = DOC_FILES.flatMap(({ id }, position): Row[] => {
      const resolved = resolveDoc(entries, id, lang);
      if (!resolved) return [];
      return [{ view: { kind: 'doc', doc: id }, label: t(`module.kit.row.${id}`), icon: DOC_ICONS[position] ?? FileText, meta: resolved.fallback ? resolved.language.toUpperCase() : undefined }];
    });
    const all: Group[] = [
      {
        id: 'capabilities',
        title: t('module.kit.group.capabilities'),
        rows: [
          { view: { kind: 'capabilities', which: 'skills' }, label: t('module.kit.row.skills'), icon: Sparkles, meta: snapshot ? kitSkills(snapshot, 'skill').length : undefined },
          { view: { kind: 'capabilities', which: 'prompts' }, label: t('module.kit.row.prompts'), icon: ScrollText, meta: snapshot ? kitSkills(snapshot, 'prompt').length : undefined },
          { view: { kind: 'capabilities', which: 'agents' }, label: t('module.kit.row.agents'), icon: Bot, meta: snapshot ? kitAgents(snapshot).length : undefined },
        ],
      },
      { id: 'tools', title: t('module.kit.group.tools'), rows: [{ view: { kind: 'tools' }, label: t('module.kit.row.tools'), icon: Wrench, meta: toolsMeta(snapshot?.tools, t) }] },
      { id: 'docs', title: t('module.kit.group.docs'), rows: docRows },
      {
        id: 'project',
        title: t('module.kit.group.project'),
        rows: [
          { view: { kind: 'schemas' }, label: t('module.kit.row.schemas'), icon: Braces, meta: entries ? entriesOf(entries, 'schemas').length : undefined },
          { view: { kind: 'context' }, label: t('module.kit.row.context'), icon: FolderTree, meta: entries ? contextScopeCount(entries) : undefined },
          { view: { kind: 'memory', which: 'lessons' }, label: t('module.kit.row.lessons'), icon: Brain },
          { view: { kind: 'memory', which: 'journal' }, label: t('module.kit.row.journal'), icon: ScrollText, meta: entries ? entriesOf(entries, 'memory', 'journal').length : undefined },
        ],
      },
    ];
    return all.map((group) => ({ ...group, rows: group.rows.filter((row) => matchesQuery(query, row.label, ...kitSearchTerms(row.view, snapshot, entries))) })).filter((group) => group.rows.length > 0);
  }, [entries, lang, query, snapshot, t]);

  return (
    <ModulePanel moduleId="kit" status={snapshot === null ? 'loading' : 'ready'} hasResults={groups.length > 0}>
      {status === 'unsupported' && <PanelNotice role="status" message={t('module.kit.panel.unsupported')} />}
      {status === 'error' && (
        <PanelNotice
          role="alert"
          tone="error"
          icon={TriangleAlert}
          message={t('module.kit.panel.error')}
          action={
            <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={reload}>
              {t('module.kit.panel.retry')}
            </Button>
          }
        />
      )}
      {groups.map((group) => (
        <PanelGroup key={group.id} id={group.id} title={group.title} count={group.rows.length}>
          {group.rows.map((row) => {
            const id = kitSelectionOf(row.view);
            return <PanelRow key={id} label={row.label} icon={row.icon} meta={row.meta} selected={selected === id} onClick={() => select('kit', id)} />;
          })}
        </PanelGroup>
      ))}
    </ModulePanel>
  );
}
