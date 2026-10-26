import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeLogin, parseAuthStatus, type CliResult, type CliRunner } from './claude-login';

const ok = (stdout: string): CliResult => ({ code: 0, stdout, stderr: '' });
const connected = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'dev@example.com', subscriptionType: 'max' });

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => {
    this.emit('close', null);
    return true;
  });
}
const asChild = (child: FakeChild) => child as unknown as ChildProcess;

describe('parseAuthStatus', () => {
  it('maps the CLI json without inventing a plan', () => {
    expect(parseAuthStatus(connected)).toEqual({ state: 'connected', email: 'dev@example.com', method: 'claude.ai', plan: 'max', loginUrl: null, error: null });
    expect(parseAuthStatus(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.co', subscriptionType: null }))?.plan).toBeNull();
  });
  it('reports disconnected and rejects garbage', () => {
    expect(parseAuthStatus(JSON.stringify({ loggedIn: false }))?.state).toBe('disconnected');
    expect(parseAuthStatus('not json')).toBeNull();
  });
});

describe('ClaudeLogin', () => {
  it('status runs claude auth status --json with the supplied env', async () => {
    const run = vi.fn<CliRunner>(async () => ok(connected));
    const env = { PATH: '/bin' };
    const login = new ClaudeLogin(() => env, { run, spawn: vi.fn() });
    expect((await login.status()).state).toBe('connected');
    expect(run).toHaveBeenCalledWith('claude', ['auth', 'status', '--json'], env);
  });

  it('status surfaces a missing CLI as error', async () => {
    const run: CliRunner = async () => ({ code: 127, stdout: '', stderr: 'spawn claude ENOENT' });
    const status = await new ClaudeLogin(() => ({}), { run, spawn: vi.fn() }).status();
    expect(status).toMatchObject({ state: 'error', error: 'spawn claude ENOENT' });
  });

  it('login spawns claude auth login --claudeai, returns pending with the captured url and reports pending until it exits', async () => {
    const child = new FakeChild();
    const spawn = vi.fn(() => asChild(child));
    const run = vi.fn<CliRunner>(async () => ok(connected));
    const login = new ClaudeLogin(() => ({}), { run, spawn });
    const started = login.login();
    child.stdout.emit('data', 'Opening browser. If it does not open visit https://claude.ai/oauth/authorize?code=true&state=abc\n');
    expect(await started).toMatchObject({ state: 'pending', loginUrl: 'https://claude.ai/oauth/authorize?code=true&state=abc' });
    expect(spawn).toHaveBeenCalledWith('claude', ['auth', 'login', '--claudeai'], {});
    expect(await login.status()).toMatchObject({ state: 'pending', loginUrl: expect.stringContaining('claude.ai') });
    expect(run).not.toHaveBeenCalled();
    child.emit('close', 0);
    expect((await login.status()).state).toBe('connected');
  });

  it('a second login while one is running does not spawn again', async () => {
    const child = new FakeChild();
    const spawn = vi.fn(() => asChild(child));
    const login = new ClaudeLogin(() => ({}), { run: async () => ok(connected), spawn }, 'claude', 20);
    await login.login();
    await login.login();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('a failed login keeps a redacted error for the next status', async () => {
    const child = new FakeChild();
    const run: CliRunner = async () => ok(JSON.stringify({ loggedIn: false }));
    const login = new ClaudeLogin(() => ({}), { run, spawn: () => asChild(child) });
    const started = login.login();
    child.stderr.emit('data', 'login failed token sk-ant-secretvalue123');
    child.emit('close', 1);
    const result = await started;
    expect(result.state).toBe('disconnected');
    expect(result.error).toContain('login failed');
    expect(result.error).not.toContain('secretvalue');
  });

  it('logout kills a pending login and runs claude auth logout', async () => {
    const child = new FakeChild();
    const calls: string[][] = [];
    const run: CliRunner = async (_f, args) => {
      calls.push(args);
      return ok(args[1] === 'status' ? JSON.stringify({ loggedIn: false }) : '');
    };
    const login = new ClaudeLogin(() => ({}), { run, spawn: () => asChild(child) }, 'claude', 20);
    await login.login();
    expect((await login.logout()).state).toBe('disconnected');
    expect(child.kill).toHaveBeenCalled();
    expect(calls[0]).toEqual(['auth', 'logout']);
  });

  it('a spawn error is reported as error without throwing', async () => {
    const child = new FakeChild();
    const login = new ClaudeLogin(() => ({}), { run: async () => ok(JSON.stringify({ loggedIn: false })), spawn: () => asChild(child) });
    const started = login.login();
    child.emit('error', new Error('spawn claude ENOENT'));
    expect((await started).error).toBe('spawn claude ENOENT');
  });
});
