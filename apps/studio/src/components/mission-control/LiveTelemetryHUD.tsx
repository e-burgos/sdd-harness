'use client';

import { useEffect, useState } from 'react';
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
      className="flex-1 h-full w-full overflow-y-auto bg-radial from-ink-900 to-ink-950 p-6 space-y-6 text-white select-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Telemetría de Misión & Tokens</h2>
          </div>
          <p className="text-xs text-white/50 font-mono">
            Monitoreo en vivo de tokens consumidos, inversión en modelos, ROI agéntico y compresión rtk.
          </p>
        </div>
        {telemetry && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-xs font-bold text-emerald-300">STREAMING TELEMETRY ACTIVE</span>
          </div>
        )}
      </div>
      {telemetry ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 text-7xl font-mono text-white/5 pointer-events-none">∑</div>
            <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Tokens Totales Consumidos</p>
            <div className="text-3xl font-extrabold font-mono text-white tracking-tight mb-2">
              {telemetry.totalTokens.toLocaleString()}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-white/60">
              <span className="flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" /> In: {telemetry.totalTokensIn.toLocaleString()}</span>
              <span className="flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-sky-400" /> Out: {telemetry.totalTokensOut.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 text-7xl font-mono text-emerald-500/10 pointer-events-none">$</div>
            <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Inversión Real en Modelos</p>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight mb-2">
              ${telemetry.estimatedCostUsd.toFixed(2)} USD
            </div>
            <p className="text-xs font-mono text-white/60">
              Tarifas sincronizadas con <code className="text-white">sdd/pricing.json</code>
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 text-7xl font-mono text-purple-500/10 pointer-events-none">%</div>
            <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Ahorro Agéntico vs Tradicional</p>
            <div className="text-3xl font-extrabold font-mono text-purple-300 tracking-tight mb-2">
              {telemetry.savingsPct === null ? '—' : `${telemetry.savingsPct}% Ahorro`}
            </div>
            <p className="text-xs font-mono text-white/60">
              Tradicional: ${telemetry.traditionalCostUsd.toLocaleString()} ({telemetry.traditionalHours}h) · Agéntico: ${telemetry.estimatedCostUsd}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Distribución de Carga por Modelo</span>
            </h3>
            <div className="space-y-3">
              {telemetry.modelBreakdown.map((m) => (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-medium">
                      {m.name}
                      {m.provider && <span className="ml-1 text-[10px] text-white/40">({m.provider})</span>}
                    </span>
                    <span className="text-white/60">{m.tokens.toLocaleString()} tokens ({m.pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Consumo de Tokens por Agente</span>
            </h3>
            <div className="space-y-3">
              {telemetry.agentConsumption.map((a) => (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-medium">
                      {a.name} <span className="text-white/40 text-[10px]">({agentMeta(a.id).role})</span>
                    </span>
                    <span className="text-white/60">{a.pct}% del enjambre</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      ) : (
        <div data-testid="telemetry-empty" className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center font-mono text-sm text-white/60">
          {t('mc.noTelemetry')}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Feather className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-white">Escudo de Compresión RTK Activo</h4>
            <p className="text-xs text-emerald-200/70 font-mono">
              Comprimiendo salidas de shell en tiempo real. Ahorro promedio: 60%–90% de contexto.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300">
            PROTECCIÓN ACTIVA
          </span>
        </div>
      </div>
    </div>
  );
}
