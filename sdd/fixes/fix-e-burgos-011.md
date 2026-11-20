# FIX-e-burgos-011 — El encabezado de la conversación va en dos filas fijas

## Problema
El medidor de contexto y el estado suben a la primera fila junto al título y «Asociado a», y «Interrumpir» queda solo en la segunda.

## Solución aplicada
- Fila 1: volver, título y asociaciones. Fila 2: medidor de contexto, estado e «Interrumpir».

### Archivos modificados
- `apps/studio/src/components/workspace/ThreadView.tsx`
- `apps/studio/src/components/workspace/threadview.spec.tsx`
