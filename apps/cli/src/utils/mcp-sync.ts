import { loadMcpConfig, type McpDocument, type McpEntry } from './kit-scripts.js';

export interface McpSyncInput {
  mcpPath: string;
  catalog: Record<string, McpEntry>;
  selected: string[];
  isOwn: (name: string, entry: unknown) => boolean;
  keepOwn?: (name: string, entry: unknown) => boolean;
}

export type McpSyncResult =
  | { ok: true; written: boolean; outcomes: Record<string, string> }
  | { ok: false; error: string };

const CONTAINER = 'mcpServers';

export async function syncMcpServers(input: McpSyncInput): Promise<McpSyncResult> {
  const mcp = await loadMcpConfig();
  const read = mcp.readMcpConfig(input.mcpPath);
  if (read.state === 'broken') {
    return { ok: false, error: `.mcp.json exists but is not valid JSON — fix it first. (${read.reason})` };
  }
  let doc: McpDocument = read.state === 'ok' ? read.doc : { [CONTAINER]: {} };
  if (mcp.containerState(doc, CONTAINER) === 'invalid') {
    return { ok: false, error: `.mcp.json has a "${CONTAINER}" that is not an object — fix it first.` };
  }

  const servers = doc[CONTAINER] as Record<string, unknown> | undefined;
  const outcomes: Record<string, string> = {};
  for (const [name, entry] of Object.entries(input.catalog)) {
    const isOwn = (existing: unknown) => input.isOwn(name, existing);
    if (input.selected.includes(name) && servers && name in servers && input.keepOwn?.(name, servers[name])) {
      outcomes[name] = 'unchanged';
      continue;
    }
    const plan = input.selected.includes(name)
      ? mcp.planUpsert(doc, CONTAINER, name, entry, isOwn)
      : mcp.planRemove(doc, CONTAINER, name, isOwn);
    doc = plan.doc;
    outcomes[name] = plan.outcome;
  }

  const changed = Object.values(outcomes).some((o) => ['created', 'updated', 'removed'].includes(o));
  const written = changed || read.state === 'missing' ? mcp.writeMcpConfig(input.mcpPath, doc) : false;
  return { ok: true, written, outcomes };
}

export async function readMcpServerNames(
  mcpPath: string,
): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> {
  const mcp = await loadMcpConfig();
  const read = mcp.readMcpConfig(mcpPath);
  if (read.state === 'missing') return { ok: true, names: [] };
  if (read.state === 'broken') {
    return { ok: false, error: `.mcp.json exists but is not valid JSON — fix it first. (${read.reason})` };
  }
  const state = mcp.containerState(read.doc, CONTAINER);
  if (state === 'invalid') {
    return { ok: false, error: `.mcp.json has a "${CONTAINER}" that is not an object — fix it first.` };
  }
  return { ok: true, names: state === 'ok' ? Object.keys(read.doc[CONTAINER] as object) : [] };
}
