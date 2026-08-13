# sdd-harness — documentation

Sitio de documentación interactiva de la CLI `@e-burgos/sdd-harness`: los tres modos de
generación, referencia de comandos, la metodología SDD (agentes + gates), catálogos y el kit
portable. React 19 + Vite + TypeScript + Tailwind v4 + Framer Motion, dark-only, fuentes
self-hosted (Space Grotesk + JetBrains Mono — las mismas del visor del kit).

Paquete **independiente**: se instala y buildea solo, sin depender del resto del workspace.

## Desarrollo

```bash
cd apps/documentation
pnpm install
pnpm dev        # http://localhost:4300
pnpm build      # tsc --noEmit + vite build → dist/
pnpm preview
```

## Deploy en Cloudflare Pages

El proyecto de Pages es **direct upload** (`sdd-harness-docs`, dominio
`sdd.estebanburgos.com.ar`): **no** está conectado a GitHub, así que Cloudflare nunca buildea
por su cuenta. El deploy lo hace el workflow `.github/workflows/deploy-docs.yml`, que corre en
cada push a `main` que toque `apps/documentation/**` (y a mano vía *Run workflow*).

Requiere dos secrets en el repo:

| Secret                 | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN` | Token con permiso **Cloudflare Pages: Edit**                  |
| `CLOUDFLARE_ACCOUNT_ID`| Account ID de Cloudflare                                      |

SPA de una sola página sin routing — no necesita `_redirects` ni funciones. Todos los assets
(fuentes incluidas) son self-hosted: funciona sin requests externos.

Deploy manual de emergencia (requiere `wrangler login`):

```bash
pnpm build
npx wrangler pages deploy dist --project-name sdd-harness-docs --branch main
```

## Estructura

| Path                    | Rol                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `src/data/content.ts`   | TODO el contenido (modos, comandos, agentes, catálogos, visor) — editar acá, no en los componentes |
| `src/components/`       | Terminal animada (timeline de frames), FileTree, CopyCommand, Section |
| `src/pages/SddDocsPage.tsx` | Página del visor `sdd:docs` (ruta `#/sdd-docs`) con galería de capturas reales |
| `src/pages/GuiaSddPage.tsx` | Página `guía sdd` (ruta `#/guia-sdd`): README y HOW-TO del kit renderizados con TOC lateral |
| `src/content/*.md`      | Snapshot de `sdd/README.md` y `sdd/HOW-TO-USE-SDD.md` del kit — re-sincronizar con `pnpm sync:sdd-content` cuando el kit cambie |
| `src/assets/sdd-docs/`  | Screenshots reales del visor corriendo sobre `examples/test-sdd-nx-workspace` — regenerarlos si el visor cambia (levantar `pnpm sdd:docs` en el ejemplo y capturar a 1320×820 @1.5x) |
| `src/App.tsx`           | Router por hash (`#/ruta` = página, `#seccion` = anchor), secciones + nav con scrollspy |
| `src/index.css`         | Theme Tailwind v4 (`@theme`): paleta ink/accent, fuentes, grain |
