# apps/studio — spec-e-burgos-009-studio-tucu-ui · cycle-03

## Estado
Studio usa `@e-burgos/tucu-ui` 3.5.0 sin wrappers propios: `Tooltip` (`size="xs" arrow={false}`), `Badge` (`tone`, `variant="soft"`) y `Select` (`aria-label`/`aria-describedby`, `buttonClassName`, opciones con `group`) se usan directo. `GateStatusModal` y `DocumentViewerModal` usan `Modal` de tucu-ui (role dialog, Escape, foco atrapado y devuelto) y quedan siempre montados con `isOpen`.

## Estructura
- `components/StudioThemeProvider.tsx` (cliente) monta `NextThemeProvider layout="clean"` con `defaultMode` según `prefers-color-scheme`; `app/layout.tsx` conserva el script anti-flash del `<head>`.
- `lib/typography-tokens.ts` registra la escala `micro…title` con `extendClassMergeTokens`, así que `cn` de tucu ya no confunde `text-meta`/`text-ui` con colores.
- Borrados: `ColorModeBootstrap`, `Tip`, `StatusPill`. `HelpSelect` queda como composición fina (Select + ícono de ayuda con Tooltip + descripción sr-only).
- `globals.css`: sin reglas `[data-tucu='button']`, `[data-help-select]` ni de select; quedan solo las de `table-element` (BasicTable no tiene esa densidad).

## Dependencias
- `@e-burgos/tucu-ui` 3.4.0 → 3.5.0 (exacta). `@source` apunta a `**/*.mjs` del paquete. vitest ya no necesita `server.deps.inline`.

## Qué sigue
- tucu-ui 3.6.0 trae `ThemeModeScript` y `defaultMode="system"`: reemplazan el script del `<head>` y `StudioThemeProvider`.
- Único override con `!` que queda: `ConnectionBanner` (Alert sin densidad compacta), reportado a tucu-ui. El overlay de los modales quedó más claro que antes porque `Modal` no permite cambiarlo (reportado).
- `SegmentedControl` propio hasta que tucu-ui lo publique.
