#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerState, planRemove, planUpsert, readMcpConfig, writeMcpConfig } from './mcp-config.mjs';
import { toolsFilePath } from './tucu-ui-common.mjs';
import {
  VIDEO_MAKER_MCP_TARGETS,
  VIDEO_MAKER_MIN_NODE_MAJOR,
  VIDEO_MAKER_PACKAGE,
  VIDEO_MAKER_PINNED_VERSION,
  VIDEO_MAKER_PLUGIN_ID,
  VIDEO_MAKER_REPAIR_COMMAND,
  VIDEO_MAKER_SERVER_NAME,
  VIDEO_MAKER_SETTINGS_FILE,
  desiredVideoMakerEntry,
  isKitVideoMakerEntry,
  nodeMeetsMinimum,
  planPluginRemove,
  planPluginUpsert,
  readToolsDocument,
  videoMakerSettings,
  videoMakerStatus,
} from './video-maker-common.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PARTS = ['plugin', 'mcp'];

const USAGE = `Usage: node sdd/scripts/sdd-video.mjs [mode]

  (no args) | --status   JSON with the integration state (read-only, no network)
  --enable [--parts=plugin,mcp] [--force]
                         declare the Claude Code plugin and add the MCP entry for Copilot and Gemini/Antigravity
  --disable              remove what the kit added (your own entries are kept)
`;

class StepError extends Error {}

const log = (line) => process.stdout.write(`${line}\n`);
const warnLine = (line) => log(`⚠ ${line}`);

