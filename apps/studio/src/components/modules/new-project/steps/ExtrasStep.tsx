'use client';

import { Checkbox, SegmentedControl } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { libsAllowed } from '@/lib/wizard/catalog';
import { isRecommended } from '@/lib/wizard/recommendations';
import { effectiveProfile, type WizardProfile } from '@/lib/wizard/state';
import { PortField } from '../PortField';
import { RecommendedBadge } from '../OptionCard';
import { ServiceRow } from '../ServiceRow';
import { WizardField } from '../WizardField';
import { useWizard } from '../wizard-context';
import { lookupText, recommendationText } from '../wizard-text';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-px">
        <h3 className="text-copy font-medium text-ink-50">{title}</h3>
        {hint && <p className="text-small text-ink-300">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function LibsSection() {
  const { t } = useT();
  const { catalog, state, dispatch, recommendations, fieldError, touch } = useWizard();
  if (catalog === null || !libsAllowed(catalog, state.mode)) return null;
  return (
    <Section title={t('wizard.extras.libs.title')} hint={t('wizard.extras.libs.hint')}>
      <ul className="flex flex-col gap-2">
        {catalog.libTypes.map((lib) => {
          const index = state.libs.findIndex((candidate) => candidate.type === lib.type);
          const selected = index >= 0;
          const recommendation = recommendations.find((item) => item.kind === 'lib' && item.value === lib.type);
          return (
            <li key={lib.type} data-lib={lib.type} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
              <Checkbox
                size="sm"
                checked={selected}
                onChange={() => dispatch({ type: 'lib-toggle', libType: lib.type })}
                label={
                  <span className="flex flex-col gap-px">
                    <span className="flex items-center gap-2">
                      <span className="text-copy text-ink-50">{lib.label}</span>
                      {recommendation && isRecommended(recommendations, 'lib', lib.type) && <RecommendedBadge reason={recommendationText(t, recommendation)} />}
                    </span>
                    <span className="text-small text-ink-300">{lookupText(t, `wizard.lib.${lib.type}.hint`) ?? lib.label}</span>
                  </span>
                }
              />
              {selected && (
                <WizardField
                  field={`libs.${index}.name`}
                  label={t('wizard.extras.libs.name', { type: lib.label })}
                  value={state.libs[index]?.name ?? ''}
                  error={fieldError(`libs.${index}.name`)}
                  onChange={(name) => dispatch({ type: 'lib-rename', libType: lib.type, name })}
                  onBlur={() => touch(`libs.${index}.name`)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ProfileSection() {
  const { t } = useT();
  const { state, dispatch, catalog } = useWizard();
  const profile = effectiveProfile(state);
  return (
    <Section title={t('wizard.extras.profile.title')}>
      <SegmentedControl<WizardProfile>
        size="sm"
        aria-label={t('wizard.extras.profile.group')}
        value={profile}
        options={(catalog?.profiles ?? ['team', 'solo']).map((value) => ({ value, label: value }))}
        onChange={(next) => dispatch({ type: 'profile', profile: next })}
      />
      <ul className="flex flex-col gap-px text-small text-ink-300">
        <li>{t('wizard.extras.profile.team')}</li>
        <li>{t('wizard.extras.profile.solo')}</li>
        <li className="text-ink-400">{t('wizard.extras.profile.default', { profile: state.mode === 'standalone' ? 'solo' : 'team' })}</li>
      </ul>
    </Section>
  );
}

export function ExtrasStep() {
  const { t } = useT();
  const { catalog, state, dispatch, fieldError, touch } = useWizard();
  if (catalog === null) return null;
  return (
    <div className="flex flex-col gap-6">
      <LibsSection />
      <Section title={t('wizard.extras.services.title')} hint={t('wizard.extras.services.hint')}>
        <ul className="flex flex-col gap-2">
          {catalog.serviceTypes.map((service) => (
            <ServiceRow key={service.type} service={service} />
          ))}
        </ul>
      </Section>
      <ProfileSection />
      <Section title={t('wizard.extras.author.label')}>
        <WizardField
          field="sdd.author"
          label={t('wizard.extras.author.label')}
          value={state.author}
          error={fieldError('sdd.author')}
          onChange={(author) => dispatch({ type: 'author', author })}
          onBlur={() => touch('sdd.author')}
        />
      </Section>
      <Section title={t('wizard.extras.ports.title')} hint={t('wizard.extras.ports.hint')}>
        <ul className="flex flex-col gap-2">
          {state.apps.map((app, index) => (
            <li key={app.id} className="flex flex-col gap-1">
              <span className="text-copy text-ink-100">{app.name}</span>
              <PortField app={app} index={index} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
