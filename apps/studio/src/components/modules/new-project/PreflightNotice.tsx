'use client';

import { Alert, Button } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { preflightCauses } from '@/lib/wizard/generate-gate';
import type { PreflightControls } from '@/lib/wizard/use-preflight';

function RetryButton({ onClick }: { onClick(): void }) {
  const { t } = useT();
  return (
    <Button type="button" size="tiny" variant="outline" color="gray" className="w-fit text-ui" onClick={onClick}>
      {t('wizard.preflight.retry')}
    </Button>
  );
}

export function PreflightNotice({ preflight }: { preflight: PreflightControls }) {
  const { t } = useT();
  if (preflight.status === 'loading') {
    return (
      <p role="status" className="text-small text-ink-400">
        {t('wizard.preflight.loading')}
      </p>
    );
  }
  if (preflight.status === 'error' || preflight.data === null) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="error" density="compact" live="assertive">
          {t('wizard.preflight.error', { error: preflight.error ?? '' })}
        </Alert>
        <RetryButton onClick={preflight.reload} />
      </div>
    );
  }
  const data = preflight.data;
  const causes = preflightCauses(data);
  const facts = [
    t('wizard.preflight.node', { version: data.node.version }),
    data.pnpm.found ? t('wizard.preflight.pnpm', { version: data.pnpm.version ?? '?' }) : null,
    data.registry.reachable === 'yes' ? t('wizard.preflight.registry') : null,
  ].filter((fact): fact is string => fact !== null);
  const gitNote = !data.git.found ? t('wizard.preflight.gitMissing') : !data.git.identity ? t('wizard.preflight.gitNoIdentity') : null;
  return (
    <div data-testid="preflight" data-ready={data.ready} className="flex flex-col gap-2">
      {causes.length > 0 ? (
        <Alert variant="error" density="compact" live="assertive">
          <ul className="flex flex-col gap-1">
            {causes.map((cause) => (
              <li key={cause}>{t(`wizard.preflight.blocked.${cause}` as keyof Dict)}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p className="text-small text-emerald-400">{t('wizard.preflight.ok')}</p>
      )}
      <p className="text-small text-ink-300">{facts.join(' · ')}</p>
      {data.registry.reachable === 'unknown' && <p className="text-small text-amberish">{t('wizard.preflight.registryUnknown')}</p>}
      {gitNote !== null && <p className="text-small text-amberish">{gitNote}</p>}
      {causes.length > 0 && <RetryButton onClick={preflight.reload} />}
    </div>
  );
}
