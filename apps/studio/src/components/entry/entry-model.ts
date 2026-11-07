import type { Dict } from '@/lib/i18n/es';

export const BRIDGE_COMMAND = 'npx @e-burgos/sdd-studio';
export const LOCAL_UI_COMMAND = 'npx @e-burgos/sdd-studio --local-ui';
export const CONFIGURE_COMMAND = 'npx @e-burgos/sdd-harness configure sdd';
export const INIT_COMMAND = 'npx @e-burgos/sdd-harness init --terminal';
export const NODE_VERSION_COMMAND = 'node -v';
export const CLAUDE_INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code';
export const CLAUDE_COMMAND = 'claude';
export const CLAUDE_LOGIN_COMMAND = '/login';
export const API_KEY_COMMAND = 'export ANTHROPIC_API_KEY=sk-ant-…';
export const SDD_DOCS_URL = 'https://sdd.estebanburgos.com.ar';
export const NODE_DOWNLOAD_URL = 'https://nodejs.org';

export type EntryPath = 'new' | 'existing' | 'running';
export type EntryStepId = 'welcome' | 'path' | 'requirements' | 'journey' | 'connect';
export type RequirementId = 'node' | 'claude';

export const ENTRY_PATHS: readonly EntryPath[] = ['new', 'existing', 'running'];
export const REQUIREMENTS: readonly RequirementId[] = ['node', 'claude'];

const GUIDED_STEPS: readonly EntryStepId[] = ['welcome', 'path', 'requirements', 'journey', 'connect'];
const SHORTCUT_STEPS: readonly EntryStepId[] = ['welcome', 'path', 'connect'];

export function stepsForPath(path: EntryPath | null): readonly EntryStepId[] {
  return path === 'running' ? SHORTCUT_STEPS : GUIDED_STEPS;
}

export interface EntryCommand {
  id: string;
  label: keyof Dict;
  command: string | keyof Dict;
  translated?: boolean;
}

const COMMANDS_BY_PATH: Record<EntryPath, readonly EntryCommand[]> = {
  new: [
    { id: 'mkdir', label: 'entry.connect.cmd.mkdir', command: 'entry.cmd.mkdir', translated: true },
    { id: 'studio', label: 'entry.connect.cmd.studio', command: BRIDGE_COMMAND },
  ],
  existing: [
    { id: 'configure', label: 'entry.connect.cmd.configure', command: CONFIGURE_COMMAND },
    { id: 'studio', label: 'entry.connect.cmd.studioRoot', command: BRIDGE_COMMAND },
  ],
  running: [{ id: 'studio', label: 'entry.connect.cmd.restart', command: BRIDGE_COMMAND }],
};

export function commandsForPath(path: EntryPath): readonly EntryCommand[] {
  return COMMANDS_BY_PATH[path];
}

export const SEAM_SPLIT_BY_PATH: Record<EntryPath, number> = { new: 0.66, existing: 0.34, running: 0.5 };
export const NEUTRAL_SEAM_SPLIT = 0.5;
export const EDGE_SEAM_SPLIT_BY_PATH: Record<EntryPath, number> = { new: 0.95, existing: 0.05, running: 0.95 };

export function isEntryPath(value: unknown): value is EntryPath {
  return typeof value === 'string' && (ENTRY_PATHS as readonly string[]).includes(value);
}
