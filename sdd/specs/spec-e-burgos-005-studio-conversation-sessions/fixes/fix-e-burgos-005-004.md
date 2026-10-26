# FIX-e-burgos-005-004 — Studio Mission Control: Documentos por agente y specs/fixes con documento

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | FIX-e-burgos-005-004                               |
| **Tipo**      | BUGFIX                                       |
| **Severidad** | medium                                       |
| **Fecha**     | 2026-10-26                                     |
| **Autor**     | e-burgos                                       |
| **Estado**    | pending                                        |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions         |

## Problema

1. La pestana de agente muestra documentos que no genero. 2. Entran specs/fixes sin documentos (spec-e-burgos-004-studio-gates-topology): relatedSpecs agrega por Read (conversation.ts DOCUMENT_TOOLS incluye Read, L191) y por link.target auto-asignado (L247); relatedFixes por mencion textual de FIX-id (L265).

## Solucion propuesta

- 'Generado' = Write/Edit/MultiEdit; Read se excluye (el pedido habla de generados).
- ConversationDocument suma `agents: string[]` (item.author.agent del tool call de escritura); `modified` pasa a ser siempre true o se elimina.
- Pestana de agente: documentos con ese agente en `agents`; Enjambre: todos.
- specs y fixes se derivan de los documentos: spec sin documento generado no se lista; fix solo si hay un documento bajo /fixes/ que lo enlaza (fixId resuelto contra snapshot). Se elimina la fuente 'link'/'event' textual.
- Verificar en la implementacion si los tool calls de subagentes llegan con author = subagente o padre; si es el padre, atribuir al padre y documentarlo.

## Archivos esperados

- `apps/studio/src/lib/conversation.ts`
- `apps/studio/src/lib/conversation.spec.ts`
- `apps/studio/src/components/mission-control/RelatedDocuments.tsx`
- `apps/studio/src/components/mission-control/RelatedDocuments.spec.tsx`
- `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`
