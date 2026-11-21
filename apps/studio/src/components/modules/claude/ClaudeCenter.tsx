'use client';

import { Badge, Button, Input, Switch } from '@e-burgos/tucu-ui';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ClaudeInventory, ClaudeToolsConfig } from '@sdd-studio/protocol';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { CenterFrame, Notice } from '../kit/KitParts';
import { useClaude } from './ClaudeProvider';
import {
  addedCounts,
  connectorNote,
  costWarning,
  isValidBrowserUrl,
  mcpRows,
  normalizeBrowserUrl,
  pluginRows,
  relativeTime,
  sectionOf,
  withBrowser,
  withMcpEnabled,
  withPluginEnabled,
  withSource,
  type ClaudeSection,
  type McpDisplayStatus,
} from './claude-model';
import type { ClaudeNotice, McpOp } from './use-claude-tools';
import { useChromeStatus } from './use-chrome-status';

type Key = Parameters<TFunction>[0];

const STATUS_TONE: Record<McpDisplayStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  connected: 'success',
  'needs-auth': 'warning',
  failed: 'danger',
  pending: 'info',
  disabled: 'neutral',
  unknown: 'neutral',
  'studio-off': 'neutral',
};

const COUNT_ROWS = ['skills', 'agents', 'plugins', 'mcpServers', 'mcpTools'] as const;

function ToggleRow({ label, description, extra, below, children }: { label: ReactNode; description?: ReactNode; extra?: ReactNode; below?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-foreground/10 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-copy font-medium text-ink-100">{label}</p>
          {extra}
        </div>
        {description && <p className="text-small text-ink-400">{description}</p>}
        {below}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-foreground/10 bg-ink-900 px-4">
      {children}
    </div>
  );
}

function noticeOf(notice: ClaudeNotice, t: TFunction): { tone: 'info' | 'warning' | 'error'; text: string } {
  if (notice.kind === 'saved') return { tone: 'info', text: t('module.claude.notice.saved') };
  const text = t(`module.claude.notice.${notice.kind}` as Key, { message: notice.message }).trim();
  return { tone: notice.kind === 'conflict' ? 'warning' : 'error', text };
}

function NextTurn() {
  const { t } = useT();
  const { scopeSupported } = useClaude();
  return <p className="text-small text-ink-400">{t(scopeSupported ? 'module.claude.nextTurnScoped' : 'module.claude.nextTurn')}</p>;
}

function ScopeBar() {
  const { t } = useT();
  const { scope, hasProjectOverride, busy, open, customizeProject, useGlobal, saveAsGlobal } = useClaude();
  const own = scope === 'project' || hasProjectOverride;
  const disabled = busy || !open;
  return (
    <div data-testid="claude-scope" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-small text-ink-300">{t(own ? 'module.claude.scope.project' : 'module.claude.scope.global')}</p>
      <div className="flex items-center gap-2">
        {own ? (
          <>
            <Button type="button" size="small" variant="outline" disabled={disabled} onClick={() => void useGlobal()}>
              {t('module.claude.scope.useGlobal')}
            </Button>
            <Button type="button" size="small" variant="outline" disabled={disabled} onClick={() => void saveAsGlobal()}>
              {t('module.claude.scope.saveGlobal')}
            </Button>
          </>
        ) : (
          <Button type="button" size="small" variant="outline" disabled={disabled} onClick={() => void customizeProject()}>
            {t('module.claude.scope.customize')}
          </Button>
        )}
      </div>
    </div>
  );
}

function InventoryBar() {
  const { t, lang } = useT();
  const { inventory, refreshing, open, refresh } = useClaude();
  const captured = inventory ? new Date(inventory.capturedAt) : null;
  const when = captured && !Number.isNaN(captured.getTime()) ? captured.toLocaleString(lang) : (inventory?.capturedAt ?? '');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-small text-ink-400" data-testid="claude-captured">
        {inventory ? t('module.claude.inventory.capturedAt', { date: when }) : t('module.claude.inventory.none')}
      </p>
      <Button type="button" size="small" variant="outline" disabled={!open || refreshing} onClick={() => void refresh()}>
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw aria-hidden size={13} className={refreshing ? 'animate-spin' : undefined} />
          {t(refreshing ? 'module.claude.inventory.refreshing' : 'module.claude.inventory.refresh')}
        </span>
      </Button>
    </div>
  );
}

function EmptyInventory() {
  const { t } = useT();
  return (
    <p role="status" data-testid="claude-inventory-empty" className="rounded-lg border border-dashed border-foreground/15 px-4 py-6 text-center text-small text-ink-300">
      {t('module.claude.inventory.empty')}
    </p>
  );
}

