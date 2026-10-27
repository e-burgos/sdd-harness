'use client';

import { Button, Tooltip } from '@e-burgos/tucu-ui';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AuthMode } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import type { ConnectionState } from '@/lib/bridge/client';
import { Chip } from './NavParts';
import { PanelToggle } from './PanelRail';
import { SidebarSearch } from './SidebarSearch';

const CONN_DOT = {
  open: { cls: 'bg-accent-400', key: 'conn.dot.open' },
  connecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  reconnecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  failed: { cls: 'bg-roseish', key: 'conn.dot.down' },
  idle: { cls: 'bg-roseish', key: 'conn.dot.down' },
} as const;

export interface SidebarHeaderProps {
  project: string;
  kitVersion: string | null;
  authMode: AuthMode | null;
  connection: ConnectionState['status'];
  query: string;
  onQueryChange(next: string): void;
  onNewConversation?(): void;
  onCollapse?(): void;
  authSlot?: ReactNode;
}

export function NewConversationIconButton({ onClick }: { onClick(): void }) {
  const { t } = useT();
  return (
    <Tooltip size="xs" arrow={false} contentClassName="text-meta" content={t('mc.newConversation')} placement="bottom">
      <Button
        type="button"
        data-testid="new-conversation-button"
        variant="outline"
        color="gray"
        size="mini"
        aria-label={t('mc.newConversation')}
        className="h-7 w-7 shrink-0 p-0 text-ui"
        onClick={onClick}
      >
        <Plus aria-hidden size={14} />
      </Button>
    </Tooltip>
  );
}

export function SidebarHeader(p: SidebarHeaderProps) {
  const { t } = useT();
  const dot = CONN_DOT[p.connection];
  const auth = p.authMode ? t(`auth.${p.authMode}`) : '…';
  return (
    <header className="max-h-[55%] shrink-0 overflow-y-auto p-3 pb-2">
      <div className="flex items-center gap-2">
        <Tooltip size="xs" arrow={false} content={`${t(dot.key)} · ${auth}`} placement="bottom">
          <span data-testid="conn-dot" aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot.cls}`} />
        </Tooltip>
        <span className="sr-only">{t(dot.key)}</span>
        <span className="sr-only">{auth}</span>
        <div className="min-w-0 flex-1 truncate text-copy font-semibold">{p.project}</div>
        {p.kitVersion && <Chip>kit {p.kitVersion}</Chip>}
        {p.onCollapse && <PanelToggle label={t('panel.sidebar.collapse')} side="left" onClick={p.onCollapse} />}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <SidebarSearch value={p.query} onChange={p.onQueryChange} />
        {p.onNewConversation && <NewConversationIconButton onClick={p.onNewConversation} />}
      </div>
      {p.authSlot}
    </header>
  );
}
