# FIX-e-burgos-009 — Kit: lista y documento con scroll propio, el documento vuelve arriba y la ruta alineada

## Problema
En el módulo Kit la lista de tarjetas y el documento comparten un solo scroll: al bajar en uno se mueve el otro, al elegir una tarjeta el documento queda a mitad de página y la ruta del archivo queda alineada a la izquierda mientras el documento va centrado.

## Solución aplicada
- Lista y documento son contenedores separados, cada uno con su scroll.
- Al elegir una tarjeta, el documento vuelve arriba.
- La ruta del archivo se alinea con el documento.

### Archivos modificados
- `apps/studio/src/components/modules/kit/KitParts.tsx`
- `apps/studio/src/components/modules/kit/KitCenter.tsx`
- `apps/studio/src/components/modules/kit/KitCapabilitiesView.tsx`
- `apps/studio/src/components/modules/kit/kit-module.spec.tsx`
