import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MCP_TARGETS, containerState, readMcpConfig } from './mcp-config.mjs';

export const TUCU_UI_PACKAGE = '@e-burgos/tucu-ui-mcp';
export const TUCU_UI_PINNED_VERSION = '0.16.0';
export const TUCU_UI_SERVER_NAME = 'tucu-ui';
export const TUCU_UI_SKILL_NAME = 'tucu-ui-design';
export const TUCU_UI_INSTALL_DIR = 'sdd/integrations/skills/tucu-ui-design';
export const TUCU_UI_LINK_DIRS = [
  { dir: '.claude/skills', harnesses: ['claude'] },
  { dir: '.github/skills', harnesses: ['copilot'] },
  { dir: '.agents/skills', harnesses: ['gemini', 'antigravity'] },
];
export const TUCU_UI_KNOWN_KEYS = ['enabled', 'skill', 'mcp', 'version'];
export const TUCU_UI_REPAIR_COMMAND = 'pnpm sdd:tucu -- --enable';
export const TUCU_UI_REQUIRED_SKILL_FILES = [
  'SKILL.md',
  'references/checklist.md',
  'references/design-guide.md',
];
export const TUCU_UI_MIN_NODE_MAJOR = 20;

const SEMVER = /^\d+\.\d+\.\d+$/;
const HARNESSES = ['claude', 'copilot', 'gemini', 'antigravity'];

export const installDirPath = (root) => join(root, ...TUCU_UI_INSTALL_DIR.split('/'));
export const toolsFilePath = (root) => join(root, 'sdd', 'tools.json');

export function readToolsDocument(root) {
  const file = toolsFilePath(root);
  if (!existsSync(file)) return { state: 'missing' };
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return { state: 'broken' };
    return { state: 'ok', doc };
  } catch {
    return { state: 'broken' };
  }
}

export function tucuUiSettings(tools) {
  const raw = tools?.tucu_ui;
  const section = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const declared = typeof section.version === 'string' && SEMVER.test(section.version);
  return {
    enabled: section.enabled === true,
    skill: section.skill !== false,
    mcp: section.mcp !== false,
    version: declared ? section.version : TUCU_UI_PINNED_VERSION,
    versionDeclared: declared,
    unknownKeys: Object.keys(section).filter((key) => !TUCU_UI_KNOWN_KEYS.includes(key)),
  };
}

export function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

export function nodeMeetsMinimum(version = process.versions.node) {
  return Number.parseInt(version, 10) >= TUCU_UI_MIN_NODE_MAJOR;
}

export function kitTucuEntry(version, target) {
  const entry = { command: 'npx', args: ['-y', `${TUCU_UI_PACKAGE}@${version}`] };
  const wantsType = MCP_TARGETS.find((t) => t.file === target)?.stdioType === true;
  return wantsType ? { type: 'stdio', ...entry } : entry;
}

const referencesPackage = (arg) =>
  typeof arg === 'string' && (arg === TUCU_UI_PACKAGE || arg.startsWith(`${TUCU_UI_PACKAGE}@`));

export function isKitTucuEntry(entry) {
  if (entry === null || typeof entry !== 'object' || !Array.isArray(entry.args)) return false;
  if (entry.command === 'npx') return entry.args.some(referencesPackage);
  if (entry.command === 'cmd') {
    return entry.args[0] === '/c' && entry.args[1] === 'npx' && entry.args.some(referencesPackage);
  }
  return false;
}

export function entryVersionToken(entry) {
  const arg = entry.args.find(referencesPackage);
  return arg.slice(TUCU_UI_PACKAGE.length + 1) || null;
}

export function desiredTucuEntry(existing, version, target) {
  if (!isKitTucuEntry(existing)) return kitTucuEntry(version, target);
  if (entryVersionToken(existing) === version) return existing;
  return {
    ...existing,
    args: existing.args.map((arg) => (referencesPackage(arg) ? `${TUCU_UI_PACKAGE}@${version}` : arg)),
  };
}

