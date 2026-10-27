# spec-e-burgos-009-studio-tucu-ui — cycle-05 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: Studio pasa a `@e-burgos/tucu-ui@3.6.0` y borra los ajustes propios que esa versión vuelve innecesarios. Es la base para el sidebar doble estilo Slack que pidió el dev (2026-10-27), que se suma como task después de aprobar su propuesta.
> Fuera de alcance: `SplitModal` y la API nueva de Select (llegan en tucu-ui 3.7.0). Sin PR hasta completar toda la adopción (pedido del dev): solo commits.

## Historias
- US-013 — Como dev de Studio quiero usar tucu-ui 3.6.0 sin los ajustes que ya resuelve. CA: el tema lo inicializa `ThemeModeScript` con `defaultMode="system"` (sin script propio ni `StudioThemeProvider` si ya no hace falta); los modales usan `overlayClassName`, `closeButtonProps`, `headerClassName`, `maxWidth`/`maxHeight` en vez de overrides; `ConnectionBanner` usa `Alert density="compact"` sin `!`; las tablas usan `BasicTable density="snug"` y tokens `--tucu-table-*` en lugar de reglas `[data-tucu=table-*]`; los selectores usan `appearance="neutral"`/`size="xs"` y Escape cierra su menú; los chips usan `Badge` sin overrides de altura; el aspecto no cambia en ninguno de los dos modos.

## Tasks
- TASK-001 — Adopción de 3.6.0: dependencia exacta, `ThemeModeScript` y `defaultMode="system"`, modales, Alert, BasicTable, Select, Tooltip `maxWidth`, Badge; borrar de `globals.css` y de los componentes todo lo que la versión resuelve; verificar que el puente de tokens de `globals.css` siga resolviendo en los dos modos. Valida: typecheck, vitest, e2e y capturas en claro y oscuro.
- TASK-002 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, `build:local` → build del bridge → e2e, recorrida visual y fricciones nuevas a tucu-ui.

## Decisiones técnicas
- Lo que 3.6.0 no resuelva igual que el ajuste actual se mantiene y se reporta a tucu-ui.
- El sidebar doble se diseña en paralelo (análisis y mockup en el main loop) y entra como task de este ciclo solo con el OK del dev.
