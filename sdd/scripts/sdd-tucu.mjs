#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  renameSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  linkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_TARGETS, containerState, planRemove, planUpsert, readMcpConfig, writeMcpConfig } from './mcp-config.mjs';
import {
  TUCU_UI_INSTALL_DIR,
  TUCU_UI_LINK_DIRS,
  TUCU_UI_MIN_NODE_MAJOR,
  TUCU_UI_PACKAGE,
  TUCU_UI_PINNED_VERSION,
  TUCU_UI_REPAIR_COMMAND,
  TUCU_UI_REQUIRED_SKILL_FILES,
  TUCU_UI_SERVER_NAME,
  TUCU_UI_SKILL_NAME,
  desiredTucuEntry,
  installDirPath,
  isKitTucuEntry,
  isSkillInstallComplete,
  kitLinkPath,
  kitLinkState,
  nodeMeetsMinimum,
  readToolsDocument,
  toolsFilePath,
  tucuUiSettings,
  tucuUiStatus,
} from './tucu-ui-common.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS_SOURCE = join(ROOT, 'sdd', 'skills');
const PARTS = ['skill', 'mcp'];
const NETWORK_ERRORS = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ENETUNREACH/;
const INSTALL_TIMEOUT_MS = 180000;
const IS_WINDOWS = process.platform === 'win32';

const USAGE = `Usage: node sdd/scripts/sdd-tucu.mjs [mode]

  (no args) | --status   JSON with the integration state (read-only, no network)
  --enable [--parts=skill,mcp] [--force]
                         install the skill, link it for every harness and add the MCP entry
  --disable [--purge]    unlink the skill and remove the MCP entry (--purge also deletes the installed skill)
`;

class StepError extends Error {}

const log = (line) => process.stdout.write(`${line}\n`);
const warnLine = (line) => log(`⚠ ${line}`);

