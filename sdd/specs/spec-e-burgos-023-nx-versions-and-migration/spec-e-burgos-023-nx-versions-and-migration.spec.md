# SPEC-e-burgos-023: El kit genera con Nx 22, 23 o 24 y sabe migrar entre versiones

> Estado: **completed** (2026-11-13). cycle-01 cerrado (flow lite, 4/4 tasks).

## Resumen ejecutivo
Los generadores fijan Nx 23.1.1 y los proyectos del dev están repartidos entre Nx 21, 22 y 23. En
vez de forzar una sola versión, el kit soporta las tres últimas mayores (22, 23 y 24, con 24 por
defecto) y trae el método y la herramienta para migrar un proyecto de una mayor a otra sin
sorpresas, de a un salto por vez y con verificación.

## Historias de usuario
- US-1 — Elegir la versión. Como dev, `harness init --nx 22|23|24` (y `nx` en
  `harness.config.json`, y el wizard de Studio) genera el workspace con esa mayor de Nx y con los
  peers que esa mayor acepta. Sin elegir, sale con 24.
- US-2 — Migrar con método. Como agente de un proyecto, la skill `nx-migration` me dice cómo migrar:
  un major por vez (`nx migrate` → install → `--run-migrations`), qué verificar en cada salto
  (build, typecheck, test, serve, e2e, imagen Docker si hay `prune-lockfile`) y las trampas
  conocidas de 22→23 y 23→24.
- US-3 — Migrar con un comando. Como dev, `pnpm sdd:nx-migrate -- --to 24` detecta la versión
  actual, arma el plan de saltos y lo ejecuta salto por salto, frenando ante el primer fallo; sin
  `--yes` solo muestra el plan.
- US-4 — Trazabilidad. La skill indica registrar la migración como fix del proyecto (FIX GATE).

## Decisiones (dev, 2026-11-13)
- Tres mayores soportadas: 22, 23 y 24 (24 por defecto). Al salir una mayor nueva entra ella y se
  cae la más vieja.
- TypeScript se queda en 6 (`~6.0.3`): TypeScript 7 está bloqueado por el ecosistema
  (typescript-eslint `<6.1`, `@nestjs/cli ~6.0`, ts-jest `<7`, Nx 24 depende de `typescript ~6.0.3`,
  sin API programática hasta TS 7.1). Se reevalúa cuando esos rangos se abran.
- Va en la misma PR que spec-e-burgos-022.

## Restricciones
- Cada combinación soportada se prueba con una generación real en `examples/`.
- Nada de Module Federation de Nx (Nx 24 lo eliminó; los `mfe` del kit no lo usan).

## Ciclos propuestos
- cycle-01 — Matriz de versiones en generadores + skill y comando de migración (US-1..US-4).
