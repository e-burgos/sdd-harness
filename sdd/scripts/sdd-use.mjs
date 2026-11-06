#!/usr/bin/env node
// Binds the current session to an open unit of work: pnpm sdd:use <spec-id|slug> <cycle-XX> | <FIX-id> [--json]
// It does not write the session registry (a script has no session id): it validates the unit and
// prints the SDD-BIND marker line, which the Claude Code mod and the Studio bridge pick up.
// Exits 0 when the unit is open, 1 when it is not, 2 on usage errors.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { formatBindMarker, openUnitsOf, unitKey } from './lib/session-registry.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = resolve(__dirname, '..');
const REPO = resolve(SDD, '..');
const OPEN_FIX = new Set(['pending', 'in-progress']);

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h') || positional.length === 0) {
  console.log(`Usage: pnpm sdd:use <spec-id|slug> <cycle-XX> [--json]
       pnpm sdd:use <FIX-id> [--json]

  Binds this session to an open cycle (status in-progress) or an open fix (pending | in-progress).
  Prints the SDD-BIND marker line that the Claude Code mod and the Studio bridge read.
  --json      → structured output for agents

Exits 0 if the unit is open, 1 if it is not, 2 on a usage error.`);
  process.exit(positional.length === 0 && !args.includes('--help') && !args.includes('-h') ? 2 : 0);
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function openCycles() {
  const index = loadJson(join(SDD, 'specs', 'index.json'));
  const out = [];
  for (const spec of index?.specs ?? []) {
    if (spec.status === 'completed' || spec.status === 'cancelled') continue;
    const dir = join(REPO, spec.folder, 'cycles');
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir).filter((d) => /^cycle-\d{2}$/.test(d)).sort()) {
      if (loadJson(join(dir, id, 'cycle.json'))?.status === 'in-progress') out.push({ spec: spec.id, cycle: id });
    }
  }
  return out;
}

function openFixes() {
  const fixes = loadJson(join(SDD, 'fixes.json'));
  return (fixes?.fixes ?? []).filter((f) => OPEN_FIX.has(f.status));
}

const cycles = openCycles();
const fixes = openFixes();
const open = openUnitsOf(cycles, fixes);
const specIds = (loadJson(join(SDD, 'specs', 'index.json'))?.specs ?? []).map((s) => s.id);

function fail(reason, code = 1) {
  const list = open.map((unit) => `pnpm sdd:use ${unit.kind === 'fix' ? unit.fix : `${unit.spec} ${unit.cycle}`}`);
  if (json) console.log(JSON.stringify({ ok: false, error: reason, open: open.map(unitKey), commands: list }, null, 2));
  else {
    console.error(`[sdd:use] ✗ ${reason}`);
    console.error(list.length ? `  Open units:\n${list.map((l) => `    ${l}`).join('\n')}` : '  There is no open cycle or fix.');
  }
  process.exit(code);
}

function resolveSpecId(query) {
  if (specIds.includes(query)) return query;
  const matches = specIds.filter((id) => id.endsWith(`-${query}`) || id.includes(query));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) fail(`"${query}" is ambiguous: ${matches.join(', ')}`, 2);
  return fail(`spec "${query}" is not in sdd/specs/index.json`, 2);
}

function normalizeCycle(raw) {
  const m = /^(?:cycle-)?(\d{1,2})$/.exec(raw ?? '');
  if (!m) fail(`invalid cycle "${raw}" — use cycle-XX`, 2);
  return `cycle-${m[1].padStart(2, '0')}`;
}

let unit;
if (/^FIX-/i.test(positional[0])) {
  const found = fixes.find((f) => f.id === positional[0]);
  if (!found) {
    const known = (loadJson(join(SDD, 'fixes.json'))?.fixes ?? []).find((f) => f.id === positional[0]);
    fail(known ? `${positional[0]} is ${known.status}, not open (pending | in-progress)` : `${positional[0]} is not in sdd/fixes.json`);
  }
  unit = { kind: 'fix', fix: found.id };
} else {
  if (positional.length < 2) fail('a spec needs its cycle: pnpm sdd:use <spec> <cycle-XX>', 2);
  const spec = resolveSpecId(positional[0]);
  const cycle = normalizeCycle(positional[1]);
  if (!cycles.some((c) => c.spec === spec && c.cycle === cycle)) fail(`${spec} ${cycle} is not an open cycle (status in-progress)`);
  unit = { kind: 'cycle', spec, cycle };
}

const marker = formatBindMarker(unit);
if (json) console.log(JSON.stringify({ ok: true, unit, marker }, null, 2));
else console.log(`Session bound to ${unitKey(unit)}\n${marker}`);
