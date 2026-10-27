import { createHash } from 'node:crypto';
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import type { ErrorCode, KitToolsState, ToolsChange, ToolsSetResult, ToolsValue } from '@sdd-studio/protocol';
import { z } from 'zod';

export class KitToolsError extends Error {
  constructor(readonly code: Extract<ErrorCode, 'not-found' | 'bad-request' | 'conflict' | 'internal'>, message: string) {
    super(message);
  }
}

type ToolsDocument = Record<string, unknown>;

const MOD_MANIFEST = path.join('.claude', 'skills', 'sdd-mod', '.claude-plugin', 'plugin.json');
const FS_PERMISSION_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);

const FallbackToolsSchema = z.looseObject({
  rtk: z.looseObject({ enabled: z.boolean() }),
  claude_mod: z.looseObject({ enabled: z.boolean().optional(), gate: z.enum(['block', 'warn']).optional() }).optional(),
});

const toolsFile = (root: string) => path.join(root, 'sdd', 'tools.json');
const toolsSchemaFile = (root: string) => path.join(root, 'sdd', 'schemas', 'tools.schema.json');

export function computeToolsRevision(raw: Buffer | string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function effectiveToolsValues(doc: ToolsDocument): { rtkEnabled: boolean; modEnabled: boolean; gate: 'block' | 'warn' } {
  const mod = asRecord(doc.claude_mod);
  return {
    rtkEnabled: asRecord(doc.rtk).enabled !== false,
    modEnabled: mod.enabled === true,
    gate: mod.gate === 'warn' ? 'warn' : 'block',
  };
}

export function effectiveValueFor(doc: ToolsDocument, tool: ToolsChange['tool']): ToolsValue {
  const values = effectiveToolsValues(doc);
  if (tool === 'rtk') return values.rtkEnabled;
  if (tool === 'mod') return values.modEnabled;
  return values.gate;
}

function requestedValue(change: ToolsChange): ToolsValue {
  return change.tool === 'gate' ? change.mode : change.enabled;
}

export function applyToolsChange(doc: ToolsDocument, change: ToolsChange): ToolsDocument {
  const next: ToolsDocument = { ...doc };
  if (change.tool === 'rtk') {
    next.rtk = { ...asRecord(doc.rtk), enabled: change.enabled };
    return next;
  }
  const patch = change.tool === 'mod' ? { enabled: change.enabled } : { gate: change.mode };
  next.claude_mod = { enabled: false, gate: 'block', ...asRecord(doc.claude_mod), ...patch };
  return next;
}

export function serializeTools(doc: ToolsDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

type ToolsValidator = (doc: unknown) => string | null;

const structuralValidator: ToolsValidator = (doc) => {
  const parsed = FallbackToolsSchema.safeParse(doc);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  return issue ? `/${issue.path.join('/')} ${issue.message}`.trim() : 'is invalid';
};

export async function loadValidator(root: string): Promise<ToolsValidator> {
  const rawSchema = await readFile(toolsSchemaFile(root), 'utf8').catch(() => null);
  if (rawSchema !== null) {
    try {
      const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(rawSchema));
      return (doc) => {
        if (validate(doc)) return null;
        const first = validate.errors?.[0];
        return first ? `${first.instancePath || '/'} ${first.message ?? 'is invalid'}`.trim() : 'does not match tools.schema.json';
      };
    } catch {
      return structuralValidator;
    }
  }
  return structuralValidator;
}

async function readToolsBytes(root: string): Promise<Buffer> {
  try {
    return await readFile(toolsFile(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new KitToolsError('not-found', 'sdd/tools.json does not exist');
    }
    throw new KitToolsError('internal', `cannot read sdd/tools.json (${(error as NodeJS.ErrnoException).code ?? 'unknown'})`);
  }
}

function parseToolsObject(raw: Buffer): ToolsDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new KitToolsError('bad-request', 'sdd/tools.json is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new KitToolsError('bad-request', 'sdd/tools.json is not an object');
  }
  return parsed as ToolsDocument;
}

export async function isModLinked(root: string): Promise<boolean> {
  return access(path.join(root, MOD_MANIFEST)).then(
    () => true,
    () => false,
  );
}

async function writeToolsAtomically(root: string, content: string): Promise<void> {
  const file = toolsFile(root);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, content, 'utf8');
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    throw new KitToolsError('internal', FS_PERMISSION_CODES.has(code) ? `cannot write sdd/tools.json (${code})` : `write failed (${code})`);
  }
}

function toolsState(doc: ToolsDocument, revision: string, modLinked: boolean): KitToolsState {
  const values = effectiveToolsValues(doc);
  return { status: 'ok', ...values, modLinked, revision };
}

async function runToolsSet(root: string, change: ToolsChange, expectedRevision: string): Promise<ToolsSetResult> {
  const raw = await readToolsBytes(root);
  const revision = computeToolsRevision(raw);
  if (revision !== expectedRevision) {
    throw new KitToolsError('conflict', 'sdd/tools.json changed since it was read; refresh and try again');
  }
  const doc = parseToolsObject(raw);
  const validate = await loadValidator(root);
  const currentProblem = validate(doc);
  if (currentProblem) throw new KitToolsError('bad-request', `sdd/tools.json is invalid: ${currentProblem}`);

  const modLinked = await isModLinked(root);
  const from = effectiveValueFor(doc, change.tool);
  const to = requestedValue(change);
  if (from === to) {
    return { changed: false, tool: change.tool, from, to, tools: toolsState(doc, revision, modLinked), warnings: [] };
  }

  const next = applyToolsChange(doc, change);
  const nextProblem = validate(next);
  if (nextProblem) throw new KitToolsError('bad-request', `result would be invalid: ${nextProblem}`);

  const content = serializeTools(next);
  await writeToolsAtomically(root, content);
  const warnings = change.tool !== 'rtk' && effectiveToolsValues(next).modEnabled && !modLinked ? ['mod-not-linked'] : [];
  return {
    changed: true,
    tool: change.tool,
    from,
    to,
    tools: toolsState(next, computeToolsRevision(content), modLinked),
    warnings,
  };
}

let queue: Promise<unknown> = Promise.resolve();

export function setKitTool(root: string, change: ToolsChange, expectedRevision: string): Promise<ToolsSetResult> {
  const run = queue.then(() => runToolsSet(root, change, expectedRevision));
  queue = run.catch(() => undefined);
  return run;
}
