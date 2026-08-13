export type AppType =
  | 'nestjs'
  | 'react'
  | 'python'
  | 'nextjs'
  | 'fastify'
  | 'springboot'
  | 'hono';
export type ServiceType = 'postgres' | 'redis' | 'rabbitmq' | 'minio';
export type InfraProvider = 'digitalocean' | 'aws' | 'gcp' | 'vercel' | 'railway';

export interface AppConfig {
  name: string;
  type: AppType;
  port?: number;
  features: string[];
}

export interface ServiceConfig {
  type: ServiceType;
  version?: string;
  port?: number;
  extensions?: string[];
}

export type LibType =
  | 'shared-types'
  | 'shared-utils'
  | 'ui-kit'
  | 'api-client'
  | 'config';

export interface LibConfig {
  name: string;
  type: LibType;
}

export interface CycleConfig {
  cycle: number;
  modules: string[];
  weeks: number;
}

export interface SDDConfig {
  enabled: boolean;
  modules: string[];
  cycles?: CycleConfig[];
  skills?: {
    include: string[];
    custom?: string[];
  };
  agents?: {
    instructionFile?: string;
    claudeFile?: string;
    copilotInstructions?: boolean;
  };
}

export interface NxConfig {
  plugins: string[];
  defaultProject?: string;
}

export interface HarnessConfig {
  mode: 'nx' | 'standalone';
  project: {
    name: string;
    description: string;
    packageScope: string;
  };
  apps: AppConfig[];
  libs: LibConfig[];
  services: ServiceConfig[];
  sdd?: SDDConfig;
  nx?: NxConfig;
  infra?: {
    provider?: InfraProvider;
  };
}
