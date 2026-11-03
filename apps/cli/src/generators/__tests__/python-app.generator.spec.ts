import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateApp } from '../app.generator.js';
import { generateStandalone } from '../standalone.generator.js';
import { PYTHON_VERSIONS, UV_VERSION } from '../versions.js';
import { HarnessConfigSchema } from '../../config/schema.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

const read = (root: string, rel: string) => fs.readFileSync(resolve(root, rel), 'utf-8');

describe('python app generator (FastAPI + LangGraph + uv)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-py-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('renders a uv pyproject with pinned deps, the ml extra, a dev group and a build backend', async () => {
    await generateApp(root, { name: 'agent-api', type: 'python' }, '@t');
    const pyproject = read(root, 'apps/agent-api/pyproject.toml');

    expect(pyproject).toContain('requires-python = ">=3.12"');
    expect(pyproject).toContain(`"fastapi>=${PYTHON_VERSIONS.fastapi}"`);
    expect(pyproject).toContain(`"uvicorn[standard]>=${PYTHON_VERSIONS.uvicorn}"`);
    expect(pyproject).toContain(`"langgraph>=${PYTHON_VERSIONS.langgraph}"`);
    expect(pyproject).toContain('[dependency-groups]');
    expect(pyproject).toContain(`"httpx>=${PYTHON_VERSIONS.httpx}"`);
    expect(pyproject).toContain(`"pytest>=${PYTHON_VERSIONS.pytest}"`);
    expect(pyproject).toContain(`"ruff>=${PYTHON_VERSIONS.ruff}"`);
    expect(pyproject).toContain('[project.optional-dependencies]');
    expect(pyproject).toContain('build-backend = "uv_build"');
    expect(pyproject).toContain(`uv_build>=${UV_VERSION}`);
  });

  it('keeps TensorFlow out of the default dependencies unless ml is true', async () => {
    await generateApp(root, { name: 'plain-api', type: 'python' }, '@t');
    await generateApp(root, { name: 'ml-api', type: 'python', ml: true }, '@t');

    const plain = read(root, 'apps/plain-api/pyproject.toml');
    const ml = read(root, 'apps/ml-api/pyproject.toml');
    const defaults = (toml: string) => toml.split('[project.optional-dependencies]')[0];

    expect(defaults(plain)).not.toContain('tensorflow');
    expect(plain).toContain(`ml = [\n  "tensorflow>=${PYTHON_VERSIONS.tensorflow}",`);
    expect(defaults(ml)).toContain(`"tensorflow>=${PYTHON_VERSIONS.tensorflow}"`);
    expect(plain).toContain('requires-python = ">=3.12"\n');
    expect(ml).toContain('requires-python = ">=3.12,<3.14"');

    expect(fs.existsSync(resolve(root, 'apps/plain-api/src/plain_api/ml.py'))).toBe(false);
    expect(fs.existsSync(resolve(root, 'apps/plain-api/tests/test_ml.py'))).toBe(false);
    expect(read(root, 'apps/ml-api/src/ml_api/ml.py')).toContain('CUDA_VISIBLE_DEVICES');
    expect(read(root, 'apps/ml-api/tests/test_ml.py')).toContain('importorskip("tensorflow")');
  });

  it('renders the FastAPI app, the LangGraph graph, the entrypoint and the tests', async () => {
    await generateApp(root, { name: 'agent-api', type: 'python', port: 8123 }, '@t');
    const src = 'apps/agent-api/src/agent_api';

    expect(read(root, `${src}/main.py`)).toContain('@app.get("/health")');
    expect(read(root, `${src}/main.py`)).toContain('@app.post("/agent/run"');
    expect(read(root, `${src}/graph.py`)).toContain('StateGraph(AgentState)');
    const entry = read(root, `${src}/__main__.py`);
    expect(entry).toContain('AGENT_API_PORT');
    expect(entry).toContain('"8123"');
    expect(entry).toContain('"agent_api.main:app"');
    const tests = read(root, 'apps/agent-api/tests/test_api.py');
    expect(tests).toContain('TestClient(app)');
    expect(tests).toContain('/health');
    expect(tests).toContain('/agent/run');
  });

  it('wires the nx targets through uv', async () => {
    await generateApp(root, { name: 'agent-api', type: 'python' }, '@t');
    const { targets } = fs.readJSONSync(resolve(root, 'apps/agent-api/project.json'));

    expect(targets.sync.command).toBe('cd apps/agent-api && uv sync');
    expect(targets.serve.command).toBe('cd apps/agent-api && uv run python -m agent_api');
    expect(targets.lint.command).toBe('cd apps/agent-api && uv run ruff check src tests');
    expect(targets.test.command).toBe('cd apps/agent-api && uv run pytest');
    expect(targets.build.command).toBe('cd apps/agent-api && uv build');
    expect(targets.build.outputs).toEqual(['{projectRoot}/dist']);
  });

  it('writes a uv Dockerfile, a dockerignore and a gitignore next to the app', async () => {
    await generateApp(root, { name: 'agent-api', type: 'python', port: 8123 }, '@t');
    const dockerfile = read(root, 'apps/agent-api/Dockerfile');

    expect(dockerfile).toContain(`COPY --from=ghcr.io/astral-sh/uv:${UV_VERSION} /uv /uvx /bin/`);
    expect(dockerfile).toContain('uv sync --no-dev');
    expect(dockerfile).toContain('AGENT_API_HOST=0.0.0.0');
    expect(dockerfile).toContain('AGENT_API_PORT=8123');
    expect(dockerfile).toContain('CMD ["python", "-m", "agent_api"]');
    expect(read(root, 'apps/agent-api/.gitignore')).toContain('.venv/');
    expect(read(root, 'apps/agent-api/.gitignore')).toContain('__pycache__/');
    expect(fs.existsSync(resolve(root, 'apps/agent-api/.dockerignore'))).toBe(true);
  });

  it('accepts ml in the config schema without making it required', () => {
    const base = {
      project: { name: 'p', description: 'd', packageScope: '@p' },
      services: [],
      libs: [],
    };
    const parse = (apps: unknown[]) => HarnessConfigSchema.safeParse({ ...base, apps });

    expect(parse([{ name: 'a', type: 'python' }]).success).toBe(true);
    expect(parse([{ name: 'a', type: 'python', ml: true }]).success).toBe(true);
    expect(parse([{ name: 'a', type: 'python', ml: 'yes' }]).success).toBe(false);
  });

  it('generates the same files at the repo root in standalone mode', async () => {
    const parent = mkdtempSync(resolve(tmpdir(), 'harness-py-sa-'));
    const cwd = process.cwd();
    process.chdir(parent);
    try {
      await generateStandalone({
        projectName: 'agent-py',
        description: 'standalone python',
        appType: 'python',
        ml: true,
        services: [],
      });
      const dir = resolve(parent, 'agent-py');
      const pkg = fs.readJSONSync(resolve(dir, 'package.json'));

      expect(read(dir, 'pyproject.toml')).toContain('build-backend = "uv_build"');
      expect(read(dir, 'src/agent_py/graph.py')).toContain('StateGraph');
      expect(fs.existsSync(resolve(dir, 'src/agent_py/ml.py'))).toBe(true);
      expect(read(dir, 'Dockerfile')).toContain('ghcr.io/astral-sh/uv');
      expect(pkg.scripts.test).toBe('uv run pytest');
      expect(pkg.scripts.build).toBe('uv build');
      expect(read(dir, '.gitignore')).toContain('.venv/');
    } finally {
      process.chdir(cwd);
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
