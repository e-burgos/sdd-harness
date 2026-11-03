import { resolve } from "node:path";
import fs from "fs-extra";
import { appEnvPrefix } from "./app-types.js";
import {
  PYTHON_DOCKER_IMAGE,
  PYTHON_REQUIRES,
  PYTHON_REQUIRES_WITH_TENSORFLOW,
  UV_VERSION,
  uvBuildRequirement,
  pythonRequirement,
} from "./versions.js";

export interface PythonAppOptions {
  name: string;
  port: number;
  ml: boolean;
}

export function pythonPackageName(appName: string): string {
  return appName.replace(/-/g, "_");
}

export function pythonUvCommands(pkg: string): Record<string, string> {
  return {
    sync: "uv sync",
    serve: `uv run python -m ${pkg}`,
    lint: "uv run ruff check src tests",
    test: "uv run pytest",
    build: "uv build",
  };
}

export function renderPyproject({ name, ml }: PythonAppOptions): string {
  const dependencies = [
    pythonRequirement("fastapi"),
    pythonRequirement("uvicorn").replace("uvicorn", "uvicorn[standard]"),
    pythonRequirement("langgraph"),
    ...(ml ? [pythonRequirement("tensorflow")] : []),
  ];
  const dev = ["pytest", "ruff", "httpx"].map((dep) =>
    pythonRequirement(dep as "pytest" | "ruff" | "httpx"),
  );
  const list = (items: string[]) => items.map((item) => `  "${item}",`).join("\n");
  return `[project]
name = "${name}"
version = "0.1.0"
requires-python = "${ml ? PYTHON_REQUIRES_WITH_TENSORFLOW : PYTHON_REQUIRES}"
dependencies = [
${list(dependencies)}
]

[project.optional-dependencies]
ml = [
${list([pythonRequirement("tensorflow")])}
]

[dependency-groups]
dev = [
${list(dev)}
]

[build-system]
requires = ["${uvBuildRequirement()}"]
build-backend = "uv_build"
`;
}

export function renderDockerfile({ name, port }: PythonAppOptions): string {
  const prefix = appEnvPrefix(name);
  const pkg = pythonPackageName(name);
  return `FROM ${PYTHON_DOCKER_IMAGE}
COPY --from=ghcr.io/astral-sh/uv:${UV_VERSION} /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

COPY src ./src
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH" ${prefix}_HOST=0.0.0.0 ${prefix}_PORT=${port}
EXPOSE ${port}
CMD ["python", "-m", "${pkg}"]
`;
}

const GRAPH_PY = `from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class AgentState(TypedDict):
    input: str
    normalized: str
    output: str


def normalize(state: AgentState) -> dict[str, str]:
    return {"normalized": " ".join(state["input"].split()).lower()}


def echo(state: AgentState) -> dict[str, str]:
    return {"output": f"echo: {state['normalized']}"}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("normalize", normalize)
    graph.add_node("echo", echo)
    graph.add_edge(START, "normalize")
    graph.add_edge("normalize", "echo")
    graph.add_edge("echo", END)
    return graph.compile()


agent_graph = build_graph()
`;

function renderMainPy(name: string): string {
  return `from fastapi import FastAPI
from pydantic import BaseModel

from .graph import agent_graph

app = FastAPI(title="${name}")


class RunRequest(BaseModel):
    input: str


class RunResponse(BaseModel):
    normalized: str
    output: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/agent/run", response_model=RunResponse)
def run_agent(request: RunRequest) -> RunResponse:
    result = agent_graph.invoke(
        {"input": request.input, "normalized": "", "output": ""}
    )
    return RunResponse(normalized=result["normalized"], output=result["output"])
`;
}

function renderEntrypointPy({ name, port }: PythonAppOptions): string {
  const prefix = appEnvPrefix(name);
  return `import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "${pythonPackageName(name)}.main:app",
        host=os.environ.get("${prefix}_HOST", "127.0.0.1"),
        port=int(os.environ.get("${prefix}_PORT", "${port}")),
    )


if __name__ == "__main__":
    main()
`;
}

const ML_PY = `import os

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")


def scale(values: list[float], factor: float) -> list[float]:
    import tensorflow as tf

    return (tf.constant(values, dtype=tf.float32) * factor).numpy().tolist()
`;

function renderTestMainPy(pkg: string): string {
  return `from fastapi.testclient import TestClient

from ${pkg}.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_agent_run_normalizes_and_echoes():
    response = client.post("/agent/run", json={"input": "  Hello   LangGraph "})
    assert response.status_code == 200
    assert response.json() == {
        "normalized": "hello langgraph",
        "output": "echo: hello langgraph",
    }


def test_agent_run_rejects_missing_input():
    response = client.post("/agent/run", json={})
    assert response.status_code == 422
`;
}

function renderTestMlPy(pkg: string): string {
  return `import pytest

pytest.importorskip("tensorflow")

from ${pkg}.ml import scale


def test_scale_multiplies_every_value():
    assert scale([1.0, 2.0, 3.0], 2.0) == [2.0, 4.0, 6.0]
`;
}

const PYTHON_GITIGNORE = `.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
dist/
`;

const PYTHON_DOCKERIGNORE = `.venv
__pycache__
.pytest_cache
.ruff_cache
dist
tests
`;

export async function writePythonAppFiles(
  dir: string,
  options: PythonAppOptions,
  { gitignore }: { gitignore: boolean },
): Promise<void> {
  const pkg = pythonPackageName(options.name);
  const src = resolve(dir, "src", pkg);
  await fs.ensureDir(src);
  await fs.ensureDir(resolve(dir, "tests"));

  const files: Record<string, string> = {
    "pyproject.toml": renderPyproject(options),
    Dockerfile: renderDockerfile(options),
    ".dockerignore": PYTHON_DOCKERIGNORE,
    [`src/${pkg}/__init__.py`]: "",
    [`src/${pkg}/__main__.py`]: renderEntrypointPy(options),
    [`src/${pkg}/main.py`]: renderMainPy(options.name),
    [`src/${pkg}/graph.py`]: GRAPH_PY,
    "tests/__init__.py": "",
    "tests/test_api.py": renderTestMainPy(pkg),
  };
  if (options.ml) {
    files[`src/${pkg}/ml.py`] = ML_PY;
    files["tests/test_ml.py"] = renderTestMlPy(pkg);
  }
  if (gitignore) files[".gitignore"] = PYTHON_GITIGNORE;

  for (const [file, content] of Object.entries(files)) {
    await fs.writeFile(resolve(dir, file), content, "utf-8");
  }
}