function usageError(message) {
  process.stderr.write(`✗ ${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { modes: [], parts: null, force: false };
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--status' || arg === '--enable' || arg === '--disable') {
      options.modes.push(arg.slice(2));
    } else if (arg === '--force') options.force = true;
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
  if (options.force && options.mode !== 'enable') usageError('--force only applies to --enable');
  if (options.parts && options.mode !== 'enable') usageError('--parts only applies to --enable');
  return options;
}

function readTools() {
  const document = readToolsDocument(ROOT);
  if (document.state === 'broken') {
    throw new StepError('sdd/tools.json is not valid JSON — fix it and re-run pnpm sdd:video');
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

const absolute = (file) => join(ROOT, ...file.split('/'));

function preflight(parts) {
  const problems = [];
  if (parts.mcp) {
    for (const target of VIDEO_MAKER_MCP_TARGETS) {
      const config = readMcpConfig(absolute(target.file));
      if (config.state === 'broken') {
        problems.push(`${target.file} is not valid JSON (${config.reason}) — fix it and re-run ${VIDEO_MAKER_REPAIR_COMMAND}`);
      } else if (config.state === 'ok' && containerState(config.doc, target.container) === 'invalid') {
        problems.push(`${target.file} has a "${target.container}" that is not an object — fix it and re-run ${VIDEO_MAKER_REPAIR_COMMAND}`);
      }
    }
  }
  if (parts.plugin) {
    const config = readMcpConfig(absolute(VIDEO_MAKER_SETTINGS_FILE));
    if (config.state === 'broken') {
      problems.push(`${VIDEO_MAKER_SETTINGS_FILE} is not valid JSON (${config.reason}) — fix it and re-run ${VIDEO_MAKER_REPAIR_COMMAND}`);
    } else if (config.state === 'ok' && planPluginUpsert(config.doc).outcome === 'invalid-container') {
      problems.push(`${VIDEO_MAKER_SETTINGS_FILE} has an "extraKnownMarketplaces" or "enabledPlugins" that is not an object — fix it and re-run ${VIDEO_MAKER_REPAIR_COMMAND}`);
    }
  }
  return problems;
}

function applyMcp(wanted, version) {
  const outcomes = {};
  for (const target of VIDEO_MAKER_MCP_TARGETS) {
    const file = absolute(target.file);
    const config = readMcpConfig(file);
    if (config.state === 'broken') {
      warnLine(`${target.file} is not valid JSON — left as is; it may still contain a ${VIDEO_MAKER_SERVER_NAME} entry`);
      outcomes[target.file] = 'broken';
      continue;
    }
    const doc = config.state === 'ok' ? config.doc : {};
    if (wanted) {
      const existing = containerState(doc, target.container) === 'ok' ? doc[target.container][VIDEO_MAKER_SERVER_NAME] : undefined;
      const entry = desiredVideoMakerEntry(existing, version, target.file);
      const plan = planUpsert(doc, target.container, VIDEO_MAKER_SERVER_NAME, entry, isKitVideoMakerEntry);
      outcomes[target.file] = plan.outcome;
      if (plan.outcome === 'created' || plan.outcome === 'updated') writeMcpConfig(file, plan.doc);
      if (plan.outcome === 'custom') warnLine(`${target.file} has your own ${VIDEO_MAKER_SERVER_NAME} entry — kept as is`);
    } else {
      if (config.state !== 'ok') {
        outcomes[target.file] = 'absent';
        continue;
      }
      const plan = planRemove(doc, target.container, VIDEO_MAKER_SERVER_NAME, isKitVideoMakerEntry);
      outcomes[target.file] = plan.outcome;
      if (plan.outcome === 'removed') writeMcpConfig(file, plan.doc);
      if (plan.outcome === 'custom') warnLine(`${target.file} has your own ${VIDEO_MAKER_SERVER_NAME} entry — kept as is`);
    }
  }
  return outcomes;
}

function applyPlugin(wanted) {
  const file = absolute(VIDEO_MAKER_SETTINGS_FILE);
  const config = readMcpConfig(file);
  if (config.state === 'broken') {
    warnLine(`${VIDEO_MAKER_SETTINGS_FILE} is not valid JSON — left as is`);
    return 'broken';
  }
  if (!wanted && config.state !== 'ok') return 'absent';
  const doc = config.state === 'ok' ? config.doc : {};
  const plan = wanted ? planPluginUpsert(doc) : planPluginRemove(doc);
  if (plan.outcome === 'created' || plan.outcome === 'removed') writeMcpConfig(file, plan.doc);
  if (plan.outcome === 'foreign-marketplace') {
    warnLine(`${VIDEO_MAKER_SETTINGS_FILE} has your own "video-maker" marketplace — kept as is`);
  }
  if (plan.outcome === 'disabled') {
    warnLine(`${VIDEO_MAKER_SETTINGS_FILE} has ${VIDEO_MAKER_PLUGIN_ID} set to false — kept as is`);
  }
  return plan.outcome;
}

const changedOutcome = (outcome) => ['created', 'updated', 'removed'].includes(outcome);

function enable(options) {
  const { doc: tools } = readTools();
  const current = videoMakerSettings(tools);
  const parts = options.parts
    ? { plugin: options.parts.has('plugin'), mcp: options.parts.has('mcp') }
    : { plugin: current.plugin, mcp: current.mcp };
  const version = options.force || !current.versionDeclared ? VIDEO_MAKER_PINNED_VERSION : current.version;
  const spec = `${VIDEO_MAKER_PACKAGE}@${version}`;

  const nodeVersion = process.env.SDD_VIDEO_NODE_VERSION ?? process.versions.node;
  if (!nodeMeetsMinimum(nodeVersion)) {
    warnLine(`${spec} needs Node >= ${VIDEO_MAKER_MIN_NODE_MAJOR} (found ${nodeVersion}) — the MCP server will not start until Node is upgraded`);
  }
  const problems = preflight(parts);
  if (problems.length > 0) throw new StepError(`nothing was changed:\n  ${problems.join('\n  ')}`);

  const pluginOutcome = applyPlugin(parts.plugin);
  const mcpOutcomes = applyMcp(parts.mcp, version);
  let changed = changedOutcome(pluginOutcome) || Object.values(mcpOutcomes).some(changedOutcome);

  const actual = tools.video_maker !== null && typeof tools.video_maker === 'object' ? tools.video_maker : {};
  const patch = { enabled: true, plugin: parts.plugin, mcp: parts.mcp, version };
  const next = { ...tools, video_maker: { enabled: true, plugin: true, mcp: true, ...actual, ...patch } };
  if (!existsSync(toolsFilePath(ROOT)) || !isDeepStrictEqual(next, tools)) {
    writeTools(next);
    changed = true;
  }

  if (!changed) {
    log('video_maker: already on and complete');
    return;
  }
  const status = videoMakerStatus(ROOT, next);
  const word = (outcome) => (outcome === 'absent' ? 'off' : outcome === 'custom' ? 'custom kept' : outcome);
  log(`claude: plugin ${VIDEO_MAKER_PLUGIN_ID} ${word(pluginOutcome)} (${VIDEO_MAKER_SETTINGS_FILE})`);
  for (const harness of ['copilot', 'gemini', 'antigravity']) {
    const target = VIDEO_MAKER_MCP_TARGETS.find((t) => t.harnesses.includes(harness));
    log(`${harness}: mcp ${target.file} ${word(mcpOutcomes[target.file])}`);
  }
  log(`video_maker: on · ${spec} · ${VIDEO_MAKER_PLUGIN_ID} (${status.state})`);
}

function disable() {
  const { exists, doc: tools } = readTools();
  const settings = videoMakerSettings(tools);
  let changed = false;

  const pluginOutcome = applyPlugin(false);
  if (pluginOutcome === 'removed') {
    log(`removed  plugin  : ${VIDEO_MAKER_PLUGIN_ID} (${VIDEO_MAKER_SETTINGS_FILE})`);
    changed = true;
  }

  const outcomes = applyMcp(false, settings.version);
  for (const [file, outcome] of Object.entries(outcomes)) {
    if (outcome === 'removed') {
      log(`removed  mcp     : ${file} (${VIDEO_MAKER_SERVER_NAME})`);
      changed = true;
    }
  }

  if (exists && settings.enabled) {
    writeTools({ ...tools, video_maker: { ...tools.video_maker, enabled: false } });
    changed = true;
  }

  log(changed ? 'video_maker: off (sdd/tools.json)' : 'video_maker: already off');
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  try {
    if (options.mode === 'enable') return enable(options);
    if (options.mode === 'disable') return disable();
    const { doc } = readTools();
    log(JSON.stringify(videoMakerStatus(ROOT, doc), null, 2));
  } catch (error) {
    process.stderr.write(`✗ ${error.message}\n`);
    process.exit(1);
  }
}

main();
