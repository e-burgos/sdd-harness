import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import fs from 'fs-extra';
import { defineCommand } from 'citty';
import {
  createRepo,
  ghStatus,
  getGithubRunner,
  gitStatus,
  parseRemoteUrl,
  protectBranch,
  REQUIRED_CHECK,
} from '../../utils/github.js';
import { getTemplatesDir } from '../../utils/fs.js';
import {
  decideConfirmation,
  dirArg,
  GH_AUTH_HELP,
  GH_INSTALL_HELP,
  printError,
  printJson,
  printLine,
  resolveDir,
} from './shared.js';
import { WORKFLOW_PATH } from './status.js';

const WORKFLOW_COMMIT_MESSAGE = 'ci: add SDD validation workflow';
const INITIAL_COMMIT_MESSAGE = 'chore: initial commit';

function projectNameFor(cwd: string): string {
  try {
    const global = JSON.parse(readFileSync(resolve(cwd, 'sdd/global.json'), 'utf-8')) as {
      project?: unknown;
    };
    if (typeof global.project === 'string' && global.project.trim()) return global.project.trim();
  } catch {
    return basename(cwd);
  }
  return basename(cwd);
}

function findWorkflowTemplate(cwd: string): string | null {
  const candidates = [
    resolve(cwd, 'sdd/templates/github/workflows/sdd-validate.yml'),
    resolve(getTemplatesDir(), 'sdd/templates/github/workflows/sdd-validate.yml'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export const connectCommand = defineCommand({
  meta: {
    name: 'connect',
    description:
      'Create the GitHub repository for this project with the gh CLI and push it, CI workflow included',
  },
  args: {
    dir: dirArg,
    name: { type: 'string', description: 'Repository name (default: sdd/global.json project or folder name)' },
    owner: { type: 'string', description: 'Owner (user or org); default: the authenticated gh user' },
    public: { type: 'boolean', description: 'Create a public repository (default: private)', default: false },
    protect: {
      type: 'boolean',
      description: `Require the "${REQUIRED_CHECK}" check on the branch after pushing`,
      default: false,
    },
    yes: { type: 'boolean', description: 'Skip the confirmation prompt', default: false },
    json: { type: 'boolean', description: 'Machine-readable output', default: false },
  },
  async run({ args }) {
    const cwd = resolveDir(args.dir);
    const run = getGithubRunner();
    const fail = (message: string, code: string) => {
      printError(message);
      if (args.json) printJson({ ok: false, error: { code, message } });
      process.exitCode = 1;
    };
    const git = (gitArgs: string[]) => run('git', gitArgs, { cwd });

    const gh = await ghStatus(run, cwd);
    if (!gh.installed) return fail(GH_INSTALL_HELP, 'gh-missing');
    if (!gh.authenticated) return fail(GH_AUTH_HELP, 'gh-unauthenticated');

    const before = await gitStatus(run, cwd);
    if (before.originUrl) {
      const ref = parseRemoteUrl(before.originUrl);
      const remote = { url: before.originUrl, owner: ref?.owner ?? null, name: ref?.name ?? null };
      if (args.json) printJson({ ok: true, alreadyConnected: true, remote });
      else printLine(`Already connected: origin is ${before.originUrl}. Nothing changed.`);
      return;
    }

    const name = args.name || projectNameFor(cwd);
    const owner = args.owner || undefined;
    const visibility = args.public ? 'public' : 'private';
    const workflowMissing = !existsSync(resolve(cwd, WORKFLOW_PATH));
    const needsRepoInit = !before.repo;
    const needsInitialCommit = !before.hasCommits;
    const plan = {
      owner: owner ?? gh.user,
      name,
      visibility,
      branch: before.branch ?? 'main',
      addWorkflow: workflowMissing,
      initRepo: needsRepoInit,
      initialCommit: needsInitialCommit,
      protect: args.protect,
    };

    if (!args.json) {
      printLine(
        `Plan: create ${visibility} repository ${plan.owner ?? ''}/${name} from branch ${plan.branch} and push.`,
      );
      if (needsRepoInit) printLine('  - initialize a git repository');
      if (needsInitialCommit) printLine('  - create the initial commit');
      if (workflowMissing) printLine(`  - add ${WORKFLOW_PATH} and commit it`);
      if (args.protect) printLine(`  - require the "${REQUIRED_CHECK}" check on the branch`);
    }

    const decision = await decideConfirmation({
      yes: args.yes,
      json: args.json,
      message: `Create the ${visibility} repository ${name} on GitHub?`,
    });
    if (decision === 'needs-confirmation') {
      if (args.json) printJson({ ok: false, needsConfirmation: true, plan });
      else printLine('Nothing done: re-run with --yes to confirm.');
      return;
    }
    if (decision === 'declined') {
      printLine('Cancelled.');
      return;
    }

    if (needsRepoInit) {
      const init = await git(['init']);
      if (init.code !== 0) return fail(init.stderr.trim() || 'git init failed', 'git-failed');
    }

    if (workflowMissing) {
      const template = findWorkflowTemplate(cwd);
      if (!template) {
        return fail(`Workflow template not found; cannot write ${WORKFLOW_PATH}.`, 'template-missing');
      }
      await fs.ensureDir(resolve(cwd, '.github/workflows'));
      await fs.copyFile(template, resolve(cwd, WORKFLOW_PATH));
    }

    if (needsInitialCommit || workflowMissing) {
      const add = await git(needsInitialCommit ? ['add', '-A'] : ['add', WORKFLOW_PATH]);
      if (add.code !== 0) return fail(add.stderr.trim() || 'git add failed', 'git-failed');
      const message = needsInitialCommit ? INITIAL_COMMIT_MESSAGE : WORKFLOW_COMMIT_MESSAGE;
      const commit = await git(['commit', '-m', message]);
      if (commit.code !== 0) {
        return fail(
          commit.stderr.trim() ||
            commit.stdout.trim() ||
            'git commit failed (is user.name/user.email configured?)',
          'git-failed',
        );
      }
    }

    const created = await createRepo(run, { owner, name, visibility, cwd });
    if (created.code !== 0) return fail(created.stderr.trim() || 'gh repo create failed', 'create-failed');

    const after = await gitStatus(run, cwd);
    const ref = after.originUrl ? parseRemoteUrl(after.originUrl) : null;
    const remote = {
      url: after.originUrl ?? created.stdout.trim(),
      owner: ref?.owner ?? owner ?? gh.user,
      name: ref?.name ?? name,
    };

    let protectedBranch = false;
    if (args.protect) {
      const branch = after.branch ?? plan.branch;
      if (!remote.owner || !remote.name) {
        return fail('Could not resolve the new repository to protect.', 'protect-failed');
      }
      const result = await protectBranch(run, {
        owner: remote.owner,
        name: remote.name,
        branch,
        cwd,
      });
      if (result.code !== 0) return fail(result.stderr.trim() || 'gh api failed', 'protect-failed');
      protectedBranch = true;
    }

    if (args.json) printJson({ ok: true, remote, protected: protectedBranch });
    else {
      printLine(`Repository created: ${remote.url}`);
      if (protectedBranch) printLine(`Branch protected: "${REQUIRED_CHECK}" required.`);
    }
  },
});
