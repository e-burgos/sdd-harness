export const NX_MAJORS = [22, 23, 24] as const;
export type NxMajor = (typeof NX_MAJORS)[number];
export const DEFAULT_NX_MAJOR: NxMajor = 24;

export const NX_VERSIONS: Record<NxMajor, string> = {
  22: "22.7.12",
  23: "23.3.2",
  24: "24.0.6",
};

export const NX_PEER_OVERRIDES: Record<NxMajor, Record<string, string>> = {
  22: {
    vitest: "^4.1.12",
    "@vitest/coverage-v8": "^4.1.12",
  },
  23: {},
  24: {},
};

export const NX_VERSION = NX_VERSIONS[DEFAULT_NX_MAJOR];

export function isNxMajor(value: unknown): value is NxMajor {
  return NX_MAJORS.some((major) => major === value);
}

export function parseNxMajor(raw: unknown): NxMajor | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (isNxMajor(value)) return value;
  throw new Error(`Invalid Nx major "${String(raw)}" — expected ${NX_MAJORS.join(" | ")}`);
}

export function nxVersionFor(major: NxMajor = DEFAULT_NX_MAJOR): string {
  return NX_VERSIONS[major];
}

export function nxMajorOfRange(range: string | undefined): NxMajor | undefined {
  const match = range ? /\d+/.exec(range) : null;
  const major = match ? Number(match[0]) : undefined;
  return isNxMajor(major) ? major : undefined;
}

export function frontendVersionFor(
  name: string,
  major: NxMajor = DEFAULT_NX_MAJOR,
): string | undefined {
  return NX_PEER_OVERRIDES[major][name] ?? (FRONTEND_VERSIONS as Record<string, string>)[name];
}

export const FRONTEND_VERSIONS = {
  next: "^16.4.4",
  react: "^19.3.1",
  "react-dom": "^19.3.1",
  "react-router-dom": "^7.18.5",
  vite: "^8.3.5",
  "@vitejs/plugin-react": "^6.2.1",
  tailwindcss: "^4.3.4",
  "@tailwindcss/vite": "^4.3.4",
  "@tailwindcss/postcss": "^4.3.4",
  vitest: "^5.1.0",
  "@vitest/coverage-v8": "^5.1.0",
  "@e-burgos/tucu-ui": "^3.10.1",
} as const;

export const PYTHON_VERSIONS = {
  fastapi: "0.162.0",
  uvicorn: "0.54.0",
  langgraph: "1.2.19",
  tensorflow: "2.21.0",
  pytest: "9.2.0",
  ruff: "0.17.3",
  httpx: "0.28.1",
} as const;

export function pythonRequirement(name: keyof typeof PYTHON_VERSIONS): string {
  return `${name}>=${PYTHON_VERSIONS[name]}`;
}

export const UV_VERSION = "0.13.7";
export const PYTHON_REQUIRES = ">=3.12";
export const PYTHON_REQUIRES_WITH_TENSORFLOW = ">=3.12,<3.14";

export function uvBuildRequirement(): string {
  const [major, minor] = UV_VERSION.split(".").map(Number);
  return `uv_build>=${UV_VERSION},<${major}.${minor + 1}.0`;
}
export const PYTHON_DOCKER_IMAGE = "python:3.12-slim";
