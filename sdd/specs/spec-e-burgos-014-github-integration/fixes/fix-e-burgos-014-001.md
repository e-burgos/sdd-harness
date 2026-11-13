# FIX-e-burgos-014-001 — El header de Studio no se parte ni se desborda en anchos intermedios

> Tipo: BUGFIX · Severidad: low · Spec: spec-e-burgos-014-github-integration · 2026-11-13

## Problema
Desde que el header suma el repo de GitHub (cycle-02 de la spec 014), con un ciclo abierto entre
1024 y ~1280 px no entran todas las píldoras: «SDD Studio», «2 unidades abiertas» y «Team ready»
se parten en dos líneas y el header se desborda. Reproducido en el navegador a 1024 px.

## Solución
- Ningún texto del header se parte (`whitespace-nowrap`); las píldoras fijas no se encogen.
- El chip del gate y el nombre del proyecto son los que ceden ancho (`min-w-0` + `truncate`); el
  chip del gate se acota más en `lg` y recupera su ancho en `xl`.
- Se quitan los comentarios JSX del header (regla de código sin comentarios).

## Archivos
- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/components/OpenUnitsPill.tsx`
- `apps/studio/src/components/github/GithubHeaderStatus.tsx`
