# sdd-harness

Monorepo of the **`@e-burgos/sdd-harness`** CLI — bootstrap AI-agent-ready repos with the
SDD (Spec-Driven Development) methodology.

## Layout

| Path                              | What it is                                                        |
| --------------------------------- | ----------------------------------------------------------------- |
| [`apps/cli/`](apps/cli/README.md) | The published npm package: CLI source, blueprints and the portable SDD kit (`apps/cli/templates/sdd/`) |
| [`apps/documentation/`](apps/documentation/README.md) | Interactive docs site (React + Vite + Tailwind), independent package, deploys to Cloudflare Pages |
| `examples/`                       | Real generated workspaces for the three modes (gitignored): `test-sdd-nx-workspace`, `test-sdd-standalone`, `test-sdd-harness` |
| `AGENTS.md` / `CLAUDE.md`         | Dual harness with the working rules for AI agents on this repo    |

## Quick start

```bash
pnpm install
pnpm build        # esbuild bundle + .d.ts → apps/cli/dist/
pnpm typecheck
pnpm test         # full suite, includes real integration tests
```

Full CLI documentation: [`apps/cli/README.md`](apps/cli/README.md).
