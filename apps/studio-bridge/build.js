import { rm } from 'node:fs/promises';
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
