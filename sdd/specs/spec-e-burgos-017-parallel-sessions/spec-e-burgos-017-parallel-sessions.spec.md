# SPEC-e-burgos-017: Sesiones en paralelo — cada sesión sabe en qué trabaja y no pisa a las otras

> Estado: **completed** (2026-11-06). cycle-01 y cycle-02 cerrados (flow lite, 7/7 tasks cada uno). Pedido del dev tras trabajar en otro proyecto
> con tres specs abiertas a la vez: Studio y la franja del mod mostraban una sola.

## Resumen ejecutivo
El modelo de datos del kit ya admite varias specs en curso a la vez (un ciclo activo **por spec**,
regla A3), pero todo lo que lo muestra asume uno: el header y Mission Control de Studio toman el
primer ciclo `in-progress` con `find`, y la franja del mod muestra el primero en orden alfabético
más «+N ciclo(s)». Ninguna sesión sabe a qué spec, ciclo o fix está atada, así que el gate del mod
deja editar código si hay *algún* ciclo abierto, y dos sesiones que tocan el mismo archivo se
enteran recién al pisarse o al mergear.

Esta spec hace tres cosas, en dos ciclos:
1. **Visibilidad:** todo lo que está en curso se ve, en Studio y en la franja.
2. **Atadura de sesión:** cada sesión queda atada a una unidad de trabajo (spec + ciclo, o fix), y la
   franja y el gate parten de esa atadura.
3. **Coordinación por archivo:** una sesión que va a editar un archivo que otra sesión tiene tomado
   se entera antes, y la otra recibe el pedido.

## Historias de usuario
- **US-1 — Ver todo lo que está en curso.** Como dev con varias specs abiertas, quiero que el header
  y Mission Control de Studio y la franja del mod listen todos los ciclos `in-progress` y los fixes
  abiertos, con su avance, no solo el primero.
- **US-2 — La sesión sabe en qué trabaja.** Como dev, quiero que la franja de cada sesión muestre
  primero su propia unidad («▸ esta sesión: spec-X · cycle-02 · lite · 3/7») y aparte las de las
  demás («otras: spec-Y · cycle-01, FIX-…»).
- **US-3 — Atadura sin pasos extra.** Como dev, quiero que la sesión se ate sola en el flujo normal:
  al pasar GATE B (`pnpm sdd:gate <spec> cycle-XX` → APPROVED); si hay una sola unidad abierta; o si
  la rama nombra una spec. Y poder atarla a mano con `pnpm sdd:use <spec> <cycle-XX>` o
  `pnpm sdd:use FIX-…` (también para fixes, que no pasan GATE B).
- **US-4 — Gate por sesión.** Como dev, quiero que una sesión sin atadura que intenta editar código
  cuando hay más de una unidad abierta reciba «¿en cuál trabajás?» con las opciones, en lugar de
  pasar porque hay algún ciclo abierto en el repo.
- **US-5 — Reserva de archivo.** Como dev con dos sesiones en specs distintas, quiero que la primera
  que edita un archivo lo reserve, y que la segunda, antes de editarlo, sepa quién lo tiene: en la
  **misma carpeta** se le frena la edición (pisaría en vivo); desde **otro worktree** solo se le
  avisa (el choque llega en el merge).
- **US-6 — Las sesiones se comunican.** Como dev, quiero que cuando una sesión choca con una reserva,
  la sesión que tiene el archivo reciba el pedido en su próximo turno («spec-Y necesita
  `src/auth/session.ts`: ¿lo liberás o acordamos el cambio?») y pueda liberarlo
  (`pnpm sdd:release <archivo>`) o responder.
- **US-7 — Studio muestra ataduras y reservas.** Como dev, quiero ver en Studio qué sesión trabaja en
  qué unidad y qué archivos tiene reservados.

## Decisiones tomadas en la conversación con el dev
- **Dónde vive el estado de sesión:** un registro **local, fuera de git**, en la carpeta común de git
  (`git rev-parse --git-common-dir`, p. ej. `.git/sdd-sessions/`). La comparten todos los worktrees
  de la misma máquina, así que cubre igual «tres sesiones en una carpeta» y «una sesión por
  worktree» sin que el dev elija. No viaja con el repo ni ensucia `git status`.
- **Qué guarda:** por sesión, su atadura (`spec` + `cycle`, o `fix`), la carpeta de trabajo
  (worktree) y la última actividad; por archivo reservado, la ruta relativa al repo, la sesión
  dueña, su unidad, su worktree y la última edición. Las reservas **vencen solas** a los 30 minutos
  sin edición (sesión muerta o abandonada).
- **Quién escribe:** el mod de Claude Code (`sdd-mod`) desde sus hooks, que conocen el id de sesión
  (`$.session.id()`); los scripts `sdd:use` / `sdd:release` para la vía manual; el puente de Studio
  para las sesiones que abre él (ver Decisiones técnicas, punto 1).
