export const APP_TYPE_OPTIONS = [
  {
    value: "nestjs",
    label: "NestJS API",
    hint: "Backend REST/WebSocket API",
  },
  { value: "react", label: "React SPA", hint: "Vite + React 19" },
  {
    value: "nextjs",
    label: "Next.js",
    hint: "Full-stack React framework",
  },
  {
    value: "next-bff",
    label: "Next.js BFF",
    hint: "app/api routes over an upstream service (monorepo only)",
  },
  {
    value: "mfe-shell",
    label: "Microfrontend shell",
    hint: "Vite shell with path-based mfes (monorepo only)",
  },
  {
    value: "mfe",
    label: "Microfrontend",
    hint: "Vite app served under /<name>/ (monorepo only)",
  },
  {
    value: "python",
    label: "Python Agent",
    hint: "FastAPI + LangGraph with uv",
  },
  {
    value: "fastify",
    label: "Fastify API",
    hint: "Lightweight Node.js API",
  },
  {
    value: "springboot",
    label: "Spring Boot 3",
    hint: "Java 21 REST API hexagonal (Maven)",
  },
  {
    value: "hono",
    label: "Hono API",
    hint: "Ultra-fast Node.js API",
  },
];

export const SERVICE_OPTIONS = [
  { value: "postgres", label: "PostgreSQL", hint: "Relational DB" },
  { value: "redis", label: "Redis", hint: "Cache & queues" },
  { value: "rabbitmq", label: "RabbitMQ", hint: "Message broker" },
  { value: "minio", label: "MinIO", hint: "S3-compatible storage" },
];

export const DEFAULT_APP_NAMES: Record<string, string> = {
  nestjs: "api",
  react: "webapp",
  nextjs: "web",
  fastify: "api",
  springboot: "service",
  hono: "api",
  "next-bff": "bff",
  "mfe-shell": "shell",
  mfe: "catalog",
  python: "agent",
};

export const LIB_TYPE_OPTIONS = [
  { value: "shared-types", label: "Shared Types", hint: "TypeScript interfaces & DTOs" },
  { value: "shared-utils", label: "Shared Utils", hint: "Helper functions & validators" },
  { value: "ui-kit", label: "UI Kit", hint: "Shared React components" },
  { value: "api-client", label: "API Client", hint: "Typed HTTP client for backend" },
  { value: "config", label: "Config", hint: "Env vars, constants, schemas" },
];
