# SDD Studio (web)

Slack-style interface for operating a repo with the SDD kit. It connects to the local bridge
[`@e-burgos/sdd-studio`](../studio-bridge) over WebSocket (127.0.0.1) and never sees credentials.

## Development

```bash
pnpm --filter sdd-studio-web dev            # http://localhost:3100
node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open \
  --root apps/studio-bridge/test/fixtures/workspace --web-url http://localhost:3100
```

Open the URL the bridge prints (`/w#bridge=…&token=…`).

## New project module

When the bridge runs without `sdd/` (launcher mode) Studio shows only **New project**, a
six-step wizard (scope, shape, frontend, backend, extras, summary) that builds a
`harness.config.json`, validates it live with `harness config validate`, and generates the
workspace through the bridge, with a safe target picker, preflight, progress, cancel and a
result screen. Option lists come from `harness config catalog`, never hardcoded. The module is
also reachable from a project workspace. Details and limits (no resume of a failed generation,
Python and Java toolchains are yours): [bridge README](../studio-bridge/README.md).

## Builds

| Script | Result |
|---|---|
| `build` | `next build` (regular Next build, for development/verification) |
| `build:local` | static export to `out/`; the bridge build copies it to `dist/web` for `--local-ui` |
| `deploy` | uploads `out/` to Cloudflare Pages, project `sdd-studio` (run `build:local` first) |

## Tests

`pnpm --filter sdd-studio-web test` (vitest) and `pnpm --filter sdd-studio-web e2e` (Playwright against the bridge with `--engine fake --local-ui`; requires `pnpm build` first). The e2e port can be changed with `E2E_PORT`.

## Before the first deploy

The web app is published the same way as the docs (`sdd.estebanburgos.com.ar`): static export on Cloudflare Pages
and a CNAME in Hostinger's DNS. The domain zone is not moved to Cloudflare.

- The `deploy-studio.yml` workflow creates the `sdd-studio` Pages project if it does not exist and deploys on
  merge to `main` (it uses the same secrets as the docs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- In Hostinger: CNAME `studio.sdd` → `sdd-studio-769.pages.dev` (TTL 300). Note: the subdomain
  `sdd-studio.pages.dev` belongs to another account; Cloudflare assigned the `-769` suffix to this project.
- In Cloudflare → Pages → `sdd-studio` → *Custom domains*: add `studio.sdd.estebanburgos.com.ar`.
- The Pages security headers live in `public/_headers`.
- If a backend is needed later (auth, teams), switch to a Worker with OpenNext; that requires
  the zone on Cloudflare or a `workers.dev` subdomain.
