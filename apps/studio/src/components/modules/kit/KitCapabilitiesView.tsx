'use client';

import { EmptyState, Skeleton } from '@e-burgos/tucu-ui';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useStudio } from '../../BridgeProvider';
import { CenterFrame, FileViewer, IconButton, NoMatches } from './KitParts';
import { kitAgents, kitSkills, type CapabilityKind } from './kit-model';

interface Capability {
  id: string;
  description: string;
  command: string;
  path: string;
  model?: string | null;
}

const COPIED_MS = 2000;

function CopyCommand({ command }: { command: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    if (!navigator.clipboard) {
      setCopied(false);
      return;
    }
    navigator.clipboard.writeText(command).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => setCopied(false),
    );
  };
  return <IconButton icon={copied ? Check : Copy} label={copied ? t('module.kit.cap.copied') : t('module.kit.cap.copy', { command })} onClick={copy} />;
}

function CapabilityRow({ item, selected, onSelect }: { item: Capability; selected: boolean; onSelect: () => void }) {
  const { t } = useT();
  return (
    <li data-testid="kit-capability" className={`flex items-start gap-1 rounded-lg border border-foreground/10 p-2 ${selected ? 'bg-ink-800' : 'bg-ink-900'}`}>
      <button type="button" aria-pressed={selected} aria-label={t('module.kit.cap.open', { id: item.id })} onClick={onSelect} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="truncate text-copy font-medium text-ink-50">{item.id}</span>
        <span className="line-clamp-2 text-small text-ink-400">{item.description || t('module.kit.cap.noDescription')}</span>
        <span className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-ui text-ink-100">{item.command}</code>
          {item.model && <span className="text-meta text-ink-400">{t('module.kit.cap.model', { model: item.model })}</span>}
        </span>
      </button>
      <CopyCommand command={item.command} />
    </li>
  );
}

export function KitCapabilitiesView({ which }: { which: CapabilityKind }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const [query] = useModuleQuery('kit');
  const [chosen, setChosen] = useState<string | null>(null);
  const title = t(`module.kit.cap.title.${which}`);
  if (!snapshot) {
    return (
      <CenterFrame title={title}>
        <Skeleton height="4rem" />
      </CenterFrame>
    );
  }
  const items: Capability[] =
    which === 'agents'
      ? kitAgents(snapshot).map((agent) => ({ id: agent.id, description: agent.description, command: `@${agent.id}`, path: agent.path, model: agent.model }))
      : kitSkills(snapshot, which === 'skills' ? 'skill' : 'prompt').map((skill) => ({ id: skill.id, description: skill.description, command: `/${skill.id}`, path: skill.path }));
  const visible = items.filter((item) => matchesQuery(query, item.id, item.description));
  const current = visible.find((item) => item.id === chosen) ?? visible[0];
  return (
    <CenterFrame title={title}>
      {items.length === 0 ? (
        <EmptyState size="sm" title={t('module.kit.cap.empty')} />
      ) : !current ? (
        <NoMatches />
      ) : (
        <div className="flex min-h-0 flex-col gap-3 md:flex-row">
          <ul className="flex shrink-0 flex-col gap-2 md:w-80">
            {visible.map((item) => (
              <CapabilityRow key={item.id} item={item} selected={item.id === current.id} onSelect={() => setChosen(item.id)} />
            ))}
          </ul>
          <div className="min-w-0 flex-1">
            <FileViewer key={current.path} path={current.path} mode="markdown" />
          </div>
        </div>
      )}
    </CenterFrame>
  );
}
