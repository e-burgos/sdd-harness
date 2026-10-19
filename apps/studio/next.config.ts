import path from 'node:path';
import type { NextConfig } from 'next';

const isExport = process.env.STUDIO_EXPORT === '1';
const monorepoRoot = path.resolve(process.cwd(), '../..');

const config: NextConfig = {
  transpilePackages: ['@sdd-studio/protocol'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  ...(isExport
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true } }
    : {}),
};

export default config;
