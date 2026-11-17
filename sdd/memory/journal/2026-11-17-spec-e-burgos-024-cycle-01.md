# spec-e-burgos-024 cycle-01 — dónde trabaja la sesión

## Qué pasó
Una sesión llevaba spec-eburgos-048 en un worktree hermano al que entró con `cd`; la franja del mod decía «sin ciclo ni fix en curso» y `sdd:use` se descartaba en silencio: el mod solo leía `$.session.root()`, que sigue a `/cd` y a EnterWorktree pero no a un `cd` de shell. Además, código editado en ese worktree quedaba fuera de la raíz y el gate lo dejaba pasar.

## Lección
Toda referencia a una unidad SDD que cruce sesiones (marca, atadura, gate) lleva el worktree donde vive; nunca asumir que la raíz de la sesión es donde se trabaja.

## Costo evitable
Sesiones paralelas sin atadura real y un gate que no miraba código de otros worktrees, en el escenario multi-spec para el que el kit está pensado.
