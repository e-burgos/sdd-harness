# spec-e-burgos-019 cycle-01 — wizard de entrada

## Qué pasó
El wizard de pantalla completa pasaba todos sus tests, pero en el navegador, al cambiar de paso, el contenedor raíz (`fixed inset-0 overflow-hidden`) quedaba desplazado 147 px: mover el foco al título nuevo scrolleaba ese contenedor (overflow hidden sigue siendo scrolleable por programa) y una capa del fondo trasladada lo ensanchaba.

## Lección
En contenedores de pantalla completa con capas animadas usar `overflow: clip` (no `hidden`) y `focus({ preventScroll: true })`; jsdom no hace layout, así que esto solo se ve en el navegador.

## Costo evitable
Una vuelta de diagnóstico en el navegador.
