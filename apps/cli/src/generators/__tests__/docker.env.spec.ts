import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { writeEnvExample } from '../docker.generator.js';

describe('.env.example for the new app types', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-env-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists the upstream URL of next-bff apps and host/port of python apps', async () => {
    await writeEnvExample(root, [], [
      { name: 'catalog-bff', type: 'next-bff' },
      { name: 'agent', type: 'python' },
      { name: 'web', type: 'react' },
    ]);
    const env = fs.readFileSync(resolve(root, '.env.example'), 'utf-8');
    expect(env).toContain('CATALOG_BFF_UPSTREAM_URL=http://localhost:3000/api/v1');
    expect(env).toContain('CATALOG_BFF_PORT=3001');
    expect(env).toContain('AGENT_HOST=127.0.0.1');
    expect(env).toContain('AGENT_PORT=8000');
    expect(env).not.toContain('WEB_UPSTREAM_URL');
    expect(env).not.toContain('WEB_HOST');
  });
});
