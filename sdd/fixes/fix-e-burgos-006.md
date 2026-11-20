# FIX-e-burgos-006 — El aviso «Conversación nueva lista» no aparece para unidades que ya se trabajan y se cierra solo

## Problema
Cuando un agente crea una spec, un ciclo o un fix desde una conversación, Studio prepara otra conversación para esa unidad y muestra el aviso aunque ya se esté trabajando ahí: el chequeo de «ya tiene conversación» corre una sola vez, antes de que la conversación que la creó quede asociada. El aviso no tiene temporizador ni se retira cuando aparece la asociación.

## Solución aplicada
- Las conversaciones preparadas se vuelven a evaluar cuando cambian las asociaciones de las conversaciones: se descartan las de unidades que ya tienen una.
- El aviso se oculta solo a los 20 s (la conversación preparada sigue disponible donde ya se lista).

### Archivos modificados
- (se completa al resolver)
