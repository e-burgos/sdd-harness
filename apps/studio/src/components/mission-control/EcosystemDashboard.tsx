'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Card, BasicTable, type TableColumn } from '@e-burgos/tucu-ui';
import { Globe, Folder, ScrollText } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';
import { SubprojectIcon, classifySubproject, type SubprojectClassification } from './SubprojectIcon';

export interface DiscoveredSubproject extends SubprojectClassification {
  name: string;
  desc: string;
  specsCount: number;
  isActive: boolean;
  descRef?: DescRef;
}

type DescRef = { key: 'ui.eco.usedIn' | 'ui.eco.moduleOf'; vars: Record<string, string> };

const typeKey = {
  docs: 'ui.eco.type.docs',
  tool: 'ui.eco.type.tool',
  library: 'ui.eco.type.library',
  backend: 'ui.eco.type.backend',
  frontend: 'ui.eco.type.frontend',
  module: 'ui.eco.type.module',
} as const;

type RoadmapRow = { id: string; title: string; module: string; status: string };

const statusTone = (status: string): 'success' | 'info' | 'neutral' => (status === 'completed' ? 'success' : status === 'in-progress' ? 'info' : 'neutral');

function KpiCard({ label, value, sub, subClass }: { label: string; value: ReactNode; sub: string; subClass: string }) {
  return (
    <Card className="backdrop-blur-md">
      <p className="mb-1 font-mono text-meta uppercase text-ink-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-ink-100">{value}</span>
        <span className={`font-mono text-ui font-semibold ${subClass}`}>{sub}</span>
      </div>
    </Card>
  );
}

