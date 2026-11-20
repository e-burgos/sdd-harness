# FIX-e-burgos-018 — Chrome de Studio listo antes del primer turno

## Problema
`ClaudeAgentSdkEngine.startTurn` es síncrono y dispara `ensureStudioChrome()` sin esperarlo: si el Chrome de Studio estaba cerrado, la primera herramienta del navegador del turno puede fallar.

## Solución aplicada
- `startTurn` guarda la promesa de `ensureStudioChrome()` (con tope de 5 s y warning si falla) y el turno espera `chromeReady` antes de entregar el primer prompt al motor: la primera herramienta del navegador ya encuentra Chrome arriba. Con el navegador apagado o con `browserUrl` propio no espera nada.

### Archivos modificados
- apps/studio-bridge/src/engine/claude-sdk-engine.ts
- apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts
