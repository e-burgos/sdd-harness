import { access } from 'node:fs/promises';
import path from 'node:path';
import {
  KitIntegrationStatus,
  MAX_INTEGRATION_OUTPUT_BYTES,
  type KitIntegrationId,
  type KitIntegrationSetResult,
} from '@sdd-studio/protocol';
import { defaultExec, type Exec } from '../github/exec';

export const INTEGRATION_STATUS_TIMEOUT_MS = 15_000;
export const INTEGRATION_SET_TIMEOUT_MS = 180_000;

const SCRIPTS: Record<KitIntegrationId, string> = {
  'tucu-ui': 'sdd-tucu.mjs',
  'video-maker': 'sdd-video.mjs',
};

export interface KitIntegrations {
  status: (root: string, integration: KitIntegrationId) => Promise<KitIntegrationStatus>;
  set: (root: string, integration: KitIntegrationId, enabled: boolean) => Promise<KitIntegrationSetResult>;
}

const scriptPathOf = (root: string, integration: KitIntegrationId): string => path.join(root, 'sdd', 'scripts', SCRIPTS[integration]);

const exists = (file: string): Promise<boolean> => access(file).then(() => true, () => false);

const unavailable = (integration: KitIntegrationId): KitIntegrationStatus => ({
  integration,
  available: false,
  enabled: false,
  state: 'unavailable',
  parts: {},
  version: null,
  kitVersion: null,
  updateAvailable: false,
  nodeOk: true,
  harnesses: { claude: 'incomplete', copilot: 'incomplete', gemini: 'incomplete', antigravity: 'incomplete' },
  repair: null,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const booleans = (value: unknown): Record<string, boolean> =>
  Object.fromEntries(Object.entries(asRecord(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));

export function normalizeIntegrationStatus(integration: KitIntegrationId, raw: unknown): KitIntegrationStatus {
  const source = asRecord(raw);
  const parsed = KitIntegrationStatus.safeParse({
    integration,
    available: true,
    enabled: source['enabled'] === true,
    state: source['state'],
    parts: booleans(source['parts']),
    version: typeof source['version'] === 'string' ? source['version'] : null,
    kitVersion: typeof source['kit_version'] === 'string' ? source['kit_version'] : null,
    updateAvailable: source['update_available'] === true,
    nodeOk: source['node_ok'] !== false,
    harnesses: asRecord(source['harnesses']),
    repair: typeof source['repair'] === 'string' ? source['repair'] : null,
  });
  return parsed.success ? parsed.data : unavailable(integration);
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const trimOutput = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length > MAX_INTEGRATION_OUTPUT_BYTES ? trimmed.slice(trimmed.length - MAX_INTEGRATION_OUTPUT_BYTES) : trimmed;
};

export function createKitIntegrations(exec: Exec = defaultExec): KitIntegrations {
  const status: KitIntegrations['status'] = async (root, integration) => {
    const script = scriptPathOf(root, integration);
    if (!(await exists(script))) return unavailable(integration);
    const result = await exec(process.execPath, [script, '--status'], { cwd: root, timeoutMs: INTEGRATION_STATUS_TIMEOUT_MS });
    if (result.code !== 0 || result.timedOut || result.missing) return unavailable(integration);
    const raw = parseJson(result.stdout);
    return raw === null ? unavailable(integration) : normalizeIntegrationStatus(integration, raw);
  };

  const set: KitIntegrations['set'] = async (root, integration, enabled) => {
    const script = scriptPathOf(root, integration);
    if (!(await exists(script))) {
      return { ok: false, exitCode: null, output: `sdd/scripts/${SCRIPTS[integration]} not found`, status: unavailable(integration) };
    }
    const result = await exec(process.execPath, [script, enabled ? '--enable' : '--disable'], { cwd: root, timeoutMs: INTEGRATION_SET_TIMEOUT_MS });
    const output = trimOutput(result.timedOut ? `${result.stdout}\n${result.stderr}\ntimeout` : `${result.stdout}\n${result.stderr}`);
    return { ok: result.code === 0 && !result.timedOut, exitCode: result.code, output, status: await status(root, integration) };
  };

  return { status, set };
}
