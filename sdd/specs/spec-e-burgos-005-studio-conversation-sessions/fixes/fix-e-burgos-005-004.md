# FIX-e-burgos-005-004 — Studio Mission Control: Documentos por agente y specs/fixes con documento

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | FIX-e-burgos-005-004                               |
| **Tipo**      | BUGFIX                                       |
| **Severidad** | medium                                       |
| **Fecha**     | 2026-10-26                                     |
| **Autor**     | e-burgos                                       |
| **Estado**    | implemented                                        |
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

## Hallazgo: autoría de los tool calls de subagentes

Verificado en `apps/studio-bridge/src/engine/sdk-mapper.ts`:

- Los mensajes `assistant` del SDK traen `parent_tool_use_id`. Al ver un `tool_use` de `Agent`/`Task`, el mapper registra `toolUseId -> subagent_type` (`subagentByToolUse`); cada `tool_use` hijo se emite como `tool.start` con `author = { agent: <subagent_type>, parentToolUseId }` (`authorFor`, L77-L82).
- Resultado: un Write/Edit hecho dentro de un subagente llega con **autor = el subagente** (p. ej. `sdd-implementor-front`), no el padre. Los del hilo principal llevan `author.agent = mainAgent` (el agente del hilo).
- Matices: si el `parent_tool_use_id` no fue registrado, el autor cae al genérico `subagent`; dos subagentes simultáneos del mismo `subagent_type` se confunden en un único autor. La ruta por hooks (`authorForAgentId`) resuelve por `agent_id` con el mismo fallback.
- Decisión: `ConversationDocument.agents` guarda `item.author.agent` tal cual llega; la pestaña de un agente lista solo los documentos que él (o su tipo de subagente) escribió, y Enjambre lista todos.

## Implementación

- `conversation.ts`: `DOCUMENT_TOOLS` sin `Read`; `modified` reemplazado por `agents`; `specs`/`fixes` se derivan de los documentos con `relatedFromDocuments` (sin `link.target` ni menciones textuales; se eliminan `referencesInText` y las fuentes `event`/`link`); `documentsOfAgent` filtra por autor.
- `AgentInspectorDrawer.tsx`: pestaña de agente filtra por `agentId`, Enjambre muestra todo; estado vacío `mc.related.agentEmpty`.
- Archivos adicionales tocados: `agent-documents.ts` (+ spec), `agentmap.spec.tsx`, `inspectordrawer.spec.tsx`, `lib/i18n/{es,en}.ts`.
