import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type Lib = {
  REQUIRED_CHECK: string;
  BRANCH_PREFIX: string;
  specSlugOf(specId: string): string;
  branchNameFor(specId: string, cycle: string): string;
  branchPolicy(global?: unknown): 'on' | 'off';
  defaultBranchOf(global?: unknown): string;
  prTitleFor(input: { specId: string; specTitle: string; module: string; cycle: string }): string;
  prBodyFor(input: { specId: string; cycle: string; cycleJson: unknown }): string;
  parseRemoteUrl(url: string): { owner: string; name: string } | null;
};

const KIT = resolve(__dirname, '../../../templates/sdd');
let lib: Lib;

beforeAll(async () => {
  lib = (await import(pathToFileURL(resolve(KIT, 'scripts/lib/github.mjs')).href)) as Lib;
});

describe('github.mjs', () => {
  it('exposes the constants', () => {
    expect(lib.REQUIRED_CHECK).toBe('sdd:validate');
    expect(lib.BRANCH_PREFIX).toBe('feat/');
  });

  it('specSlugOf strips the spec prefix and falls back to the input', () => {
    expect(lib.specSlugOf('spec-e-burgos-014-github-integration')).toBe('github-integration');
    expect(lib.specSlugOf('spec-eburgos-001-catalog-core')).toBe('catalog-core');
    expect(lib.specSlugOf('github-integration')).toBe('github-integration');
    expect(lib.specSlugOf('spec-x')).toBe('spec-x');
  });

  it('branchNameFor builds feat/<slug>-<cycle>', () => {
    expect(lib.branchNameFor('spec-e-burgos-014-github-integration', 'cycle-01')).toBe('feat/github-integration-cycle-01');
  });

  it('branchPolicy honours the override, then the profile', () => {
    expect(lib.branchPolicy({ github: { branch_per_cycle: 'on' }, profile: 'solo' })).toBe('on');
    expect(lib.branchPolicy({ github: { branch_per_cycle: 'off' }, profile: 'team' })).toBe('off');
    expect(lib.branchPolicy({ profile: 'solo' })).toBe('off');
    expect(lib.branchPolicy({ profile: 'team' })).toBe('on');
    expect(lib.branchPolicy({})).toBe('on');
    expect(lib.branchPolicy(undefined)).toBe('on');
    expect(lib.branchPolicy({ github: { branch_per_cycle: 'maybe' }, profile: 'solo' })).toBe('off');
  });

  it('defaultBranchOf defaults to main', () => {
    expect(lib.defaultBranchOf({ github: { default_branch: 'develop' } })).toBe('develop');
    expect(lib.defaultBranchOf({})).toBe('main');
    expect(lib.defaultBranchOf(undefined)).toBe('main');
  });

  it('prTitleFor formats and caps at 200 chars', () => {
    expect(lib.prTitleFor({ specId: 'spec-a-001-x', specTitle: 'GitHub integration', module: 'github-integration', cycle: 'cycle-01' })).toBe(
      'feat(github-integration): GitHub integration (spec-a-001-x cycle-01)',
    );
    const long = lib.prTitleFor({ specId: 's', specTitle: 'x'.repeat(500), module: 'm', cycle: 'cycle-01' });
    expect(long).toHaveLength(200);
  });

  it('prBodyFor renders every section', () => {
    const body = lib.prBodyFor({
      specId: 'spec-a-001-x',
      cycle: 'cycle-01',
      cycleJson: {
        objectives: ['Connect repo', 'Open PRs'],
        issues_found: ['Flaky test'],
        reviewer_report: { ca_results: { 'US-1': 'ok', 'US-2': 'ok too' }, tests: { cli: '12 passing' } },
      },
    });
    expect(body).toContain('## Summary\n\n- Connect repo\n- Open PRs');
    expect(body).toContain('## Reviewer\n\n- **US-1** — ok\n- **US-2** — ok too');
    expect(body).toContain('## Tests\n\n- **cli** — 12 passing');
    expect(body).toContain('## Issues\n\n- Flaky test');
    expect(body.trimEnd().split('\n').pop()).toBe('_Opened with `pnpm sdd:pr spec-a-001-x cycle-01`._');
  });

  it('prBodyFor omits empty sections and accepts array tests', () => {
    const minimal = lib.prBodyFor({ specId: 's', cycle: 'cycle-01', cycleJson: { objectives: ['a'], issues_found: [], reviewer_report: null } });
    expect(minimal).toContain('## Summary');
    expect(minimal).not.toContain('## Reviewer');
    expect(minimal).not.toContain('## Tests');
    expect(minimal).not.toContain('## Issues');
    const withArray = lib.prBodyFor({ specId: 's', cycle: 'cycle-01', cycleJson: { reviewer_report: { ca_results: {}, tests: ['one', 'two'] } } });
    expect(withArray).toContain('## Tests\n\n- one\n- two');
    expect(withArray).not.toContain('## Reviewer');
    expect(lib.prBodyFor({ specId: 's', cycle: 'cycle-01', cycleJson: {} })).toBe('_Opened with `pnpm sdd:pr s cycle-01`._');
  });

  it('parseRemoteUrl handles https, scp-style and ssh forms', () => {
    const expected = { owner: 'o', name: 'n' };
    expect(lib.parseRemoteUrl('https://github.com/o/n')).toEqual(expected);
    expect(lib.parseRemoteUrl('https://github.com/o/n.git')).toEqual(expected);
    expect(lib.parseRemoteUrl('git@github.com:o/n.git')).toEqual(expected);
    expect(lib.parseRemoteUrl('git@github.com:o/n')).toEqual(expected);
    expect(lib.parseRemoteUrl('ssh://git@github.com/o/n.git')).toEqual(expected);
    expect(lib.parseRemoteUrl('ssh://git@github.com/o/n')).toEqual(expected);
    expect(lib.parseRemoteUrl('https://github.com/o/my.repo.git')).toEqual({ owner: 'o', name: 'my.repo' });
    expect(lib.parseRemoteUrl('https://gitlab.com/o/n.git')).toBeNull();
    expect(lib.parseRemoteUrl('')).toBeNull();
    expect(lib.parseRemoteUrl('not a url')).toBeNull();
  });
});

