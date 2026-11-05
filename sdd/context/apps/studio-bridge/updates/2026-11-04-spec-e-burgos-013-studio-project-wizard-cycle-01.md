# spec-e-burgos-013-studio-project-wizard — cycle-01 — 2026-11-04

## Estado
El puente arranca **sin `sdd/`** en modo launcher (`host.runtime === null`, aviso en consola) en vez de abortar; con `sdd/` se comporta como antes. Nueva opción `--allow-target <a,b>` (rutas absolutas separadas por coma; el home siempre está permitido). Atiende el wizard: catálogo y validación vía la CLI fijada, preflight, explorador de directorios, chequeo de destino con huella, generación (`harness init --config harness.config.json --here -y`) con etapas, buffer de salida, cancelación por árbol de procesos, revelar carpeta y cambio de workspace (`workspace.open`, evento `workspace.switched`, cierre WS 4010 del runtime anterior). Documentado en `apps/studio-bridge/README.md`.

## Estructura
- `BridgeHost` (host) separado de `ProjectRuntime` (`src/project/runtime.ts`): el host posee auth, login, servidor, registro de generaciones y bases permitidas; el runtime posee sesiones, store y watchers del proyecto abierto.
- `src/wizard/`: `cli-locator`, `cli-env`, `config-cli`, `preflight`, `dirs`, `fs-paths`, `target`, `reveal`, `init-output` (clasificador de etapas), `generation`, `service`. `src/cli-options.ts` suma `parseAllowTargets`.
- Test de contrato `config-cli.contract.spec.ts` y `no-cli-import.spec.ts` (el puente invoca la CLI como proceso, nunca la importa).

## Dependencias
- Nueva dependencia `@e-burgos/sdd-harness` (`workspace:*`, versión fijada y localizada con `import.meta.resolve`). Credenciales fuera del env de la CLI, `NX_DAEMON=false`.

## Qué sigue
- Subir la versión de la CLI exige regrabar los fixtures de `src/wizard/__fixtures__/init-output/` (R-1).
- `SIGKILL` al puente deja huérfano el grupo de procesos en POSIX (R-3); `pnpm install` escribe en el store global y corre postinstall de terceros (R-6).
- Orden de release: CLI, web, puente (R-4).
