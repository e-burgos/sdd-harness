# FIX-e-burgos-001-001 — workspace.snapshot re-escanea antes de responder

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-001-001                    |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | medium                                  |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-10-23                              |
| **Autor**     | e-burgos                                |
| **Estado**    | absorbed (cycle-02)                     |
| **Spec**      | spec-e-burgos-001-studio-session-ux     |

## Problema

Durante la verificación de cycle-02, el menú `/` no mostraba una skill recién creada en `.claude/skills`
y recargar la web no la recuperaba: FSEvents (chokidar en macOS) no garantiza la entrega de eventos bajo
carga, y `workspace.snapshot` devolvía el último snapshot en memoria del watcher. Una vista derivada del fs
quedaba desactualizada hasta el próximo evento que sí llegara.

## Justificación del bypass

Encontrado dentro del ciclo abierto sobre el mismo subproyecto; una línea en el router más su test, sin
contratos ni entidades nuevas. Bloqueaba CA-005.5 en uso real.

## Solución aplicada

- `router.ts`: `workspace.snapshot` hace `await watcher.refresh()` (errores ignorados) antes de devolver
  `watcher.current()`. Recargar la web fuerza un re-escaneo y recupera eventos perdidos.
- Endurecimiento de tests del watcher (commits `fd72a99` y `4ed0381`): la skill se escribe de forma atómica
  (staging + rename) y el test de `.claude/skills` corre con `retry: 2`, porque la latencia de FSEvents no es
  determinista.

### Archivos modificados

- `apps/studio-bridge/src/server/router.ts` (+ `router.spec.ts`)
- `apps/studio-bridge/src/workspace/watcher.spec.ts`

### Test de validación

- **Referencia:** `apps/studio-bridge/src/server/router.spec.ts` («workspace.snapshot rescans the workspace
  before answering, so a reload recovers missed fs events»)
