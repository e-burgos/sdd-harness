import {
  acceptsShell,
  appTypeEntry,
  backendFamilies,
  libsAllowed,
  maxAppsFor,
  modeAllowsScope,
  modeBlockReason,
  stackDescription,
  supportsMl,
  supportsTucuUi,
  typeOptions,
} from '../catalog';
import { catalogFixture } from './fixtures';

describe('catalog selectors', () => {
  it('lists frontend types and blocks the workspace-only ones in standalone', () => {
    const blocked = typeOptions(catalogFixture, 'standalone', 'frontend').filter((o) => o.blocked).map((o) => o.type);
    expect(blocked).toEqual(['next-bff', 'mfe-shell', 'mfe']);
    expect(typeOptions(catalogFixture, 'nx', 'frontend').every((o) => o.blocked === null)).toBe(true);
    expect(typeOptions(catalogFixture, null, 'frontend').every((o) => o.blocked === null)).toBe(true);
  });

  it('lists backend types by role', () => {
    expect(typeOptions(catalogFixture, 'nx', 'backend').map((o) => o.type)).toEqual(['nestjs', 'fastify', 'hono', 'python', 'springboot']);
  });

  it('reads limits and flags from the catalog', () => {
    expect(maxAppsFor(catalogFixture, 'standalone')).toBe(1);
    expect(maxAppsFor(catalogFixture, 'nx')).toBeNull();
    expect(libsAllowed(catalogFixture, 'nx')).toBe(true);
    expect(libsAllowed(catalogFixture, 'standalone')).toBe(false);
    expect(supportsTucuUi(catalogFixture, 'react')).toBe(true);
    expect(supportsTucuUi(catalogFixture, 'nestjs')).toBe(false);
    expect(supportsMl(catalogFixture, 'python')).toBe(true);
    expect(acceptsShell(catalogFixture, 'mfe')).toBe(true);
    expect(acceptsShell(catalogFixture, 'mfe-shell')).toBe(false);
    expect(appTypeEntry(catalogFixture, 'unknown')).toBeUndefined();
  });

  it('explains why standalone is blocked for full stack', () => {
    expect(modeAllowsScope(catalogFixture, 'standalone', 'fullstack')).toBe(false);
    expect(modeAllowsScope(catalogFixture, 'standalone', 'front')).toBe(true);
    expect(modeBlockReason(catalogFixture, 'standalone', 'fullstack')).toBe('fullstack-needs-nx');
    expect(modeBlockReason(catalogFixture, 'nx', 'fullstack')).toBeNull();
    expect(modeBlockReason(catalogFixture, 'standalone', null)).toBeNull();
  });

  it('groups backends in families', () => {
    expect(backendFamilies(catalogFixture).map((f) => [f.id, f.options.map((o) => o.type)])).toEqual([
      ['node', ['nestjs', 'fastify', 'hono']],
      ['python', ['python']],
      ['java', ['springboot']],
    ]);
  });

  it('prefers the plain stack text when present', () => {
    const entry = appTypeEntry(catalogFixture, 'react')!;
    expect(stackDescription(entry, true)).toBe('react stack');
    expect(stackDescription({ ...entry, stackPlain: 'plain' }, true)).toBe('plain');
    expect(stackDescription({ ...entry, stackPlain: 'plain' }, false)).toBe('react stack');
  });
});
