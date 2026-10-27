'use client';

import { Button } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { Check, Copy, Cpu, Fingerprint, Tag, TriangleAlert } from 'lucide-react';
import { providerLabel } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { Tip } from '../Tip';

export interface ConversationSessionInfoProps {
  sessionTitle: string | null | undefined;
  engineSessionId: string | null | undefined;
  provider: string | undefined;
}

export function ConversationSessionInfo({ sessionTitle, engineSessionId, provider }: ConversationSessionInfoProps) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (!engineSessionId) return;
    void navigator.clipboard.writeText(engineSessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const staleBridge = (testId: string) => (
    <dd data-testid={testId} className="flex items-center gap-1 text-amber-300">
      <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
      <span>{t('mc.bridgeStale')}</span>
    </dd>
  );

  return (
    <dl data-testid="conversation-session-info" className="grid gap-1 rounded-lg border border-foreground/5 bg-foreground/5 px-2 py-1.5 font-mono text-micro">
      <div className="flex min-w-0 items-center gap-1.5">
        <Tag className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />
        <dt className="uppercase text-ink-500">{t('mc.title')}</dt>
        {sessionTitle === undefined ? (
          staleBridge('conversation-title')
        ) : sessionTitle === null ? (
          <dd data-testid="conversation-title" className="text-ink-300">
            {t('mc.noTitle')}
          </dd>
        ) : (
          <dd data-testid="conversation-title" title={sessionTitle} className="min-w-0 flex-1 truncate font-bold text-amber-300">
            {sessionTitle}
          </dd>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Cpu className="h-3 w-3 shrink-0 text-purple-300" aria-hidden />
        <dt className="uppercase text-ink-500">{t('mc.provider')}</dt>
        {provider === undefined ? (
          staleBridge('conversation-provider')
        ) : (
          <dd data-testid="conversation-provider" className="truncate font-bold text-purple-300">
            {providerLabel(provider)}
          </dd>
        )}
      </div>
      <div className="flex items-start gap-1.5">
        <Fingerprint className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" aria-hidden />
        <dt className="uppercase text-ink-500">{t('mc.session')}</dt>
        {engineSessionId === undefined ? (
          staleBridge('conversation-session')
        ) : engineSessionId === null ? (
          <dd data-testid="conversation-session" className="text-ink-300">
            {t('mc.noSession')}
          </dd>
        ) : (
          <dd className="flex min-w-0 flex-1 items-start gap-1.5">
            <span data-testid="conversation-session" className="min-w-0 flex-1 break-all text-sky-300">
              {engineSessionId}
            </span>
            <Tip text={t('mc.copySession')}>
              <Button
                type="button"
                data-testid="copy-session-button"
                onClick={copySessionId}
                aria-label={t('mc.copySession')}
                variant="transparent"
                color="gray"
                shape="circle"
                size="tiny"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              </Button>
            </Tip>
          </dd>
        )}
      </div>
    </dl>
  );
}
