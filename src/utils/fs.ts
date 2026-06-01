import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import ejs from 'ejs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getTemplatesDir(): string {
  // In development: tools/harness/templates
  // In published package: dist/tools/harness/templates
  const devPath = resolve(__dirname, '../../templates');
  const distPath = resolve(__dirname, '../templates');
  return fs.existsSync(devPath) ? devPath : distPath;
}

export async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const fullPath = resolve(getTemplatesDir(), templatePath);
  const template = await fs.readFile(fullPath, 'utf-8');
  return ejs.render(template, data, { async: false });
}

export async function writeRenderedTemplate(
  templatePath: string,
  outputPath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const content = await renderTemplate(templatePath, data);
  await fs.ensureDir(dirname(outputPath));
  await fs.writeFile(outputPath, content, 'utf-8');
}

export async function copyTemplate(
  templatePath: string,
  outputPath: string,
): Promise<void> {
  const fullPath = resolve(getTemplatesDir(), templatePath);
  await fs.ensureDir(dirname(outputPath));
  await fs.copy(fullPath, outputPath);
}