- **Comunicación entre sesiones:** el mecanismo principal es un **buzón en el mismo registro**: la
  sesión que choca escribe un pedido dirigido a la sesión dueña, y el mod de la dueña lo lee en
  `turn.start`/`turn.complete` y lo pone en su contexto. Además, de bonus, se intenta
  `$.session.send({ to: { sessionId } })`; si devuelve `isDelivered: false` (no se garantiza que
  llegue a otro proceso ni a una sesión inactiva) alcanza con el buzón. Un pedido por par
  sesión/archivo mientras dure la reserva (sin repetir en cada intento).
- **Studio solo lee:** el kit es la fuente; Studio (vía el puente, que corre en la misma máquina)
  lee el registro y lo muestra. Respeta la regla de independencia: el kit nunca depende de Studio.

## Ciclos propuestos
- **cycle-01 — Visibilidad y atadura (US-1..US-4).** Franja y pane del mod multi-ciclo con «esta
  sesión» y «otras»; Studio (header, Mission Control) lista todos los ciclos en curso; registro de
  sesión; atadura automática (GATE B, unidad única, rama) y manual (`sdd:use`); gate del mod por
  sesión; los agentes del kit (orquestador, implementores) y `sdd-gates.md` mencionan la atadura.
- **cycle-02 — Reservas y comunicación (US-5..US-7).** Reserva por archivo en `Edit`/`Write`/
  `NotebookEdit`; frenar en la misma carpeta, avisar desde otro worktree; pedido a la sesión dueña
  vía `session.send`; `sdd:release`; vencimiento; Studio muestra ataduras y reservas.

## Restricciones
- **Compatibilidad hacia atrás** (regla del kit): nada nuevo pasa a `required` en los schemas
  existentes; sin mod prendido el kit se comporta como hoy; el validador solo avisa.
- **El mod sigue apagado por defecto** y el dev lo prende; la atadura y las reservas solo existen
  con el mod prendido (Claude Code). Copilot y Gemini ven todo lo que está en curso (Studio,
  `/sdd`-equivalentes del kit) y usan `sdd:use` a mano; no tienen reservas automáticas.
- **Un registro roto o ilegible nunca bloquea**: el gate deja pasar y avisa (igual que hoy cuando no
  puede leer `sdd/`).
- **La regla A3 no cambia:** sigue habiendo un solo ciclo activo por spec.
- Código sin comentarios; tests de cada pieza; `pnpm build && pnpm typecheck && pnpm test` y una
  prueba real en `examples/` con dos sesiones de Claude Code en paralelo.

## Fuera de alcance
- **Aviso por archivos planificados en git** (`touches` declarado en `cycle.json` y chequeado en
  GATE A): sería lo único que sirve entre máquinas y entre devs, pero suma registros y reglas del
  validador. Si hace falta para equipos, va en otra spec.
- Coordinación entre máquinas distintas (otro dev, otra computadora): sigue resolviéndose en el
  merge.

## Decisiones técnicas (criterio del autor tras la revisión; el dev puede objetarlas)
1. **Sesiones de Studio:** el puente no carga el mod (usa hooks `PreToolUse` propios del Agent SDK:
   `judgeTool`/`beforeTool`), así que **el puente participa igual que el mod**: escribe la atadura de
   sus sesiones (ya sabe su spec/fix por las specs 007 y 008), aplica el gate por sesión y toma y
   respeta reservas. La lógica compartida (leer/escribir el registro, decidir allow/warn/deny) vive
   en el kit y el puente la reusa; el kit no importa nada de Studio. Verificar con una corrida real
   del SDK que el mod efectivamente no carga.
2. **Formato del registro:** un archivo por sesión (`sessions/<session-id>.json`), uno por reserva
   (`locks/<hash de la ruta>.json`) y uno por pedido (`inbox/<session-dueña>/<id>.json`). `$.fs` no
   tiene rename atómico ni creación exclusiva: se escribe y se relee para detectar una carrera
   perdida. Con un schema en `sdd/schemas/` como el resto de los registros.
3. **Captura de la atadura:** los scripts no conocen el id de sesión, así que `sdd:gate` (con
   APPROVED en B) y `sdd:use` imprimen una **línea marcadora** (`SDD-BIND spec=… cycle=…` /
   `SDD-BIND fix=…`). El hook del mod hace `await next(e)` sobre `Bash` y busca esa línea en la
   salida: no depende de cómo se escribió el comando (`rtk`, `pnpm -s`, `a && …`).
4. **Carpeta común de git desde el mod:** el mod no corre `git`; resuelve la carpeta común leyendo
   `.git` (archivo `gitdir:` en un worktree y su `commondir`). Los scripts del kit usan
   `git rev-parse --git-common-dir`.
5. **Fin de sesión:** `session.end` borra la atadura y libera las reservas de la sesión; si la
   sesión muere sin cerrarse, vence a los 30 minutos como las reservas.

## Dependencias
- spec-e-burgos-007 y spec-e-burgos-008 (asociación conversación ↔ spec/fix en Studio): se reutiliza.
- Ninguna spec depende de esta.
