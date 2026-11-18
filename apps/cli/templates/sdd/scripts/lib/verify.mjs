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

const WINDOWS_UNSAFE_FILE_CHARS = /["%^&|<>!]/;

export const fileArgument = (file) => (file.startsWith('-') ? `./${file}` : file);

export const unsafeFileName = (files, platform = process.platform) =>
  platform === 'win32' ? (files ?? []).find((file) => WINDOWS_UNSAFE_FILE_CHARS.test(file)) ?? null : null;

export function expandFiles(command, files, platform = process.platform) {
  if (!hasFilesPlaceholder(command)) return command;
  if (!files || files.length === 0) return null;
  const joined = files.map((file) => shellQuote(fileArgument(file), platform)).join(' ');
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
  return {
    cycle: null,
    reason: matching.length === 0 ? 'none' : 'ambiguous',
    candidates: matching.map((candidate) => `${candidate.spec}/${candidate.cycle}`),
  };
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

export const appDirName = (app) => app.replace(/\//g, '-');

export const allSkipped = (commands) => commands.length > 0 && commands.every((command) => command.skipped);

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

const sameCommands = (stored, expected) =>
  Array.isArray(stored) &&
  stored.length === expected.length &&
  stored.every((entry, index) => entry && entry.skipped !== true && entry.command === expected[index]);

export function canReuse(previous, { app, changedSincePrevious, dirtyNow, prefix, commands }) {
  if (!previous || previous.ok !== true || previous.level !== 'full') return false;
  if (previous.app !== app || !previous.commit) return false;
  if (!sameCommands(previous.commands, commands ?? [])) return false;
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

export const INFERRED_SCRIPTS = ['lint', 'typecheck', 'test', 'build'];

export const isStandaloneTool = (tool) => String(tool ?? '').startsWith('none (standalone');

const bucketOf = (id) => id.slice(0, id.indexOf('/'));

function nxEntry(name) {
  return {
    quick: [nxCommand(['lint', 'test'], name)],
    full: [nxCommand(['lint', 'test', 'build'], name)],
    full_exclusive: true,
  };
}

function scriptSourceOf({ hasDir, packageJson, rootPackageJson, standalone, id }) {
  if (hasDir) return packageJson;
  return standalone && bucketOf(id) === 'apps' ? rootPackageJson : null;
}

export function inferEntry({ id, name, nx, hasProjectJson, packageJson, rootPackageJson, hasDir, standalone }) {
  if (nx) return hasProjectJson || packageJson ? nxEntry(name) : null;
  const source = scriptSourceOf({ hasDir, packageJson, rootPackageJson, standalone, id });
  if (!source?.scripts) return null;
  const run = hasDir && source.name ? (script) => `pnpm --filter ${source.name} run ${script}` : (script) => `pnpm run ${script}`;
  const quick = scriptCommands(source.scripts, ['lint', 'typecheck', 'test'], run);
  const full = scriptCommands(source.scripts, INFERRED_SCRIPTS, run);
  const entry = {};
  if (quick.length) entry.quick = quick;
  if (full.length) entry.full = full;
  return entry.quick || entry.full ? entry : null;
}

export function whyNoEntry({ id, nx, hasProjectJson, packageJson, hasDir, standalone }) {
  const again = 'run pnpm sdd:verify --init again once it has code';
  if (nx) return `not an nx project yet (no project.json or package.json) — ${again}`;
  if (!hasDir && !(standalone && bucketOf(id) === 'apps')) {
    return standalone ? `no directory of its own in a standalone repo — ${again}` : `no directory yet — ${again}`;
  }
  if (hasDir && !packageJson) return `no package.json in its directory — ${again}`;
  return `no ${INFERRED_SCRIPTS.slice(0, -1).join(', ')} or build script in its package.json — add one and ${again}`;
}

export function descendantsOf(pid, listChildren) {
  const found = [];
  for (const child of listChildren(pid)) found.push(...descendantsOf(child, listChildren), child);
  return found;
}
