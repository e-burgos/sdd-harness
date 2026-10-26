'use client';

import { TriangleAlert } from 'lucide-react';
import { DevProfile, FlowChoice } from '@sdd-studio/protocol';
import { effectiveFlow, type FullException } from '@/lib/flow-choice';
import { useT } from '@/lib/i18n/i18n';
import { HelpSelect } from '../HelpSelect';

export interface ModeSelectorsProps {
  profile: DevProfile;
  flow: FlowChoice;
  exception: FullException | null;
  canEditProfile: boolean;
  profileError: string | null;
  onProfileChange(profile: DevProfile): void;
  onFlowChange(flow: FlowChoice): void;
}

const select = 'rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const PROFILES = DevProfile.options;
const FLOWS = FlowChoice.options;

export function ModeSelectors(p: ModeSelectorsProps) {
  const { t } = useT();
  const warn = p.exception !== null && effectiveFlow(p.profile, p.flow) === 'lite';
  return (
    <div data-testid="mode-selectors" className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
      <label className="sr-only" htmlFor="mode-dev">{t('mode.dev.label')}</label>
      <HelpSelect
        id="mode-dev"
        help={t('help.mode.dev')}
        className={select}
        value={p.profile}
        disabled={!p.canEditProfile}
        onChange={(e) => p.onProfileChange(DevProfile.parse(e.target.value))}
      >
        {PROFILES.map((x) => <option key={x} value={x}>{t('mode.dev.option', { mode: t(`mode.dev.${x}`) })}</option>)}
      </HelpSelect>
      <label className="sr-only" htmlFor="mode-flow">{t('mode.flow.label')}</label>
      <HelpSelect
        id="mode-flow"
        help={t('help.mode.flow')}
        className={select}
        value={p.flow}
        onChange={(e) => p.onFlowChange(FlowChoice.parse(e.target.value))}
      >
        {FLOWS.map((x) => <option key={x} value={x}>{t('mode.flow.option', { mode: t(`mode.flow.${x}`) })}</option>)}
      </HelpSelect>
      <span data-testid="mode-effective" className="text-[11px] text-ink-400">
        {t('mode.effective', { flow: effectiveFlow(p.profile, p.flow).toUpperCase() })}
      </span>
      {!p.canEditProfile && <span className="text-[11px] text-ink-500">{t('mode.dev.readonly')}</span>}
      {p.profileError && <span role="alert" className="text-[11px] text-roseish">{p.profileError}</span>}
      {warn && (
        <span role="status" data-testid="mode-exception" className="inline-flex basis-full items-center gap-1 text-[11px] text-amberish">
          <TriangleAlert size={12} aria-hidden />
          {t(p.exception === 'depends-on' ? 'mode.exception.dependsOn' : 'mode.exception.dependedOn')}
        </span>
      )}
    </div>
  );
}