describe('global.schema.json github block', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(fs.readJSONSync(resolve(KIT, 'schemas/global.schema.json')));
  const base = {
    project: 'p',
    description: 'd',
    version: '1.0.0',
    completed_modules: [],
    in_progress_modules: [],
    pending_modules: [],
    monorepo: { tool: 'pnpm', package_manager: 'pnpm', apps: {}, libs: {} },
  };

  it('accepts a valid github block and its absence', () => {
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, github: { branch_per_cycle: 'off', default_branch: 'main' } })).toBe(true);
    expect(validate({ ...base, github: {} })).toBe(true);
  });

  it('rejects unknown keys and invalid values', () => {
    expect(validate({ ...base, github: { nope: 1 } })).toBe(false);
    expect(validate({ ...base, github: { branch_per_cycle: 'maybe' } })).toBe(false);
    expect(validate({ ...base, github: { default_branch: '' } })).toBe(false);
  });
});

describe('kit CI workflow', () => {
  const workflow = readFileSync(resolve(__dirname, '../../../templates/sdd/templates/github/workflows/sdd-validate.yml'), 'utf8');

  it('uses job ids GitHub accepts and names the job after the required check', () => {
    const jobsBlock = workflow.slice(workflow.indexOf('\njobs:\n'));
    const jobIds = [...jobsBlock.matchAll(/^ {2}([^\s:#][^:]*):\s*$/gm)].map((match) => match[1]);
    expect(jobIds.length).toBeGreaterThan(0);
    for (const id of jobIds) expect(id).toMatch(/^[A-Za-z_][A-Za-z0-9_-]*$/);
    expect(workflow).toMatch(/^ {4}name: sdd:validate$/m);
  });
});
