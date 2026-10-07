import { cp, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const distDir = new URL('./dist/', import.meta.url);
await rm(distDir, { recursive: true, force: true });
await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./src/cli.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: fileURLToPath(distDir),
  // @sdd-studio/protocol se empaqueta adentro (es privado); el resto son dependencias reales.
  external: ['@anthropic-ai/claude-agent-sdk', 'chokidar', 'citty', 'picocolors', 'ws', 'zod'],
});
console.log('sdd-studio build OK');

const webOut = new URL('../studio/out/', import.meta.url);
if (await stat(webOut).then((s) => s.isDirectory()).catch(() => false)) {
  await cp(webOut, new URL('./dist/web/', import.meta.url), { recursive: true });
  console.log('sdd-studio: web local incluida en dist/web');
} else {
  console.warn('sdd-studio: no hay apps/studio/out (corré `pnpm --filter sdd-studio-web build:local`); --local-ui no va a estar disponible');
}
