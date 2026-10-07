import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serveStatic } from './static';

let dir: string;
let server: Server;
let base: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'studio-web-'));
  await mkdir(path.join(dir, 'w'), { recursive: true });
  await mkdir(path.join(dir, '_next', 'static'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), '<h1>home</h1>');
  await writeFile(path.join(dir, 'w', 'index.html'), '<h1>workspace</h1>');
  await writeFile(path.join(dir, '_next', 'static', 'app.js'), 'console.log(1)');
  await writeFile(path.join(tmpdir(), 'outside-secret.txt'), 'secret');
  server = createServer((req, res) => void serveStatic(dir, req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('serves index.html for / and directories', async () => {
    expect(await (await fetch(`${base}/`)).text()).toBe('<h1>home</h1>');
    const w = await fetch(`${base}/w/`);
    expect(w.status).toBe(200);
    expect(w.headers.get('content-type')).toContain('text/html');
    expect(w.headers.get('cache-control')).toBe('no-store');
    expect(w.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await w.text()).toBe('<h1>workspace</h1>');
  });
  it('redirects /w to /w/ keeping nothing else', async () => {
    const r = await fetch(`${base}/w`, { redirect: 'manual' });
    expect(r.status).toBe(308);
    expect(r.headers.get('location')).toBe('/w/');
  });
  it('serves assets with a javascript content type', async () => {
    const r = await fetch(`${base}/_next/static/app.js`);
    expect(r.headers.get('content-type')).toContain('javascript');
  });
  it.each(['/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/w/%2e%2e/%2e%2e/outside-secret.txt', '/nope.html'])(
    '404 for %s',
    async (p) => {
      expect((await fetch(`${base}${p}`)).status).toBe(404);
    },
  );
  it('rejects non-GET methods', async () => {
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405);
  });
});
