# FIX-e-burgos-016 — Paquetes de roles de ciclo en ciclos multi-app

## Problema
En un ciclo con varias apps, `sdd-pack` pide `--app` para los roles de unidad `cycle` (reviewer, planner, architect, functional) y el puente cae al contexto base; `kit.pack.stats` usa siempre la primera app.

## Solución aplicada
- Roles de ciclo en ciclos multi-app: `targetOf` agrega `app` al `PackTarget` (app del primer bloque con tasks pendientes; sin bloques pendientes, la primera app de `cycle.json`) y `build` pasa `--app <id>` a `sdd-pack`. Con una app no se pasa `--app`. La clave de caché incluye la app.
- No se agregó `app` al objeto `pack` de `contextSource` (el contrato no lo admite; sin cambios de protocolo). Se omitió la opción (b) (última app tocada por el hilo): el puente no la rastrea de forma trivial.
- `kit.pack.stats`: `readPackStats` corre `--stats --json` por cada app de `cycle.json` (secuencial, timeout por llamada), une las filas (las filas de rol batch se deduplican por rol+unidad; las de rol de ciclo se conservan por app), suma totales y pack-misses. Con una app, igual que antes.

### Archivos modificados
- apps/studio-bridge/src/sessions/pack-context.ts
- apps/studio-bridge/src/sessions/pack-context.spec.ts
- apps/studio-bridge/src/workspace/pack-runner.ts
- apps/studio-bridge/src/workspace/pack-runner.spec.ts
