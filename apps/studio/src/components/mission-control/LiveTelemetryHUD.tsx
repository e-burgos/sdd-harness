'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Card } from '@e-burgos/tucu-ui';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  Users,
  Feather,
} from 'lucide-react';
import { useBridge, useStudio } from '../BridgeProvider';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { StatusPill } from '../StatusPill';

function KpiPanel({ glyph, glyphClass, label, value, valueClass, children }: { glyph: string; glyphClass: string; label: string; value: ReactNode; valueClass: string; children: ReactNode }) {
  return (
    <Card className="relative overflow-hidden backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-4 -bottom-4 font-mono text-7xl ${glyphClass}`}>{glyph}</div>
      <p className="mb-1 font-mono text-meta uppercase text-ink-500">{label}</p>
      <div className={`mb-2 font-mono text-3xl font-extrabold tracking-tight ${valueClass}`}>{value}</div>
      {children}
    </Card>
  );
}

function SectionPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-100">
          {icon}
          <span>{title}</span>
        </h3>
        {children}
      </div>
    </Card>
  );
}

interface ModelStat {
  name: string;
  provider: string | null;
  tokens: number;
  pct: number;
  color: string;
}

interface AgentStat {
  id: string;
  name: string;
  pct: number;
  color: string;
}

interface TelemetryData {
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  estimatedCostUsd: number;
  traditionalHours: number;
  traditionalCostUsd: number;
  savingsPct: number | null;
  modelBreakdown: ModelStat[];
  agentConsumption: AgentStat[];
}

interface UsageEntry {
  tokens_in?: number;
  tokens_out?: number;
  provider_model?: string;
  agent?: string;
}

type Rates = Record<string, { input: number; output: number }>;

const DEFAULT_RATES: Rates = {
  'claude/haiku': { input: 1, output: 5 },
  'claude/sonnet': { input: 3, output: 15 },
  'claude/opus': { input: 5, output: 25 },
  'claude/fable': { input: 10, output: 50 },
  'gemini/flash-lite': { input: 0.25, output: 1.5 },
  'gemini/flash': { input: 0.5, output: 3 },
  'gemini/pro': { input: 2, output: 12 },
  'copilot/gpt-5-mini': { input: 0.25, output: 2 },
  'copilot/claude-sonnet': { input: 3, output: 15 },
  'copilot/claude-opus': { input: 5, output: 25 },
  'copilot/gemini-flash': { input: 1.5, output: 9 },
};

const UNKNOWN = 'desconocido';
const MODEL_COLORS = ['#f59e0b', '#ec4899', '#38bdf8', '#818cf8', '#34d399', '#fb7185', '#94a3b8'];

export function formatModelName(providerModel: string): { name: string; provider: string | null } {
  const slash = providerModel.indexOf('/');
  if (slash <= 0) return { name: providerModel, provider: null };
  return { name: providerModel.slice(slash + 1), provider: providerModel.slice(0, slash) };
}

interface Totals {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  hours: number;
  modelTokens: Record<string, number>;
  agentTokens: Record<string, number>;
}

const emptyTotals = (): Totals => ({ tokensIn: 0, tokensOut: 0, costUsd: 0, hours: 0, modelTokens: {}, agentTokens: {} });

