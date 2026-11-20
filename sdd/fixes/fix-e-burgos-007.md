# FIX-e-burgos-007 — El chat con un agente se abre en el panel central y las asociaciones tienen scroll

## Problema
En el módulo Agentes, la ficha del agente (panel derecho) incrusta la conversación en una caja de 26 rem: las asociaciones (specs y fixes) se apilan, ocupan toda la caja y no hay scroll; el chat queda en un panel angosto.

## Solución aplicada
- La ficha conserva la lista de conversaciones del agente y el botón de conversación nueva, pero toda conversación se abre en el panel central (la misma vista que Inicio).
- Las asociaciones (ficha y encabezado de la conversación) tienen altura máxima y scroll.

### Archivos modificados
- (se completa al resolver)
