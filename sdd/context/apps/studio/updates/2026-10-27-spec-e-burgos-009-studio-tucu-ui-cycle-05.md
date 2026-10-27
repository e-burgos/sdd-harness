# apps/studio — spec-e-burgos-009-studio-tucu-ui · cycle-05

## Estado
Studio usa `@e-burgos/tucu-ui` 3.6.0. El modo inicial lo pone `<ThemeModeScript defaultMode="system" />` en el `<head>` (sin script propio) y `StudioThemeProvider` pasa `defaultMode="system"`; queda solo para cargar `lib/typography-tokens`. Los modales usan `overlayClassName`, `closeButtonProps`, `headerClassName`, `maxWidth`/`maxHeight`; el visor de documentos usa el cierre propio de Modal. `ConnectionBanner` usa `Alert density="compact"` sin `!`. Las tablas usan `BasicTable density="snug"` y tokens `--tucu-table-*` en `:root` en lugar de reglas `[data-tucu=table-*]`. `HelpSelect` usa `appearance="neutral"` y Escape cierra el menú.

## Estructura
- Nuevo `src/types/tucu-ui-next.d.ts`: declara `ThemeModeScript` porque el `index.d.ts` de `@e-burgos/tucu-ui/next` 3.6.0 no lo exporta (fricción reportada; borrar cuando tucu-ui lo publique).
- `globals.css` ya no tiene reglas de tabla; el puente de tokens sigue resolviendo en los dos modos (todas las `--color-*` que usa existen en 3.6.0).

## Dependencias
- `@e-burgos/tucu-ui` 3.5.0 → 3.6.0 (exacta).

## Qué sigue
- tucu-ui 3.7.0: `SplitModal` para los dos modales, API nueva de Select (reemplaza los ajustes de lista de `HelpSelect`), Button `shape="square"`, Input `shortcut`, Badge `size="micro"`, Tooltip `lazy` y `--color-page`.
- Sidebar doble estilo Slack (riel de módulos + panel de lista, canales `#general`/`#specs`/`#fixes` con resumen): propuesta mostrada al dev, pendiente de dos decisiones (panel en Mapa/Métricas; Ecosistema y Telemetría juntos o separados).
- Diferencias visuales menores aceptadas: tablas `snug` (13px, padding menor), radio y borde del Select `neutral`, hint del cierre del visor como `title` nativo.