function addUsage(totals: Totals, usage: UsageEntry, rates: Rates): void {
  const tokensIn = usage.tokens_in ?? 0;
  const tokensOut = usage.tokens_out ?? 0;
  const model = usage.provider_model ?? UNKNOWN;
  const agent = usage.agent ?? UNKNOWN;
  const price = rates[model];
  totals.tokensIn += tokensIn;
  totals.tokensOut += tokensOut;
  if (price) totals.costUsd += (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
  totals.modelTokens[model] = (totals.modelTokens[model] ?? 0) + tokensIn + tokensOut;
  totals.agentTokens[agent] = (totals.agentTokens[agent] ?? 0) + tokensIn + tokensOut;
}

const sharePct = (tokens: number, grand: number): number => Math.max(1, Math.round((tokens / grand) * 100));

function toTelemetry(totals: Totals, hourlyRate: number): TelemetryData | null {
  const grandTokens = totals.tokensIn + totals.tokensOut;
  if (grandTokens === 0) return null;
  const traditionalCost = totals.hours * hourlyRate;
  return {
    totalTokensIn: totals.tokensIn,
    totalTokensOut: totals.tokensOut,
    totalTokens: grandTokens,
    estimatedCostUsd: Number(totals.costUsd.toFixed(2)),
    traditionalHours: Number(totals.hours.toFixed(1)),
    traditionalCostUsd: Number(traditionalCost.toFixed(2)),
    savingsPct: traditionalCost > 0 ? Math.round(((traditionalCost - totals.costUsd) / traditionalCost) * 100) : null,
    modelBreakdown: Object.entries(totals.modelTokens)
      .sort(([, a], [, b]) => b - a)
      .map(([model, tokens], index) => ({
        ...formatModelName(model),
        tokens,
        pct: sharePct(tokens, grandTokens),
        color: MODEL_COLORS[index % MODEL_COLORS.length] ?? '#94a3b8',
      })),
    agentConsumption: Object.entries(totals.agentTokens)
      .map(([id, tokens]) => ({ id, name: agentMeta(id).name, pct: sharePct(tokens, grandTokens), color: agentMeta(id).color }))
      .sort((a, b) => b.pct - a.pct),
  };
}

type FileReader = (path: string) => Promise<string | null>;

async function readJson(read: FileReader, path: string): Promise<any | null> {
  const content = await read(path);
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function collectTotals(read: FileReader, cycles: { specId: string; cycle: string }[], rates: Rates): Promise<Totals> {
  const totals = emptyTotals();
  for (const { specId, cycle } of cycles) {
    const base = `sdd/specs/${specId}/cycles/${cycle}`;
    const cycleData = await readJson(read, `${base}/cycle.json`);
    const byAgent = cycleData?.metrics?.usage?.by_agent;
    if (Array.isArray(byAgent)) for (const entry of byAgent) addUsage(totals, entry, rates);
    const tasksData = await readJson(read, `${base}/tasks.json`);
    for (const task of tasksData?.tasks ?? []) totals.hours += task.estimation_hours ?? task.story_points ?? 0;
  }
  const fixesData = await readJson(read, 'sdd/fixes.json');
  for (const fix of fixesData?.fixes ?? []) {
    if (fix.usage) addUsage(totals, fix.usage, rates);
    totals.hours += fix.estimation_hours ?? 0;
  }
  return totals;
}

export function LiveTelemetryHUD() {
  const { client } = useBridge();
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cycles = snapshot?.cycles ?? [];
    if (!client || cycles.length === 0) {
      setTelemetry(null);
      return;
    }
    const pricing = (snapshot?.pricing as Record<string, any> | null) ?? {};
    const rates: Rates = { ...DEFAULT_RATES, ...(pricing.model_prices_per_mtok ?? {}) };
    const hourlyRate: number = pricing.traditional_hourly_rate ?? 50;
    const read: FileReader = async (path) => {
      try {
        const result = (await client.request({ cmd: 'workspace.readFile', path })) as { content: string };
        return result.content;
      } catch {
        return null;
      }
    };
    collectTotals(read, cycles, rates).then((totals) => {
      if (!cancelled) setTelemetry(toTelemetry(totals, hourlyRate));
    });
    return () => {
      cancelled = true;
    };
  }, [client, snapshot]);

  return (
    <div
      data-testid="live-telemetry-hud"
      className="flex-1 h-full w-full overflow-y-auto bg-radial from-ink-900 to-ink-950 p-6 space-y-6 text-ink-100 select-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-foreground/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-ink-100">{t('ui.tel.title')}</h2>
          </div>
          <p className="text-xs text-ink-500 font-mono">
            {t('ui.tel.subtitle')}
          </p>
        </div>
        {telemetry && (
          <StatusPill tone="success" size="meta" className="gap-2! px-3! py-1.5! font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{t('ui.tel.streaming')}</span>
          </StatusPill>
        )}
      </div>
      {telemetry ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiPanel glyph="∑" glyphClass="text-foreground/5" label={t('ui.tel.totalTokens')} value={telemetry.totalTokens.toLocaleString()} valueClass="text-ink-100">
            <div className="flex items-center gap-4 font-mono text-ui text-ink-300">
              <span className="flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" /> {t('ui.tel.in', { n: telemetry.totalTokensIn.toLocaleString() })}</span>
              <span className="flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-sky-400" /> {t('ui.tel.out', { n: telemetry.totalTokensOut.toLocaleString() })}</span>
            </div>
          </KpiPanel>
          <KpiPanel glyph="$" glyphClass="text-emerald-500/10" label={t('ui.tel.invested')} value={`$${telemetry.estimatedCostUsd.toFixed(2)} USD`} valueClass="text-emerald-400">
            <p className="font-mono text-ui text-ink-300">
              {t('ui.tel.ratesSynced')} <code className="text-ink-100">sdd/pricing.json</code>
            </p>
          </KpiPanel>
          <KpiPanel
            glyph="%"
            glyphClass="text-purple-500/10"
            label={t('ui.tel.savings')}
            value={telemetry.savingsPct === null ? '—' : t('ui.tel.savingsValue', { pct: telemetry.savingsPct })}
            valueClass="text-purple-300"
          >
            <p className="font-mono text-ui text-ink-300">
              {t('ui.tel.traditionalLine', { cost: telemetry.traditionalCostUsd.toLocaleString(), hours: telemetry.traditionalHours, agentic: telemetry.estimatedCostUsd })}
            </p>
          </KpiPanel>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionPanel icon={<Cpu className="w-4 h-4 text-sky-400" />} title={t('ui.tel.byModel')}>
            <div className="space-y-3">
              {telemetry.modelBreakdown.map((m) => (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-ui font-mono">
                    <span className="text-ink-100 font-medium">
                      {m.name}
                      {m.provider && <span className="ml-1 text-micro text-ink-500">({m.provider})</span>}
                    </span>
                    <span className="text-ink-300">{t('ui.tel.tokensPct', { tokens: m.tokens.toLocaleString(), pct: m.pct })}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>
          <SectionPanel icon={<Users className="w-4 h-4 text-purple-400" />} title={t('ui.tel.byAgent')}>
            <div className="space-y-3">
              {telemetry.agentConsumption.map((a) => (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between text-ui font-mono">
                    <span className="text-ink-100 font-medium">
                      {a.name} <span className="text-ink-500 text-micro">({agentMeta(a.id).role})</span>
                    </span>
                    <span className="text-ink-300">{t('ui.tel.swarmPct', { pct: a.pct })}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.pct}%`, backgroundColor: a.color }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>
        </>
      ) : (
        <div data-testid="telemetry-empty" className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center font-mono text-sm text-ink-300">
          {t('mc.noTelemetry')}
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Feather className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-ink-100">{t('ui.tel.shield')}</h4>
              <p className="text-ui text-ink-300 font-mono">{t('ui.tel.shieldBody')}</p>
            </div>
          </div>
          <StatusPill tone="success" size="meta" className="px-3! py-1.5! font-bold">
            {t('ui.tel.protection')}
          </StatusPill>
        </div>
      </Card>
    </div>
  );
}
