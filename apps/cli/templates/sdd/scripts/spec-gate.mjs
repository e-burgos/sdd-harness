#!/usr/bin/env node
// SPEC GATE as a command: answers the gate deterministically instead of an agent reading
// ten files by hand. Run with: pnpm sdd:gate <spec-id|slug> [cycle-XX] [--json]
//   GATE A (no cycle)  → can a cycle be opened for this spec?
//   GATE B (cycle-XX)  → can implementation start in this cycle? (flow-aware: full/reduced/lite)
// Exits 0 when the gate passes, 1 when blocked, 2 on usage errors.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = resolve(__dirname, '..');
const REPO = resolve(SDD, '..');

const DOCS_BY_FLOW = {
  full: ['brief.yaml', 'functional.md', 'planner.md', 'architect.md'],
  reduced: ['brief.yaml'],
  lite: ['plan.md'],
};

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h') || positional.length === 0) {
  console.log(`Uso: pnpm sdd:gate <spec-id|slug> [cycle-XX] [--json]

  Sin ciclo   → GATE A (apertura): ¿se puede abrir un ciclo de esta spec?
  Con ciclo   → GATE B (implementación): ¿se puede escribir código en ese ciclo?
                (según flow: full → brief/functional/planner/architect · reduced → brief · lite → plan.md)
  --json      → salida estructurada para agentes

Sale con 0 si el gate pasa, 1 si está bloqueado, 2 ante un error de uso.`);
  process.exit(positional.length === 0 && !args.includes('--help') && !args.includes('-h') ? 2 : 0);
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function usageError(message) {
  if (json) console.log(JSON.stringify({ error: message }, null, 2));
  else console.error(`[spec-gate] ✗ ${message}`);
  process.exit(2);
}

const specsIndex = loadJson(join(SDD, 'specs', 'index.json'));
const globalJson = loadJson(join(SDD, 'global.json'));

function resolveSpec(query) {
  const exact = specsIndex.specs.find((s) => s.id === query);
  if (exact) return exact;
  const matches = specsIndex.specs.filter(
    (s) => s.id.endsWith(`-${query}`) || s.id.includes(query),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)
    usageError(`"${query}" es ambiguo: ${matches.map((s) => s.id).join(', ')}`);
  usageError(
    `spec "${query}" no está en sdd/specs/index.json (${specsIndex.specs.length} registradas)`,
  );
}

function normalizeCycle(raw) {
  const m = /^(?:cycle-)?(\d{1,2})$/.exec(raw);
  if (!m) usageError(`ciclo inválido "${raw}" — usar cycle-XX`);
  return `cycle-${m[1].padStart(2, '0')}`;
}

function cyclesOf(spec) {
  const dir = join(REPO, spec.folder, 'cycles');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => /^cycle-\d{2}$/.test(d))
    .sort()
    .map((id) => {
      const file = join(dir, id, 'cycle.json');
      let data = null;
      try {
        data = existsSync(file) ? loadJson(file) : null;
      } catch {
        data = null;
      }
      return { id, dir: join(dir, id), data };
    });
}

function moduleEntry(spec) {
  for (const bucket of ['pending_modules', 'in_progress_modules', 'completed_modules']) {
    const entry = (globalJson[bucket] ?? []).find((m) => m.spec === spec.id);
    if (entry) return { bucket, entry };
  }
  return null;
}

const suggestedFlow = () => (globalJson.profile === 'solo' ? 'lite' : 'full');

function gateA(spec) {
  const checks = [];
  const specFile = join(REPO, spec.file);
  checks.push({
    id: 'A1',
    label: 'Spec registrada en specs/index.json y su archivo existe',
    ok: existsSync(specFile),
    detail: existsSync(specFile) ? spec.file : `falta ${spec.file}`,
  });
  const mod = moduleEntry(spec);
  const modOk = !!mod && mod.bucket !== 'completed_modules';
  checks.push({
    id: 'A2',
    label: 'Módulo en pending_modules o in_progress_modules de global.json',
    ok: modOk,
    detail: mod
      ? `${mod.entry.module} → ${mod.bucket}`
      : 'sin ModuleEntry — harness add spec lo registra; si la spec ya existe, agregarlo a pending_modules',
  });
  const cycles = cyclesOf(spec);
  const open = cycles.filter((c) => c.data?.status === 'in-progress');
  checks.push({
    id: 'A3',
    label: 'Ningún otro ciclo de esta spec está in-progress',
    ok: open.length === 0,
    detail: open.length ? `abierto: ${open.map((c) => c.id).join(', ')} — cerrarlo primero` : 'sin ciclos abiertos',
  });
  const missingDeps = (spec.depends_on ?? []).filter(
    (dep) => specsIndex.specs.find((s) => s.id === dep)?.status !== 'completed',
  );
  checks.push({
    id: 'A4',
    label: 'Dependencias de la spec (depends_on) completadas',
    ok: missingDeps.length === 0,
    detail: missingDeps.length ? `pendientes: ${missingDeps.join(', ')}` : 'sin dependencias pendientes',
  });
  checks.push({
    id: 'A5',
    label: 'La spec no está completed ni cancelled',
    ok: spec.status !== 'completed' && spec.status !== 'cancelled',
    detail: `status: ${spec.status}`,
  });
  const last = cycles.length ? Number(cycles[cycles.length - 1].id.slice(6)) : 0;
  return {
    gate: 'A',
    checks,
    next: {
      cycle: `cycle-${String(last + 1).padStart(2, '0')}`,
      flow: suggestedFlow(),
      profile: globalJson.profile ?? 'team',
    },
  };
}

