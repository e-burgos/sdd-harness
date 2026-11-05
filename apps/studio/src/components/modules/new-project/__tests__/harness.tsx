import { configure, render } from '@testing-library/react';
import type { ConfigIssue, ResolvedConfig } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { NavProvider } from '@/lib/nav/use-nav';
import { BridgeContext, type BridgeContextValue } from '../../../BridgeProvider';
import { bridgeValue } from '../../../shell/shell-test-utils';
import { BridgeFailure, fakeClient } from '@/lib/wizard/__tests__/fake-client';
import { catalogResultFixture } from '@/lib/wizard/__tests__/fixtures';
import { NewProjectCenter } from '../NewProjectCenter';
import { NewProjectPanel } from '../NewProjectPanel';
import { NewProjectRight } from '../NewProjectRight';
import { WizardScope } from '../wizard-context';

configure({ asyncUtilTimeout: 5000 });

type Handler = (cmd: Record<string, unknown>) => unknown;

export const validation = (issues: ConfigIssue[] = [], resolved: ResolvedConfig | null = null) => ({
  format: 1 as const,
  cliVersion: '0.17.0',
  ok: issues.every((issue) => issue.severity !== 'error'),
  issues,
  resolved,
});

export function wizardClient(overrides: Partial<Record<string, Handler>> = {}) {
  return fakeClient((cmd) => {
    const custom = overrides[cmd.cmd as string];
    if (custom) return custom(cmd);
    if (cmd.cmd === 'wizard.catalog') return catalogResultFixture;
    if (cmd.cmd === 'wizard.validate') return validation();
    throw new BridgeFailure('not-found', String(cmd.cmd));
  });
}

export function WizardHarness() {
  return (
    <>
      <NewProjectPanel />
      <NewProjectCenter />
      <NewProjectRight />
    </>
  );
}

export function withFeatures(fake: ReturnType<typeof wizardClient>, features: readonly string[]) {
  (fake.client as unknown as { supports(feature: string): boolean }).supports = (feature) => features.includes(feature);
  return fake;
}

export function renderWizard(options: { lang?: 'es' | 'en'; fake?: ReturnType<typeof wizardClient>; bridge?: Partial<BridgeContextValue> } = {}) {
  const fake = options.fake ?? wizardClient();
  const value = bridgeValue({ client: fake.client as never, ...options.bridge });
  const view = render(
    <I18nProvider initial={options.lang ?? 'es'}>
      <BridgeContext.Provider value={value}>
        <NavProvider project="fixture-project">
          <WizardScope>
            <WizardHarness />
          </WizardScope>
        </NavProvider>
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { ...view, fake };
}
