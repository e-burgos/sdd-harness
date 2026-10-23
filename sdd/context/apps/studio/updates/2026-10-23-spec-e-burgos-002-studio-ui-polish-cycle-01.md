# spec-e-burgos-002-studio-ui-polish cycle-01 — 2026-10-23

## Estado

- Shell completamente anclado al viewport sin scrollbars indeseados en el documento ni saltos de scroll al hacer foco en el composer.
- Menú `@`/`/`: priorización de agentes sobre archivos y envío directo con un único Enter sobre comandos completos.
- Interfaz modular con sidebar y panel derecho colapsables, guardando la preferencia en localStorage.
- Composer acotado a 200px con scroll vertical interno; ErrorBoundary de nivel superior con acción de recarga; ApprovalCard con colapso de argumentos extensos.
- Store cliente con deduplicación de eventos consecutivos idénticos del bot.

## Estructura

- `components/AppShell.tsx`, `components/WorkspaceApp.tsx`, `globals.css`: contención de overflow del documento y preservación de layout anclado.
- `lib/use-mention-menu.ts`: orden de catálogo priorizando agentes y lógica de Enter inmediato sobre comandos completos.
- `lib/use-panel-state.ts`, `components/workspace/PanelRail.tsx`: control reactivo y botones de riel para colapsar paneles laterales.
- `components/ErrorBoundary.tsx`: boundary de React con fallback i18n y botón de reintento.
- `components/workspace/ApprovalCard.tsx`: truncamiento expandible para parámetros o comandos largos.
- `lib/store/state.ts`: dedupe de eventos de bot consecutivos.

## Dependencias

- Sin dependencias externas añadidas.

## Qué sigue

- Validación con múltiples arneses en simultáneo y posibles refinamientos visuales a pedido de devs.