export function isSkillInstallComplete(root) {
  const dir = installDirPath(root);
  return TUCU_UI_REQUIRED_SKILL_FILES.every((file) => existsSync(join(dir, ...file.split('/'))));
}

export function kitLinkPath(root, linkDir) {
  return join(root, ...linkDir.split('/'), TUCU_UI_SKILL_NAME);
}

function safeRealpath(path) {
  try {
    return realpathSync.native(path);
  } catch {
    return null;
  }
}

const normalize = (path) => resolve(path).replace(/[\\/]+$/, '').replace(/^\\\\\?\\/, '');

export function kitLinkState(root, linkDir) {
  const link = kitLinkPath(root, linkDir);
  let stat;
  try {
    stat = lstatSync(link);
  } catch {
    return 'absent';
  }
  if (!stat.isSymbolicLink()) return 'foreign';
  const installed = safeRealpath(installDirPath(root));
  const resolved = safeRealpath(link);
  if (installed && resolved) {
    return normalize(resolved).toLowerCase() === normalize(installed).toLowerCase() ? 'kit' : 'foreign';
  }
  let target;
  try {
    target = readlinkSync(link);
  } catch {
    return 'foreign';
  }
  const absolute = normalize(resolve(dirname(link), target)).toLowerCase();
  return absolute === normalize(installDirPath(root)).toLowerCase() ? 'kit-dangling' : 'foreign';
}

export function mcpEntryState(root, target) {
  const config = readMcpConfig(join(root, ...target.file.split('/')));
  if (config.state === 'missing') return 'no-file';
  if (config.state === 'broken') return 'broken';
  if (containerState(config.doc, target.container) === 'invalid') return 'invalid-container';
  const entry = config.doc[target.container]?.[TUCU_UI_SERVER_NAME];
  if (entry === undefined) return 'missing';
  return isKitTucuEntry(entry) ? 'present' : 'custom';
}

export function tucuUiStatus(root, tools) {
  const document = tools === undefined ? readToolsDocument(root) : { state: 'ok', doc: tools };
  const settings = tucuUiSettings(document.state === 'ok' ? document.doc : null);
  const kitVersion = TUCU_UI_PINNED_VERSION;
  const installed = isSkillInstallComplete(root);

  const links = {};
  for (const { dir } of TUCU_UI_LINK_DIRS) {
    const state = kitLinkState(root, dir);
    links[dir] = !settings.skill ? 'n/a' : state === 'kit' ? 'linked' : state === 'foreign' ? 'foreign' : 'missing';
  }

  const mcp = {};
  for (const target of MCP_TARGETS) {
    mcp[target.file] = settings.mcp ? mcpEntryState(root, target) : 'n/a';
  }

  const harnesses = {};
  for (const harness of HARNESSES) {
    const linkDir = TUCU_UI_LINK_DIRS.find((l) => l.harnesses.includes(harness))?.dir;
    const mcpFile = MCP_TARGETS.find((t) => t.harnesses.includes(harness))?.file;
    const skillOk = !settings.skill || (installed && links[linkDir] === 'linked');
    const mcpOk = !settings.mcp || mcp[mcpFile] === 'present' || mcp[mcpFile] === 'custom';
    harnesses[harness] = skillOk && mcpOk ? 'complete' : 'incomplete';
  }

  const active = settings.enabled && (settings.skill || settings.mcp);
  const complete = Object.values(harnesses).every((value) => value === 'complete');
  const state = !active ? 'off' : complete ? 'complete' : 'incomplete';

  return {
    enabled: settings.enabled,
    state,
    parts: { skill: settings.skill, mcp: settings.mcp },
    version: settings.version,
    kit_version: kitVersion,
    update_available: settings.versionDeclared && compareVersions(settings.version, kitVersion) < 0,
    node_ok: nodeMeetsMinimum(),
    skill: { dir: TUCU_UI_INSTALL_DIR, installed, links },
    mcp,
    harnesses,
    unknown_keys: settings.unknownKeys,
    ...(state === 'incomplete' ? { repair: TUCU_UI_REPAIR_COMMAND } : {}),
  };
}
