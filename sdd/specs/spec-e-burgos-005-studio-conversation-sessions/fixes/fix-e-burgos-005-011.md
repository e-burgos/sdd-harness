# FIX-e-burgos-005-011 — RelatedDocuments: overflow y truncado en panel angosto (~300px)

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-011 |
| **Tipo**      | BUGFIX |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

En el panel derecho del Workspace (ConversationPanelSections → RelatedDocuments), cuando el ancho es ~300px (viewport angosto o splitter ajustado):

1. Los textos de la tarjeta "Specs y fixes relacionados" se escapan del contenedor: IDs de spec largos (ej. `spec-e-burgos-005-studio-conversation-sessions`), nombres de archivo (ej. `architect.md`), fragmentos como "en spec-e-burgos-005-studio-conversation-sessions", y lista de agentes autores. Deben truncarse con ellipsis y mostrar el texto completo en `title`.

2. La fila del documento de un fix (FIX-e-burgos-005-004) muestra solo los agentes autores, pero no el nombre del archivo del fix (`fix-e-burgos-005-004.md`).

3. El campo "Dónde estás" (ConversationGate) muestra `FIX GATE FIX-e-burgos-005-004` aunque la conversación trabajó después en FIX-e-burgos-005-006..010. La regla `deriveConversationGate` / `inferGateFromText` debe detectar el fix más reciente realmente trabajado en el hilo, no el más antiguo.

## Solucion propuesta

### RelatedDocuments.tsx
- Aplicar `min-w-0` a flex children (spec id, archivo, especificación, agentes) para permitir truncado
- Usar `truncate` y `title=""` para texto largo en tarjetas
- Agentes: mostrar en línea propia o truncar lista si es muy larga
- Ajustar padding/spacing para contenedores angostos

### conversation-gate.ts
- Cambiar `inferGateFromText`: buscar el fix más reciente (mayor secuencia) en los eventos de la conversación, no el primero encontrado
- Verificar que `conversation.gate` refuerza el mismo criterio

### ConversationPanelSections.tsx (si aplica)
- Ajustar layout responsivo si el ancho es crítico para otras secciones

## Archivos esperados

- `apps/studio/src/components/mission-control/RelatedDocuments.tsx`
- `apps/studio/src/lib/conversation-gate.ts`
- `apps/studio/src/components/workspace/ConversationPanelSections.tsx` (opcional)

## Verificacion

- RelatedDocuments.spec.tsx: hilo ancho vs ~300px, tarjetas truncan sin desbordar, title visibles
- conversation-gate.spec.ts: el fix más reciente registrado en fix.json es detectado como gate actual


## Ampliación 2026-10-26

Pedido del dev: la sección "ACTIVIDAD" del panel derecho pasa a la parte superior.

- Header del panel (`RightPanel.tsx`): título "ACTIVIDAD" y botón expandir/contraer en la misma fila, sticky, siempre en la esquina superior derecha.
- La tarjeta de actividad queda inmediatamente debajo del header.
- Orden final: Actividad, Dónde estás, Documentos generados, Últimas acciones, Detalles.
- Con el panel contraído se renderiza solo `PanelRail` (sin cambios), por lo que no hay impacto.
- Tests: `rightpanel.spec.tsx` (Actividad primero, botón dentro del header, orden de secciones).
