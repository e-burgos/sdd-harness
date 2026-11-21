# FIX-e-burgos-019 — Un solo chequeo de Chrome al abrir Studio

## Problema
El puente chequea Chrome al arrancar (`runtime.ts`) y la web pide `claude.browser.check` al montar `useChromeStatus`: dos sondeos para el mismo dato.

## Solución aplicada
- `claude.browser.check` acepta `force?: boolean` (protocolo). El puente responde con el estado ya calculado (el chequeo de arranque o el último bot event) y solo sondea si no hay estado o si llega `force: true`.
- `useChromeStatus`: el montaje pide `check(false)` (usa el estado del puente); el botón «Reintentar»/«Comprobar» y el recheck tras abrir los ajustes piden `force: true`. El bot event `claude-browser.changed` sigue actualizando la vista.

### Archivos modificados
- libs/studio-protocol/src/commands.ts
- libs/studio-protocol/src/commands.spec.ts
- apps/studio-bridge/src/server/router.ts
- apps/studio-bridge/src/server/router.spec.ts
- apps/studio/src/components/modules/claude/use-chrome-status.ts
- apps/studio/src/components/modules/claude/claude-module.spec.tsx
