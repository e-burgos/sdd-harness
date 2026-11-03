export const NX_VERSION = "23.1.1";

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
  "@e-burgos/tucu-ui": "^3.10.0",
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
