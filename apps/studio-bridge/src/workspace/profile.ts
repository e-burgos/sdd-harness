import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DevProfile } from '@sdd-studio/protocol';

export class ProfileError extends Error {
  constructor(readonly code: 'not-found' | 'bad-request', message: string) {
    super(message);
  }
}

export async function writeProfile(root: string, profile: DevProfile): Promise<void> {
  const file = path.join(root, 'sdd', 'global.json');
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) throw new ProfileError('not-found', 'sdd/global.json does not exist');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProfileError('bad-request', 'sdd/global.json is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProfileError('bad-request', 'sdd/global.json is not an object');
  }
  const next = { ...(parsed as Record<string, unknown>), profile };
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}