function usageError(message) {
  process.stderr.write(`✗ ${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { modes: [], parts: null, purge: false, force: false };
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--status' || arg === '--enable' || arg === '--disable' || arg === '--sync') {
      options.modes.push(arg.slice(2));
    } else if (arg === '--purge') options.purge = true;
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--parts=')) {
      const parts = arg.slice('--parts='.length).split(',').filter(Boolean);
      if (parts.length === 0 || parts.some((part) => !PARTS.includes(part))) {
        usageError(`--parts must be a comma list of ${PARTS.join(', ')} (got "${arg.slice('--parts='.length)}")`);
      }
      options.parts = new Set(parts);
    } else usageError(`unknown argument "${arg}"`);
  }
  if (new Set(options.modes).size > 1) usageError(`${options.modes.map((m) => `--${m}`).join(' and ')} cannot be combined`);
  options.mode = options.modes[0] ?? 'status';
  if (options.purge && options.mode !== 'disable') usageError('--purge only applies to --disable');
  if (options.force && options.mode !== 'enable') usageError('--force only applies to --enable');
  if (options.parts && options.mode !== 'enable') usageError('--parts only applies to --enable');
  return options;
}

function readTools() {
  const document = readToolsDocument(ROOT);
  if (document.state === 'broken') {
    throw new StepError('sdd/tools.json is not valid JSON — fix it and re-run pnpm sdd:tucu');
  }
  const doc =
    document.state === 'ok'
      ? document.doc
      : { $schema: './schemas/tools.schema.json', rtk: { enabled: true, auto_install: true } };
  return { exists: document.state === 'ok', doc };
}

function writeTools(doc) {
  writeFileSync(toolsFilePath(ROOT), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function runNpx(args) {
  const stub = process.env.SDD_TUCU_NPX;
  const options = { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: INSTALL_TIMEOUT_MS };
  if (stub) return spawnSync(process.execPath, [stub, ...args], options);
  if (IS_WINDOWS) return spawnSync(windowsCommandLine('npx', args), { ...options, shell: true });
  return spawnSync('npx', args, options);
}

function windowsCommandLine(command, args) {
  const quoted = args.map((arg) => (/[\s&|<>^()%!"]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg));
  return [command, ...quoted].join(' ');
}

const lastLines = (text, count) => text.trim().split(/\r?\n/).slice(-count).join('\n');

function locateInstalledSkill(staging) {
  for (const candidate of [staging, join(staging, TUCU_UI_SKILL_NAME)]) {
    if (existsSync(join(candidate, 'SKILL.md'))) return candidate;
  }
  return null;
}

function missingSkillFiles(dir) {
  return TUCU_UI_REQUIRED_SKILL_FILES.filter((file) => !existsSync(join(dir, ...file.split('/'))));
}

function installSkill(version) {
  const target = installDirPath(ROOT);
  const parent = dirname(target);
  const staging = join(parent, `.${TUCU_UI_SKILL_NAME}.staging-${process.pid}`);
  const previous = join(parent, `.${TUCU_UI_SKILL_NAME}.old-${process.pid}`);
  const spec = `${TUCU_UI_PACKAGE}@${version}`;
  const retry = `sdd/tools.json unchanged; retry with network: ${TUCU_UI_REPAIR_COMMAND}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  try {
    const result = runNpx(['--yes', '-p', spec, 'tucu-ui-skill', 'install', '--dir', staging, '--force']);
    const stderr = `${result.stderr ?? ''}`;
    if (result.error?.code === 'ENOENT') {
      throw new StepError(`npx was not found — install Node.js ${TUCU_UI_MIN_NODE_MAJOR}+ and re-run ${TUCU_UI_REPAIR_COMMAND}`);
    }
    if (result.error?.code === 'ETIMEDOUT' || (result.status !== 0 && NETWORK_ERRORS.test(stderr))) {
      throw new StepError(`could not download ${spec} (no network?) — ${retry}`);
    }
    if (result.status !== 0) {
      throw new StepError(`npx failed installing ${spec}:\n${lastLines(stderr, 20)}\n${retry}`);
    }
    const source = locateInstalledSkill(staging);
    const missing = source ? missingSkillFiles(source) : TUCU_UI_REQUIRED_SKILL_FILES;
    if (!source || missing.length > 0) {
      throw new StepError(`${spec} did not produce the expected skill (missing: ${missing.join(', ')}) — sdd/tools.json unchanged`);
    }
    const hadPrevious = existsSync(target);
    if (hadPrevious) renameSync(target, previous);
    try {
      renameSync(source, target);
    } catch (error) {
      if (hadPrevious) renameSync(previous, target);
      throw error;
    }
    rmSync(previous, { recursive: true, force: true });
  } finally {
    rmSync(staging, { recursive: true, force: true });
    removeEmptyParents(target);
  }
  log(`skill: installed ${spec} → ${TUCU_UI_INSTALL_DIR}`);
}

function removeSymlinkEntry(path) {
  try {
    unlinkSync(path);
  } catch {
    rmdirSync(path);
  }
}

function createItemLink(linkPath, absoluteSource, relativeTarget) {
  if (IS_WINDOWS) {
    if (statSync(absoluteSource).isDirectory()) symlinkSync(absoluteSource, linkPath, 'junction');
    else linkSync(absoluteSource, linkPath);
    return;
  }
  symlinkSync(relativeTarget, linkPath);
}

function convertSkillsDirectory(dirPath, includePlugins) {
  const entry = (() => {
    try {
      return lstatSync(dirPath);
    } catch {
      return null;
    }
  })();
  if (entry?.isSymbolicLink()) removeSymlinkEntry(dirPath);
  mkdirSync(dirPath, { recursive: true });
  let count = 0;
  for (const name of readdirSync(SKILLS_SOURCE).sort()) {
    if (name.startsWith('.') || name.endsWith('.new')) continue;
    const source = join(SKILLS_SOURCE, name);
    if (!includePlugins && existsSync(join(source, '.claude-plugin'))) continue;
    const linkPath = join(dirPath, name);
    try {
      lstatSync(linkPath);
      continue;
    } catch {
      createItemLink(linkPath, source, `../../sdd/skills/${name}`);
      count++;
    }
  }
  return count;
}

function prepareLinkParent(linkDir) {
  const parent = join(ROOT, ...linkDir.split('/'));
  let entry = null;
  try {
    entry = lstatSync(parent);
  } catch {
    entry = null;
  }
  if (entry === null) {
    if (linkDir === '.claude/skills') {
      const count = convertSkillsDirectory(parent, true);
      log(`created  dir     : ${linkDir} (${count} kit links)`);
      return { ok: true, changed: true };
    }
    mkdirSync(parent, { recursive: true });
    return { ok: true, changed: false };
  }
  if (!entry.isSymbolicLink()) return { ok: true, changed: false };
  let resolved = null;
  try {
    resolved = realpathSync(parent);
  } catch {
    resolved = null;
  }
  const skills = existsSync(SKILLS_SOURCE) ? realpathSync(SKILLS_SOURCE) : null;
  if (resolved !== null && skills !== null && resolved === skills) {
    const count = convertSkillsDirectory(parent, linkDir === '.claude/skills');
    log(`converted dir    : ${linkDir} (symlink to sdd/skills → real directory with ${count} kit links)`);
    return { ok: true, changed: true };
  }
  warnLine(`${linkDir} is a link that does not point at sdd/skills — tucu-ui-design not linked there`);
  return { ok: false, changed: false };
}

function createKitLink(linkDir) {
  const label = `${linkDir}/${TUCU_UI_SKILL_NAME}`;
  const state = kitLinkState(ROOT, linkDir);
  if (state === 'foreign') {
    warnLine(`${label} is not the kit's link (kept as is)`);
    return 'foreign';
  }
  if (state === 'kit') {
    log(`kept     symlink : ${label} (already points at the kit)`);
    return 'kept';
  }
  const parent = prepareLinkParent(linkDir);
  if (!parent.ok) return 'skipped';
  const link = kitLinkPath(ROOT, linkDir);
  if (state === 'kit-dangling') removeSymlinkEntry(link);
  if (IS_WINDOWS) symlinkSync(installDirPath(ROOT), link, 'junction');
  else symlinkSync(`../../${TUCU_UI_INSTALL_DIR}`, link);
  log(`created  symlink : ${label}`);
  return 'created';
}

function removeKitLink(linkDir) {
  const label = `${linkDir}/${TUCU_UI_SKILL_NAME}`;
  const state = kitLinkState(ROOT, linkDir);
  if (state === 'foreign') {
    warnLine(`${label} is not the kit's link (kept as is)`);
    return 'foreign';
  }
  if (state === 'absent') return 'absent';
  removeSymlinkEntry(kitLinkPath(ROOT, linkDir));
  log(`removed  symlink : ${label}`);
  return 'removed';
}

function removeEmptyParents(path) {
  const stop = join(ROOT, 'sdd');
  let dir = dirname(path);
  while (dir.startsWith(stop) && dir !== stop && existsSync(dir) && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    dir = dirname(dir);
  }
}

function claudeLocalOverride(action, version, announce = true) {
  const stub = process.env.SDD_TUCU_CLAUDE;
  if (!IS_WINDOWS && !stub) return;
  const args =
    action === 'add'
      ? ['mcp', 'add', '--scope', 'local', TUCU_UI_SERVER_NAME, '--', 'cmd', '/c', 'npx', '-y', `${TUCU_UI_PACKAGE}@${version}`]
      : ['mcp', 'remove', '--scope', 'local', TUCU_UI_SERVER_NAME];
  const options = { stdio: 'pipe', encoding: 'utf8', timeout: 30000 };
  const result = stub
    ? spawnSync(process.execPath, [stub, ...args], options)
    : spawnSync(windowsCommandLine('claude', args), { ...options, shell: true });
  if (result.status === 0) {
    if (announce) log(`claude: local MCP override ${action === 'add' ? 'set' : 'removed'} (Windows needs the cmd /c wrapper for npx)`);
    return true;
  }
  if (action === 'add') warnLine(`could not add the Claude Code local override — run: claude ${args.join(' ')}`);
  return false;
}

function mcpPreflight() {
  const problems = [];
  for (const target of MCP_TARGETS) {
    const config = readMcpConfig(join(ROOT, ...target.file.split('/')));
    if (config.state === 'broken') {
      problems.push(`${target.file} is not valid JSON (${config.reason}) — fix it and re-run ${TUCU_UI_REPAIR_COMMAND}`);
    } else if (config.state === 'ok' && containerState(config.doc, target.container) === 'invalid') {
      problems.push(`${target.file} has a "${target.container}" that is not an object — fix it and re-run ${TUCU_UI_REPAIR_COMMAND}`);
    }
  }
  return problems;
}

function applyMcp(parts, version) {
  const outcomes = {};
  for (const target of MCP_TARGETS) {
    const file = join(ROOT, ...target.file.split('/'));
    const config = readMcpConfig(file);
    if (config.state === 'broken') {
      warnLine(`${target.file} is not valid JSON — left as is; it may still contain a ${TUCU_UI_SERVER_NAME} entry`);
      outcomes[target.file] = 'broken';
      continue;
    }
    const doc = config.state === 'ok' ? config.doc : {};
    if (parts.mcp) {
      const existing = containerState(doc, target.container) === 'ok' ? doc[target.container][TUCU_UI_SERVER_NAME] : undefined;
      const entry = desiredTucuEntry(existing, version, target.file);
      const plan = planUpsert(doc, target.container, TUCU_UI_SERVER_NAME, entry, isKitTucuEntry);
      outcomes[target.file] = plan.outcome;
      if (plan.outcome === 'created' || plan.outcome === 'updated') writeMcpConfig(file, plan.doc);
      if (plan.outcome === 'custom') warnLine(`${target.file} has your own ${TUCU_UI_SERVER_NAME} entry — kept as is`);
    } else {
      if (config.state !== 'ok') {
        outcomes[target.file] = 'absent';
        continue;
      }
      const plan = planRemove(doc, target.container, TUCU_UI_SERVER_NAME, isKitTucuEntry);
      outcomes[target.file] = plan.outcome;
      if (plan.outcome === 'removed') writeMcpConfig(file, plan.doc);
      if (plan.outcome === 'custom') warnLine(`${target.file} has your own ${TUCU_UI_SERVER_NAME} entry — kept as is`);
    }
  }
  return outcomes;
}

function enable(options) {
  const { doc: tools } = readTools();
  const current = tucuUiSettings(tools);
  const parts = options.parts
    ? { skill: options.parts.has('skill'), mcp: options.parts.has('mcp') }
    : { skill: current.skill, mcp: current.mcp };
  const version = options.force || !current.versionDeclared ? TUCU_UI_PINNED_VERSION : current.version;
  const spec = `${TUCU_UI_PACKAGE}@${version}`;

  const nodeVersion = process.env.SDD_TUCU_NODE_VERSION ?? process.versions.node;
  if (!nodeMeetsMinimum(nodeVersion)) {
    throw new StepError(`${spec} needs Node >= ${TUCU_UI_MIN_NODE_MAJOR} (found ${nodeVersion})`);
  }
  if (parts.mcp) {
    const problems = mcpPreflight();
    if (problems.length > 0) throw new StepError(`nothing was changed:\n  ${problems.join('\n  ')}`);
  }

  let changed = false;
  if (parts.skill && (options.force || !isSkillInstallComplete(ROOT))) {
    installSkill(version);
    changed = true;
  }

  const linkOutcomes = {};
  for (const { dir } of TUCU_UI_LINK_DIRS) {
    linkOutcomes[dir] = parts.skill ? createKitLink(dir) : removeKitLink(dir);
    if (linkOutcomes[dir] === 'created' || linkOutcomes[dir] === 'removed') changed = true;
  }

  const mcpOutcomes = applyMcp(parts, version);
  if (Object.values(mcpOutcomes).some((o) => o === 'created' || o === 'updated' || o === 'removed')) changed = true;
  const kitOwnsClaudeEntry = ['created', 'updated', 'unchanged'].includes(mcpOutcomes['.mcp.json']);
  if (parts.mcp && kitOwnsClaudeEntry) {
    claudeLocalOverride('remove', version, false);
    claudeLocalOverride('add', version, mcpOutcomes['.mcp.json'] !== 'unchanged' || options.force);
  } else if (!parts.mcp) {
    claudeLocalOverride('remove', version, false);
  }

  const actual = tools.tucu_ui !== null && typeof tools.tucu_ui === 'object' ? tools.tucu_ui : {};
  const patch = { enabled: true, skill: parts.skill, mcp: parts.mcp, version };
  const next = { ...tools, tucu_ui: { enabled: true, skill: true, mcp: true, ...actual, ...patch } };
  const toolsExists = existsSync(toolsFilePath(ROOT));
  if (!toolsExists || !isDeepStrictEqual(next, tools)) {
    writeTools(next);
    changed = true;
  }

  if (!changed) {
    log('tucu_ui: already on and complete');
    return;
  }
  const status = tucuUiStatus(ROOT, next);
  const wording = { created: 'linked', kept: 'linked', foreign: 'foreign link kept', skipped: 'not linked', removed: 'unlinked', absent: 'unlinked' };
  for (const harness of ['claude', 'copilot', 'gemini', 'antigravity']) {
    const linkDir = TUCU_UI_LINK_DIRS.find((l) => l.harnesses.includes(harness)).dir;
    const target = MCP_TARGETS.find((t) => t.harnesses.includes(harness));
    const skillPart = `skill ${wording[linkOutcomes[linkDir]] ?? linkOutcomes[linkDir]}`;
    const mcpOutcome = mcpOutcomes[target.file];
    const mcpPart = `mcp ${target.file} ${mcpOutcome === 'absent' ? 'off' : mcpOutcome === 'custom' ? 'custom kept' : mcpOutcome}`;
    log(`${harness}: ${skillPart} · ${mcpPart}`);
  }
  log(`tucu_ui: on · ${spec} · ${TUCU_UI_INSTALL_DIR} (${status.state})`);
}

function disable(options) {
  const { exists, doc: tools } = readTools();
  const settings = tucuUiSettings(tools);
  let changed = false;

  for (const { dir } of TUCU_UI_LINK_DIRS) {
    if (removeKitLink(dir) === 'removed') changed = true;
  }

  const outcomes = applyMcp({ skill: false, mcp: false }, settings.version);
  for (const [file, outcome] of Object.entries(outcomes)) {
    if (outcome === 'removed') {
      log(`removed  mcp     : ${file} (${TUCU_UI_SERVER_NAME})`);
      changed = true;
    }
  }
  if (settings.enabled || changed) claudeLocalOverride('remove', settings.version, false);

  if (options.purge && existsSync(installDirPath(ROOT))) {
    rmSync(installDirPath(ROOT), { recursive: true, force: true });
    removeEmptyParents(installDirPath(ROOT));
    log(`removed  dir     : ${TUCU_UI_INSTALL_DIR}`);
    changed = true;
  }

  if (exists && settings.enabled) {
    writeTools({ ...tools, tucu_ui: { ...tools.tucu_ui, enabled: false } });
    changed = true;
  }

  log(changed ? 'tucu_ui: off (sdd/tools.json)' : 'tucu_ui: already off');
}

function sync() {
  const document = readToolsDocument(ROOT);
  const settings = tucuUiSettings(document.state === 'ok' ? document.doc : null);
  const wanted = settings.enabled && settings.skill && isSkillInstallComplete(ROOT);
  for (const { dir } of TUCU_UI_LINK_DIRS) {
    if (wanted) createKitLink(dir);
    else removeKitLink(dir);
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  try {
    if (options.mode === 'sync') return sync();
    if (options.mode === 'enable') return enable(options);
    if (options.mode === 'disable') return disable(options);
    const { doc } = readTools();
    log(JSON.stringify(tucuUiStatus(ROOT, doc), null, 2));
  } catch (error) {
    if (options.mode === 'sync') {
      warnLine(`tucu-ui sync skipped: ${error.message}`);
      return;
    }
    process.stderr.write(`✗ ${error.message}\n`);
    process.exit(1);
  }
}

main();
