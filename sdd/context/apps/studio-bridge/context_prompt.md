# Context prompt — apps/studio-bridge

> Entry point para agentes y desarrolladores trabajando en `@e-burgos/sdd-studio`.
> Leer este documento antes de tocar el motor de agentes, el WebSocket o la validación del SPEC GATE.

## Qué es este subproyecto

Es el daemon/puente que corre localmente en la máquina del usuario (`sdd-studio`). Se encarga de levantar el WebSocket local, coordinar el `@anthropic-ai/claude-agent-sdk` para ejecutar los agentes SDD, vigilar los cambios de archivos con `chokidar` y aplicar el SPEC GATE para denegar ediciones no autorizadas.

## Mapa de navegación rápido

- **Entrada y CLI:** `bin/sdd-studio.mjs` y `src/cli.ts` -> `src/main.ts`.
- **Motor de IA y Hooks:**
  - `src/engine/claude-sdk-engine.ts`: Integración con Claude Agent SDK y mapeo de tiers a modelos reales.
  - `src/engine/fake-engine.ts`: Motor falso para tests.
  - `src/engine/sdk-mapper.ts`: Conversión de streaming del SDK a eventos del protocolo.
- **Enforcement del SPEC GATE:** `src/gate/judge.ts` (función `judgeEdit`).
- **Gestión de hilos y aprobaciones:** `src/sessions/session-manager.ts`.
- **Servidor y WebSocket:** `src/server/ws-server.ts` y `src/server/router.ts`.
- **Observador del workspace:** `src/workspace/watcher.ts` y `src/workspace/snapshot.ts`.

## Comandos para desarrollo y verificación

1. Ejecutar tests: `pnpm --filter @e-burgos/sdd-studio test`
2. Verificar tipos: `pnpm --filter @e-burgos/sdd-studio typecheck`
3. Probar el daemon en modo seguro (sin invocar APIs reales):
   ```bash
   node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open --root apps/studio-bridge/test/fixtures/workspace
   ```
4. Rebuild: `pnpm --filter @e-burgos/sdd-studio build`

## Advertencias de seguridad y estabilidad

- **Protección de rutas:** Toda ruta recibida desde el cliente para lectura (`workspace.readFile`) pasa por `paths.ts` (`safePathWithinRoot`). Prohibido abrir archivos fuera del directorio raíz.
- **Interrupción de hilos:** `thread.interrupt` aborta el `AbortController` del engine para detener turnos de modelo desbocados inmediatamente.
