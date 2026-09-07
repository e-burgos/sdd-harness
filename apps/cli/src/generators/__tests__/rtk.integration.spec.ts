import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dirname, resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

// Integración real de la capa rtk del kit: los scripts corren de verdad sobre una copia
// de templates/sdd/ (setup-rtk.mjs, rtk-hook.mjs), con un binario `rtk` falso en el PATH
// y un servidor HTTP local que hace de GitHub Releases para el instalador.
const KIT_DIR = resolve(__dirname, '../../../templates/sdd');

const FAKE_RTK = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "rtk 0.48.0"; exit 0; fi
if [ "$1" = "hook" ]; then
  cat >/dev/null
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"command":"rtk git status"}}}'
  exit 0
fi
exit 0
`;

type RunOptions = { env?: Record<string, string | undefined>; input?: string };

// Async on purpose: the install tests serve the fake release from THIS process, and a
// spawnSync would block the event loop the HTTP server needs to answer the child.
function run(ws: string, script: string, args: string[] = [], opts: RunOptions = {}) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...process.env, ...opts.env })) {
    if (value !== undefined) env[key] = value;
  }
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((done) => {
    const child = spawn(process.execPath, [resolve(ws, 'sdd/scripts', script), ...args], {
      cwd: ws,
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => done({ status, stdout, stderr }));
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}

const HOOK_INPUT = JSON.stringify({
  session_id: 's',
  tool_name: 'Bash',
  tool_input: { command: 'git status' },
});

describe.skipIf(process.platform === 'win32')('rtk kit scripts (integration)', () => {
  let ws: string;
  let fakeBin: string;

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-rtk-'));
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
    fakeBin = resolve(ws, 'fakebin');
    await fs.ensureDir(fakeBin);
    await fs.writeFile(resolve(fakeBin, 'rtk'), FAKE_RTK, { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  const skipInstall = { SDD_RTK_SKIP_INSTALL: '1' };

  it('setup-rtk deja los hooks de Claude Code y Gemini CLI sin pisar lo existente, y es idempotente', async () => {
    await fs.ensureDir(resolve(ws, '.claude'));
    await fs.writeJSON(resolve(ws, '.claude/settings.json'), {
      permissions: { allow: ['Bash(git status:*)'] },
      hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo hi' }] }] },
    });

    const first = await run(ws, 'setup-rtk.mjs', [], { env: skipInstall });
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('merged           : .claude/settings.json');
    expect(first.stdout).toContain('merged           : .gemini/settings.json');
    expect(first.stdout).toContain('skipped install');

    const claude = await fs.readJSON(resolve(ws, '.claude/settings.json'));
    expect(claude.permissions.allow).toEqual(['Bash(git status:*)']);
    expect(claude.hooks.PreToolUse).toHaveLength(2);
    expect(claude.hooks.PreToolUse[0].matcher).toBe('Write');
    const bash = claude.hooks.PreToolUse[1];
    expect(bash.matcher).toBe('Bash');
    expect(bash.hooks[0].command).toContain('$CLAUDE_PROJECT_DIR/sdd/scripts/rtk-hook.mjs');
    expect(bash.hooks[0].command).toMatch(/ claude$/);

    const gemini = await fs.readJSON(resolve(ws, '.gemini/settings.json'));
    expect(gemini.hooks.BeforeTool[0].matcher).toBe('run_shell_command');
    expect(gemini.hooks.BeforeTool[0].hooks[0].command).toBe('node sdd/scripts/rtk-hook.mjs gemini');

    const second = await run(ws, 'setup-rtk.mjs', [], { env: skipInstall });
    expect(second.stdout).toContain('present          : .claude/settings.json');
    const again = await fs.readJSON(resolve(ws, '.claude/settings.json'));
    expect(again.hooks.PreToolUse).toHaveLength(2);
  });

  it('respeta un hook nativo de `rtk init` y no rompe con un settings.json inválido', async () => {
    await fs.ensureDir(resolve(ws, '.claude'));
    await fs.writeJSON(resolve(ws, '.claude/settings.json'), {
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook claude' }] }] },
    });
    await fs.ensureDir(resolve(ws, '.gemini'));
    await fs.writeFile(resolve(ws, '.gemini/settings.json'), '{ not json');

    const result = await run(ws, 'setup-rtk.mjs', [], { env: skipInstall });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("kept yours       : .claude/settings.json already runs rtk's own hook");
    expect(result.stderr).toContain('.gemini/settings.json is not valid JSON');
    const claude = await fs.readJSON(resolve(ws, '.claude/settings.json'));
    expect(claude.hooks.PreToolUse).toHaveLength(1);
    expect(await fs.readFile(resolve(ws, '.gemini/settings.json'), 'utf-8')).toBe('{ not json');
  });

  it('rtk-hook: passthrough silencioso sin binario o apagado; delega cuando rtk está y tools.json lo habilita', async () => {
    const noBinary = await run(ws, 'rtk-hook.mjs', ['claude'], {
      input: HOOK_INPUT,
      env: { PATH: '/nonexistent', RTK_INSTALL_DIR: resolve(ws, 'empty') },
    });
    expect(noBinary.status).toBe(0);
    expect(noBinary.stdout).toBe('');

    const withBinary = await run(ws, 'rtk-hook.mjs', ['claude'], {
      input: HOOK_INPUT,
      env: { PATH: `${fakeBin}:${process.env['PATH']}` },
    });
    expect(withBinary.status).toBe(0);
    expect(JSON.parse(withBinary.stdout).hookSpecificOutput.updatedInput.command).toBe('rtk git status');

    const disable = await run(ws, 'setup-rtk.mjs', ['--disable']);
    expect(disable.stdout).toContain('rtk disabled in sdd/tools.json');
    expect((await fs.readJSON(resolve(ws, 'sdd/tools.json'))).rtk.enabled).toBe(false);

    const disabled = await run(ws, 'rtk-hook.mjs', ['claude'], {
      input: HOOK_INPUT,
      env: { PATH: `${fakeBin}:${process.env['PATH']}` },
    });
    expect(disabled.stdout).toBe('');

    await run(ws, 'setup-rtk.mjs', ['--enable']);
    const statusRun = await run(ws, 'setup-rtk.mjs', ['--status'], {
      env: { PATH: `${fakeBin}:${process.env['PATH']}` },
    });
    const status = JSON.parse(statusRun.stdout);
    expect(status.enabled).toBe(true);
    expect(status.version).toBe('0.48.0');
    expect(status.binary).toBe(resolve(fakeBin, 'rtk'));

    const unknownAgent = await run(ws, 'rtk-hook.mjs', ['cursor'], {
      input: HOOK_INPUT,
      env: { PATH: `${fakeBin}:${process.env['PATH']}` },
    });
    expect(unknownAgent.stdout).toBe('');
  });

  it('tools.json apagado o auto_install=false no descarga nada; CI tampoco', async () => {
    await fs.writeJSON(resolve(ws, 'sdd/tools.json'), {
      $schema: './schemas/tools.schema.json',
      rtk: { enabled: true, auto_install: false },
    });
    const noAuto = await run(ws, 'setup-rtk.mjs', [], {
      env: { SDD_RTK_SKIP_INSTALL: undefined, CI: undefined, PATH: '/nonexistent', RTK_INSTALL_DIR: resolve(ws, 'bin') },
    });
    expect(noAuto.stdout).toContain('rtk.auto_install is false');

    const ci = await run(ws, 'setup-rtk.mjs', [], {
      env: { SDD_RTK_SKIP_INSTALL: undefined, CI: 'true', PATH: '/nonexistent', RTK_INSTALL_DIR: resolve(ws, 'bin') },
    });
    expect(ci.stdout).toContain('CI environment');
    expect(fs.existsSync(resolve(ws, 'bin/rtk'))).toBe(false);
  });

  describe('instalación del binario contra un GitHub Releases local', () => {
    let server: Server;
    let baseUrl: string;
    const files = new Map<string, Buffer>();

    beforeEach(async () => {
      const stage = resolve(ws, 'stage');
      await fs.ensureDir(stage);
      await fs.writeFile(resolve(stage, 'rtk'), FAKE_RTK, { mode: 0o755 });
      const asset = `rtk-${process.platform === 'darwin' ? (process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin') : process.arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-musl'}.tar.gz`;
      execFileSync('tar', ['-czf', resolve(ws, asset), '-C', stage, 'rtk']);
      const archive = await fs.readFile(resolve(ws, asset));
      files.set(`/${asset}`, archive);
      const digest = createHash('sha256').update(archive).digest('hex');
      files.set('/checksums.txt', Buffer.from(`${digest}  ${asset}\n`));
      server = createServer((req, res) => {
        const body = files.get(req.url ?? '');
        if (!body) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Length': body.length });
        res.end(body);
      });
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    });

    afterEach(async () => {
      await new Promise<void>((done) => server.close(() => done()));
    });

    const installEnv = (extra: Record<string, string> = {}) => ({
      SDD_RTK_SKIP_INSTALL: undefined,
      CI: undefined,
      // node's own dir so the installed script can be version-checked; no real rtk anywhere.
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      RTK_INSTALL_DIR: resolve(ws, 'bin'),
      SDD_RTK_RELEASE_BASE_URL: baseUrl,
      // The sandbox routes fetch/curl through a proxy that cannot reach loopback.
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      ...extra,
    });

    it('descarga la versión pinneada, verifica el checksum y deja el binario listo; segunda corrida no re-descarga', async () => {
      const first = await run(ws, 'setup-rtk.mjs', [], { env: installEnv() });
      expect(first.status).toBe(0);
      expect(first.stdout).toContain('installed        : rtk 0.48.0');
      expect(fs.existsSync(resolve(ws, 'bin/rtk'))).toBe(true);

      const second = await run(ws, 'setup-rtk.mjs', [], { env: installEnv() });
      expect(second.stdout).toContain('present          : rtk 0.48.0');
    });

    it('un checksum que no coincide se rechaza y el kit sigue andando (exit 0 + aviso)', async () => {
      files.set('/checksums.txt', Buffer.from(`${'0'.repeat(64)}  rtk-x86_64-unknown-linux-musl.tar.gz\n${'0'.repeat(64)}  rtk-aarch64-unknown-linux-gnu.tar.gz\n${'0'.repeat(64)}  rtk-x86_64-apple-darwin.tar.gz\n${'0'.repeat(64)}  rtk-aarch64-apple-darwin.tar.gz\n`));
      const result = await run(ws, 'setup-rtk.mjs', [], { env: installEnv() });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('checksum mismatch');
      expect(result.stderr).toContain('install.sh | sh');
      expect(fs.existsSync(resolve(ws, 'bin/rtk'))).toBe(false);
    });
  });
});
