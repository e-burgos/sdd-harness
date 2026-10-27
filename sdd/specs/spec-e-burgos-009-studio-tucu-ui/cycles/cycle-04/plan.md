# spec-e-burgos-009-studio-tucu-ui — cycle-04 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: pedido del dev (2026-10-27). Mejorar el contenido de los 9 selectores con lo que ya trae el `Select` de tucu-ui 3.5.0 (ícono, descripción, check y búsqueda), con menús que se ajustan a su contenido. El rediseño del sidebar entra en este ciclo solo después de que el dev apruebe la propuesta.
> Fuera de alcance: modales con barra lateral (esperan `SplitModal` de tucu-ui, pedido a su spec-002) y la limpieza que habilita tucu-ui 3.6.0.

## Historias
- US-011 — Como usuario quiero que cada selector me explique sus opciones para elegir sin adivinar. CA: cada opción muestra nombre y una descripción corta (es/en), con ícono donde aporta; la opción elegida lleva check; el disparador muestra un valor corto que no se recorta; el menú se ajusta al contenido sin pasarse del ancho útil ni cortar texto; los selectores con muchas opciones (vínculos, conversaciones) tienen búsqueda; teclado y lectores de pantalla siguen funcionando.

## Tasks
- TASK-001 — Selectores: opciones con `icon`/`description` (agente con su avatar y rol; modelo con su tier; esfuerzo; permisos; modo de desarrollo e implementación; vínculos de hilo agrupados con estado; conversaciones con fecha), `showCheck`, `searchable` donde la lista es larga, valor corto en el disparador y ancho del menú según contenido (mínimo el del disparador, máximo acotado, descripciones que pasan a la línea siguiente). Textos nuevos en `es.ts`/`en.ts`. Valida: specs de HelpSelect, Composer, ModeSelectors, ThreadLinkPicker y ConversationSelector; e2e del Composer; capturas en claro y oscuro.
- TASK-002 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, `build:local` → build del bridge → e2e, recorrida visual y fricciones nuevas a tucu-ui.

## Decisiones técnicas
- `HelpSelect` sigue siendo la única puerta: recibe `icon`/`description` por opción y los pasa al `Select`, así el estilo de los menús queda en un lugar.
- La propuesta del sidebar se presenta como mockup antes de tocar código; si se aprueba, se suma como task de este ciclo.
