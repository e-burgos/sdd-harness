import type { ComponentType, ReactNode } from 'react';

export interface ModuleSlots {
  Panel: ComponentType;
  Center: ComponentType;
  Right: ComponentType | null;
  Scope?: ComponentType<{ children: ReactNode }>;
  legacyCenter?: boolean;
}
