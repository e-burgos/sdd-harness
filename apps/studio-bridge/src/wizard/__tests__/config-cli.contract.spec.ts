import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConfigCatalog, ConfigValidation } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { createConfigCli } from '../config-cli';
import { locateHarnessCli } from '../cli-locator';

const cli = locateHarnessCli();
const built = existsSync(path.join(path.dirname(cli.bin), '..', 'dist', 'cli.js'));

describe.skipIf(!built)('real harness CLI contract', () => {
  const configCli = createConfigCli({ cli });

  it('config catalog --json parses with the protocol schema', async () => {
    const catalog = await configCli.catalog();
    expect(ConfigCatalog.safeParse(catalog).success).toBe(true);
    expect(catalog.cliVersion).toBe(cli.version);
    expect(catalog.appTypes.length).toBeGreaterThan(0);
  });

  it('config validate - --json parses with the protocol schema for an invalid and a valid config', async () => {
    const invalid = await configCli.validate({});
    expect(ConfigValidation.safeParse(invalid).success).toBe(true);
    expect(invalid.ok).toBe(false);

    const valid = await configCli.validate({
      project: { name: 'contract-check', packageScope: '@contract-check' },
      apps: [{ name: 'api', type: 'nestjs' }],
    });
    expect(ConfigValidation.safeParse(valid).success).toBe(true);
  });
});
