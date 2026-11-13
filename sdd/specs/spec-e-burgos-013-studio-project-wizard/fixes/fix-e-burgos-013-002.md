# FIX-e-burgos-013-002 — Studio y los generadores pasan a tucu-ui 3.10.1; fuera el parche de 100 ms

> Tipo: IMPROVEMENT · Severidad: low · Spec: spec-e-burgos-013-studio-project-wizard · 2026-11-13

## Problema
FIX-e-burgos-013-001 hizo esperar 100 ms a los specs de Studio entre aperturas del `Select` de
tucu-ui (`waitForSelectToClose`), porque el timer de cierre del `Select` quedaba suelto y cerraba
un dropdown reabierto. El arreglo real salió en tucu-ui 3.10.1 (FIX-e-burgos-003-002 en ese repo).

## Solución
Studio fija `@e-burgos/tucu-ui` 3.10.1 y los generadores del kit piden `^3.10.1`; se quita
`waitForSelectToClose` de `pick-option.ts` y de los cuatro specs que lo usaban.

## Archivos
- `apps/studio/package.json`, `pnpm-lock.yaml`, `apps/cli/src/generators/versions.ts`
- `apps/studio/src/lib/test-utils/pick-option.ts`
- `apps/studio/src/components/helpselect.spec.tsx`, `workspace/{modes,composer,threadlink}.spec.tsx`
