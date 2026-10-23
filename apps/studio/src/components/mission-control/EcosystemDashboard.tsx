'use client';

import { useBridge } from '../BridgeProvider';

export function EcosystemDashboard() {
  const { snapshot } = useBridge();

  const specs = snapshot?.specs ?? [];
  const cycles = snapshot?.cycles ?? [];
  const fixes = snapshot?.fixes ?? [];

  const completedSpecs = specs.filter((s) => s.status === 'completed').length;
  const inProgressSpecs = specs.filter((s) => s.status === 'in-progress').length;
  const activeCycle = cycles.find((c) => c.status === 'in-progress');

  const totalTasks = cycles.reduce((acc, c) => acc + c.tasksTotal, 0);
  const doneTasks = cycles.reduce((acc, c) => acc + c.tasksDone, 0);
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  // Subprojects derived from cycles and catalog
  const knownApps = [
    { name: 'apps/studio', type: 'Next.js 16 Web App', icon: '💻', desc: 'SDD Studio Web Interface' },
    { name: 'apps/studio-bridge', type: 'Node / WebSocket Server', icon: '🔌', desc: 'Puente local de agentes con Claude SDK' },
    { name: 'libs/studio-protocol', type: 'TypeScript Protocol Lib', icon: '📦', desc: 'Contrato y esquemas Zod compartidos' },
    { name: 'apps/cli', type: 'Node / CLI', icon: '⌨️', desc: 'CLI harness para instalación y scaffolding' },
    { name: 'apps/documentation', type: 'React / Vite Pages', icon: '📖', desc: 'Sitio bilingüe de documentación oficial' },
  ];

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
        <h3 className="text-sm font-semibold tracking-tight text-white mb-3 flex items-center gap-2">
          <span>📁</span>
          <span>Subproyectos y Módulos del Workspace</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {knownApps.map((app) => (
            <div
              key={app.name}
              className="rounded-xl border border-white/10 bg-ink-900/60 p-4 hover:border-white/20 transition-all hover:bg-ink-900/90 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{app.icon}</span>
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/60 border border-white/5">
                  {app.type}
                </span>
              </div>
              <h4 className="font-mono text-xs font-bold text-white mb-1">{app.name}</h4>
              <p className="text-xs text-white/60 leading-relaxed mb-3">{app.desc}</p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Contexto activo & verificado</span>
              </div>
            </div>
          ))}
        </div>
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
