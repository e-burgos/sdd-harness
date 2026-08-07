import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getTemplatesDir(): string {
  // In development: tools/harness/templates
  // In published package: dist/tools/harness/templates
  const devPath = resolve(__dirname, '../../templates');
  const distPath = resolve(__dirname, '../templates');
  return fs.existsSync(devPath) ? devPath : distPath;
}

export async function copyTemplate(
  templatePath: string,
  outputPath: string,
): Promise<void> {
  const fullPath = resolve(getTemplatesDir(), templatePath);
  await fs.ensureDir(dirname(outputPath));
  await fs.copy(fullPath, outputPath);
}
