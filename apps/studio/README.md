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
| `build` | `next build` (build normal de Next, para desarrollo/verificación) |
| `build:local` | export estático en `out/`; el build del puente lo copia a `dist/web` para `--local-ui` |
| `deploy` | sube `out/` a Cloudflare Pages, proyecto `sdd-studio` (correr `build:local` antes) |

## Tests

`pnpm --filter sdd-studio-web test` (vitest) y `pnpm --filter sdd-studio-web e2e` (Playwright contra el puente con `--engine fake --local-ui`; requiere `pnpm build` antes). El puerto del e2e se puede cambiar con `E2E_PORT`.

## Antes del primer deploy

La web se publica igual que las docs (`sdd.estebanburgos.com.ar`): export estático en Cloudflare Pages
y un CNAME en el DNS de Hostinger. La zona del dominio no se mueve a Cloudflare.

- El workflow `deploy-studio.yml` crea el proyecto de Pages `sdd-studio` si no existe y despliega al
  mergear a `main` (usa los mismos secrets que las docs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- En Hostinger: CNAME `studio.sdd` → `sdd-studio-769.pages.dev` (TTL 300). Ojo: el subdominio
  `sdd-studio.pages.dev` pertenece a otra cuenta; Cloudflare le asignó el sufijo `-769` a este proyecto.
- En Cloudflare → Pages → `sdd-studio` → *Custom domains*: agregar `studio.sdd.estebanburgos.com.ar`.
- Los headers de seguridad de Pages viven en `public/_headers`.
- Si más adelante hace falta backend (auth, equipos), se pasa a un Worker con OpenNext; eso requiere
  la zona en Cloudflare o un subdominio `workers.dev`.
