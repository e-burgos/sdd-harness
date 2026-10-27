'use client';

import { Tooltip } from '@e-burgos/tucu-ui';
import { CircleUser, Ellipsis, type LucideIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { MODULE_LABEL_KEY } from '@/lib/nav/module-labels';
import type { ModuleId } from '@/lib/nav/module-ids';
import type { useRailPreferences } from '@/lib/nav/use-rail-preferences';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import type { ConnectionState } from '@/lib/bridge/client';
import { AuthPanel } from '../workspace/AuthPanel';
import { NewConversationIconButton } from '../workspace/SidebarHeader';
import { RailCustomizeMenu } from './RailCustomizeMenu';
import { RailPopover } from './RailPopover';
import { focusRing } from './shell-context';

export const RAIL_WIDTH_PX = 72;

const CONN_DOT = {
  open: { cls: 'bg-accent-400', key: 'conn.dot.open' },
  connecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  reconnecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  failed: { cls: 'bg-roseish', key: 'conn.dot.down' },
  idle: { cls: 'bg-roseish', key: 'conn.dot.down' },
} as const;

export interface ModuleRailProps {
  project: string;
  kitVersion: string | null;
  activeModule: ModuleId;
  icons: Record<ModuleId, LucideIcon>;
  preferences: ReturnType<typeof useRailPreferences>;
  connection: ConnectionState['status'];
  onSelectModule(id: ModuleId): void;
  onNewConversation(): void;
}

const initialsOf = (project: string) => project.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '…';

function RailButton({ label, active = false, current = false, badge, onClick, icon: Icon, text }: { label: string; active?: boolean; current?: boolean; badge?: number; onClick(): void; icon: LucideIcon; text: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      data-active={active || undefined}
      onClick={onClick}
      className={`${focusRing} relative flex w-14 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors ${
        active ? 'bg-accent-dim text-ink-50' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
      }`}
    >
      {active && <span aria-hidden data-testid="rail-active-indicator" className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-400" />}
      <span className="relative">
        <Icon aria-hidden size={20} />
        {badge ? (
          <span className="text-micro absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-400 px-1 font-semibold text-ink-950">{badge}</span>
        ) : null}
      </span>
      <span className={`${PANEL_TYPE.rail} max-w-full truncate leading-tight`}>{text}</span>
    </button>
  );
}

export function ModuleRail({ project, kitVersion, activeModule, icons, preferences, connection, onSelectModule, onNewConversation }: ModuleRailProps) {
  const { t } = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const dot = CONN_DOT[connection];
  const activeIsHidden = preferences.hidden.includes(activeModule);
  const projectLabel = kitVersion ? t('shell.rail.projectKit', { project, kit: kitVersion }) : t('shell.rail.project', { project });

  return (
    <nav data-studio-rail aria-label={t('shell.rail.label')} style={{ width: RAIL_WIDTH_PX }} className="relative z-30 flex h-full shrink-0 flex-col items-center border-r border-foreground/10 bg-ink-950 py-2">
      <Tooltip size="xs" arrow={false} contentClassName="text-meta" content={projectLabel} placement="right">
        <span
          role="img"
          aria-label={projectLabel}
          data-testid="rail-project"
          className={`${PANEL_TYPE.group} mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-100`}
        >
          {initialsOf(project)}
        </span>
      </Tooltip>

      <ul className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-1 pb-1">
        {preferences.visible.map((id) => (
          <li key={id}>
            <RailButton
              label={t(MODULE_LABEL_KEY[id])}
              text={t(MODULE_LABEL_KEY[id])}
              icon={icons[id]}
              active={id === activeModule}
              current={id === activeModule}
              onClick={() => {
                setMoreOpen(false);
                onSelectModule(id);
              }}
            />
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
        <div className="relative">
          <RailButton
            label={preferences.hidden.length > 0 ? t('shell.rail.moreHidden', { count: preferences.hidden.length }) : t('shell.rail.more')}
            text={t('shell.rail.more')}
            icon={Ellipsis}
            badge={preferences.hidden.length}
            active={moreOpen || activeIsHidden}
            onClick={() => {
              setAccountOpen(false);
              setMoreOpen((open) => !open);
            }}
          />
          <RailPopover open={moreOpen} label={t('shell.rail.custom.title')} onClose={closeMore}>
            <RailCustomizeMenu
              preferences={preferences}
              icons={icons}
              onOpenModule={(id) => {
                setMoreOpen(false);
                onSelectModule(id);
              }}
            />
          </RailPopover>
        </div>

        <NewConversationIconButton onClick={onNewConversation} />

        <div className="relative">
          <Tooltip size="xs" arrow={false} contentClassName="text-meta" content={t(dot.key)} placement="right">
            <button
              type="button"
              aria-label={t('shell.rail.account')}
              aria-expanded={accountOpen}
              aria-haspopup="dialog"
              data-testid="rail-account"
              onClick={() => {
                setMoreOpen(false);
                setAccountOpen((open) => !open);
              }}
              className={`${focusRing} relative flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-ink-800 hover:text-ink-100`}
            >
              <CircleUser aria-hidden size={20} />
              <span data-testid="rail-conn-dot" aria-hidden className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 ${dot.cls}`} />
            </button>
          </Tooltip>
          <span className="sr-only">{t(dot.key)}</span>
          <RailPopover open={accountOpen} label={t('shell.rail.account')} onClose={closeAccount} exempt>
            <AuthPanel defaultOpen />
          </RailPopover>
        </div>
      </div>
    </nav>
  );
}
