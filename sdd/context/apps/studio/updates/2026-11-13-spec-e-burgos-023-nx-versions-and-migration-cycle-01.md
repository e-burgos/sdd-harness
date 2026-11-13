# spec-e-burgos-023-nx-versions-and-migration — cycle-01 — 2026-11-13

## Estado
El wizard de Nuevo proyecto ofrece «Versión de Nx» (solo monorepo, desde `catalog.nx`; la por defecto marcada como recomendada) y escribe `nx.version` en el config. Oculto sin `catalog.nx` (CLI viejas).

## Estructura
- `steps/ShapeStep.tsx` (HelpSelect `data-testid="nx-version"`), `lib/wizard/{state,catalog,to-config,persist,summary-model,preview-tree}.ts`, i18n `wizard.nx.*`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec.
