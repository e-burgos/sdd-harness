'use client';

import { useEffect, useState } from 'react';
import { useBridge, useStudio } from '../BridgeProvider';
import { SubprojectIcon, classifySubproject, type SubprojectClassification } from './SubprojectIcon';

export interface DiscoveredSubproject extends SubprojectClassification {
  name: string;
  desc: string;
  specsCount: number;
  isActive: boolean;
}

export function EcosystemDashboard() {
  const { client } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);

  const specs = snapshot?.specs ?? [];
  const cycles = snapshot?.cycles ?? [];
  const fixes = snapshot?.fixes ?? [];

  const completedSpecs = specs.filter((s) => s.status === 'completed').length;
  const inProgressSpecs = specs.filter((s) => s.status === 'in-progress').length;
  const activeCycle = cycles.find((c) => c.status === 'in-progress');

  const totalTasks = cycles.reduce((acc, c) => acc + c.tasksTotal, 0);
  const doneTasks = cycles.reduce((acc, c) => acc + c.tasksDone, 0);
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  const [subprojects, setSubprojects] = useState<DiscoveredSubproject[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function discoverSubprojects() {
      const discoveredMap = new Map<string, { desc: string }>();

      // 1. Try to read sdd/global.json from the active repository
      if (client) {
        try {
          const raw = (await client.request({ cmd: 'workspace.readFile', path: 'sdd/global.json' })) as { content: string };
          const globalData = JSON.parse(raw.content);
          const monorepo = globalData.monorepo;

          if (monorepo) {
            // Apps
            if (monorepo.apps && typeof monorepo.apps === 'object') {
              for (const [key, val] of Object.entries(monorepo.apps)) {
                const descStr = typeof val === 'string' ? val : key;
                const pathStr = descStr.includes(' — ') ? descStr.split(' — ')[0].trim() : (key.startsWith('apps/') ? key : `apps/${key}`);
                discoveredMap.set(pathStr, { desc: descStr });
              }
            }

            // Libs
            if (monorepo.libs && typeof monorepo.libs === 'object') {
              for (const [key, val] of Object.entries(monorepo.libs)) {
                const descStr = typeof val === 'string' ? val : key;
                const pathStr = descStr.includes(' — ') ? descStr.split(' — ')[0].trim() : (key.startsWith('libs/') ? key : `libs/${key}`);
                discoveredMap.set(pathStr, { desc: descStr });
              }
            }

            // Tools
            if (monorepo.tools && typeof monorepo.tools === 'object') {
              for (const [key, val] of Object.entries(monorepo.tools)) {
                const descStr = typeof val === 'string' ? val : key;
                const pathStr = descStr.includes(' — ') ? descStr.split(' — ')[0].trim() : (key.startsWith('tools/') ? key : `tools/${key}`);
                discoveredMap.set(pathStr, { desc: descStr });
              }
            }
          }

          // Also check completed/in_progress modules for apps
          const allModules = [
            ...(globalData.completed_modules ?? []),
            ...(globalData.in_progress_modules ?? []),
            ...(globalData.pending_modules ?? []),
          ];
          for (const m of allModules) {
            if (Array.isArray(m.apps)) {
              for (const a of m.apps) {
                if (!discoveredMap.has(a)) {
                  discoveredMap.set(a, { desc: `${m.module} module target` });
                }
              }
            }
          }
        } catch {
          // If global.json is unreadable, fall back to snapshot cycles and specs
        }
      }

      // 2. Discover from snapshot cycles
      for (const c of cycles) {
        if (Array.isArray(c.apps)) {
          for (const a of c.apps) {
            if (!discoveredMap.has(a)) {
              discoveredMap.set(a, { desc: `Utilizado en ${c.specId}` });
            }
          }
        }
      }

      // 3. Discover from snapshot specs
      for (const s of specs) {
        if (s.app && !discoveredMap.has(s.app)) {
          discoveredMap.set(s.app, { desc: `Módulo de ${s.title}` });
        }
      }

      // 4. Transform into classified subproject models
      const items: DiscoveredSubproject[] = Array.from(discoveredMap.entries()).map(([name, meta]) => {
        const classification = classifySubproject(name, meta.desc);
        const specsCount = specs.filter((s) => s.app === name || s.folder?.includes(name)).length;
        const isActive = activeCycle?.apps?.includes(name) ?? false;

        return {
          name,
          desc: meta.desc,
          specsCount,
          isActive,
          ...classification,
        };
      });

      if (!cancelled) {
        setSubprojects(items);
      }
    }

    discoverSubprojects();
    return () => {
      cancelled = true;
    };
  }, [client, cycles, specs, activeCycle]);

  return (
    <div
      data-testid="ecosystem-dashboard"
      className="flex-1 h-full w-full overflow-y-auto bg-radial from-ink-900 to-ink-950 p-6 space-y-6 text-white select-none"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🌐</span>
            <h2 className="text-xl font-bold tracking-tight text-white">Ecosistema del Repositorio</h2>
          </div>
          <p className="text-xs text-white/50 font-mono">
            Monitoreo dinámico de subproyectos, contratos, roadmap de specs y salud del SPEC GATE.
          </p>
        </div>

        {/* Global Gate Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-ink-900 border border-white/10 px-4 py-2 shadow-lg">
            <span className={`h-2.5 w-2.5 rounded-full ${activeCycle ? 'bg-emerald-400 animate-ping' : 'bg-sky-400'}`} />
            <div>
              <p className="text-[10px] font-mono uppercase text-white/40">SPEC GATE STATUS</p>
              <p className="text-xs font-mono font-bold text-emerald-400">
                {activeCycle ? `CYCLE IN-PROGRESS (${activeCycle.flow})` : 'IDLE (NO ACTIVE CYCLE)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Headline Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Especificaciones</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{specs.length}</span>
            <span className="text-xs text-emerald-400 font-mono font-semibold">
              {completedSpecs} listas · {inProgressSpecs} activas
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Tareas & Sprint</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{doneTasks}/{totalTasks}</span>
            <span className="text-xs text-sky-400 font-mono font-semibold">{taskProgressPct}% completado</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Ciclos Totales</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{cycles.length}</span>
            <span className="text-xs text-purple-400 font-mono font-semibold">
              {cycles.filter((c) => c.status === 'completed').length} cerrados
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[11px] font-mono uppercase text-white/40 mb-1">Fixes Registrados</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{fixes.length}</span>
            <span className="text-xs text-amber-400 font-mono font-semibold">100% absorbidos</span>
          </div>
        </div>
      </div>

      {/* Subprojects Grid (Apps, Libs, Tools) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>📁</span>
            <span>Subproyectos y Módulos del Workspace ({subprojects.length})</span>
          </h3>
          <span className="text-[11px] font-mono text-white/40">Detección automática de arquitectura</span>
        </div>

        {subprojects.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-ink-900/40 p-8 text-center text-white/40 font-mono text-xs">
            No se detectaron subproyectos registrados en este workspace.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subprojects.map((app) => (
              <div
                key={app.name}
                className="rounded-xl border border-white/10 bg-ink-900/60 p-4 hover:border-white/20 transition-all hover:bg-ink-900/90 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <SubprojectIcon category={app.category} size={24} />
                    </div>
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide border"
                      style={{
                        color: app.color,
                        backgroundColor: app.badgeBg,
                        borderColor: `${app.color}40`,
                      }}
                    >
                      {app.typeLabel}
                    </span>
                  </div>
                  <h4 className="font-mono text-xs font-bold text-white mb-1 truncate" title={app.name}>
                    {app.name}
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed mb-4 line-clamp-2" title={app.desc}>
                    {app.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono">
                  {app.isActive ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Activo en {activeCycle?.cycle}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-white/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                      <span>{app.specsCount > 0 ? `${app.specsCount} spec${app.specsCount > 1 ? 's' : ''}` : 'Estable'}</span>
                    </div>
                  )}
                  <span className="text-white/40 uppercase tracking-wider text-[9px]">Monorepo</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Specs Status Table */}
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-white mb-3 flex items-center gap-2">
          <span>📜</span>
          <span>Roadmap de Especificaciones SDD</span>
        </h3>
        <div className="rounded-xl border border-white/10 bg-ink-900/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/5 text-white/50 border-b border-white/10 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Spec ID</th>
                  <th className="py-2.5 px-4">Título</th>
                  <th className="py-2.5 px-4">Módulo</th>
                  <th className="py-2.5 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {specs.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-emerald-400 font-bold truncate max-w-[220px]">{s.id}</td>
                    <td className="py-3 px-4 font-sans text-xs text-white font-medium">{s.title}</td>
                    <td className="py-3 px-4 text-white/50">{s.module ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          s.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                            : s.status === 'in-progress'
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20 animate-pulse'
                              : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