function gateB(spec, cycleId) {
  const checks = [];
  const cycle = cyclesOf(spec).find((c) => c.id === cycleId);
  const cycleDir = cycle?.dir ?? join(REPO, spec.folder, 'cycles', cycleId);
  const rel = (name) => join(spec.folder, 'cycles', cycleId, name);
  const data = cycle?.data ?? null;
  checks.push({
    id: 'B1',
    label: 'cycle.json existe con status in-progress',
    ok: data?.status === 'in-progress',
    detail: data ? `status: ${data.status}` : `falta ${rel('cycle.json')} — lo crea el orquestador al abrir el ciclo`,
  });
  const mod = moduleEntry(spec);
  checks.push({
    id: 'B2',
    label: 'Módulo en in_progress_modules de global.json',
    ok: mod?.bucket === 'in_progress_modules',
    detail: mod ? `${mod.entry.module} → ${mod.bucket}` : 'sin ModuleEntry en global.json',
  });
  let tasks = null;
  try {
    tasks = existsSync(join(cycleDir, 'tasks.json')) ? loadJson(join(cycleDir, 'tasks.json')) : null;
  } catch {
    tasks = null;
  }
  const taskCount = tasks?.tasks?.length ?? 0;
  checks.push({
    id: 'B3',
    label: 'tasks.json del ciclo con al menos una task',
    ok: taskCount > 0,
    detail: tasks ? `${taskCount} task(s)` : `falta ${rel('tasks.json')}`,
  });
  const flow = data?.flow ?? tasks?.flow ?? 'full';
  const docs = DOCS_BY_FLOW[flow] ?? DOCS_BY_FLOW.full;
  const missingDocs = docs.filter((d) => !existsSync(join(cycleDir, d)));
  checks.push({
    id: 'B4',
    label: `Documentos del ciclo según flow ${flow}: ${docs.join(', ')}`,
    ok: missingDocs.length === 0,
    detail: missingDocs.length ? `faltan: ${missingDocs.join(', ')}` : 'completos',
  });
  const apps = data?.apps ?? mod?.entry.apps ?? [];
  const missingCtx = apps.filter((app) => {
    const [category, name] = app.split('/');
    return !existsSync(join(SDD, 'context', category, name, 'constitution.md'));
  });
  checks.push({
    id: 'B5',
    label: 'constitution.md de cada subproyecto del ciclo',
    ok: apps.length > 0 && missingCtx.length === 0,
    detail:
      apps.length === 0
        ? 'el ciclo no declara apps[]'
        : missingCtx.length
          ? `faltan: ${missingCtx.map((a) => `context/${a}/constitution.md`).join(', ')}`
          : apps.join(', '),
  });
  return { gate: 'B', checks, flow, cycle: cycleId };
}

const spec = resolveSpec(positional[0]);
const cycleId = positional[1] ? normalizeCycle(positional[1]) : null;
const result = cycleId ? gateB(spec, cycleId) : gateA(spec);
const passed = result.checks.every((c) => c.ok);

if (json) {
  console.log(JSON.stringify({ spec: spec.id, passed, ...result }, null, 2));
} else {
  const title =
    result.gate === 'A'
      ? `SPEC GATE A — apertura de ciclo · ${spec.id}`
      : `SPEC GATE B — implementación · ${spec.id} · ${result.cycle} (flow: ${result.flow})`;
  console.log(`\n${title}`);
  for (const c of result.checks) {
    console.log(`  ${c.ok ? '✔' : '✘'} ${c.id}. ${c.label}\n      ${c.detail}`);
  }
  const pending = result.checks.filter((c) => !c.ok).length;
  console.log(
    passed
      ? `\n→ APROBADO${result.gate === 'A' ? ` — próximo ciclo: ${result.next.cycle}, flow sugerido: ${result.next.flow} (profile: ${result.next.profile}; [LITE]/[FULL] en el pedido lo fuerzan)` : ''}`
      : `\n→ BLOQUEADO — ${pending} condición(es) pendiente(s). Completarlas antes de continuar.`,
  );
}
process.exit(passed ? 0 : 1);
