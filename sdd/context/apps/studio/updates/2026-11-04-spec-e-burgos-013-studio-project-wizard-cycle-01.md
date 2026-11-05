# spec-e-burgos-013-studio-project-wizard — cycle-01 — 2026-11-04

## Estado
Módulo nuevo **Nuevo proyecto** (`new-project`): wizard de seis pasos (alcance, forma, frontend, backend, extras, resumen) que arma un `harness.config.json`, lo valida en vivo contra el puente (`wizard.validate`, debounce y cola de uno), elige una carpeta destino segura con explorador de directorios, muestra preflight (Node, pnpm, git, registry), genera con progreso por etapas y log, permite cancelar y cierra con una pantalla de resultado (revelar, copiar ruta, abrir el proyecto nuevo en Studio). Las opciones salen del catálogo de la CLI, nunca hardcodeadas. Con el puente en modo launcher (`workspace: null` en el handshake) la app monta `LauncherShell` con ese único módulo; `workspace.switched` recarga el estado y `resetState` limpia borradores. Documentado en `apps/studio/README.md` y en el sitio de documentación (es/en).

## Estructura
- `src/components/modules/new-project/` (panel, centro, derecha, `steps/`, `wizard-context.tsx`, diálogos y componentes de generación) y `src/components/shell/LauncherShell.tsx`.
- `src/lib/wizard/`: lógica pura (`state`, `to-config`, `step-gate`, `field-checks`, `issues`, `recommendations`, `preview-tree`, `generate-gate`, `target-status`) y hooks (`use-catalog`, `use-wizard-validation`, `use-target-check`, `use-preflight`, `use-generation`, `use-launch`). Estado y puntero de generación en `sessionStorage` (`sdd-studio:wizard:*`).
- Fixes de revisión: `WizardUnavailable` (`useWizardUnavailable`) bloquea panel y centro sin la feature `project-wizard`; `useCatalog(client, enabled)` no pide catálogo en ese caso; abrir el proyecto generado pide `ConfirmDialog` cuando ya hay un proyecto abierto y se deshabilita sin `workspace-switch`; la idea para Hermes se guarda solo tras un `workspace.open` exitoso; `use-generation` recorta la salida al pasar `GENERATION_BUFFER_BYTES` (al 75 %) y expone `outputVersion` para el autoscroll de `OutputLog`. `BridgeCapability` suma `project-wizard` y `workspace-switch`.
- Specs del wizard con timeout async mayor que el default de Testing Library (1 s): bajo la carga de la suite completa fallaban.
- i18n en `src/lib/i18n/modules/wizard.ts` (es/en); `BridgeProvider`, `ConnectScreen`, `ConnectionBanner`, `StudioHeader` y `WorkspaceApp` aceptan workspace nulo y el cambio de workspace.

## Dependencias
- Sin librerías nuevas. Consume los comandos `wizard.*` y `workspace.open` y los eventos `generation.*`/`workspace.switched` de `@sdd-studio/protocol`; requiere la feature `project-wizard` del puente.

## Qué sigue
- E2E del wizard (4/4) y generación real por el puente (TASK-022) verificados; la verificación manual en Windows queda pendiente (seguimiento del review).
- No se puede reanudar una generación fallida o cancelada; las toolchains de Python y Java las pone el dev.
