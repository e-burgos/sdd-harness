import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getTemplatesDir } from './fs.js';

export type McpDocument = Record<string, unknown>;
export type McpEntry = object;

export interface McpTarget {
  file: string;
  container: string;
  harnesses: string[];
  stdioType?: boolean;
}

export type McpReadResult =
  | { state: 'missing' }
  | { state: 'broken'; reason: string }
  | { state: 'ok'; doc: McpDocument };

export type UpsertOutcome = 'created' | 'updated' | 'unchanged' | 'custom' | 'invalid-container';
export type RemoveOutcome = 'removed' | 'absent' | 'custom' | 'invalid-container';

export interface McpConfigModule {
  MCP_TARGETS: McpTarget[];
  readMcpConfig(absPath: string): McpReadResult;
  containerState(doc: McpDocument, container: string): 'absent' | 'ok' | 'invalid';
  planUpsert(
    doc: McpDocument,
    container: string,
    name: string,
    entry: McpEntry,
    isOwn: (entry: unknown) => boolean,
  ): { doc: McpDocument; outcome: UpsertOutcome };
  planRemove(
    doc: McpDocument,
    container: string,
    name: string,
    isOwn: (entry: unknown) => boolean,
  ): { doc: McpDocument; outcome: RemoveOutcome };
  writeMcpConfig(absPath: string, doc: McpDocument): boolean;
}

export interface TucuUiCommonModule {
  TUCU_UI_PINNED_VERSION: string;
  TUCU_UI_SERVER_NAME: string;
  kitTucuEntry(version: string, target: string): McpEntry;
  isKitTucuEntry(entry: unknown): boolean;
}

const cache = new Map<string, Promise<unknown>>();

function loadKitScript<T>(file: string): Promise<T> {
  const path = resolve(getTemplatesDir(), 'sdd/scripts', file);
  let loaded = cache.get(path);
  if (!loaded) {
    loaded = import(pathToFileURL(path).href);
    cache.set(path, loaded);
  }
  return loaded as Promise<T>;
}

export const loadMcpConfig = (): Promise<McpConfigModule> =>
  loadKitScript<McpConfigModule>('mcp-config.mjs');

export const loadTucuUiCommon = (): Promise<TucuUiCommonModule> =>
  loadKitScript<TucuUiCommonModule>('tucu-ui-common.mjs');
