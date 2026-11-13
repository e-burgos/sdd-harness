'use client';

import { Alert, Badge, Button, Switch } from '@e-burgos/tucu-ui';
import { KIT_INTEGRATION_HARNESSES, type KitIntegrationId, type KitIntegrationStatus } from '@sdd-studio/protocol';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { useKitIntegrations, type IntegrationEntry } from './use-kit-integrations';

type Key = Parameters<TFunction>[0];

const STATE_TONE = { off: 'neutral', complete: 'success', incomplete: 'warning', unavailable: 'neutral' } as const;

function HarnessChips({ status }: { status: KitIntegrationStatus }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t('module.kit.integrations.harnesses')}>
      {KIT_INTEGRATION_HARNESSES.map((harness) => (
        <Badge
          key={harness}
          variant="soft"
          size="micro"
          shape="pill"
          tone={status.harnesses[harness] === 'complete' ? 'success' : 'warning'}
          data-testid={`integration-harness-${harness}`}
          className="px-2 py-0.5 font-mono text-micro"
        >
          {harness} · {t(`module.kit.integrations.harness.${status.harnesses[harness]}` as Key)}
        </Badge>
      ))}
    </div>
  );
}

function IntegrationCard({ id, entry, offline, onToggle }: { id: KitIntegrationId; entry: IntegrationEntry; offline: boolean; onToggle: (enabled: boolean) => void }) {
  const { t } = useT();
  const { status, busy, failure } = entry;
  const unavailable = status !== null && !status.available;
  const disabled = offline || busy !== null || status === null || unavailable;
  const running = status?.enabled === true && status.available;
  return (
    <div data-testid={`integration-${id}`} className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-ink-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-copy font-medium text-ink-100">{id}</p>
            {status && (
              <Badge variant="soft" size="micro" shape="pill" tone={STATE_TONE[status.state]} data-testid={`integration-state-${id}`} className="px-2 py-0.5 text-micro">
                {t(`module.kit.integrations.state.${status.state}` as Key)}
              </Badge>
            )}
            {status?.version && (
              <span className="font-mono text-micro text-ink-400">{t('module.kit.integrations.version', { version: status.version })}</span>
            )}
            {status?.updateAvailable && <span className="text-micro text-amberish">{t('module.kit.integrations.updateAvailable')}</span>}
          </div>
          <p className="text-small text-ink-300">{t(`module.kit.integrations.${id}.desc` as Key)}</p>
          <p className="text-small text-ink-400">{t(`module.kit.integrations.${id}.req` as Key)}</p>
        </div>
        <div className="shrink-0">
          <Switch checked={running} disabled={disabled} aria-label={id} onChange={(checked) => onToggle(checked)} />
        </div>
      </div>
      {entry.loading && <p className="text-small text-ink-400">{t('module.kit.integrations.loading')}</p>}
      {entry.loadFailed && status === null && <p className="text-small text-roseish">{t('module.kit.integrations.loadFailed')}</p>}
      {unavailable && <p data-testid={`integration-unavailable-${id}`} className="text-small text-ink-400">{t('module.kit.integrations.unavailable')}</p>}
      {busy && (
        <p role="status" data-testid={`integration-busy-${id}`} className="text-small text-ink-300">
          {t(`module.kit.integrations.busy.${busy}` as Key)}
        </p>
      )}
      {status && status.available && status.state !== 'off' && <HarnessChips status={status} />}
      {status && !status.nodeOk && <p className="text-small text-amberish">{t('module.kit.integrations.nodeOld')}</p>}
      {status?.state === 'incomplete' && (
        <div>
          <Button type="button" size="small" variant="outline" disabled={offline || busy !== null} onClick={() => onToggle(true)}>
            {t('module.kit.integrations.repair')}
          </Button>
        </div>
      )}
      {failure && (
        <Alert variant="error" data-testid={`integration-failure-${id}`}>
          <p>{t('module.kit.integrations.failed')}</p>
          {failure.output && <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-micro">{failure.output}</pre>}
        </Alert>
      )}
    </div>
  );
}

export function KitIntegrations() {
  const { t } = useT();
  const { supported, open, entries, toggle } = useKitIntegrations();
  if (!supported) return null;
  return (
    <section data-testid="kit-integrations" aria-labelledby="kit-integrations-title" className="flex flex-col gap-3">
      <div>
        <h3 id="kit-integrations-title" className="text-copy font-medium text-ink-100">
          {t('module.kit.integrations.title')}
        </h3>
        <p className="text-small text-ink-300">{t('module.kit.integrations.intro')}</p>
      </div>
      {!open && <p className="text-small text-amberish">{t('module.kit.integrations.offline')}</p>}
      {(Object.keys(entries) as KitIntegrationId[]).map((id) => (
        <IntegrationCard key={id} id={id} entry={entries[id]} offline={!open} onToggle={(enabled) => void toggle(id, enabled)} />
      ))}
    </section>
  );
}
