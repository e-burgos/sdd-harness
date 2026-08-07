import type { ServiceConfig } from '../types/config.types.js';

export const DEFAULT_SERVICES: Record<string, Omit<ServiceConfig, 'type'>> = {
  postgres: { port: 5432, version: '16' },
  redis: { port: 6379, version: '7' },
  rabbitmq: { port: 5672, version: '3' },
  minio: { port: 9000, version: 'latest' },
};

export const DEFAULT_NX_PLUGINS: Record<string, string[]> = {
  nestjs: ['@nx/nest', '@nx/webpack', '@nx/eslint'],
  react: ['@nx/react', '@nx/vite', '@nx/eslint'],
  python: [],
  nextjs: ['@nx/next', '@nx/eslint'],
  fastify: ['@nx/node', '@nx/webpack', '@nx/eslint'],
};

export const DEFAULT_FEATURES: Record<string, string[]> = {
  nestjs: ['prisma', 'jwt', 'swagger', 'websockets', 'bull'],
  react: ['zustand', 'react-query', 'router', 'tailwind'],
  python: ['socketio', 'scheduler', 'sqlite'],
  nextjs: ['tailwind', 'app-router'],
  fastify: ['prisma', 'jwt'],
};