export function EcosystemDashboard() {
  const { t } = useT();
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
      const discoveredMap = new Map<string, { desc: string; descRef?: DescRef }>();

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
              discoveredMap.set(a, { desc: `Utilizado en ${c.specId}`, descRef: { key: 'ui.eco.usedIn', vars: { spec: c.specId } } });
            }
          }
        }
      }

      // 3. Discover from snapshot specs
      for (const s of specs) {
        if (s.app && !discoveredMap.has(s.app)) {
          discoveredMap.set(s.app, { desc: `Módulo de ${s.title}`, descRef: { key: 'ui.eco.moduleOf', vars: { title: s.title } } });
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
          descRef: meta.descRef,
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

  const roadmapRows: RoadmapRow[] = specs.map((s) => ({ id: s.id, title: s.title, module: s.module ?? '—', status: s.status }));
  const roadmapColumns: TableColumn<RoadmapRow>[] = [
    { key: 'id', label: t('ui.eco.col.id'), render: (v) => <span className="font-mono font-bold text-emerald-400">{String(v)}</span> },
    { key: 'title', label: t('ui.eco.col.title'), render: (v) => <span className="font-sans font-medium">{String(v)}</span> },
    { key: 'module', label: t('ui.eco.col.module'), render: (v) => <span className="font-mono text-ink-500">{String(v)}</span> },
    {
      key: 'status',
      label: t('ui.eco.col.status'),
      render: (v) => (
        <Badge variant="soft" size="micro" shape="pill" tone={statusTone(String(v))} className={`gap-1.5 px-2 py-0.5 font-mono text-micro uppercase ${v === 'in-progress' ? 'animate-pulse' : ''}`}>
          {String(v)}
        </Badge>
      ),
    },
  ];

  return (
    <div
      data-testid="ecosystem-dashboard"
      className="flex-1 h-full w-full overflow-y-auto bg-radial from-ink-900 to-ink-950 p-6 space-y-6 text-ink-100 select-none"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-foreground/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-ink-100">{t('ui.eco.title')}</h2>
          </div>
          <p className="text-xs text-ink-500 font-mono">
            {t('ui.eco.subtitle')}
          </p>
        </div>

        {/* Global Gate Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-ink-900 border border-foreground/10 px-4 py-2 shadow-lg">
            <span className={`h-2.5 w-2.5 rounded-full ${activeCycle ? 'bg-emerald-400 animate-ping' : 'bg-sky-400'}`} />
            <div>
              <p className="text-micro font-mono uppercase text-ink-500">{t('ui.eco.gateStatus')}</p>
              <p className="text-xs font-mono font-bold text-emerald-400">
                {activeCycle ? t('ui.eco.cycleInProgress', { flow: activeCycle.flow }) : t('ui.eco.idle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Headline Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label={t('ui.eco.kpi.specs')}
          value={specs.length}
          sub={t('ui.eco.kpi.specsSub', { done: completedSpecs, active: inProgressSpecs })}
          subClass="text-emerald-400"
        />
        <KpiCard
          label={t('ui.eco.kpi.tasks')}
          value={`${doneTasks}/${totalTasks}`}
          sub={t('ui.eco.kpi.tasksSub', { pct: taskProgressPct })}
          subClass="text-sky-400"
        />
        <KpiCard
          label={t('ui.eco.kpi.cycles')}
          value={cycles.length}
          sub={t('ui.eco.kpi.cyclesSub', { n: cycles.filter((c) => c.status === 'completed').length })}
          subClass="text-purple-400"
        />
        <KpiCard label={t('ui.eco.kpi.fixes')} value={fixes.length} sub={t('ui.eco.kpi.fixesSub')} subClass="text-amber-400" />
      </div>

      {/* Subprojects Grid (Apps, Libs, Tools) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-tight text-ink-100 flex items-center gap-2">
            <Folder className="w-4 h-4 text-emerald-400" />
            <span>{t('ui.eco.subprojects', { n: subprojects.length })}</span>
          </h3>
          <span className="text-meta font-mono text-ink-500">{t('ui.eco.autoDetect')}</span>
        </div>

        {subprojects.length === 0 ? (
          <div className="rounded-xl border border-foreground/10 bg-ink-900/40 p-8 text-center text-ink-500 font-mono text-xs">
            {t('ui.eco.none')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subprojects.map((app) => {
              const desc = app.descRef ? t(app.descRef.key, app.descRef.vars) : app.desc;
              return (
                <Card
                  key={app.name}
                  className="flex h-full flex-col transition-colors hover:border-foreground/20 [&>div:first-child]:flex-1"
                  footer={
                    <div className="flex items-center justify-between font-mono text-micro">
                      {app.isActive ? (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                          <span>{t('ui.eco.activeIn', { cycle: activeCycle?.cycle ?? '' })}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-ink-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                          <span>{app.specsCount > 0 ? t(app.specsCount > 1 ? 'ui.eco.specMany' : 'ui.eco.specOne', { n: app.specsCount }) : t('ui.eco.stable')}</span>
                        </div>
                      )}
                      <span className="text-micro uppercase tracking-wider text-ink-500">Monorepo</span>
                    </div>
                  }
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-2">
                      <SubprojectIcon category={app.category} size={24} />
                    </div>
                    <span
                      className="rounded border px-2 py-0.5 font-mono text-micro font-semibold tracking-wide"
                      style={{ color: app.color, backgroundColor: app.badgeBg, borderColor: `${app.color}40` }}
                    >
                      {t(typeKey[app.category])}
                    </span>
                  </div>
                  <h4 className="mb-1 truncate font-mono text-ui font-bold text-ink-100" title={app.name}>
                    {app.name}
                  </h4>
                  <p className="line-clamp-2 text-ui leading-relaxed text-ink-300" title={desc}>
                    {desc}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Specs Status Table */}
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-ink-100 mb-3 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-purple-400" />
          <span>{t('ui.eco.roadmap')}</span>
        </h3>
        <BasicTable
          density="snug"
          resizable={false}
          mobileCards={false}
          maxRows={roadmapRows.length + 2}
          columns={roadmapColumns}
          data={roadmapRows}
        />
      </div>
    </div>
  );
}
