# spec-e-burgos-017-parallel-sessions — cycle-02 · plan (lite)

> Módulo: parallel-sessions | Subproyectos: apps/cli (kit), apps/studio-bridge, apps/studio,
> libs/studio-protocol | Fecha: 2026-11-06
> Objetivo: que dos sesiones no se pisen un archivo. La primera que edita un archivo de código lo
> reserva; la segunda se entera antes de editarlo y la dueña recibe el pedido. Rama
> `feat/parallel-sessions` (sigue al cycle-01).

## Historias
- US-5 — Reserva de archivo. CA: un `Edit`/`Write`/`NotebookEdit` permitido sobre un archivo de
  código reserva ese archivo para la sesión (o refresca su reserva); una sesión que edita un archivo
  reservado por otra sesión **en la misma carpeta** recibe un deny (o un aviso con `gate: "warn"`)
  que nombra a la dueña, su unidad y cómo seguir; desde **otro worktree** solo recibe un aviso y la
  edición pasa. Las reservas vencen a los 30 minutos sin edición y se liberan al cerrar la sesión.
  Los archivos que no son código (`sdd/`, superficies de arneses, markdown raíz) no se reservan.
- US-6 — Las sesiones se comunican. CA: al chocar con una reserva se deja un pedido en el buzón de
  la sesión dueña (uno por par sesión/archivo mientras dure esa reserva) y se intenta además
  `$.session.send`; el mod de la dueña suma los pedidos sin leer a su contexto en su próxima acción
  y los marca leídos; `pnpm sdd:release <archivo…>` libera reservas y avisa en su buzón a quienes
  las pidieron.
- US-7 — Studio muestra ataduras y reservas. CA: el snapshot del protocolo suma las reservas vivas
  (campo opcional) con los pedidos pendientes; la lista «en curso» de Studio muestra bajo cada
  unidad los archivos reservados y quién los pide; las conversaciones de Studio toman y respetan
  reservas en el puente igual que las sesiones de Claude Code.

## Tasks
- TASK-001 — Reservas y buzón en la librería del kit: schemas `file-lease.schema.json` y
  `session-request.schema.json`; en `session-registry.mjs` clave estable por ruta, leer/listar
  reservas vivas, tomar con relectura (carrera perdida = choque), liberar, liberar las de una sesión,
  decisión pura `judgeFileLease` (allow / deny misma carpeta / warn otro worktree), pedidos al buzón
  sin duplicar, leer y marcar leídos; tests. Copia del mod y espejo en `sdd/`.
- TASK-002 — `sdd:release`: script `sdd/scripts/sdd-release.mjs` (rutas relativas o absolutas,
  `--json`), registrado donde están los demás `sdd:*`, deja un aviso «liberado» en el buzón de
  quienes la pidieron; tests de integración.
- TASK-003 — Mod de Claude Code: después del gate por sesión, chequeo de reserva y toma en
  `Edit`/`Write`/`NotebookEdit`; pedido al buzón + `session.send`; el resultado de la próxima
  herramienta suma los pedidos sin leer (`context`) y los marca leídos; `session.end` libera las reservas de la sesión; el pane lista las
  reservas propias y los pedidos; tests.
- TASK-004 — Puente y protocolo: el gate del puente aplica `judgeFileLease` y toma reservas por
  conversación; cerrar la conversación las libera; el snapshot suma `leases` (opcional, con tope)
  desde el feed de sesiones; tests.
- TASK-005 — Studio: la lista de unidades en curso muestra los archivos reservados de cada unidad y
  los pedidos pendientes; i18n; tests.
- TASK-006 — Docs del kit: `sdd-gates.md` (reservas y buzón), implementores, steward, data-schemas,
  `documentation/{es,en}`, `CHANGELOG.md`, `catalog.json`; espejo en el `sdd/` del repo.
- TASK-007 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, prueba real en
  `examples/` con dos sesiones de Claude Code sobre el mismo archivo (misma carpeta), `sdd:validate`.

## Decisiones técnicas
- Registro: `<registry>/locks/<clave>.json` y `<registry>/inbox/<sesión-dueña>/<id>.json`, al lado
  de `sessions/`. La clave es un hash FNV-1a de 64 bits de la ruta relativa (sin Node: el mod no
  tiene `crypto`); el archivo guarda la ruta y si no coincide se trata como libre.
- Sin borrado en `$.fs`: liberar y leer son lápidas (`released_at`, `read_at`). Vencimiento a
  30 minutos desde la última edición, como las ataduras.
- Toma sin creación exclusiva: se escribe y se relee; si al releer la dueña es otra, se perdió la
  carrera y se trata como choque.
- El id del pedido incluye la clave, la sesión que pide y el instante en que se tomó la reserva: un
  pedido por par sesión/archivo mientras dure esa reserva, sin repetir en cada intento.
- Una sesión sin atadura (una sola unidad abierta) también reserva, con `unit: null`.
- El buzón llega como `context` del resultado de la próxima herramienta de la sesión dueña (lo lee
  el modelo, no el usuario). `prompt.compose` no sirve: el motor arma el system prompt una vez por
  sesión y no vuelve a preguntar (comprobado en la prueba real con 2.1.317).
- Un registro roto o ilegible nunca bloquea: la reserva se saltea y la edición pasa.
- Compatibilidad: campos nuevos del protocolo opcionales; sin mod prendido nada cambia; el
  validador no exige nada nuevo.
