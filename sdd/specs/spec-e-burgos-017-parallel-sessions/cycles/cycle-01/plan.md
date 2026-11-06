# spec-e-burgos-017-parallel-sessions — cycle-01 · plan (lite)

> Módulo: parallel-sessions | Subproyectos: apps/cli (kit), apps/studio-bridge, apps/studio,
> libs/studio-protocol | Fecha: 2026-11-06
> Objetivo: que todo lo que está en curso se vea y que cada sesión sepa a qué spec + ciclo o fix
> está atada, con el gate partiendo de esa atadura. Las reservas de archivo y el buzón son cycle-02.
> Rama `feat/parallel-sessions`.

## Historias
- US-1 — Ver todo lo que está en curso. CA: la franja y el pane del mod, el header de Studio y
  Mission Control listan todos los ciclos `in-progress` y los fixes abiertos con su avance; ninguno
  usa `find` sobre el primer ciclo.
- US-2 — La sesión sabe en qué trabaja. CA: la franja muestra primero «▸ esta sesión: <spec> ·
  <cycle> · <flow> · <done>/<total>» (o «▸ esta sesión: <FIX-id>») y después «otras: …»; sin atadura
  dice «esta sesión: sin unidad · /sdd».
- US-3 — Atadura sin pasos extra. CA: la sesión se ata sola cuando (a) la salida de un `Bash` trae la
  línea `SDD-BIND …` (la imprimen `sdd:gate` con APPROVED en B y `sdd:use`), (b) hay una sola unidad
  abierta o (c) la rama nombra una spec con un ciclo abierto; `pnpm sdd:use <spec> <cycle-XX>` y
  `pnpm sdd:use <FIX-id>` atan a mano y validan que la unidad exista y esté abierta.
- US-4 — Gate por sesión. CA: con el mod en `block`, una sesión sin atadura que edita código con más
  de una unidad abierta recibe un deny que lista las unidades y el comando para elegir; con una
  atadura a una unidad ya cerrada, lo mismo; las sesiones de Studio pasan por la misma regla en el
  puente.

## Tasks
- TASK-001 — Registro de sesiones en el kit: schema `session-binding.schema.json`, librería
  `sdd/scripts/lib/session-registry.mjs` sin imports de Node (fs inyectado: read/write/list/remove)
  con resolución de la carpeta común de git leyendo `.git`, ataduras con vencimiento a 30 min y la
  decisión pura del gate por sesión; tests.
- TASK-002 — `sdd:use` y la línea marcadora: script `sdd/scripts/sdd-use.mjs`, `pnpm sdd:use`
  registrado donde se registran los demás `sdd:*`, `spec-gate.mjs` imprime `SDD-BIND spec=… cycle=…`
  al aprobar GATE B; tests de integración.
- TASK-003 — Mod de Claude Code: snapshot con la atadura de esta sesión (`$.session.id()`), franja y
  pane multi-unidad, atadura automática (marcador en `Bash`, unidad única, rama), gate por sesión,
  limpieza en `session.end`; tests.
- TASK-004 — Puente: escribe la atadura de cada conversación con spec/fix (specs 007/008) en el
  registro, `judgeEdit` por sesión, y el snapshot del protocolo suma las ataduras activas
  (campo opcional); tests.
- TASK-005 — Studio: header y Mission Control con todos los ciclos en curso y fixes abiertos, y qué
  sesión trabaja en cada uno; tests.
- TASK-006 — Agentes y docs del kit: `sdd-gates.md` (atadura y gate por sesión), orquestador,
  implementores, steward, `documentation/{es,en}`, `catalog.json`; espejo en el `sdd/` del repo.
- TASK-007 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, generación real
  en `examples/` con dos sesiones de Claude Code en specs distintas, `sdd:validate`.

## Decisiones técnicas
- Una sola implementación del registro: el `.mjs` del kit sin dependencias de Node lo usan los
  scripts (fs de Node), el mod (`$.fs`) y el puente (importado desde el paquete
  `@e-burgos/sdd-harness`, del que ya depende). Si el mod no puede importar un archivo fuera de su
  carpeta, lleva una copia y un test verifica que sea idéntica (como los espejos del kit).
- Registro en `<git-common-dir>/sdd-sessions/sessions/<session-id>.json`; las reservas y el buzón
  (cycle-02) van en carpetas hermanas. Sin git, en `sdd/.sessions/` gitignoreado.
- Escritura sin rename atómico: cada sesión escribe solo su propio archivo; un archivo ilegible se
  ignora y el gate deja pasar con aviso.
- Compatibilidad: todo campo nuevo del protocolo es opcional; sin mod prendido nada cambia; el
  validador no exige nada nuevo.
- Flow lite por perfil `solo`: el registro es un archivo local, no tablas ni endpoints, y su único
  consumidor fuera del kit (el puente) entra en esta misma spec.
