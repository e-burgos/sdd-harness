import { join } from 'node:path';
import { MCP_TARGETS, containerState, readMcpConfig } from './mcp-config.mjs';
import { compareVersions, readToolsDocument } from './tucu-ui-common.mjs';

export { compareVersions, readToolsDocument };

export const VIDEO_MAKER_PACKAGE = '@e-burgos/video-maker-mcp';
export const VIDEO_MAKER_PINNED_VERSION = '0.1.0';
export const VIDEO_MAKER_SERVER_NAME = 'video-maker';
export const VIDEO_MAKER_MARKETPLACE_NAME = 'video-maker';
export const VIDEO_MAKER_MARKETPLACE_REPO = 'e-burgos/video-maker';
export const VIDEO_MAKER_PLUGIN_ID = 'video-maker@video-maker';
export const VIDEO_MAKER_SETTINGS_FILE = '.claude/settings.json';
export const VIDEO_MAKER_KNOWN_KEYS = ['enabled', 'plugin', 'mcp', 'version'];
export const VIDEO_MAKER_REPAIR_COMMAND = 'pnpm sdd:video -- --enable';
export const VIDEO_MAKER_MIN_NODE_MAJOR = 22;
export const VIDEO_MAKER_MCP_TARGETS = MCP_TARGETS.filter((target) => target.file !== '.mcp.json');

const SEMVER = /^\d+\.\d+\.\d+$/;
const HARNESSES = ['claude', 'copilot', 'gemini', 'antigravity'];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function videoMakerSettings(tools) {
  const raw = tools?.video_maker;
  const section = isPlainObject(raw) ? raw : {};
  const declared = typeof section.version === 'string' && SEMVER.test(section.version);
  return {
    enabled: section.enabled === true,
    plugin: section.plugin !== false,
    mcp: section.mcp !== false,
    version: declared ? section.version : VIDEO_MAKER_PINNED_VERSION,
    versionDeclared: declared,
    unknownKeys: Object.keys(section).filter((key) => !VIDEO_MAKER_KNOWN_KEYS.includes(key)),
  };
}

export function nodeMeetsMinimum(version = process.versions.node) {
  return Number.parseInt(version, 10) >= VIDEO_MAKER_MIN_NODE_MAJOR;
}

export function kitVideoMakerEntry(version, target, platform = process.platform) {
  const spec = `${VIDEO_MAKER_PACKAGE}@${version}`;
  const entry =
    platform === 'win32'
      ? { command: 'cmd', args: ['/c', 'npx', '-y', spec] }
      : { command: 'npx', args: ['-y', spec] };
  const wantsType = MCP_TARGETS.find((t) => t.file === target)?.stdioType === true;
  return wantsType ? { type: 'stdio', ...entry } : entry;
}

const referencesPackage = (arg) =>
  typeof arg === 'string' &&
  (arg === VIDEO_MAKER_PACKAGE || arg.startsWith(`${VIDEO_MAKER_PACKAGE}@`));

export function isKitVideoMakerEntry(entry) {
  if (!isPlainObject(entry) || !Array.isArray(entry.args)) return false;
  if (entry.command === 'npx') return entry.args.some(referencesPackage);
  if (entry.command === 'cmd') {
    return entry.args[0] === '/c' && entry.args[1] === 'npx' && entry.args.some(referencesPackage);
  }
  return false;
}

export function entryVersionToken(entry) {
  const arg = entry.args.find(referencesPackage);
  return arg.slice(VIDEO_MAKER_PACKAGE.length + 1) || null;
}

export function desiredVideoMakerEntry(existing, version, target, platform = process.platform) {
  if (!isKitVideoMakerEntry(existing)) return kitVideoMakerEntry(version, target, platform);
  if (entryVersionToken(existing) === version) return existing;
  return {
    ...existing,
    args: existing.args.map((arg) =>
      referencesPackage(arg) ? `${VIDEO_MAKER_PACKAGE}@${version}` : arg,
    ),
  };
}

export function mcpEntryState(root, target) {
  const config = readMcpConfig(join(root, ...target.file.split('/')));
  if (config.state === 'missing') return 'no-file';
  if (config.state === 'broken') return 'broken';
  if (containerState(config.doc, target.container) === 'invalid') return 'invalid-container';
  const entry = config.doc[target.container]?.[VIDEO_MAKER_SERVER_NAME];
  if (entry === undefined) return 'missing';
  return isKitVideoMakerEntry(entry) ? 'present' : 'custom';
}

export const kitMarketplaceEntry = () => ({
  source: { source: 'github', repo: VIDEO_MAKER_MARKETPLACE_REPO },
});

export function isKitMarketplaceEntry(entry) {
  return (
    isPlainObject(entry) &&
    isPlainObject(entry.source) &&
    entry.source.source === 'github' &&
    entry.source.repo === VIDEO_MAKER_MARKETPLACE_REPO
  );
}

