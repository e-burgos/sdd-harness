# spec-e-burgos-009 cycle-01 — 2026-10-27

## Estado
Studio usa `@e-burgos/tucu-ui@3.4.0` vía `@e-burgos/tucu-ui/next`: `NextThemeProvider` en `app/layout.tsx` (`themeStyle="default"`, `layout="clean"`, `mode="dark"`, `background="none"`, sin menú ni settings), paleta y tipografía del tema de tucu-ui (Inter y JetBrains Mono de `@e-burgos/tucu-ui/fonts`) y primitivas de la librería: `Button` en los botones de acción, `Input`/`Textarea`/`Checkbox`/`Radio` en los campos, `Badge` en `StatusBadge` y chips de estado, `Alert` en el error de sincronización de `ConnectionBanner`. La distribución de todas las pantallas no cambió y el viewport sigue bloqueado.

## Estructura
- `app/globals.css`: `@import '@e-burgos/tucu-ui/theme'` + `@source` al paquete + `@import '@e-burgos/tucu-ui/fonts'`; `@theme inline` puentea `ink-*`, `accent-*`, `amberish`, `roseish` y `emerald-*` a variables del tema (`--color-body`, `--color-light-dark`, `--color-secondary`, `--color-foreground`, `--color-muted`, `--color-brand`, `--color-success`, `--color-warning`, `--color-error`). Un color nuevo se pide al tema, no se hardcodea.
- `globals.css` neutraliza el tinte de `Button variant="transparent"` con `[data-tucu='button'][data-variant='transparent']`.
- `lib/i18n/i18n.tsx` sincroniza el idioma de tucu-ui con `useTheme.setState({ lang: resolveTucuLang(lang) })`.
- Excepciones nativas a propósito: `<button>` estructurales (filas y carets de `NavTree`, tabs y segmented controls, filas de listas, chips de gate/agente), el `<select>` de `HelpSelect`, el `<input type=file>` del Composer, `GateStatusModal` y `DocumentViewerModal` (tucu `Modal` no deja pasar `aria-label`/`data-testid` ni traduce el cierre), el `role="status"` de reconexión y `ActivityIndicator`.
- Overrides de tamaño sobre tucu-ui: `Input`/`Textarea` con utilidades `!` vía `inputClassName`; layout (`ml-auto`, `absolute`) en un wrapper propio porque `Button` ya envuelve en un `<div>`.
- `vitest.config.mts`: `server.deps.inline: ['@e-burgos/tucu-ui', 'swiper']` (el barrel raíz importa CSS de swiper).

## Dependencias
- Nueva: `@e-burgos/tucu-ui` 3.4.0 (exacta, desde npm).
- Quitadas: `@fontsource-variable/space-grotesk`, `@fontsource-variable/jetbrains-mono`.

## Qué sigue
- El e2e sirve `apps/studio-bridge/dist/web`, una copia de `apps/studio/out` que solo se refresca con `pnpm --filter sdd-studio build`: para probar la UI nueva, `build:local` → build del bridge → `e2e`, en ese orden.
- Migrar los dos modales a tucu `Modal` cuando la librería acepte `aria-label`, `data-testid`, label de cierre traducible y header como ReactNode.
- Reemplazar el puente de tokens por un preset de marca con nombre cuando tucu-ui lo ofrezca.
