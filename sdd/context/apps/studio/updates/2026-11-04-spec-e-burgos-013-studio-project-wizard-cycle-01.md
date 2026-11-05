# spec-e-burgos-013-studio-project-wizard — cycle-01 — 2026-11-04

## Estado
Módulo nuevo **Nuevo proyecto** (`new-project`): wizard de seis pasos (alcance, forma, frontend, backend, extras, resumen) que arma un `harness.config.json`, lo valida en vivo contra el puente (`wizard.validate`, debounce y cola de uno), elige una carpeta destino segura con explorador de directorios, muestra preflight (Node, pnpm, git, registry), genera con progreso por etapas y log, permite cancelar y cierra con una pantalla de resultado (revelar, copiar ruta, abrir el proyecto nuevo en Studio). Las opciones salen del catálogo de la CLI, nunca hardcodeadas. Con el puente en modo launcher (`workspace: null` en el handshake) la app monta `LauncherShell` con ese único módulo; `workspace.switched` recarga el estado y `resetState` limpia borradores. Documentado en `apps/studio/README.md` y en el sitio de documentación (es/en).

## Estructura
- `src/components/modules/new-project/` (panel, centro, derecha, `steps/`, `wizard-context.tsx`, diálogos y componentes de generación) y `src/components/shell/LauncherShell.tsx`.
- `src/lib/wizard/`: lógica pura (`state`, `to-config`, `step-gate`, `field-checks`, `issues`, `recommendations`, `preview-tree`, `generate-gate`, `target-status`) y hooks (`use-catalog`, `use-wizard-validation`, `use-target-check`, `use-preflight`, `use-generation`, `use-launch`). Estado y puntero de generación en `sessionStorage` (`sdd-studio:wizard:*`).
- i18n en `src/lib/i18n/modules/wizard.ts` (es/en); `BridgeProvider`, `ConnectScreen`, `ConnectionBanner`, `StudioHeader` y `WorkspaceApp` aceptan workspace nulo y el cambio de workspace.

## Dependencias
- Sin librerías nuevas. Consume los comandos `wizard.*` y `workspace.open` y los eventos `generation.*`/`workspace.switched` de `@sdd-studio/protocol`; requiere la feature `project-wizard` del puente.

## Qué sigue
- Verificación real de punta a punta y manual en Windows pendientes (TASK-022/023).
- No se puede reanudar una generación fallida o cancelada; las toolchains de Python y Java las pone el dev.
