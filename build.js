import esbuild from 'esbuild';
import fs from 'fs-extra';
import { resolve } from 'path';
import { execSync } from 'child_process';

async function build() {
  const root = process.cwd();
  const dist = resolve(root, 'dist');

  // Clean dist
  await fs.remove(dist);
  await fs.ensureDir(dist);

  // Compile TS files
  await esbuild.build({
    entryPoints: ['src/index.ts', 'src/cli.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outdir: 'dist',
    external: ['esbuild', 'fs-extra', 'ejs', 'picocolors', 'citty', '@clack/prompts', 'zod'],
  });

  // Generate TypeScript declaration files
  console.log('Generating TypeScript declaration files...');
  execSync('npx tsc -p tsconfig.lib.json --emitDeclarationOnly --outDir dist --rootDir src', {
    stdio: 'inherit',
  });

  // Copy assets
  await fs.copy('README.md', resolve(dist, 'README.md'));
  await fs.copy('CHANGELOG.md', resolve(dist, 'CHANGELOG.md'));

  // Read package.json and write it to dist/package.json
  const pkg = await fs.readJson('package.json');
  await fs.writeJson(resolve(dist, 'package.json'), pkg, { spaces: 2 });

  console.log('Build completed successfully!');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});

