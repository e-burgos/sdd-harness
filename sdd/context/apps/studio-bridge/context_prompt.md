# Context prompt — apps/studio-bridge

> Última actualización: consolida los fragmentos de spec-e-burgos-017 cycle-02 y 014 cycle-02 | Fecha: 2026-11-13

> Entry point para agentes y desarrolladores trabajando en `@e-burgos/sdd-studio`.
> Leer este documento antes de tocar el motor de agentes, el WebSocket o la validación del SPEC GATE.

## Qué es este subproyecto

Es el daemon/puente que corre localmente en la máquina del usuario (`sdd-studio`). Se encarga de levantar el WebSocket local, coordinar el `@anthropic-ai/claude-agent-sdk` para ejecutar los agentes SDD, vigilar los cambios de archivos con `chokidar` y aplicar el SPEC GATE para denegar ediciones no autorizadas. Sin `sdd/` arranca en modo launcher y atiende el wizard «Nuevo proyecto»: genera una carpeta nueva con la CLI fijada (`harness init --config`) y cambia de workspace al proyecto generado.

## Mapa de navegación rápido

- **Entrada y CLI:** `bin/sdd-studio.mjs` y `src/cli.ts` (`cli-options.ts`: `--allow-target`, etc.) -> `src/main.ts` (`BridgeHost`, launcher).
- **Runtime del proyecto abierto:** `src/project/runtime.ts` (sesiones, store, watchers, `CommandRunner`; cambio de workspace).
- **Wizard:** `src/wizard/` (`service.ts` despacha; `config-cli.ts`, `generation.ts`, `preflight.ts`, `target.ts`, `dirs.ts`, `reveal.ts`, `cli-locator.ts`, `cli-env.ts`). La CLI se invoca como proceso, nunca se importa.
- **Motor de IA y Hooks:**
  - `src/engine/claude-sdk-engine.ts`: Integración con Claude Agent SDK y mapeo de tiers a modelos reales.
  - `src/engine/fake-engine.ts`: Motor falso para tests.
  - `src/engine/sdk-mapper.ts`: Conversión de streaming del SDK a eventos del protocolo.
  - `src/engine/stable-prefix.ts`: prefijo de sistema estable (prompt caching).
  - `src/engine/input-channel.ts` y `src/engine/prompt-content.ts`: prompt streaming y armado de `SDKUserMessage`.
- **Enforcement del SPEC GATE:** `src/gate/judge.ts` (función `judgeEdit`).
- **Gestión de hilos y aprobaciones:** `src/sessions/session-manager.ts`, `session-bindings.ts` (ataduras a ciclo/fix y reservas de archivo), `store.ts`, `always-rule.ts`, `thread-link.ts`, `document-tracker.ts` y `attachment-store.ts`.
- **GitHub:** `src/github/` (`service.ts`, `pr-feed.ts`, `exec.ts`): `github.*` delega en la CLI del kit; `snapshot.github` con PR y checks por ciclo.
- **Autenticación:** `src/auth/claude-login.ts` (login de suscripción vía CLI de Claude) y `src/auth-mode.ts` (preferencia de modo y entorno).
- **Servidor y WebSocket:** `src/server/ws-server.ts` y `src/server/router.ts`.
- **Observador del workspace:** `src/workspace/watcher.ts`, `snapshot.ts`, `sessions-feed.ts`, `file-index.ts` (menú `@`), `catalog.ts` (agentes, skills, prompts), `kit-index.ts`, `kit-tools.ts`, `rtk-gain.ts` y `profile.ts`.

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
- **Mensajes pendientes:** un `thread.send` sobre un hilo ocupado encola (`delivery: 'pending'`); la entrega ocurre en `PostToolBatch` o como siguiente turno.
- **Wizard:** generar valida siempre con `validateExact` (sin fusionar pedidos); la CLI corre sin credenciales en el env; `workspace.open` re-verifica `realpath` y bases permitidas antes de cambiar.
- **Release:** CLI, web, puente. Subir la versión de la CLI exige regrabar los fixtures de `src/wizard/__fixtures__/init-output/`.
