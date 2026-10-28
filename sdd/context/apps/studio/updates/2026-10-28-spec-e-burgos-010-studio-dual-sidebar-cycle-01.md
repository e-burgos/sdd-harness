# apps/studio — spec-e-burgos-010-studio-dual-sidebar · cycle-01

## Estado
Studio usa un shell estilo Slack sobre `@e-burgos/tucu-ui` 3.9.1: riel de módulos personalizable (Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit, Arquitectura, Métricas, Más) y un panel de lista por módulo; el panel derecho solo existe en Inicio, Specs, Fixes, Agentes y Mapa. El header conserva idioma, tema y el chip del gate (lee `snapshot.tools?.gate ?? snapshot.gateMode`). Inicio tiene #general, #specs y #fixes con resumen; Specs muestra una ficha con pestañas; el Mapa conserva los nodos y el `AgentInspectorDrawer` embebido, con chat directo en tarjeta flotante. Kit permite prender/apagar rtk y el mod y cambiar el modo del gate con confirmación y `expectedRevision`.

## Estructura
- `src/components/shell/*`: `StudioShell`, `ModuleRail`, `ModulePanel`, `PanelGroup`/`PanelRow`, `RightPanelFrame`, `PanelRail`, `SidebarSearch`, `NewConversationIconButton`.
- `src/components/modules/{home,specs,fixes,agents,activity,map,kit,architecture,metrics}` con su i18n en `src/lib/i18n/modules/*`.
- `src/lib/nav/*`: navegación y riel persistidos por proyecto (`sdd-studio.nav.v1:<project>`, `sdd-studio.rail.v1:<project>`).
- `src/lib/sdd-status.ts`: estados de specs, ciclos y fixes compartidos por Inicio, Specs, Fixes y la conversación.
- Borrados el sidebar anterior (`Sidebar`, `NavTree`, `NavSections`, `RightPanel`, `Workspace`, `ChannelView`, `ConversationSelector`, stores `nav-tree`/`nav-filter`/`nav-summary`) y el slot `legacyCenter`.
- Escala tipográfica: micro 10, meta 11, ui 12, small 13, copy 14, title 16.

## Dependencias
- `@e-burgos/tucu-ui` 3.7.0 → 3.9.1 (exacta).

## Qué sigue
- Refrescar el contenido de skills con `workspace.changed`; Arquitectura relee más de lo necesario.
- Actividad sin conversaciones; horas aproximadas de aprobaciones y preguntas.
- Vista diff del visor de documentos con soporte del puente.
