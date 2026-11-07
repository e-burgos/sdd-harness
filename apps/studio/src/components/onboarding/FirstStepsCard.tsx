'use client';

import { Button, Modal } from '@e-burgos/tucu-ui';
import { Check, Circle } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { readGuideHidden, writeGuideHidden } from '@/lib/onboarding';
import { useBridge, useStudio } from '../BridgeProvider';
import { GithubConnectPanel } from '../github/GithubConnectPanel';

interface Row {
  id: 'github' | 'idea' | 'spec';
  done: boolean;
  label: string;
  action: string;
  run(): void;
}

export function FirstStepsCard() {
  const { t } = useT();
  const { client, connection } = useBridge();
  const root = (connection?.status === 'open' ? connection.welcome?.workspace?.root : undefined) ?? '';
  const project = useStudio((s) => s.snapshot?.project ?? '');
  const specCount = useStudio((s) => s.snapshot?.specs.length ?? 0);
  const remote = useStudio((s) => s.snapshot?.github?.remote ?? null);
  const threadCount = useStudio((s) => Object.keys(s.threads).length);
  const openHome = useNav((s) => s.openHome);
  const setModule = useNav((s) => s.setModule);
  const [hiddenNow, setHiddenNow] = useState(false);
  const hidden = hiddenNow || readGuideHidden(root);
  const [githubOpen, setGithubOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const githubSupported = client?.supports?.('github') === true;

  const focusComposer = () => {
    openHome({ kind: 'channel', channelId: 'general' });
    const label = t('composer.placeholder');
    requestAnimationFrame(() => {
      const box = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find((el) => el.getAttribute('aria-label') === label);
      box?.focus();
    });
  };

  const rows: Row[] = [
    ...(githubSupported
      ? [{ id: 'github' as const, done: remote !== null || connected, label: t('onboarding.card.github'), action: t('onboarding.card.githubAction'), run: () => setGithubOpen(true) }]
      : []),
    { id: 'idea', done: threadCount > 0, label: t('onboarding.card.idea'), action: t('onboarding.card.ideaAction'), run: focusComposer },
    { id: 'spec', done: specCount > 0, label: t('onboarding.card.spec'), action: t('onboarding.card.specAction'), run: () => setModule('specs') },
  ];

  if (hidden || rows.every((row) => row.done)) return null;

  const hide = () => {
    writeGuideHidden(root);
    setHiddenNow(true);
  };

  return (
    <section data-testid="first-steps-card" aria-label={t('onboarding.card.title')} className="mx-4 mt-3 flex shrink-0 flex-col gap-2 rounded-md border border-foreground/10 bg-ink-900 p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-small font-semibold text-ink-100">{t('onboarding.card.title')}</h2>
        <Button type="button" size="tiny" variant="transparent" color="gray" className="ml-auto" data-testid="first-steps-hide" onClick={hide}>
          {t('onboarding.card.hide')}
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.id} data-step={row.id} data-done={row.done} className="flex items-center gap-2 text-small text-ink-300">
            {row.done ? <Check aria-hidden size={14} className="text-emerald-400" /> : <Circle aria-hidden size={14} className="text-ink-500" />}
            <span className={row.done ? 'text-ink-400 line-through' : 'text-ink-100'}>{row.label}</span>
            {row.done ? (
              <span className="sr-only">{t('onboarding.card.done')}</span>
            ) : (
              <Button type="button" size="tiny" variant="outline" color="gray" className="ml-auto" onClick={row.run}>
                {row.action}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Modal isOpen={githubOpen} setIsOpen={() => undefined} onClose={() => setGithubOpen(false)} hideButtons size="md" text={{ title: t('github.dialog.title') }}>
        <GithubConnectPanel
          defaultName={project}
          onConnected={() => setConnected(true)}
          onSkip={() => setGithubOpen(false)}
        />
      </Modal>
    </section>
  );
}
