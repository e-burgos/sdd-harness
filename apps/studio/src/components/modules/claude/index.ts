import type { ModuleSlots } from '@/lib/nav/module-slots';
import { ClaudeCenter } from './ClaudeCenter';
import { ClaudePanel } from './ClaudePanel';
import { ClaudeProvider } from './ClaudeProvider';

export const claudeModule: ModuleSlots = { Panel: ClaudePanel, Center: ClaudeCenter, Right: null, Scope: ClaudeProvider };
