import { cp, rm, stat } from 'node:fs/promises';
import esbuild from 'esbuild';

await rm('dist', { recursive: true, force: true });
await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
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
