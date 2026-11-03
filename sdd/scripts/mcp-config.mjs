import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const MCP_TARGETS = [
  { file: '.mcp.json', container: 'mcpServers', harnesses: ['claude'] },
  { file: '.vscode/mcp.json', container: 'servers', harnesses: ['copilot'], stdioType: true },
  { file: '.gemini/settings.json', container: 'mcpServers', harnesses: ['gemini', 'antigravity'] },
];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function readMcpConfig(absPath) {
  if (!existsSync(absPath)) return { state: 'missing' };
  let text;
  try {
    text = readFileSync(absPath, 'utf8');
  } catch (error) {
    return { state: 'broken', reason: error.message };
  }
  try {
    const doc = JSON.parse(text.replace(/^﻿/, ''));
    if (!isPlainObject(doc)) return { state: 'broken', reason: 'the root is not a JSON object' };
    return { state: 'ok', doc };
  } catch (error) {
    const hasComments = /\/\/|\/\*/.test(text);
    const reason = hasComments
      ? `${error.message}; comments or trailing commas are not supported by the kit's merge — remove them or add the tucu-ui entry by hand`
      : error.message;
    return { state: 'broken', reason };
  }
}

export function containerState(doc, container) {
  if (!Object.hasOwn(doc, container)) return 'absent';
  return isPlainObject(doc[container]) ? 'ok' : 'invalid';
}

export function planUpsert(doc, container, name, entry, isOwn) {
  const state = containerState(doc, container);
  if (state === 'invalid') return { doc, outcome: 'invalid-container' };
  const servers = state === 'ok' ? doc[container] : {};
  if (!Object.hasOwn(servers, name)) {
    return { doc: { ...doc, [container]: { ...servers, [name]: entry } }, outcome: 'created' };
  }
  const current = servers[name];
  if (!isOwn(current)) return { doc, outcome: 'custom' };
  if (isDeepStrictEqual(current, entry)) return { doc, outcome: 'unchanged' };
  return { doc: { ...doc, [container]: { ...servers, [name]: entry } }, outcome: 'updated' };
}

export function planRemove(doc, container, name, isOwn) {
  const state = containerState(doc, container);
  if (state === 'invalid') return { doc, outcome: 'invalid-container' };
  if (state === 'absent' || !Object.hasOwn(doc[container], name)) return { doc, outcome: 'absent' };
  if (!isOwn(doc[container][name])) return { doc, outcome: 'custom' };
  const { [name]: _removed, ...rest } = doc[container];
  return { doc: { ...doc, [container]: rest }, outcome: 'removed' };
}

function hasContent(absPath, text) {
  try {
    return readFileSync(absPath, 'utf8').replace(/^\uFEFF/, '') === text;
  } catch {
    return false;
  }
}

export function writeMcpConfig(absPath, doc) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  if (hasContent(absPath, text)) return false;
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, text, 'utf8');
    renameSync(tmp, absPath);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
  return true;
}
