# spec-e-burgos-009-studio-tucu-ui — cycle-04 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: pedido del dev (2026-10-27). Mejorar el contenido de los 9 selectores con lo que ya trae el `Select` de tucu-ui 3.5.0 (ícono, descripción, check y búsqueda), con menús que se ajustan a su contenido. El rediseño del sidebar sigue el mockup que el dev aprobó el 2026-10-27.
> Fuera de alcance: modales con barra lateral (esperan `SplitModal` de tucu-ui, pedido a su spec-002) y la limpieza que habilita tucu-ui 3.6.0.

## Historias
- US-011 — Como usuario quiero que cada selector me explique sus opciones para elegir sin adivinar. CA: cada opción muestra nombre y una descripción corta (es/en), con ícono donde aporta; la opción elegida lleva check; el disparador muestra un valor corto que no se recorta; el menú se ajusta al contenido sin pasarse del ancho útil ni cortar texto; los selectores con muchas opciones (vínculos, conversaciones) tienen búsqueda; teclado y lectores de pantalla siguen funcionando.

- US-012 — Como usuario quiero un sidebar que me muestre de un vistazo qué está pasando. CA: buscador que filtra canales, specs, fixes y agentes; hilos en curso con el agente que trabaja y su estado; specs con estado, ciclo, flow y progreso de tareas; fixes con severidad; agentes con presencia y tarea actual; encabezados con resumen; secciones vacías sin líneas de relleno; modo colapsado a íconos; teclado y lectores de pantalla siguen funcionando.

## Tasks
- TASK-001 — Selectores: opciones con `icon`/`description` (agente con su avatar y rol; modelo con su tier; esfuerzo; permisos; modo de desarrollo e implementación; vínculos de hilo agrupados con estado; conversaciones con fecha), `showCheck`, `searchable` donde la lista es larga, valor corto en el disparador y ancho del menú según contenido (mínimo el del disparador, máximo acotado, descripciones que pasan a la línea siguiente). Textos nuevos en `es.ts`/`en.ts`. Valida: specs de HelpSelect, Composer, ModeSelectors, ThreadLinkPicker y ConversationSelector; e2e del Composer; capturas en claro y oscuro.
- TASK-002 — Sidebar según el mockup aprobado: encabezado compacto con punto de conexión y versión del kit, buscador (⌘K) que filtra el árbol, botón + de nueva conversación; "En curso" con avatar del agente y chip de estado (se oculta vacía); canales como chips con cantidad de conversaciones (no hay dato de no leídos); specs con punto de estado, chip `cNN · flow`, mini barra y contador de tareas, conversaciones resumidas en una línea; fixes con severidad y estado; agentes con anillo de presencia, nombre y tarea o rol; encabezados con resumen; pie con modo colapsado a íconos en lugar de "Views". Solo datos que Studio ya recibe. Valida: specs de Sidebar y NavTree, e2e, capturas en claro y oscuro a 1440×860 y 1280×700.
- TASK-003 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, `build:local` → build del bridge → e2e, recorrida visual y fricciones nuevas a tucu-ui.

## Decisiones técnicas
- `HelpSelect` sigue siendo la única puerta: recibe `icon`/`description` por opción y los pasa al `Select`, así el estilo de los menús queda en un lugar.
- El sidebar usa solo datos del snapshot, los hilos y la presencia que ya llegan del bridge: sin cambios en el bridge ni en el protocolo.
