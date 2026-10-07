import { createReadStream } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res: ServerResponse, status: number, body = ''): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

/** Sirve el export estático de la web (sólo GET/HEAD, confinado a `dir`). */
export async function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    return send(res, 400);
  }
  if (pathname.startsWith('//') || pathname.includes('\0')) return send(res, 404);
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s.includes('\\') || s.includes(':'))) return send(res, 404);
  const root = await realpath(dir);
  let target = path.resolve(root, ...segments);
  // Confinamiento lógico antes de cualquier llamada al fs.
  if (target !== root && !target.startsWith(root + path.sep)) return send(res, 404);
  let info = await stat(target).catch(() => null);
  if (info?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(308, { location: `/${segments.join('/')}/` });
      return void res.end();
    }
    target = path.join(target, 'index.html');
    info = await stat(target).catch(() => null);
  }
  if (!info?.isFile()) return send(res, 404);
  const real = await realpath(target).catch(() => null);
  if (!real || (real !== root && !real.startsWith(root + path.sep))) return send(res, 404);
  const handle = await open(real).catch(() => null);
  if (!handle) return send(res, 500);
  const type = TYPES[path.extname(real).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'content-length': info.size,
    'x-content-type-options': 'nosniff',
    'cache-control': type.startsWith('text/html') ? 'no-store' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') {
    await handle.close().catch(() => undefined);
    return void res.end();
  }
  pipeline(createReadStream(real, { fd: handle.fd, autoClose: true }), res, (err) => {
    if (!err) return;
    if (!res.headersSent) send(res, 500);
    else res.destroy();
  });
}
