# spec-e-burgos-016 cycle-01 — wizard con graphic motion

## Qué pasó
Al verificar la escena de puertas en el panel del navegador de Claude, las entradas de GSAP parecían trabadas en opacidad 0 durante 8–10 s. No era el código: el panel estaba oculto y el navegador frenaba `requestAnimationFrame` a ~2 fps.

## Lección
Antes de diagnosticar motion "trabado", medir los fps de `requestAnimationFrame` y confirmar que la pestaña o el panel esté visible.

## Costo evitable
Dos rebuilds de Studio y varias capturas persiguiendo un bug que no existía.