function CountsTable({ inventory }: { inventory: ClaudeInventory }) {
  const { t } = useT();
  const added = addedCounts(inventory);
  return (
    <table data-testid="claude-counts" className="w-full text-small">
      <thead>
        <tr className="text-left text-meta text-ink-400">
          <th className="py-2 font-medium" />
          <th className="py-2 font-medium">{t('module.claude.counts.project')}</th>
          <th className="py-2 font-medium">{t('module.claude.counts.all')}</th>
          <th className="py-2 font-medium">{t('module.claude.counts.added')}</th>
        </tr>
      </thead>
      <tbody>
        {COUNT_ROWS.map((row) => (
          <tr key={row} className="border-t border-foreground/10 text-ink-100">
            <td className="py-2 text-ink-300">{t(`module.claude.counts.${row}` as Key)}</td>
            <td className="py-2 font-mono">{inventory.counts.project[row]}</td>
            <td className="py-2 font-mono">{inventory.counts.all[row]}</td>
            <td className="py-2 font-mono">+{added[row]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface ViewProps {
  config: ClaudeToolsConfig;
  inventory: ClaudeInventory | null;
  disabled: boolean;
  save: (next: ClaudeToolsConfig) => Promise<void>;
}

function SourcesView({ config, inventory, disabled, save }: ViewProps) {
  const { t } = useT();
  return (
    <>
      <Card testId="claude-sources">
        <ToggleRow label={t('module.claude.sources.project')} description={t('module.claude.sources.projectDesc')}>
          <Switch checked disabled onChange={() => undefined} aria-label={t('module.claude.sources.project')} />
        </ToggleRow>
        <ToggleRow label={t('module.claude.sources.user')} description={t('module.claude.sources.userDesc')}>
          <Switch checked={config.sources.user} disabled={disabled} aria-label={t('module.claude.sources.user')} onChange={(on) => void save(withSource(config, 'user', on))} />
        </ToggleRow>
        <ToggleRow label={t('module.claude.sources.local')} description={t('module.claude.sources.localDesc')}>
          <Switch checked={config.sources.local} disabled={disabled} aria-label={t('module.claude.sources.local')} onChange={(on) => void save(withSource(config, 'local', on))} />
        </ToggleRow>
      </Card>
      <NextTurn />
      {inventory ? <CountsTable inventory={inventory} /> : <EmptyInventory />}
    </>
  );
}

function PluginsView({ config, inventory, disabled, save }: ViewProps) {
  const { t } = useT();
  const rows = pluginRows(inventory, config);
  if (!inventory) return <EmptyInventory />;
  if (rows.length === 0) return <p className="text-small text-ink-400">{t('module.claude.plugins.empty')}</p>;
  return (
    <>
      <p className="text-small text-ink-400">{t('module.claude.plugins.intro')}</p>
      <Card testId="claude-plugins">
        {rows.map((row) => (
          <ToggleRow
            key={row.id}
            label={row.name}
            description={row.ignoredBySource ? t('module.claude.ignoredBySource', { source: row.scope }) : row.id}
            extra={
              <Badge variant="soft" size="micro" shape="pill" tone="neutral" className="px-2 py-0.5 font-mono text-micro">
                {row.scope}
              </Badge>
            }
          >
            <Switch checked={row.enabled} disabled={disabled} aria-label={row.name} onChange={(on) => void save(withPluginEnabled(config, row.id, on))} />
          </ToggleRow>
        ))}
      </Card>
    </>
  );
}

function McpOpNote({ name, op, status }: { name: string; op: McpOp | undefined; status: McpDisplayStatus }) {
  const { t } = useT();
  if (!op) return null;
  if (op.phase === 'running') {
    return (
      <p role="status" data-testid={`claude-mcp-op-${name}`} className="text-meta text-ink-300">
        {t(op.kind === 'login' ? 'module.claude.mcp.loginRunning' : 'module.claude.mcp.reconnecting')}
      </p>
    );
  }
  if (op.phase === 'reconnect-failed') {
    return (
      <p role="alert" data-testid={`claude-mcp-op-${name}`} className="text-meta text-roseish">
        {t('module.claude.mcp.reconnect.error')}
      </p>
    );
  }
  const informative = op.outcome === 'not-oauth' || op.outcome === 'header-auth' || op.outcome === 'terminal';
  const showNote = (status === 'failed' || status === 'needs-auth') && connectorNote(name, op.output);
  return (
    <div data-testid={`claude-mcp-op-${name}`} className="flex flex-col gap-1">
      <p role={informative ? 'status' : 'alert'} className={`text-meta ${informative ? 'text-ink-300' : 'text-roseish'}`}>
        {t(`module.claude.mcp.login.${op.outcome}` as Key)}
      </p>
      {showNote && <p className="text-meta text-ink-400">{t('module.claude.mcp.connectorsNote')}</p>}
      {!informative && op.output.trim() !== '' && (
        <details className="text-meta text-ink-400">
          <summary className="cursor-pointer">{t('module.claude.mcp.details')}</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ink-950 p-2 font-mono text-micro text-ink-300">{op.output}</pre>
        </details>
      )}
    </div>
  );
}

function McpActions({ name, status, op }: { name: string; status: McpDisplayStatus; op: McpOp | undefined }) {
  const { t } = useT();
  const { loginMcp, reconnectMcp, open } = useClaude();
  const running = op?.phase === 'running';
  const login = status === 'needs-auth';
  const reconnect = status === 'failed' || status === 'pending';
  if (!login && !reconnect) return null;
  return (
    <Button type="button" size="tiny" variant="outline" disabled={!open || running} onClick={() => void (login ? loginMcp(name) : reconnectMcp(name))}>
      <span className="inline-flex items-center gap-1.5 text-meta">
        {running && <Loader2 aria-hidden size={12} className="animate-spin" />}
        {t(login ? 'module.claude.mcp.login' : 'module.claude.mcp.reconnect')}
      </span>
    </Button>
  );
}

function McpView({ config, inventory, disabled, save }: ViewProps) {
  const { t } = useT();
  const { connectSupported, mcpOps } = useClaude();
  const rows = mcpRows(inventory, config);
  if (!inventory) return <EmptyInventory />;
  if (rows.length === 0) return <p className="text-small text-ink-400">{t('module.claude.mcp.empty')}</p>;
  return (
    <>
      <p className="text-small text-ink-400">{t('module.claude.mcp.intro')}</p>
      <Card testId="claude-mcp">
        {rows.map((row) => (
          <ToggleRow
            key={row.name}
            label={row.name}
            description={row.status === 'needs-auth' && !connectSupported ? t('module.claude.mcp.needsAuth') : row.ignoredBySource ? t('module.claude.ignoredBySource', { source: row.source }) : row.source}
            below={connectSupported ? <McpOpNote name={row.name} op={mcpOps[row.name]} status={row.status} /> : undefined}
            extra={
              <Badge variant="soft" size="micro" shape="pill" tone={STATUS_TONE[row.status]} data-testid={`claude-mcp-status-${row.name}`} className="px-2 py-0.5 text-micro">
                {t(`module.claude.mcp.status.${row.status}` as Key)}
              </Badge>
            }
          >
            <div className="flex items-center gap-3">
              {connectSupported && <McpActions name={row.name} status={row.status} op={mcpOps[row.name]} />}
              <Switch checked={row.enabled} disabled={disabled} aria-label={row.name} onChange={(on) => void save(withMcpEnabled(config, row.name, on))} />
            </div>
          </ToggleRow>
        ))}
      </Card>
    </>
  );
}

function BrowserUrlField({ config, disabled, save }: Omit<ViewProps, 'inventory'>) {
  const { t } = useT();
  const stored = config.browser.browserUrl ?? '';
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);
  const valid = isValidBrowserUrl(draft);
  const dirty = draft.trim() !== stored;
  return (
    <div className="flex flex-col gap-2 py-3">
      <label htmlFor="claude-browser-url" className="text-copy font-medium text-ink-100">
        {t('module.claude.browser.url')}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="claude-browser-url"
          type="text"
          size="sm"
          className="min-w-0 flex-1"
          placeholder="http://127.0.0.1:9222"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="button" size="small" variant="outline" disabled={disabled || !valid || !dirty} onClick={() => void save(withBrowser(config, { browserUrl: normalizeBrowserUrl(draft) }))}>
          {t('module.claude.browser.save')}
        </Button>
      </div>
      {!valid && (
        <p role="alert" className="text-small text-roseish">
          {t('module.claude.browser.invalid')}
        </p>
      )}
      <p className="text-small text-ink-400">{t(stored === '' ? 'module.claude.browser.urlHint' : 'module.claude.browser.remote')}</p>
    </div>
  );
}

const STATE_TONE = {
  connected: 'success',
  'permission-pending': 'warning',
  'debugging-disabled': 'warning',
  'chrome-closed': 'danger',
  off: 'neutral',
  unknown: 'neutral',
} as const;

function BrowserStatusLine() {
  const { t, lang } = useT();
  const { supported, status, checking, check, openSettings } = useChromeStatus();
  if (!supported) return null;
  return (
    <div data-testid="claude-browser-status" className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-copy font-medium text-ink-100">{t('module.claude.browser.statusLabel')}</p>
        {status && (
          <>
            <Badge variant="soft" size="micro" shape="pill" tone={STATE_TONE[status.state]} data-testid="claude-browser-state" className="px-2 py-0.5 text-micro">
              {t(`module.claude.browser.state.${status.state}` as Key)}
            </Badge>
            <span className="text-meta text-ink-400">{t('module.claude.browser.checkedAt', { when: relativeTime(status.checkedAt, lang) })}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="tiny" variant="outline" disabled={checking} onClick={() => void check()}>
          <span className="text-meta">{t(checking ? 'module.claude.browser.checking' : 'module.claude.browser.check')}</span>
        </Button>
        <Button type="button" size="tiny" variant="outline" onClick={() => void openSettings()}>
          <span className="text-meta">{t('module.claude.chrome.action.openSettings')}</span>
        </Button>
      </div>
    </div>
  );
}

function BrowserView({ config, disabled, save, version }: Omit<ViewProps, 'inventory'> & { version: string }) {
  const { t } = useT();
  return (
    <>
      <Card testId="claude-browser">
        <ToggleRow
          label={t('module.claude.browser.chrome')}
          description={t('module.claude.browser.chromeDesc')}
          extra={version ? <span className="font-mono text-micro text-ink-400">{t('module.claude.browser.version', { version })}</span> : undefined}
        >
          <Switch checked={config.browser.enabled} disabled={disabled} aria-label={t('module.claude.browser.chrome')} onChange={(on) => void save(withBrowser(config, { enabled: on }))} />
        </ToggleRow>
        <BrowserStatusLine />
        <p className="pb-3 text-small text-ink-400">{t('module.claude.browser.autoConnect')}</p>
        <BrowserUrlField config={config} disabled={disabled} save={save} />
      </Card>
      <NextTurn />
      <Card testId="claude-in-chrome">
        <ToggleRow
          label={t('module.claude.inChrome.label')}
          description={t('module.claude.inChrome.desc')}
          extra={
            <Badge variant="soft" size="micro" shape="pill" tone="neutral" className="px-2 py-0.5 text-micro">
              {t('module.claude.inChrome.badge')}
            </Badge>
          }
        >
          <span />
        </ToggleRow>
      </Card>
    </>
  );
}

function SectionBody({ section }: { section: ClaudeSection }) {
  const claude = useClaude();
  if (!claude.config) return null;
  const view = { config: claude.config, disabled: claude.busy || !claude.open, save: claude.save };
  if (section === 'sources') return <SourcesView {...view} inventory={claude.inventory} />;
  if (section === 'plugins') return <PluginsView {...view} inventory={claude.inventory} />;
  if (section === 'mcp') return <McpView {...view} inventory={claude.inventory} />;
  return <BrowserView {...view} version={claude.browserMcpVersion} />;
}

export function ClaudeCenter() {
  const { t } = useT();
  const section = sectionOf(useNav((s) => s.selection.claude));
  const claude = useClaude();
  const warning = claude.config ? costWarning(claude.inventory, claude.config) : null;
  const shown = claude.notice ? noticeOf(claude.notice, t) : null;
  return (
    <CenterFrame title={t(`module.claude.section.${section}` as Key)}>
      <div className="flex max-w-3xl flex-col gap-3">
        {!claude.supported ? (
          <Notice testId="claude-unsupported" tone={claude.open ? 'info' : 'warning'}>
            {t(claude.open ? 'module.claude.unsupported' : 'module.claude.offline')}
          </Notice>
        ) : claude.loadFailed && !claude.loaded ? (
          <Notice testId="claude-load-failed" tone="error" role="alert">
            {t('module.claude.loadFailed')}
          </Notice>
        ) : !claude.loaded ? (
          <p role="status" className="text-small text-ink-400">
            {t('module.claude.loading')}
          </p>
        ) : (
          <>
            {claude.scopeSupported && claude.scope && <ScopeBar />}
            {section !== 'browser' && <InventoryBar />}
            {shown && (
              <Notice testId="claude-notice" tone={shown.tone} role={shown.tone === 'error' ? 'alert' : 'status'} onDismiss={claude.dismissNotice} dismissLabel={t('module.claude.notice.dismiss')}>
                {shown.text}
              </Notice>
            )}
            {warning && (
              <Notice testId="claude-cost-warning" tone="warning">
                {t('module.claude.cost', { skills: warning.skills, mcpTools: warning.mcpTools })}
              </Notice>
            )}
            <SectionBody section={section} />
          </>
        )}
      </div>
    </CenterFrame>
  );
}
