'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ChevronDown, ExternalLink, Rocket, TriangleAlert } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { CommandLine } from '../CommandLine';
import { commandsForPath, INIT_COMMAND, LOCAL_UI_COMMAND, SDD_DOCS_URL, type EntryPath } from '../entry-model';
import { PasteLinkForm } from './PasteLinkForm';
import { StepHeader } from './StepHeader';

function WindowDots() {
  return (
    <span aria-hidden className="flex gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
    </span>
  );
}

function TerminalCard({ path }: { path: EntryPath }) {
  const { t } = useT();
  const commands = commandsForPath(path);
  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-ink-900/80 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur">
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5">
        <WindowDots />
        <span className="font-mono text-meta text-ink-500">{t('entry.connect.terminal')}</span>
      </div>
      <ol aria-label={t('entry.connect.commands')} className="wizard-stagger flex flex-col gap-4 p-4">
        {commands.map((entry) => (
          <li key={entry.id}>
            <CommandLine label={t(entry.label)} command={entry.translated ? t(entry.command as keyof Dict) : entry.command} />
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-small text-emerald-200">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="wizard-breathe absolute inset-0 rounded-full bg-emerald-400/60" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Rocket aria-hidden size={14} className="shrink-0" />
          {t('entry.connect.opens')}
        </li>
      </ol>
    </div>
  );
}

function PathNotes({ path }: { path: EntryPath }) {
  const { t } = useT();
  if (path === 'new') {
    return (
      <div className="flex flex-col gap-3 text-small text-ink-300">
        <p>{t('entry.connect.launcherHint')}</p>
        <CommandLine label={t('entry.connect.initAlt')} command={INIT_COMMAND} />
      </div>
    );
  }
  if (path === 'existing') {
    return (
      <a
        href={SDD_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 rounded text-small text-accent-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        {t('entry.connect.docs')} <ExternalLink aria-hidden size={13} />
      </a>
    );
  }
  return null;
}

function BlockedHelp({ initiallyOpen }: { initiallyOpen: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <div className="rounded-2xl border border-foreground/10 bg-ink-900/60 backdrop-blur">
      <Button
        type="button"
        variant="transparent"
        color="gray"
        size="small"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-small text-ink-100"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <TriangleAlert aria-hidden size={14} className="text-amberish" />
          {t('entry.connect.help.toggle')}
        </span>
        <ChevronDown aria-hidden size={16} className={`transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div id={panelId} role="region" aria-label={t('entry.connect.help.toggle')} className="flex flex-col gap-3 border-t border-foreground/10 px-4 py-4 text-small text-ink-300">
          <p>{t('entry.connect.help.chrome')}</p>
          <p>{t('entry.connect.help.chromeFix')}</p>
          <p>{t('entry.connect.help.safari')}</p>
          <CommandLine command={LOCAL_UI_COMMAND} />
          <p>{t('entry.connect.help.reopen')}</p>
        </div>
      )}
    </div>
  );
}

interface ConnectStepProps {
  path: EntryPath;
  error?: string;
  gentle: boolean;
  onNavigate(href: string): void;
}

export const ConnectStep = forwardRef<HTMLHeadingElement, ConnectStepProps>(function ConnectStep({ path, error, gentle, onNavigate }, titleRef) {
  const { t } = useT();
  return (
    <section data-entry-step="connect" className="flex flex-col gap-6">
      <StepHeader ref={titleRef} title={t('entry.connect.title')} description={t(`entry.connect.desc.${path}` as keyof Dict)} gentle={gentle} />
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-roseish/40 bg-roseish/10 p-4">
          <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0 text-roseish" />
          <div className="flex flex-col gap-1">
            <h2 className="text-copy font-semibold text-ink-50">{t('entry.connect.error.title')}</h2>
            <p role="alert" className="text-small text-roseish">
              {error}
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <TerminalCard path={path} />
          <PathNotes path={path} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-400/25 bg-ink-900/70 p-5 backdrop-blur">
            <p className="font-mono text-micro uppercase tracking-[0.2em] text-accent-300">{t('entry.connect.notOpened')}</p>
            <p className="text-small text-ink-300">{t('entry.connect.token')}</p>
            <PasteLinkForm onNavigate={onNavigate} />
          </div>
          <BlockedHelp initiallyOpen={Boolean(error)} />
        </div>
      </div>
    </section>
  );
});
