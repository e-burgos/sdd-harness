'use client';

import { Button, Checkbox, Input } from '@e-burgos/tucu-ui';
import { useEffect, useState } from 'react';
import { GithubConnectResult, GithubStatus, type GithubRemote } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { errorMessage } from '@/lib/wizard/wizard-client';
import { useBridge } from '../BridgeProvider';
import { HelpSelect } from '../HelpSelect';

export interface GithubConnectPanelProps {
  generationId?: string;
  defaultName?: string;
  onConnected?(remote: GithubRemote): void;
  onSkip?(): void;
}

type Visibility = 'private' | 'public';
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: GithubStatus }
  | { kind: 'connecting'; status: GithubStatus }
  | { kind: 'done'; remote: GithubRemote; protectedBranch: boolean };

const REPO_NAME = /^[A-Za-z0-9._-]+$/;
const repoUrl = (remote: GithubRemote): string => `https://github.com/${remote.owner}/${remote.name}`;

function Help({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <div data-testid={testId} className="space-y-1 text-small">
      <p className="font-semibold text-ink-100">{title}</p>
      <p className="text-ink-400">{body}</p>
    </div>
  );
}

function RepoLink({ remote, label }: { remote: GithubRemote; label: string }) {
  const { t } = useT();
  return (
    <a data-testid="github-repo-link" href={repoUrl(remote)} target="_blank" rel="noreferrer" aria-label={label} className="font-mono text-small text-sky-300 underline-offset-2 hover:underline">
      {remote.owner}/{remote.name}
    </a>
  );
}

export function GithubConnectPanel({ generationId, defaultName = '', onConnected, onSkip }: GithubConnectPanelProps) {
  const { t } = useT();
  const { client } = useBridge();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [name, setName] = useState(defaultName);
  const [owner, setOwner] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [protect, setProtect] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPhase({ kind: 'loading' });
    (async () => {
      try {
        const status = GithubStatus.parse(await client.request({ cmd: 'github.status', ...(generationId === undefined ? {} : { generationId }) }));
        if (alive) setPhase({ kind: 'ready', status });
      } catch (error) {
        if (alive) setPhase({ kind: 'error', message: errorMessage(error) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, generationId]);

  const nameValid = REPO_NAME.test(name);
  const ownerValid = owner === '' || REPO_NAME.test(owner);

  const connect = async (status: GithubStatus) => {
    setFailure(null);
    setPhase({ kind: 'connecting', status });
    try {
      const result = GithubConnectResult.parse(
        await client.request({
          cmd: 'github.connect',
          ...(generationId === undefined ? {} : { generationId }),
          name,
          ...(owner === '' ? {} : { owner }),
          visibility,
          protect,
        }),
      );
      if (result.ok && result.remote) {
        setPhase({ kind: 'done', remote: result.remote, protectedBranch: result.protected });
        onConnected?.(result.remote);
        return;
      }
      setFailure(result.error ?? '');
    } catch (error) {
      setFailure(errorMessage(error));
    }
    setPhase({ kind: 'ready', status });
  };

  if (phase.kind === 'loading') return <p data-testid="github-loading" className="text-small text-ink-400">{t('github.loading')}</p>;
  if (phase.kind === 'error') return <p role="alert" data-testid="github-check-error" className="text-small text-roseish">{t('github.checkFailed', { message: phase.message })}</p>;
  if (phase.kind === 'done') {
    return (
      <div data-testid="github-done" className="space-y-1 text-small">
        <p className="text-ink-100">{t('github.result.ok', { repo: `${phase.remote.owner}/${phase.remote.name}` })}</p>
        {phase.protectedBranch && <p className="text-ink-400">{t('github.result.protected')}</p>}
        <RepoLink remote={phase.remote} label={t('github.openRepo')} />
      </div>
    );
  }

  const { status } = phase;
  if (!status.gh.installed) return <Help testId="github-gh-missing" title={t('github.ghMissing.title')} body={t('github.ghMissing.body')} />;
  if (!status.gh.authenticated) return <Help testId="github-gh-auth" title={t('github.ghAuth.title')} body={t('github.ghAuth.body')} />;
  if (status.remote) {
    return (
      <div data-testid="github-connected" className="space-y-1 text-small">
        <p className="text-ink-100">{t('github.connected', { repo: `${status.remote.owner}/${status.remote.name}` })}</p>
        <RepoLink remote={status.remote} label={t('github.openRepo')} />
      </div>
    );
  }

  const busy = phase.kind === 'connecting';
  return (
    <form
      data-testid="github-form"
      className="space-y-3 text-small"
      onSubmit={(event) => {
        event.preventDefault();
        if (nameValid && ownerValid && !busy) void connect(status);
      }}
    >
      <label className="block space-y-1 text-ink-300">
        {t('github.field.name')}
        <Input
          data-testid="github-name"
          value={name}
          spellCheck={false}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          inputClassName="h-auto sm:h-auto rounded-md px-2 py-1 text-ui"
        />
      </label>
      {name !== '' && !nameValid && <p role="alert" className="text-meta text-roseish">{t('github.field.nameInvalid')}</p>}
      <label className="block space-y-1 text-ink-300">
        {t('github.field.owner')}
        <Input
          data-testid="github-owner"
          value={owner}
          spellCheck={false}
          disabled={busy}
          placeholder={status.gh.user ?? ''}
          onChange={(event) => setOwner(event.target.value)}
          inputClassName="h-auto sm:h-auto rounded-md px-2 py-1 text-ui"
        />
      </label>
      {!ownerValid && <p role="alert" className="text-meta text-roseish">{t('github.field.nameInvalid')}</p>}
      <div className="flex items-center gap-2 text-ink-300">
        <span>{t('github.field.visibility')}</span>
        <HelpSelect
          label={t('github.field.visibility')}
          help={t('github.field.visibilityHelp')}
          value={visibility}
          disabled={busy}
          onChange={(value) => setVisibility(value === 'public' ? 'public' : 'private')}
          options={[
            { value: 'private', label: t('github.visibility.private') },
            { value: 'public', label: t('github.visibility.public') },
          ]}
        />
      </div>
      <div className="space-y-1">
        <Checkbox
          data-testid="github-protect"
          size="sm"
          checked={protect}
          disabled={busy}
          onChange={(event) => setProtect(event.target.checked)}
          label={t('github.field.protect')}
          labelClassName="text-meta text-ink-300"
        />
        <p className="pl-6 text-meta text-ink-500">{t('github.field.protectHint')}</p>
      </div>
      {busy && <p data-testid="github-progress" className="text-ink-400">{t('github.connecting')}</p>}
      {failure !== null && <p role="alert" data-testid="github-error" className="text-roseish">{t('github.result.failed', { message: failure })}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="tiny" disabled={busy || !nameValid || !ownerValid}>{t('github.connect')}</Button>
        {onSkip && <Button type="button" size="tiny" variant="transparent" color="gray" disabled={busy} onClick={onSkip}>{t('github.skip')}</Button>}
      </div>
    </form>
  );
}
