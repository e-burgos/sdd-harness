# FIX-e-burgos-005-010 — Workspace: panel derecho muestra documentos, actividad y specs/ciclos/fixes de la conversacion

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-010 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

RightPanel.tsx deriva 'Detalles' solo de cycleForChannel(snapshot, channelId) (L111) -> 'Este canal no tiene un ciclo activo' y 'Actividad' solo de presence (L22-L27) -> 'Nadie esta trabajando ahora'. ThreadLinkPicker muestra 'Sin asociar' porque link.target es kind none (threads.json: link.source auto) y nada deriva la relacion de los eventos.

## Solucion propuesta

- RightPanel: con conversacion seleccionada, secciones 'Donde estas' (gate derivado), 'Documentos generados' (via RelatedDocuments agrupado), 'Ultimas acciones del enjambre' (ultimos N dialogos con autor), y specs/ciclos/fixes trabajados; mantiene el estado vacio solo si no hay nada derivado. El ciclo de 'Detalles' prefiere el ciclo derivado de la conversacion y cae a cycleForChannel.
- ThreadLinkPicker: cuando link.target es none, muestra 'Detectado: <spec/ciclo/fix>' derivado de eventos (solo lectura, sin persistir).
- Fuera de alcance: persistir asociacion multiple (link.targets[]) -> cycle-02.

## Archivos esperados

- `apps/studio/src/components/workspace/RightPanel.tsx`
- `apps/studio/src/components/workspace/RightPanel.spec.tsx`
- `apps/studio/src/components/workspace/ThreadLinkPicker.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`

## Verificacion

- RightPanel.spec.tsx: hilo con docs y fix sin link manual -> muestra relacionados; hilo vacio -> estados vacios actuales.
