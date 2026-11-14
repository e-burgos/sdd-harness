# FIX-e-burgos-022-001 — Las tarjetas de integraciones se refrescan cuando sdd/tools.json cambia afuera de Studio

> Tipo: BUGFIX · Severidad: low · Spec: spec-e-burgos-022-studio-kit-integrations · 2026-11-14

## Problema
`useKitIntegrations` pedía `kit.integration.status` solo al montar el módulo. Prender o apagar
tucu-ui o video-maker desde la terminal (`pnpm sdd:tucu`, `pnpm sdd:video`) dejaba las tarjetas
mostrando el estado viejo hasta recargar Studio.

## Solución
El hook vuelve a pedir el estado de las dos integraciones cada vez que cambia
`snapshot.tools.revision`, que el bridge ya actualiza al detectar cambios en `sdd/tools.json`.
Sin cambios de protocolo.

## Archivos
- `apps/studio/src/components/modules/kit/use-kit-integrations.ts`
- `apps/studio/src/components/modules/kit/kit-module.spec.tsx`
