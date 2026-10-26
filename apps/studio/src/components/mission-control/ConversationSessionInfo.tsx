'use client';

import { Cpu, Fingerprint } from 'lucide-react';
import { providerLabel } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';

export interface ConversationSessionInfoProps {
  engineSessionId: string | null | undefined;
  provider: string | undefined;
}

export function ConversationSessionInfo({ engineSessionId, provider }: ConversationSessionInfoProps) {
  const { t } = useT();
  const session = engineSessionId === undefined ? t('mc.sessionUnknown') : (engineSessionId ?? t('mc.noSession'));
  const providerText = provider === undefined ? t('mc.providerUnknown') : providerLabel(provider);

  return (
    <dl data-testid="conversation-session-info" className="grid gap-1 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 font-mono text-[10px]">
      <div className="flex items-center gap-1.5">
        <Cpu className="h-3 w-3 shrink-0 text-purple-300" aria-hidden />
        <dt className="uppercase text-white/50">{t('mc.provider')}</dt>
        <dd data-testid="conversation-provider" className="truncate font-bold text-purple-300">
          {providerText}
        </dd>
      </div>
      <div className="flex items-center gap-1.5">
        <Fingerprint className="h-3 w-3 shrink-0 text-sky-300" aria-hidden />
        <dt className="uppercase text-white/50">{t('mc.session')}</dt>
        <dd data-testid="conversation-session" className="truncate text-sky-300" title={engineSessionId ?? undefined}>
          {session}
        </dd>
      </div>
    </dl>
  );
}
