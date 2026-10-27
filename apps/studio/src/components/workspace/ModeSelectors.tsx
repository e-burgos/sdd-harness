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

const PROFILES = DevProfile.options;
const FLOWS = FlowChoice.options;
const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function ModeSelectors(p: ModeSelectorsProps) {
  const { t } = useT();
  const warn = p.exception !== null && effectiveFlow(p.profile, p.flow) === 'lite';
  return (
    <div data-testid="mode-selectors" className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
      <HelpSelect
        label={t('mode.dev.label')}
        help={t('help.mode.dev')}
        value={p.profile}
        disabled={!p.canEditProfile}
        options={PROFILES.map((x) => ({
          value: x,
          label: capitalized(t(`mode.dev.${x}`)),
          description: t(`mode.dev.${x}.desc`),
          triggerLabel: t('mode.dev.option', { mode: t(`mode.dev.${x}`) }),
        }))}
        onChange={(value) => p.onProfileChange(DevProfile.parse(value))}
      />
      <HelpSelect
        label={t('mode.flow.label')}
        help={t('help.mode.flow')}
        value={p.flow}
        options={FLOWS.map((x) => ({
          value: x,
          label: capitalized(t(`mode.flow.${x}`)),
          description: t(`mode.flow.${x}.desc`),
          triggerLabel: t('mode.flow.option', { mode: t(`mode.flow.${x}`) }),
        }))}
        onChange={(value) => p.onFlowChange(FlowChoice.parse(value))}
      />
      <span data-testid="mode-effective" className="text-meta text-ink-400">
        {t('mode.effective', { flow: effectiveFlow(p.profile, p.flow).toUpperCase() })}
      </span>
      {!p.canEditProfile && <span className="text-meta text-ink-500">{t('mode.dev.readonly')}</span>}
      {p.profileError && <span role="alert" className="text-meta text-roseish">{p.profileError}</span>}
      {warn && (
        <span role="status" data-testid="mode-exception" className="inline-flex basis-full items-center gap-1 text-meta text-amberish">
          <TriangleAlert size={12} aria-hidden />
          {t(p.exception === 'depends-on' ? 'mode.exception.dependsOn' : 'mode.exception.dependedOn')}
        </span>
      )}
    </div>
  );
}
