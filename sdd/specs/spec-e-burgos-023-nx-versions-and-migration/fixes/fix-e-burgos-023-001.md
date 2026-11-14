# FIX-e-burgos-023-001 — Los workspaces React generados instalan @nx/web para serve-static

> Tipo: BUGFIX · Severidad: low · Spec: spec-e-burgos-023-nx-versions-and-migration · 2026-11-14

## Problema
`@nx/vite/plugin` infiere el target `serve-static` con el executor `@nx/web:file-server`. Los
generadores no instalaban `@nx/web`, así que `nx serve-static <app>` fallaba con
`Unable to resolve @nx/web:file-server` en los tres majors de Nx.

## Solución
El template `nx-workspace/package.json` declara `@nx/web` (a la versión de Nx del major elegido,
como el resto de `@nx/*`) y los generadores lo tratan como dependencia de la familia React: se
borra junto con `@nx/vite` cuando no hay apps React y se agrega al sumar una app React.

## Archivos
- `apps/cli/templates/sdd/templates/nx-workspace/package.json`, `sdd/templates/nx-workspace/package.json`
- `apps/cli/src/generators/root-package.ts`, `apps/cli/src/generators/workspace.generator.ts`
