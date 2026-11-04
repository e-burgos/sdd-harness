'use client';

import { Button, Modal } from '@e-burgos/tucu-ui';
import { ArrowUp, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DirListing } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { errorMessage } from '@/lib/wizard/wizard-client';
import { focusRing } from '../../shell/shell-context';
import { useBridge } from '../../BridgeProvider';

interface BrowserState {
  status: 'loading' | 'ready' | 'error';
  listing: DirListing | null;
  error: string | null;
}

function Browser({ onPick, onClose }: { onPick(path: string): void; onClose(): void }) {
  const { t } = useT();
  const { client } = useBridge();
  const [path, setPath] = useState<string | undefined>(undefined);
  const [showHidden, setShowHidden] = useState(false);
  const [state, setState] = useState<BrowserState>({ status: 'loading', listing: null, error: null });

  useEffect(() => {
    let alive = true;
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    (async () => {
      try {
        const next = DirListing.parse(await client.request({ cmd: 'wizard.listDirs', ...(path === undefined ? {} : { path }), showHidden }));
        if (alive) setState({ status: 'ready', listing: next, error: null });
      } catch (failure) {
        if (alive) setState({ status: 'error', listing: null, error: errorMessage(failure) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, path, showHidden]);

  const listing = state.listing;
  const childPath = (name: string): string => {
    const base = listing?.path ?? '';
    const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
    return `${base.replace(/[\\/]+$/, '')}${separator}${name}`;
  };
  return (
    <div data-testid="directory-browser" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="tiny"
          variant="outline"
          color="gray"
          className="text-ui"
          aria-label={t('wizard.browser.up')}
          disabled={listing?.parent == null}
          onClick={() => listing?.parent != null && setPath(listing.parent)}
        >
          <ArrowUp aria-hidden size={14} />
        </Button>
        <p data-testid="browser-path" className="min-w-0 flex-1 break-all text-small text-ink-100">
          {listing?.path ?? t('wizard.browser.loading')}
        </p>
      </div>
      <label className="flex items-center gap-2 text-small text-ink-300">
        <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
        {t('wizard.browser.hidden')}
      </label>
      {state.status === 'error' && (
        <p role="alert" className="text-small text-roseish">
          {t('wizard.browser.error', { error: state.error ?? '' })}
        </p>
      )}
      {state.status === 'loading' && (
        <p role="status" className="text-small text-ink-400">
          {t('wizard.browser.loading')}
        </p>
      )}
      {listing !== null && state.status !== 'error' && (
        <>
          {listing.entries.length === 0 ? (
            <p className="text-small text-ink-400">{t('wizard.browser.empty')}</p>
          ) : (
            <ul aria-label={t('wizard.browser.title')} className="flex max-h-64 flex-col gap-px overflow-y-auto">
              {listing.entries.map((entry) => (
                <li key={entry.name}>
                  <button
                    type="button"
                    aria-label={t('wizard.browser.open', { name: entry.name })}
                    onClick={() => setPath(childPath(entry.name))}
                    className={`${focusRing} flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-copy text-ink-100 hover:bg-ink-800`}
                  >
                    <Folder aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {entry.symlink && <span className="text-meta text-ink-400">{t('wizard.browser.symlink')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {listing.truncated && <p className="text-small text-amberish">{t('wizard.browser.truncated')}</p>}
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={onClose}>
          {t('wizard.browser.close')}
        </Button>
        <Button type="button" size="tiny" className="text-ui" disabled={listing === null || state.status === 'error'} onClick={() => listing && onPick(listing.path)}>
          {t('wizard.browser.use')}
        </Button>
      </div>
    </div>
  );
}

export function DirectoryBrowserModal({ isOpen, onClose, onPick }: { isOpen: boolean; onClose(): void; onPick(path: string): void }) {
  const { t } = useT();
  return (
    <Modal isOpen={isOpen} setIsOpen={() => undefined} onClose={onClose} hideButtons size="md" text={{ title: t('wizard.browser.title') }}>
      {isOpen && <Browser onPick={onPick} onClose={onClose} />}
    </Modal>
  );
}
