import { resolve } from 'node:path';
import fs from 'fs-extra';
import { copyBlueprint, resolveBlueprintDir } from '../utils/blueprint.js';

const LIB_TYPE_TAGS: Record<string, string> = {
  'shared-types': 'type:types',
  'shared-utils': 'type:util',
  'ui-kit': 'type:ui',
  'api-client': 'type:data',
  config: 'type:config',
};

/**
 * Genera una librería compartida a partir del blueprint portable
 * sdd/templates/libs/ts-lib (skill scaffold-nx), ajustando tags por tipo y
 * registrando el path alias @[nombre] en tsconfig.base.json.
 */
export async function generateLib(
  root: string,
  lib: { name: string; type: string },
  packageScope: string,
): Promise<void> {
  const libDir = resolve(root, 'libs', lib.name);
  const blueprint = resolveBlueprintDir(root, 'libs/ts-lib');

  await copyBlueprint(blueprint, libDir, { 'shared-lib': lib.name });

  const projectJsonPath = resolve(libDir, 'project.json');
  const projectJson = await fs.readJSON(projectJsonPath);
  projectJson.tags = ['scope:shared', LIB_TYPE_TAGS[lib.type] ?? 'type:util'];
  await fs.writeJSON(projectJsonPath, projectJson, { spaces: 2 });

  if (lib.type === 'ui-kit') {
    const tsconfigPath = resolve(libDir, 'tsconfig.json');
    const tsconfig = await fs.readJSON(tsconfigPath);
    tsconfig.compilerOptions = {
      ...tsconfig.compilerOptions,
      jsx: 'react-jsx',
    };
    await fs.writeJSON(tsconfigPath, tsconfig, { spaces: 2 });
  }

  await fs.writeFile(
    resolve(libDir, 'src/index.ts'),
    `// ${packageScope}/${lib.name}\nexport {};\n`,
    'utf-8',
  );

  await registerTsconfigPath(root, lib.name);
}

async function registerTsconfigPath(root: string, name: string): Promise<void> {
  const tsconfigBasePath = resolve(root, 'tsconfig.base.json');
  if (!(await fs.pathExists(tsconfigBasePath))) return;

  const tsconfigBase = await fs.readJSON(tsconfigBasePath);
  tsconfigBase.compilerOptions.paths = {
    ...tsconfigBase.compilerOptions.paths,
    [`@${name}`]: [`./libs/${name}/src/index.ts`],
  };
  await fs.writeJSON(tsconfigBasePath, tsconfigBase, { spaces: 2 });
}
