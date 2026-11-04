'use client';

import { Badge, Button, Switch } from '@e-burgos/tucu-ui';
import { Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { acceptsShell, appTypeEntry, MFE_SHELL_TYPE, supportsMl, supportsTucuUi } from '@/lib/wizard/catalog';
import type { WizardApp } from '@/lib/wizard/state';
import { HelpSelect } from '../../HelpSelect';
import { PortField } from './PortField';
import { WizardField } from './WizardField';
import { useWizard } from './wizard-context';
import { typeLabel } from './wizard-text';

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange(next: boolean): void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onChange={onChange} aria-label={label} onLabel={null} offLabel={null} />
      <span className="text-copy text-ink-100">{label}</span>
    </div>
  );
}

export function AppRow({ app, index }: { app: WizardApp; index: number }) {
  const { t } = useT();
  const { catalog, state, dispatch, fieldError, touch } = useWizard();
  if (catalog === null) return null;
  const entry = appTypeEntry(catalog, app.type);
  const nameField = `apps.${index}.name`;
  const shells = state.apps.filter((candidate) => candidate.type === MFE_SHELL_TYPE);
  const showShell = acceptsShell(catalog, app.type) && shells.length > 1;
  return (
    <li data-app-row={app.name} className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-3">
      <div className="flex items-center gap-2">
        <Badge variant="soft" size="tiny" shape="pill" tone="neutral" className="px-1.5 py-0 text-micro">
          {entry ? typeLabel(t, entry) : app.type}
        </Badge>
        <span className="min-w-0 flex-1" />
        <Button
          type="button"
          size="tiny"
          variant="transparent"
          color="gray"
          className="text-ui"
          aria-label={t('wizard.app.remove', { name: app.name })}
          onClick={() => dispatch({ type: 'app-remove', id: app.id })}
        >
          <Trash2 aria-hidden size={14} />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <WizardField
          field={nameField}
          label={t('wizard.app.name')}
          value={app.name}
          error={fieldError(nameField)}
          onChange={(name) => dispatch({ type: 'app-set', id: app.id, patch: { name } })}
          onBlur={() => touch(nameField)}
        />
        <PortField app={app} index={index} />
      </div>
      {supportsTucuUi(catalog, app.type) && (
        <Toggle checked={app.tucuUi} label={t('wizard.app.tucuUi')} onChange={(tucuUi) => dispatch({ type: 'app-set', id: app.id, patch: { tucuUi } })} />
      )}
      {supportsMl(catalog, app.type) && (
        <Toggle checked={app.ml} label={t('wizard.app.ml')} onChange={(ml) => dispatch({ type: 'app-set', id: app.id, patch: { ml } })} />
      )}
      {showShell && (
        <HelpSelect
          label={t('wizard.app.shell', { name: app.name })}
          help={t('wizard.app.shellHelp')}
          value={app.shell ?? ''}
          options={shells.map((shell) => ({ value: shell.name, label: shell.name }))}
          onChange={(shell) => dispatch({ type: 'app-set', id: app.id, patch: { shell } })}
        />
      )}
      {app.type === 'mfe' && <p className="text-small text-ink-400">{t('wizard.app.route', { name: app.name })}</p>}
    </li>
  );
}
