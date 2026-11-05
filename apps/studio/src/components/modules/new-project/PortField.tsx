'use client';

import { useT } from '@/lib/i18n/i18n';
import { appTypeEntry } from '@/lib/wizard/catalog';
import type { WizardApp } from '@/lib/wizard/state';
import { WizardField } from './WizardField';
import { useWizard } from './wizard-context';

export function PortField({ app, index }: { app: WizardApp; index: number }) {
  const { t } = useT();
  const { catalog, dispatch, fieldError, touch, validation } = useWizard();
  const field = `apps.${index}.port`;
  const defaultPort = catalog ? appTypeEntry(catalog, app.type)?.defaultPort : undefined;
  const resolved = validation.validation?.resolved?.apps[index];
  const edited = app.portText.trim() !== '';
  const hint = resolved && !edited && resolved.port !== defaultPort
    ? t('wizard.port.resolved', { port: resolved.port })
    : defaultPort !== undefined
      ? t('wizard.port.default', { port: defaultPort })
      : null;
  return (
    <WizardField
      field={field}
      label={t('wizard.port.label')}
      value={app.portText}
      inputMode="numeric"
      placeholder={defaultPort === undefined ? undefined : String(defaultPort)}
      error={fieldError(field)}
      hint={hint}
      onChange={(portText) => dispatch({ type: 'app-set', id: app.id, patch: { portText } })}
      onBlur={() => touch(field)}
    />
  );
}
