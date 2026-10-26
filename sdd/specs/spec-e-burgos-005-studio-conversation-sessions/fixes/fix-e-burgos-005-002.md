# FIX-e-burgos-005-002 — Studio Mission Control: documentos de la conversación y visor modal centrado

| Campo         | Valor                                                  |
| ------------- | ------------------------------------------------------ |
| **ID**        | FIX-e-burgos-005-002                                   |
| **Tipo**      | BUGFIX                                                 |
| **Severidad** | medium                                                 |
| **Keyword**   | [BUGFIX]                                               |
| **Fecha**     | 2026-10-26                                             |
| **Autor**     | e-burgos                                               |
| **Estado**    | pending                                                |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions         |
| **Hermano**   | FIX-e-burgos-005-001 (selector y panel)                |

## Problema

1. `AgentInspectorDrawer` lista documentos ajenos a la conversación y entradas "no está en el workspace" con ids truncados (`spec-e-burgos-005-studi`, `spec-e-b`, `spec-e-burgos`). Causa probable: `lib/conversation.ts` deriva ids por regex sobre textos truncados.
2. `DocumentViewerModal` no es un modal centrado de ancho de lectura cómodo.

## Justificación del bypass

Bug de presentación/derivación sobre lo entregado en spec-005; no cambia contratos ni entidades. Partido del pedido original junto a FIX-e-burgos-005-001 para respetar el límite de archivos.

## Solución propuesta

1. Derivar documentos solo de tool calls de escritura/edición/lectura sobre rutas `sdd/specs/...` y de FIX-ids reales de la conversación seleccionada; descartar todo id que no exista en el snapshot del workspace (nunca regex sobre texto truncado).
2. Mostrar los documentos en una tarjeta contraíble/expandible que se abre con "Ver info", con estado abierto/cerrado persistido en localStorage (reutilizar `lib/use-collapsed-state.ts`).
3. `DocumentViewerModal` como modal centrado, ancho de lectura cómodo, con el patrón del visor de `pnpm sdd:docs`.

## Referencia del visor sdd/docs

- Servidor: `sdd/docs/serve.mjs` (`pnpm sdd:docs`)
- Modal: `sdd/docs/app.js` (`MODAL_SIZE_CLASS` ~L2257, backdrop `#sdd-modal-backdrop` ~L2303, `handleModalKeydown` ~L2245)
- Estilos: `sdd/docs/styles.css` (`.modal-backdrop` L1455, `.modal` L1471, `.modal--lg` 672px / `.modal--xl` 896px, `.modal-header`, `.modal-body`)

Patrón: backdrop fijo `inset: 0` con flex centrado y blur, panel `width: 100%`, `max-height: 85vh`, columna flex, `border-radius` 2xl, header fijo y cuerpo con scroll, cierre con Esc/backdrop.

## Archivos esperados

- `apps/studio/src/lib/conversation.ts`
- `apps/studio/src/lib/conversation.spec.ts`
- `apps/studio/src/lib/agent-documents.ts`
- `apps/studio/src/components/mission-control/RelatedDocuments.tsx`
- `apps/studio/src/components/mission-control/RelatedDocuments.spec.tsx`
- `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`
- `apps/studio/src/components/mission-control/DocumentViewerModal.tsx`
- `apps/studio/src/components/mission-control/documentviewermodal.spec.tsx`
