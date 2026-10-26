# FIX-e-burgos-005-008 — Header: chip de gate refleja el gate real de la conversacion seleccionada

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-008 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

StudioHeader.tsx L85 muestra 'SPEC GATE IDLE' literal cuando no hay ciclo in-progress global (activeCycle del snapshot); ignora la conversacion seleccionada, que puede estar trabajando un FIX GATE (FIX-e-burgos-005-00x).

## Solucion propuesta

- Nuevo `deriveConversationGate(view, snapshot)` puro: `{kind:'spec', specId, cycle} | {kind:'fix', fixId} | {kind:'idle'}`. Prioridad: ultimo documento escrito (spec/fix) -> fix con status pending/in-progress en la conversacion -> ciclo in-progress de una spec relacionada -> idle. Usa el ConversationView de FIX-e-burgos-005-006 e inferGateFromText como apoyo.
- StudioHeader: chip `SPEC GATE <spec> <ciclo>` / `FIX GATE <fix-id>` / `IDLE` segun la conversacion seleccionada (resolveSelectedThreadId); si no hay conversacion, cae al ciclo global actual. Si seleccionar la conversacion requiere exponerla al header, se hace con el selector existente del store sin tocar el protocolo.

## Archivos esperados

- `apps/studio/src/lib/conversation-gate.ts`
- `apps/studio/src/lib/conversation-gate.spec.ts`
- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`

## Verificacion

- conversation-gate.spec.ts: hilo solo con fixes -> FIX GATE; con ciclo in-progress -> SPEC GATE; vacio -> idle.

## Implementacion

- La conversacion seleccionada se comparte via un campo de UI `selectedThreadId` en el store del front (`selectThread`), sin tocar el protocolo; Workspace y `useConversationSelection` lo escriben y el header lo lee con `useSelectedConversation`.
- `relatedDocuments` mueve un documento re-escrito al final, para que 'ultimo documento escrito' sea el ultimo tocado.
- `inferGateFromText` apoya la derivacion: con un aviso de fix-gate en el ultimo dialogo con gate, se acepta el fix mencionado mas reciente aunque su estado no sea pending/in-progress.
