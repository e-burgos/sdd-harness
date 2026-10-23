import { describe, expect, it } from 'vitest';
import { alwaysOfferOf, bashPrefixOf, matchesRule, ruleOf } from './always-rule';

describe('bashPrefixOf', () => {
  it.each([
    ['git status --short', 'git status'],
    ['pnpm nx run-many -t lint', 'pnpm nx run-many'],
    ['pnpm sdd:validate', 'pnpm sdd:validate'],
    ['ls -la apps', 'ls'],
    ['./gradlew build', './gradlew build'],
    ['git commit -m "msg with spaces"', 'git commit'],
    ["echo 'a b' c", 'echo'],
    ['git   status', 'git status'],
  ])('%s -> %s', (command, prefix) => expect(bashPrefixOf(command)).toBe(prefix));

  it.each([
    ['npx vitest run'],
    ['pnpx tsc'],
    ['sudo rm -rf /'],
    ['/usr/bin/sudo ls'],
    ['bash -c "ls"'],
    ['env FOO=1 ls'],
    ['FOO=1 git status'],
    ['git log | head'],
    ['git status && rm -rf x'],
    ['git status; rm -rf x'],
    ['git status & disown'],
    ['echo $(whoami)'],
    ['echo `whoami`'],
    ['cat < /etc/passwd'],
    ['echo hi > out.txt'],
    ['(git status)'],
    ['{ git status; }'],
    ['git status\nrm -rf x'],
    ['echo "unbalanced'],
    ["echo 'unbalanced"],
    [''],
    ['   '],
    ['~/bin/tool run'],
  ])('%j is not calculable', (command) => expect(bashPrefixOf(command)).toBeNull());
});

describe('alwaysOfferOf', () => {
  it('offers a tool rule for edit tools and unknown tools', () => {
    expect(alwaysOfferOf('Edit', {})).toEqual({ kind: 'tool', tool: 'Edit' });
    expect(alwaysOfferOf('Write', {})).toEqual({ kind: 'tool', tool: 'Write' });
    expect(alwaysOfferOf('WebFetch', {})).toEqual({ kind: 'tool', tool: 'WebFetch' });
  });

  it('offers the full mcp tool name', () => {
    expect(alwaysOfferOf('mcp__fake__ping', {})).toEqual({ kind: 'mcp', tool: 'mcp__fake__ping' });
  });

  it('offers a bash prefix or reports not-calculable', () => {
    expect(alwaysOfferOf('Bash', { command: 'git status --short' })).toEqual({ kind: 'bash-prefix', prefix: 'git status' });
    expect(alwaysOfferOf('Bash', { command: 'npx vitest run' })).toEqual({ kind: 'none', reason: 'not-calculable' });
    expect(alwaysOfferOf('Bash', {})).toEqual({ kind: 'none', reason: 'not-calculable' });
  });

  it('never offers a rule on a gate warning, whatever the tool', () => {
    expect(alwaysOfferOf('Edit', {}, 'warn')).toEqual({ kind: 'none', reason: 'gate-warning' });
    expect(alwaysOfferOf('Bash', { command: 'git status' }, 'warn')).toEqual({ kind: 'none', reason: 'gate-warning' });
  });

  it('refuses names that exceed the protocol limits', () => {
    expect(alwaysOfferOf('T'.repeat(129), {})).toEqual({ kind: 'none', reason: 'not-calculable' });
    expect(alwaysOfferOf(`mcp__s__${'t'.repeat(260)}`, {})).toEqual({ kind: 'none', reason: 'not-calculable' });
  });

  it('ruleOf returns the rule only for real offers', () => {
    expect(ruleOf({ kind: 'tool', tool: 'Edit' })).toEqual({ kind: 'tool', tool: 'Edit' });
    expect(ruleOf({ kind: 'none', reason: 'gate-warning' })).toBeNull();
  });
});

describe('matchesRule', () => {
  const git = { kind: 'bash-prefix', prefix: 'git status' } as const;
  const bash = (command: string) => matchesRule(git, 'Bash', { command });

  it('matches commands that start with the same tokens', () => {
    expect(bash('git status')).toBe(true);
    expect(bash('git status --short')).toBe(true);
    expect(bash('git   status  -sb')).toBe(true);
  });

  it('never matches a compound command that merely starts with the prefix', () => {
    expect(bash('git status && rm -rf x')).toBe(false);
    expect(bash('git status; rm -rf x')).toBe(false);
    expect(bash('git status | tee out')).toBe(false);
    expect(bash('git status $(rm -rf x)')).toBe(false);
  });

  it('does not match a different program, subcommand or a shorter command', () => {
    expect(bash('git statusx')).toBe(false);
    expect(bash('git log')).toBe(false);
    expect(bash('git')).toBe(false);
    expect(bash('FOO=1 git status')).toBe(false);
    expect(matchesRule(git, 'Edit', { command: 'git status' })).toBe(false);
    expect(matchesRule(git, 'Bash', {})).toBe(false);
  });

  it('a single-token prefix covers any simple invocation of that program', () => {
    expect(matchesRule({ kind: 'bash-prefix', prefix: 'ls' }, 'Bash', { command: 'ls -la apps' })).toBe(true);
    expect(matchesRule({ kind: 'bash-prefix', prefix: 'ls' }, 'Bash', { command: 'lsof' })).toBe(false);
  });

  it('tool and mcp rules match the exact tool name only', () => {
    expect(matchesRule({ kind: 'tool', tool: 'Edit' }, 'Edit', {})).toBe(true);
    expect(matchesRule({ kind: 'tool', tool: 'Edit' }, 'Write', {})).toBe(false);
    expect(matchesRule({ kind: 'mcp', tool: 'mcp__fake__ping' }, 'mcp__fake__ping', {})).toBe(true);
    expect(matchesRule({ kind: 'mcp', tool: 'mcp__fake__ping' }, 'mcp__fake__other', {})).toBe(false);
  });
});
