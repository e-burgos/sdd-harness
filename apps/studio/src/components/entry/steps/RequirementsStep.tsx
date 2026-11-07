'use client';

import { Checkbox } from '@e-burgos/tucu-ui';
import { Bot, CircleCheck, ExternalLink, Hexagon, ShieldCheck, type LucideIcon } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { CommandLine } from '../CommandLine';
import {
  API_KEY_COMMAND,
  CLAUDE_COMMAND,
  CLAUDE_INSTALL_COMMAND,
  CLAUDE_LOGIN_COMMAND,
  NODE_DOWNLOAD_URL,
  NODE_VERSION_COMMAND,
  REQUIREMENTS,
  type RequirementId,
} from '../entry-model';
import { StepHeader } from './StepHeader';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-micro uppercase tracking-[0.2em] text-ink-500">{title}</h3>
      {children}
    </div>
  );
}

function RequirementCard({ id, icon: Icon, title, checked, onToggle, children }: { id: RequirementId; icon: LucideIcon; title: string; checked: boolean; onToggle(id: RequirementId, value: boolean): void; children: ReactNode }) {
  const { t } = useT();
  return (
    <article
      aria-label={title}
      data-requirement={id}
      data-checked={checked}
      className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-ink-900/70 p-5 backdrop-blur transition-[border-color,box-shadow] duration-500 data-[checked=true]:border-emerald-400/50 data-[checked=true]:shadow-[0_24px_60px_-32px_rgba(52,211,153,0.7)] motion-reduce:transition-none"
    >
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent-300">
          <Icon aria-hidden size={18} />
        </span>
        <h2 className="min-w-0 flex-1 text-title font-semibold text-ink-50">{title}</h2>
        {checked && <CircleCheck aria-hidden size={20} className="wizard-pop shrink-0 text-emerald-400" />}
      </header>
      {children}
      <div className="mt-auto border-t border-foreground/10 pt-3">
        <Checkbox size="sm" checked={checked} onChange={(event) => onToggle(id, event.target.checked)} label={t('entry.req.have')} labelClassName="text-small text-ink-100" />
      </div>
    </article>
  );
}

interface RequirementsStepProps {
  checked: readonly RequirementId[];
  gentle: boolean;
  onToggle(id: RequirementId, value: boolean): void;
}

export const RequirementsStep = forwardRef<HTMLHeadingElement, RequirementsStepProps>(function RequirementsStep({ checked, gentle, onToggle }, titleRef) {
  const { t } = useT();
  const isChecked = (id: RequirementId) => checked.includes(id);
  return (
    <section data-entry-step="requirements" className="flex flex-col gap-6">
      <StepHeader ref={titleRef} title={t('entry.req.title')} description={t('entry.req.desc')} gentle={gentle} />
      <div className="wizard-stagger grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RequirementCard id="node" icon={Hexagon} title={t('entry.req.node.title')} checked={isChecked('node')} onToggle={onToggle}>
          <Section title={t('entry.req.verify')}>
            <CommandLine command={NODE_VERSION_COMMAND} />
            <p className="text-small text-ink-300">{t('entry.req.node.expect')}</p>
          </Section>
          <Section title={t('entry.req.fix')}>
            <a
              href={NODE_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 rounded text-small text-accent-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {t('entry.req.node.fixLink')} <ExternalLink aria-hidden size={13} />
            </a>
          </Section>
        </RequirementCard>
        <RequirementCard id="claude" icon={Bot} title={t('entry.req.claude.title')} checked={isChecked('claude')} onToggle={onToggle}>
          <Section title={t('entry.req.verify')}>
            <CommandLine command={CLAUDE_COMMAND} />
            <p className="text-small text-ink-300">{t('entry.req.claude.expect')}</p>
            <CommandLine command={CLAUDE_LOGIN_COMMAND} prompt={false} />
          </Section>
          <Section title={t('entry.req.fix')}>
            <p className="text-small text-ink-300">{t('entry.req.claude.fix')}</p>
            <CommandLine command={CLAUDE_INSTALL_COMMAND} />
            <p className="text-small text-ink-300">{t('entry.req.claude.apiKey')}</p>
            <CommandLine command={API_KEY_COMMAND} />
          </Section>
        </RequirementCard>
      </div>
      <footer className="flex flex-col gap-1 text-small text-ink-400 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="font-mono text-meta uppercase tracking-[0.18em] text-ink-300">
          {t('entry.req.status', { n: checked.length, total: REQUIREMENTS.length })} · {t('entry.req.optional')}
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck aria-hidden size={14} className="shrink-0 text-emerald-400" />
          {t('entry.req.privacy')}
        </p>
      </footer>
    </section>
  );
});
