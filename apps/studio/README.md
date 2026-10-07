# SDD Studio (web)

Interfaz estilo Slack para operar un repo con el kit SDD. Se conecta al puente local
[`@e-burgos/sdd-studio`](../studio-bridge) por WebSocket (127.0.0.1) y nunca ve credenciales.

## Desarrollo

```bash
pnpm --filter sdd-studio-web dev            # http://localhost:3100
node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open \
  --root apps/studio-bridge/test/fixtures/workspace --web-url http://localhost:3100
```

Abrí la URL que imprime el puente (`/w#bridge=…&token=…`).

## Builds

| Script | Resultado |
|---|---|
| `build` | `next build` (Worker vía OpenNext con `build:worker`) |
| `build:local` | export estático en `out/`; el build del puente lo copia a `dist/web` para `--local-ui` |
| `deploy` | OpenNext → Cloudflare Workers (`studio.sdd.estebanburgos.com.ar`) |

## Tests

`pnpm --filter sdd-studio-web test` (vitest) y `pnpm --filter sdd-studio-web e2e` (Playwright contra el puente con `--engine fake --local-ui`; requiere `pnpm build` antes). El puerto del e2e se puede cambiar con `E2E_PORT`.

## Antes del primer deploy

- La zona de `studio.sdd.estebanburgos.com.ar` tiene que existir en la misma cuenta de Cloudflare.
- `CLOUDFLARE_API_TOKEN` necesita permiso de Workers (y definir `CLOUDFLARE_ACCOUNT_ID`) como secrets del repo.
- El primer deploy corre al mergear esto a `main` (workflow `deploy-studio.yml`).
