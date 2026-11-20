'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useClaudeTools, type ClaudeToolsValue } from './use-claude-tools';

const ClaudeContext = createContext<ClaudeToolsValue | null>(null);

export function ClaudeProvider({ children }: { children: ReactNode }) {
  return <ClaudeContext.Provider value={useClaudeTools()}>{children}</ClaudeContext.Provider>;
}

export function useClaude(): ClaudeToolsValue {
  const value = useContext(ClaudeContext);
  if (!value) throw new Error('ClaudeProvider is missing');
  return value;
}
