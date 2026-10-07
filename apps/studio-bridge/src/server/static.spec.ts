import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serveStatic } from './static';

let outer: string;
let dir: string;
let server: Server;
let port: number;
let base: string;

/** Petición con path crudo (fetch normaliza `/../` y `%2e%2e` antes de enviar). */
function raw(p: string, method = 'GET'): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: p, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

beforeEach(async () => {
  outer = await mkdtemp(path.join(tmpdir(), 'studio-web-'));
  dir = path.join(outer, 'web');
  await mkdir(path.join(dir, 'w'), { recursive: true });
  await mkdir(path.join(dir, '_next', 'static'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), '<h1>home</h1>');
  await writeFile(path.join(dir, 'w', 'index.html'), '<h1>workspace</h1>');
  await writeFile(path.join(dir, '_next', 'static', 'app.js'), 'console.log(1)');
  await writeFile(path.join(outer, 'outside-secret.txt'), 'secret');
  server = createServer((req, res) => void serveStatic(dir, req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const address = server.address();
  port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});
afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(outer, { recursive: true, force: true });
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
  it('404 for a missing file', async () => {
    expect((await fetch(`${base}/nope.html`)).status).toBe(404);
  });
  it.each([
    '/..%2foutside-secret.txt',
    '/%2e%2e%2foutside-secret.txt',
    '/w/..%2f..%2foutside-secret.txt',
    '/%252e%252e/outside-secret.txt',
    '/..%5coutside-secret.txt',
    '/w%5c..%5c..%5coutside-secret.txt',
    '/C%3a/x',
  ])('rejects traversal %s', async (p) => {
    const r = await raw(p);
    expect([400, 404]).toContain(r.status);
    expect(r.body).not.toContain('secret');
  });
  it('404 for a symlink escaping the web dir', async (ctx) => {
    try {
      await symlink(path.join(outer, 'outside-secret.txt'), path.join(dir, 'link.txt'));
    } catch {
      return ctx.skip();
    }
    const r = await raw('/link.txt');
    expect(r.status).toBe(404);
    expect(r.body).not.toContain('secret');
  });
  it('HEAD /w/ answers 200 without a body', async () => {
    const r = await raw('/w/', 'HEAD');
    expect(r.status).toBe(200);
    expect(r.body).toBe('');
  });
  it('never redirects to a protocol-relative location', async () => {
    for (const p of ['/%2fw', '//w', '/%2f%2fw']) {
      const r = await raw(p);
      expect(r.location ?? '').not.toMatch(/^\/\//);
      expect(r.status).not.toBe(308);
    }
  });
  it('survives an unreadable file and keeps serving', async (ctx) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return ctx.skip();
    const f = path.join(dir, 'locked.txt');
    await writeFile(f, 'x');
    await chmod(f, 0o000);
    const r = await raw('/locked.txt');
    expect([404, 500]).toContain(r.status);
    expect((await raw('/w/')).status).toBe(200);
  });
  it('rejects non-GET methods', async () => {
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405);
  });
});