export function pluginDeclarationState(doc) {
  const markets = doc.extraKnownMarketplaces;
  const plugins = doc.enabledPlugins;
  if (
    (Object.hasOwn(doc, 'extraKnownMarketplaces') && !isPlainObject(markets)) ||
    (Object.hasOwn(doc, 'enabledPlugins') && !isPlainObject(plugins))
  ) {
    return 'invalid-container';
  }
  const market = markets?.[VIDEO_MAKER_MARKETPLACE_NAME];
  const flag = plugins?.[VIDEO_MAKER_PLUGIN_ID];
  if (market !== undefined && !isKitMarketplaceEntry(market)) return 'foreign-marketplace';
  if (flag === false) return 'disabled';
  if (market !== undefined && flag === true) return 'declared';
  return 'missing';
}

export function pluginState(root) {
  const config = readMcpConfig(join(root, ...VIDEO_MAKER_SETTINGS_FILE.split('/')));
  if (config.state === 'missing') return 'no-file';
  if (config.state === 'broken') return 'broken';
  return pluginDeclarationState(config.doc);
}

export function planPluginUpsert(doc) {
  const state = pluginDeclarationState(doc);
  if (state === 'invalid-container') return { doc, outcome: 'invalid-container' };
  if (state === 'foreign-marketplace') return { doc, outcome: 'foreign-marketplace' };
  if (state === 'disabled') return { doc, outcome: 'disabled' };
  if (state === 'declared') return { doc, outcome: 'unchanged' };
  return {
    doc: {
      ...doc,
      extraKnownMarketplaces: {
        ...(doc.extraKnownMarketplaces ?? {}),
        [VIDEO_MAKER_MARKETPLACE_NAME]: kitMarketplaceEntry(),
      },
      enabledPlugins: { ...(doc.enabledPlugins ?? {}), [VIDEO_MAKER_PLUGIN_ID]: true },
    },
    outcome: 'created',
  };
}

function withoutKey(container, key) {
  const { [key]: _removed, ...rest } = container;
  return rest;
}

export function planPluginRemove(doc) {
  const state = pluginDeclarationState(doc);
  if (state === 'invalid-container') return { doc, outcome: 'invalid-container' };
  const next = { ...doc };
  let removed = false;
  if (isPlainObject(doc.enabledPlugins) && doc.enabledPlugins[VIDEO_MAKER_PLUGIN_ID] === true) {
    const rest = withoutKey(doc.enabledPlugins, VIDEO_MAKER_PLUGIN_ID);
    if (Object.keys(rest).length === 0) delete next.enabledPlugins;
    else next.enabledPlugins = rest;
    removed = true;
  }
  if (isKitMarketplaceEntry(doc.extraKnownMarketplaces?.[VIDEO_MAKER_MARKETPLACE_NAME])) {
    const rest = withoutKey(doc.extraKnownMarketplaces, VIDEO_MAKER_MARKETPLACE_NAME);
    if (Object.keys(rest).length === 0) delete next.extraKnownMarketplaces;
    else next.extraKnownMarketplaces = rest;
    removed = true;
  }
  if (removed) return { doc: next, outcome: 'removed' };
  return { doc, outcome: state === 'foreign-marketplace' ? 'foreign-marketplace' : 'absent' };
}

export function videoMakerStatus(root, tools) {
  const document = tools === undefined ? readToolsDocument(root) : { state: 'ok', doc: tools };
  const settings = videoMakerSettings(document.state === 'ok' ? document.doc : null);

  const plugin = {
    file: VIDEO_MAKER_SETTINGS_FILE,
    marketplace: VIDEO_MAKER_MARKETPLACE_NAME,
    id: VIDEO_MAKER_PLUGIN_ID,
    state: settings.plugin ? pluginState(root) : 'n/a',
  };

  const mcp = {};
  for (const target of VIDEO_MAKER_MCP_TARGETS) {
    mcp[target.file] = settings.mcp ? mcpEntryState(root, target) : 'n/a';
  }

  const harnesses = {};
  for (const harness of HARNESSES) {
    const target = VIDEO_MAKER_MCP_TARGETS.find((t) => t.harnesses.includes(harness));
    const ok = target
      ? !settings.mcp || mcp[target.file] === 'present' || mcp[target.file] === 'custom'
      : !settings.plugin || ['declared', 'disabled', 'foreign-marketplace'].includes(plugin.state);
    harnesses[harness] = ok ? 'complete' : 'incomplete';
  }

  const active = settings.enabled && (settings.plugin || settings.mcp);
  const complete = Object.values(harnesses).every((value) => value === 'complete');
  const state = !active ? 'off' : complete ? 'complete' : 'incomplete';

  return {
    enabled: settings.enabled,
    state,
    parts: { plugin: settings.plugin, mcp: settings.mcp },
    version: settings.version,
    kit_version: VIDEO_MAKER_PINNED_VERSION,
    update_available:
      settings.versionDeclared && compareVersions(settings.version, VIDEO_MAKER_PINNED_VERSION) < 0,
    node_ok: nodeMeetsMinimum(),
    plugin,
    mcp,
    harnesses,
    unknown_keys: settings.unknownKeys,
    ...(state === 'incomplete' ? { repair: VIDEO_MAKER_REPAIR_COMMAND } : {}),
  };
}
