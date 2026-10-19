# sdd-harness

Monorepo of the **`@e-burgos/sdd-harness`** CLI — bootstrap AI-agent-ready repos with the
SDD (Spec-Driven Development) methodology.

📖 **Documentation site:** [sdd.estebanburgos.com.ar](https://sdd.estebanburgos.com.ar)

## Layout

| Path                              | What it is                                                        |
| --------------------------------- | ----------------------------------------------------------------- |
| [`apps/cli/`](apps/cli/README.md) | The published npm package: CLI source, blueprints and the portable SDD kit (`apps/cli/templates/sdd/`) |
| [`apps/documentation/`](apps/documentation/README.md) | Interactive docs site (React + Vite + Tailwind), independent package, deploys to Cloudflare Pages |
| `examples/`                       | Local test bench: real generated workspaces for the three modes (gitignored, regenerate at will) |
| `AGENTS.md` / `CLAUDE.md`         | Dual harness with the working rules for AI agents on this repo    |

## See what it generates

[**e-burgos/sdd-harness-examples**](https://github.com/e-burgos/sdd-harness-examples) holds the
CLI's real output, browsable without installing anything — one example per mode: an Nx monorepo
(React + Spring Boot), a standalone Fastify app, and a project that already existed and adopted
SDD without changing a line of its own code. A scheduled workflow regenerates them from the
**published** package on every release, so they never drift from npm — which also makes that repo
a smoke test of each release.

The `examples/` directory here is a different thing: a scratch bench for local E2E runs, ignored
by git on purpose.

## Quick start

```bash
pnpm install
pnpm build        # esbuild bundle + .d.ts → apps/cli/dist/
pnpm typecheck
pnpm test         # full suite, includes real integration tests
```

Full CLI documentation: [`apps/cli/README.md`](apps/cli/README.md).

## SDD Studio

A Slack-style web interface to operate a repo with the SDD kit: chat with the Orchestrator or any agent,
watch who is working live and approve every action. Run it at the repo root:

```bash
npx @e-burgos/sdd-studio              # opens the web app paired with a local bridge (127.0.0.1)
npx @e-burgos/sdd-studio --local-ui   # serve the UI from the bridge itself (offline / Safari)
```

Details in [`apps/studio/README.md`](apps/studio/README.md).
