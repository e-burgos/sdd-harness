'use client';

import { Checkbox } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { ConfigCatalog } from '@sdd-studio/protocol';
import { WizardField } from './WizardField';
import { useWizard } from './wizard-context';

export function ServiceRow({ service }: { service: ConfigCatalog['serviceTypes'][number] }) {
  const { t } = useT();
  const { state, dispatch, validation } = useWizard();
  const index = state.services.indexOf(service.type);
  const selected = index >= 0;
  const port = validation.validation?.resolved?.services[index]?.port ?? service.defaultPort;
  return (
    <li data-service={service.type} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
      <Checkbox
        size="sm"
        checked={selected}
        onChange={() => dispatch({ type: 'service-toggle', serviceType: service.type })}
        label={
          <span className="flex flex-col gap-px">
            <span className="text-copy text-ink-50">{service.label}</span>
            <span className="text-small text-ink-300">{service.hint}</span>
          </span>
        }
      />
      {selected && (
        <WizardField field={`services.${index}.port`} label={t('wizard.port.readonly')} value={String(port)} readOnly />
      )}
    </li>
  );
}
