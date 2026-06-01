export type AppType = 'nestjs' | 'react' | 'python' | 'nextjs' | 'fastify';
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
  port: number;
  extensions?: string[];
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
  project: {
    name: string;
    description: string;
    packageScope: string;
  };
  apps: AppConfig[];
  services: ServiceConfig[];
  sdd?: SDDConfig;
  nx: NxConfig;
  infra?: {
    provider?: InfraProvider;
  };
}
