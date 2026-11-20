# FIX-e-burgos-008 — El compositor del chat con un agente va en el panel central, no en la ficha

## Problema
FIX-e-burgos-007 movió las conversaciones al panel central pero dejó en la ficha del agente (panel derecho) la lista «Chat directo» con un compositor: el dev sigue escribiendo en el sidebar derecho mientras el centro queda vacío abajo.

## Solución aplicada
- El módulo Agentes muestra el compositor abajo del panel central, debajo de las conversaciones del agente elegido; al enviar se crea la conversación y se abre en el centro.
- La ficha del agente (panel derecho) queda solo con los datos del agente: sin lista ni compositor.

### Archivos modificados
- `apps/studio/src/components/modules/agents/AgentsCenter.tsx`
- `apps/studio/src/components/modules/agents/AgentCard.tsx`
- `apps/studio/src/components/modules/agents/AgentChatList.tsx` (borrado)
- `apps/studio/src/components/modules/agents/agents.spec.tsx`
