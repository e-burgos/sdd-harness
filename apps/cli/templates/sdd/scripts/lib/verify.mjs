export const LEVELS = ['quick', 'full'];
export const APP_ID_RE = /^(apps|libs|tools)\/[a-z][a-z0-9-]*$/;
export const UNIT_RE = /^(TASK-\d{3}|B-\d{2})$/;
export const TAIL_LINES = 40;
const META_KEYS = new Set(['$schema', '_description']);

export const appIdsOf = (config) => Object.keys(config ?? {}).filter((key) => !META_KEYS.has(key));

export function resolveEntryId(config, query) {
  const ids = appIdsOf(config);
  if (ids.includes(query)) return { id: query };
  const byName = ids.filter((id) => id.slice(id.indexOf('/') + 1) === query);
  if (byName.length === 1) return { id: byName[0] };
  if (byName.length > 1) return { error: 'ambiguous', candidates: byName };
  return { error: 'missing', candidates: ids };
}

export function logicalIdsOf(globalJson) {
  const monorepo = globalJson?.monorepo ?? {};
  return ['apps', 'libs', 'tools'].flatMap((bucket) =>
    Object.keys(monorepo[bucket] ?? {}).map((name) => `${bucket}/${name}`),
  );
}

export function shellQuote(value, platform = process.platform) {
  if (platform === 'win32') return `"${value.replace(/"/g, '\\"')}"`;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export const hasFilesPlaceholder = (command) => command.includes('{files}');

export function expandFiles(command, files, platform = process.platform) {
  if (!hasFilesPlaceholder(command)) return command;
  if (!files || files.length === 0) return null;
  const joined = files.map((file) => shellQuote(file, platform)).join(' ');
  return command.split('{files}').join(joined);
}

export function parseFilesOption(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCycleId(raw) {
  const match = /^(?:cycle-)?(\d{1,2})$/.exec(String(raw ?? ''));
  return match ? `cycle-${match[1].padStart(2, '0')}` : null;
}

export function specMatches(specId, query) {
  return specId === query || specId.endsWith(`-${query}`) || specId.includes(query);
}

export function selectCycle(candidates, { app, spec, cycle }) {
  const explicit = Boolean(spec || cycle);
  const matching = candidates.filter((candidate) => {
    if (spec && !specMatches(candidate.spec, spec)) return false;
    if (cycle && candidate.cycle !== cycle) return false;
    if (explicit) return true;
    return candidate.status === 'in-progress' && (candidate.apps ?? []).includes(app);
  });
  if (matching.length === 1) return { cycle: matching[0] };
  return { cycle: null, reason: matching.length === 0 ? 'none' : 'ambiguous' };
}

export const isSddPath = (path, prefix = 'sdd/') => path.replace(/\\/g, '/').startsWith(prefix);

export function parseStatusZ(output) {
  const entries = output.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (status.includes('R') || status.includes('C')) index += 1;
  }
  return paths;
}

export const nonSddPaths = (paths, prefix) => paths.filter((path) => !isSddPath(path, prefix));

export const resultFileName = (unit, level) => `${unit ?? 'cycle'}-${level}.json`;

export function buildResult({ app, level, unit, commit, dirty, startedAt, durationMs, commands }) {
  return {
    app,
    level,
    unit: unit ?? 'cycle',
    ok: commands.every((command) => command.skipped || command.exit_code === 0),
    commit,
    dirty,
    started_at: startedAt,
    duration_ms: durationMs,
    commands,
  };
}

export function canReuse(previous, { app, changedSincePrevious, dirtyNow, prefix }) {
  if (!previous || previous.ok !== true || previous.level !== 'full') return false;
  if (previous.app !== app || !previous.commit) return false;
  if ((previous.dirty ?? []).length > 0) return false;
  if (changedSincePrevious === null || changedSincePrevious === undefined) return false;
  return nonSddPaths(changedSincePrevious, prefix).length === 0 && nonSddPaths(dirtyNow, prefix).length === 0;
}

export function pickReusableCandidates(results, app) {
  return results
    .filter((result) => result && result.app === app && result.level === 'full' && result.ok === true)
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
}

export function tailOf(text, lines = TAIL_LINES) {
  const all = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  return all.slice(-lines).join('\n');
}

export function formatDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function commandLine(command) {
  const mark = command.skipped ? '–' : command.exit_code === 0 ? '✔' : '✘';
  const suffix = command.skipped ? 'skipped (needs --files)' : formatDuration(command.duration_ms);
  return `${mark} ${command.command} (${suffix})`;
}

function nxCommand(targets, name) {
  return `pnpm nx run-many -t ${targets.join(' ')} -p ${name}`;
}

function scriptCommands(scripts, wanted, runner) {
  return wanted.filter((script) => script in scripts).map((script) => runner(script));
}

export function inferEntry({ name, nx, projectTargets, packageJson, rootPackageJson, hasDir }) {
  if (nx) {
    const targets = projectTargets ?? ['lint', 'test', 'build'];
    const quick = ['lint', 'test'].filter((target) => targets.includes(target));
    const full = ['lint', 'test', 'build'].filter((target) => targets.includes(target));
    const entry = {};
    if (quick.length) entry.quick = [nxCommand(quick, name)];
    if (full.length) entry.full = [nxCommand(full, name)];
    if (!entry.quick && !entry.full) return null;
    entry.full_exclusive = true;
    return entry;
  }
  const source = hasDir ? packageJson : rootPackageJson;
  if (!source?.scripts) return null;
  const run = hasDir && source.name ? (script) => `pnpm --filter ${source.name} run ${script}` : (script) => `pnpm run ${script}`;
  const quick = scriptCommands(source.scripts, ['lint', 'typecheck', 'test'], run);
  const full = scriptCommands(source.scripts, ['lint', 'typecheck', 'test', 'build'], run);
  const entry = {};
  if (quick.length) entry.quick = quick;
  if (full.length) entry.full = full;
  return entry.quick || entry.full ? entry : null;
}
