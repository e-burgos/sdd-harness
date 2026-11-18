# SPEC-e-burgos-024: Cada sesión muestra dónde trabaja — unidad SDD y worktree, desde el primer documento

> Estado: **completed** (2026-11-17). cycle-01 cerrado (flow lite, 5/5 tasks). Pedido del dev tras ver la franja del mod decir «sin ciclo
> ni fix en curso» en una sesión que llevaba la spec-eburgos-048 en un worktree hermano.

## Resumen ejecutivo
spec-e-burgos-017 dejó varias specs en paralelo, cada sesión atada a una unidad. En uso real falla
en tres puntos: (1) el mod lee `sdd/` solo de la raíz de la sesión, y un `cd` a otro worktree no la
mueve, así que la unidad que vive en ese worktree no existe para el mod y `sdd:use` se descarta en
silencio; (2) la atadura llega recién en el GATE B, con `sdd:use` a mano o por heurísticas
estrechas (una sola unidad, id de spec en la rama), así que mientras se escriben brief, functional,
planner, architect o plan la sesión no figura en nada; (3) editar código en otro worktree queda
fuera de la raíz y el gate lo deja pasar sin mirar.

## Historias de usuario
- US-1 — Ver todo el repo. El mod junta las unidades abiertas de todos los worktrees del repo y
  sabe en cuál vive cada una; `sdd:use`, el GATE y el gate de edición se resuelven contra el
  worktree de la unidad (o del archivo), no solo contra la raíz de la sesión.
- US-2 — Atadura temprana y automática, en flow full o lite: abrir una spec o un ciclo (GATE A,
  escribir documentos de la spec o del ciclo), registrar un fix o improvement, editar código en un
  worktree con una sola unidad abierta, o una rama que nombre la spec (id o slug) atan la sesión
  sin comando manual. Una spec sin ciclo abierto es una unidad válida («preparando la spec») que
  pasa sola al ciclo cuando éste se abre.
- US-3 — Ver dónde trabaja. La franja y `/sdd` muestran la unidad de la sesión (spec, ciclo y flow;
  o fix y su tipo) y el worktree cuando no es la raíz de la sesión. Una atadura que no se puede
  aplicar avisa el motivo en vez de perderse.
- US-4 — Regla prioritaria. Los arneses (Claude, Copilot, Gemini) llevan, junto a la regla cero,
  la regla de declarar y atar la unidad SDD antes de trabajarla; el recordatorio de inicio de sesión
  la repite.

## Restricciones
- Compatibilidad: marcas `SDD-BIND` y registros de sesión viejos siguen leyéndose; nada nuevo es
  obligatorio en los JSON de `sdd/`.
- Una spec sin ciclo **no** autoriza escribir código: el gate sigue pidiendo ciclo in-progress o fix.
- Mod apagado ⇒ nada cambia.

## Ciclos propuestos
- cycle-01 — US-1..US-4 (flow lite, solo apps/cli).
