'use client';

import { Button, Modal } from '@e-burgos/tucu-ui';
import { useEffect, useState } from 'react';
import { GithubStatus, type GithubRemote } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';
import { GithubConnectPanel } from './GithubConnectPanel';

const FEATURE = 'github';

export function GithubHeaderStatus() {
  const { t } = useT();
  const { client } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const supported = client?.supports?.(FEATURE) === true && snapshot !== null;
  const snapshotKnown = snapshot?.github !== undefined;
  const [fallback, setFallback] = useState<GithubRemote | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!supported || snapshotKnown) return;
    let alive = true;
    (async () => {
      try {
        const status = GithubStatus.parse(await client.request({ cmd: 'github.status' }));
        if (alive) setFallback(status.remote);
      } catch {
        if (alive) setFallback(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, supported, snapshotKnown]);

  if (!supported) return null;
  const remote = snapshotKnown ? snapshot.github!.remote : fallback;

  if (remote) {
    const repo = `${remote.owner}/${remote.name}`;
    return (
      <a
        data-testid="github-header-link"
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noreferrer"
        title={t('github.header.open', { repo })}
        className="hidden max-w-[200px] items-center truncate rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 font-mono text-meta text-ink-300 transition-colors hover:bg-foreground/10 lg:flex"
      >
        {repo}
      </a>
    );
  }

  return (
    <>
      <Button type="button" data-testid="github-header-connect" size="tiny" variant="outline" color="gray" className="hidden font-mono text-meta lg:inline-flex" title={t('github.header.connectHint')} onClick={() => setOpen(true)}>
        {t('github.header.connect')}
      </Button>
      <Modal isOpen={open} setIsOpen={() => undefined} onClose={() => setOpen(false)} hideButtons size="md" text={{ title: t('github.dialog.title') }}>
        <GithubConnectPanel
          defaultName={snapshot?.project ?? ''}
          onConnected={(connected) => {
            setFallback(connected);
          }}
          onSkip={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
