# FIX-e-burgos-005-001 — Studio Mission Control: selector de conversaciones compacto y panel del agente

| Campo         | Valor                                                  |
| ------------- | ------------------------------------------------------ |
| **ID**        | FIX-e-burgos-005-001                                   |
| **Tipo**      | IMPROVEMENT                                            |
| **Severidad** | low                                                    |
| **Keyword**   | [IMPROVEMENT]                                          |
| **Fecha**     | 2026-10-26                                             |
| **Autor**     | e-burgos                                               |
| **Estado**    | pending                                                |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions         |
| **Hermano**   | FIX-e-burgos-005-002 (documentos y visor)              |

## Problema

1. El selector de conversaciones es una fila de chips bajo el header; ocupa espacio y se desborda con muchas conversaciones.
2. El input "Escribir a <agente>" del panel debe enviar a la conversación seleccionada, dirigido a ese agente, y no abrir una conversación nueva.
3. El botón "Abrir chat directo con <agente>" debe decir "Abrir nuevo chat con <agente>" (es/en, agente posicionado).

## Justificación del bypass

Ajuste de UX sobre lo entregado en spec-005 sin contratos ni entidades nuevas. `thread.send` ya existe en `@sdd-studio/protocol`: no hay cambio de protocolo. El pedido original excedía 5 archivos y se partió en dos fixes coherentes (este y -002).

## Solución propuesta

1. `ConversationSelector` pasa de chips a dropdown compacto, ubicado en el header de "Topología del Enjambre" a la izquierda de los filtros Ciclo/Transversales/Todas; "Nueva conversación" queda junto a él.
2. `LiveAgentChatFeed.sendQuickMessage` envía con `thread.send` al `threadId` seleccionado con `refs.agents: [agentId]`; solo si no hay conversación seleccionada crea una (comportamiento actual). Se garantiza que `conversation` llegue con el `threadId` de la selección, incluso si el agente aún no dialogó en ella.
3. Texto del botón actualizado en `AgentInspectorDrawer` y claves i18n es/en con el nombre del agente posicionado.

## Archivos esperados

- `apps/studio/src/components/mission-control/ConversationSelector.tsx`
- `apps/studio/src/components/mission-control/ConversationSelector.spec.tsx`
- `apps/studio/src/components/mission-control/AgentMapCanvas.tsx`
- `apps/studio/src/components/mission-control/LiveAgentChatFeed.tsx`
- `apps/studio/src/components/mission-control/liveagentchatfeed.spec.tsx`
- `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`
- `apps/studio/src/components/mission-control/inspectordrawer.spec.tsx`
- `apps/studio/src/components/mission-control/agentmap.spec.tsx`
- `apps/studio/src/lib/i18n/` (claves es/en)
