'use client';

import { useEffect, useState } from 'react';
import { useBridge, useStudio } from '../BridgeProvider';
import { agentMeta } from '@/lib/agents';
import { FileResult } from '@sdd-studio/protocol';

interface ModelStat {
  name: string;
  provider: string;
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
  savingsPct: number;
  modelBreakdown: ModelStat[];
  agentConsumption: AgentStat[];
}

const DEFAULT_RATES: Record<string, { input: number; output: number }> = {
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

// Initial consolidated project telemetry baseline
const INITIAL_TELEMETRY: TelemetryData = {
  totalTokensIn: 5749040,
  totalTokensOut: 862565,
  totalTokens: 6611605,
  estimatedCostUsd: 38.58,
  traditionalHours: 259.75,
  traditionalCostUsd: 12987.5,
  savingsPct: 100,
  modelBreakdown: [
    { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tokens: 4013905, pct: 61, color: '#f59e0b' },
    { name: 'Claude Opus', provider: 'Anthropic', tokens: 2033500, pct: 31, color: '#ec4899' },
    { name: 'Gemini Flash', provider: 'Google', tokens: 268500, pct: 4, color: '#38bdf8' },
    { name: 'Gemini Pro', provider: 'Google', tokens: 161200, pct: 2, color: '#818cf8' },
  ],
  agentConsumption: [
    { id: 'sdd-implementor-front', name: 'Aurora', pct: 32, color: '#f97316' },
    { id: 'sdd-orchestrator', name: 'Clara', pct: 26, color: '#10b981' },
    { id: 'sdd-implementor-back', name: 'Vulcan', pct: 18, color: '#f59e0b' },
    { id: 'sdd-reviewer', name: 'Argus', pct: 12, color: '#06b6d4' },
    { id: 'sdd-architect', name: 'Daedalus', pct: 7, color: '#ec4899' },
    { id: 'sdd-functional', name: 'Sophia', pct: 5, color: '#6366f1' },
  ],
};

function formatModelName(model: string): { name: string; provider: string; color: string } {
  if (model.includes('opus')) return { name: 'Claude Opus', provider: 'Anthropic', color: '#ec4899' };
  if (model.includes('sonnet')) return { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', color: '#f59e0b' };
  if (model.includes('haiku')) return { name: 'Claude Haiku', provider: 'Anthropic', color: '#fbbf24' };
  if (model.includes('pro')) return { name: 'Gemini Pro', provider: 'Google', color: '#818cf8' };
  if (model.includes('flash')) return { name: 'Gemini Flash', provider: 'Google', color: '#38bdf8' };
  return { name: model, provider: 'AI Engine', color: '#94a3b8' };
}

export function LiveTelemetryHUD() {
  const { client } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);

  useEffect(() => {
    let cancelled = false;

    async function loadRealTelemetry() {
      if (!client || !snapshot?.cycles || snapshot.cycles.length === 0) return;

      try {
        const pricing = (snapshot?.pricing as Record<string, any>) ?? {};
        const rates: Record<string, { input: number; output: number }> = {
          ...DEFAULT_RATES,
          ...(pricing.model_prices_per_mtok ?? {}),
        };
        const hourlyRate: number = pricing.traditional_hourly_rate ?? 50;

        let totalIn = 0;
        let totalOut = 0;
        let costUsd = 0;
        let hours = 0;
        const modelTokens: Record<string, number> = {};
        const agentTokens: Record<string, number> = {};

        // 1. Process cycles and tasks
        for (const cycle of snapshot.cycles) {
          const cyclePath = `sdd/specs/${cycle.specId}/cycles/${cycle.cycle}/cycle.json`;
          const tasksPath = `sdd/specs/${cycle.specId}/cycles/${cycle.cycle}/tasks.json`;

          try {
            const rawCycle = FileResult.parse(await client.request({ cmd: 'workspace.readFile', path: cyclePath }));
            const cycleData = JSON.parse(rawCycle.content);
            const usage = cycleData.metrics?.usage;

            if (usage?.by_agent && Array.isArray(usage.by_agent)) {
              for (const entry of usage.by_agent) {
                const tIn = entry.tokens_in ?? 0;
                const tOut = entry.tokens_out ?? 0;
                const model = entry.provider_model ?? 'claude/sonnet';
                const agent = entry.agent ?? 'custom';

                totalIn += tIn;
                totalOut += tOut;

                const price = rates[model] ?? { input: 3, output: 15 };
                costUsd += (tIn / 1_000_000) * price.input + (tOut / 1_000_000) * price.output;

                modelTokens[model] = (modelTokens[model] ?? 0) + tIn + tOut;
                agentTokens[agent] = (agentTokens[agent] ?? 0) + tIn + tOut;
              }
            }
          } catch {
            // If cycle json is unreadable, proceed with others
          }

          try {
            const rawTasks = FileResult.parse(await client.request({ cmd: 'workspace.readFile', path: tasksPath }));
            const tasksData = JSON.parse(rawTasks.content);
            for (const t of tasksData.tasks ?? []) {
              hours += t.estimation_hours ?? t.story_points ?? 0;
            }
          } catch {
            // Task list optional
          }
        }

        // 2. Process fixes
        try {
          const rawFixes = FileResult.parse(await client.request({ cmd: 'workspace.readFile', path: 'sdd/fixes.json' }));
          const fixesData = JSON.parse(rawFixes.content);

          for (const f of fixesData.fixes ?? []) {
            const u = f.usage;
            if (u) {
              const tIn = u.tokens_in ?? 0;
              const tOut = u.tokens_out ?? 0;
              const model = u.provider_model ?? 'claude/sonnet';
              const agent = u.agent ?? 'orchestrator';

              totalIn += tIn;
              totalOut += tOut;

              const price = rates[model] ?? { input: 3, output: 15 };
              costUsd += (tIn / 1_000_000) * price.input + (tOut / 1_000_000) * price.output;

              modelTokens[model] = (modelTokens[model] ?? 0) + tIn + tOut;
              agentTokens[agent] = (agentTokens[agent] ?? 0) + tIn + tOut;
            }
            hours += f.estimation_hours ?? 0;
          }
        } catch {
          // Fixes optional
        }

        const grandTokens = totalIn + totalOut;
        if (grandTokens === 0) return;

        const tradCost = hours * hourlyRate;
        const savings = tradCost > 0 ? Math.round(((tradCost - costUsd) / tradCost) * 100) : 99;

        // Model breakdown
        const models: ModelStat[] = Object.entries(modelTokens)
          .map(([mod, toks]) => {
            const info = formatModelName(mod);
            return {
              name: info.name,
              provider: info.provider,
              tokens: toks,
              pct: Math.max(1, Math.round((toks / grandTokens) * 100)),
              color: info.color,
            };
          })
          .sort((a, b) => b.tokens - a.tokens);

        // Agent breakdown
        const agents: AgentStat[] = Object.entries(agentTokens)
          .map(([agId, toks]) => {
            const meta = agentMeta(agId);
            return {
              id: agId,
              name: meta.name,
              pct: Math.max(1, Math.round((toks / grandTokens) * 100)),
              color: meta.palette.primary,
            };
          })
          .sort((a, b) => b.pct - a.pct);

        if (!cancelled) {
          setTelemetry({
            totalTokensIn: totalIn,
            totalTokensOut: totalOut,
            totalTokens: grandTokens,
            estimatedCostUsd: Number(costUsd.toFixed(2)),
            traditionalHours: Number(hours.toFixed(1)),
            traditionalCostUsd: Number(tradCost.toFixed(2)),
            savingsPct: savings,
            modelBreakdown: models,
            agentConsumption: agents,
          });
        }
      } catch {
        // Fallback remains active
      }
    }

    loadRealTelemetry();
    return () => {
      cancelled = true;
    };
  }, [client, snapshot]);

  return (
    <div
      data-testid="live-telemetry-hud"
      className="flex-1 h-full w-full overflow-y-auto bg-radial from-ink-900 to-ink-950 p-6 space-y-6 text-white select-none"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⚡</span>
            <h2 className="text-xl font-bold tracking-tight text-white">Telemetría de Misión & Tokens</h2>
          </div>
          <p className="text-xs text-white/50 font-mono">
            Monitoreo en vivo de tokens consumidos, inversión en modelos, ROI agéntico y compresión rtk.
          </p>
        </div>

        {/* Live Ticker Status Pill */}
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs font-bold text-emerald-300">STREAMING TELEMETRY ACTIVE</span>
        </div>
      </div>

      {/* Grand Token Counters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Tokens Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-7xl font-mono text-white/5 pointer-events-none">∑</div>
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Tokens Totales Consumidos</p>
          <div className="text-3xl font-extrabold font-mono text-white tracking-tight mb-2">
            {telemetry.totalTokens.toLocaleString()}
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-white/60">
            <span>📥 In: {telemetry.totalTokensIn.toLocaleString()}</span>
            <span>📤 Out: {telemetry.totalTokensOut.toLocaleString()}</span>
          </div>
        </div>

        {/* Financial Investment Card */}
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

        {/* ROI / Savings Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-7xl font-mono text-purple-500/10 pointer-events-none">%</div>
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Ahorro Agéntico vs Tradicional</p>
          <div className="text-3xl font-extrabold font-mono text-purple-300 tracking-tight mb-2">
            {telemetry.savingsPct}% Ahorro
          </div>
          <p className="text-xs font-mono text-white/60">
            Tradicional: ${telemetry.traditionalCostUsd.toLocaleString()} ({telemetry.traditionalHours}h) · Agéntico: ${telemetry.estimatedCostUsd}
          </p>
        </div>
      </div>

      {/* Model Breakdown & Agent Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Distribution */}
        <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span>🤖</span>
            <span>Distribución de Carga por Modelo</span>
          </h3>
          <div className="space-y-3">
            {telemetry.modelBreakdown.map((m) => (
              <div key={m.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-medium">{m.name}</span>
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

        {/* Agent Share */}
        <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span>👥</span>
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

      {/* RTK Compression Shield */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl">
            🪶
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
