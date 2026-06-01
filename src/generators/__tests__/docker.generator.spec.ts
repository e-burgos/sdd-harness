import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { generateDockerCompose } from '../docker.generator.js';

describe('docker.generator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'harness-docker-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('genera docker-compose.yml con postgres', async () => {
    await generateDockerCompose(tmpDir, ['postgres']);

    const composePath = resolve(tmpDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('postgres');
    expect(content).toContain('postgres:16-alpine');
    expect(content).toContain('5432:5432');
    expect(content).toContain('pgdata');
  });

  it('genera docker-compose.yml con múltiples servicios', async () => {
    await generateDockerCompose(tmpDir, ['postgres', 'redis', 'minio']);

    const content = fs.readFileSync(
      resolve(tmpDir, 'docker-compose.yml'),
      'utf-8',
    );
    expect(content).toContain('postgres');
    expect(content).toContain('redis');
    expect(content).toContain('minio');
    expect(content).toContain('redis:7-alpine');
    expect(content).toContain('minio/minio:latest');
  });

  it('genera .env.example con las variables correspondientes', async () => {
    await generateDockerCompose(tmpDir, ['postgres', 'redis']);

    const envPath = resolve(tmpDir, '.env.example');
    expect(fs.existsSync(envPath)).toBe(true);

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).toContain('DB_USER=admin');
    expect(content).toContain('DATABASE_URL=');
    expect(content).toContain('REDIS_URL=');
  });

  it('genera docker-compose.yml con rabbitmq', async () => {
    await generateDockerCompose(tmpDir, ['rabbitmq']);

    const content = fs.readFileSync(
      resolve(tmpDir, 'docker-compose.yml'),
      'utf-8',
    );
    expect(content).toContain('rabbitmq');
    expect(content).toContain('rabbitmq:3-management-alpine');
    expect(content).toContain('5672:5672');
    expect(content).toContain('15672:15672');
  });

  it('ignora servicios desconocidos', async () => {
    await generateDockerCompose(tmpDir, ['postgres', 'unknown-service']);

    const content = fs.readFileSync(
      resolve(tmpDir, 'docker-compose.yml'),
      'utf-8',
    );
    expect(content).toContain('postgres');
    expect(content).not.toContain('unknown-service');
  });

  it('genera volumes para servicios que los requieren', async () => {
    await generateDockerCompose(tmpDir, ['postgres', 'minio']);

    const content = fs.readFileSync(
      resolve(tmpDir, 'docker-compose.yml'),
      'utf-8',
    );
    expect(content).toContain('pgdata');
    expect(content).toContain('minio_data');
  });
});
