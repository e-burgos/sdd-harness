import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.SDD_STUDIO_HOME = mkdtempSync(path.join(tmpdir(), 'studio-home-'));
