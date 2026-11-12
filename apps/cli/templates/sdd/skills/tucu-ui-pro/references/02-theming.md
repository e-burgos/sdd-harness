# Theming de tucu-ui

Cuatro palancas, de la más gruesa a la más fina. Usá la más gruesa que alcance.

## 1. `themeStyle` + `layout` (el chrome)

| `themeStyle` | `layout` válidos | Para |
| --- | --- | --- |
| `default` (omitible) | `admin` (sidebar), `horizontal` (topbar), `clean` (sin chrome) | apps de gestión, landings y auth (`clean`) |
| `macos` | `macos`, `macos-clean` | look macOS Sonoma |
| `macos-tahoe` | `macos-tahoe`, `macos-tahoe-dock`, `macos-tahoe-clean` | look macOS Tahoe (vidrio nativo); base natural del Liquid Glass |

`LAYOUT_OPTIONS` (enum exportado) tiene los mismos valores. Un layout fuera de su `themeStyle`
cae al default del estilo. Para pantallas sin chrome dentro de una app con sidebar (login,
onboarding) usá la variante `*-clean` del mismo estilo.

## 2. Preset (`preset`) — personalidad sin tocar CSS

Built-ins: `glass`, `classic`, `elegant`, `fresh`, `minimal`, `vibrant`. Propios:

```ts
import { registerThemePresets } from '@e-burgos/tucu-ui';

registerThemePresets({
  name: 'acme', accent: '#0ea5e9', darkAccent: '#38bdf8',
  surface: 'auto', radius: 'lg', cards: 'solid', buttons: 'rounded',
  fontFamily: "'Geist', sans-serif", headingFontFamily: "'Outfit', sans-serif",
});
<ThemeProvider preset="acme" … />
```

Los presets escriben `--tucu-accent`, `--tucu-radius`, `--tucu-card-*` y `data-tucu-*`.
Multi-tenant / multi-host: `resolveThemePreset({ host, tenant, rules, fallback })`.

**`ThemeScope`** aplica un preset y un modo a un subárbol (`preset`, `mode` light | dark | auto,
`tokens` con variables crudas). Los overlays abiertos adentro (Modal, Drawer, Select, tooltips)
se montan en el portal del scope y conservan su tema; dale `relative` o `isolate` si necesitás
contener su z-index. Solo se soporta **un nivel** de anidado de modo opuesto (`dark:` dentro de
un scope light dentro de `html.dark`).

## 3. Paleta (`customPaletteColor` / `brandColor`)

`brandColor` toma un nombre de preset de color (`'Blue'`, `'Green'`…; lista en `tucu://theme`).
`customPaletteColor` acepta hex o nombre por slot, con su par dark:

`primary`/`darkPrimary` (marca → `bg-brand`, `text-brand`, Button sólido), `secondary`,
`accent`, `muted`, `lightBg`/`darkBg` (fondo de página → `bg-body`), `lightDark`/`darkLightDark`
(superficie elevada → `bg-light-dark`), `fg`/`darkFg` (texto → `text-foreground`), `border`/
`darkBorder`, `success`, `warning`, `error`, `info` (cada uno con `dark*`).

> ⚠️ `--color-accent` por defecto es **amarillo**. Si tu lenguaje no lo usa, fijalo en
> `customPaletteColor.accent` (o en CSS: `html:root{--color-accent:…} html.dark{--color-accent:…}`);
> si no, hovers y fondos de acento salen amarillos.

## 4. Tokens CSS (`--tucu-*`) — ajuste fino

Cada token tiene un valor `-default` que define la librería y un nombre público que vos
sobreescribís: el componente lee `var(--tucu-x, var(--tucu-x-default))`. **Sobreescribí siempre
el nombre sin `-default`**, después del `@import` del tema, en `:root` y `.dark`:

```css
:root {
  --tucu-glass-regular-bg: rgba(255, 255, 255, 0.58);
  --tucu-glass-blur-regular: 26px;
  --tucu-radius-card: 1rem;
}
.dark {
  --tucu-glass-regular-bg: rgba(44, 44, 52, 0.55);
}
```

Familias principales (lista completa en el recurso MCP `tucu://tokens`):

| Familia | Gobierna |
| --- | --- |
| `--tucu-glass-{thin,regular,thick,sub}-bg`, `--tucu-glass-blur-*`, `--tucu-glass-border` | `GlassPanel` y superficies de vidrio |
| `--tucu-radius-{control,card,panel}` | radios de controles, cards y paneles |
| `--tucu-shadow-{card,panel,float}` | elevación |
| `--tucu-state-{green,orange,red,teal,purple,neutral}-{soft,ink,line}` | `StateBadge`, `FilterPill`, notices |
| `--tucu-table-*`, `--tucu-datatable-card-*` | `BasicTable` / `DataTable` (bg, header, hover, divider, pinned) |
| `--tucu-input-*`, `--tucu-control-*`, `--tucu-ctl-*` | inputs y controles |
| `--tucu-button-*`, `--tucu-badge-*`, `--tucu-alert-*`, `--tucu-toast-*`, `--tucu-tooltip-*` | cada componente |
| `--tucu-segmented-*` | `SegmentedControl` |
| `--tucu-marketing-*`, `--tucu-auth-*`, `--tucu-split-modal-*` | `MarketingLayout`, `SplitAuthLayout`, `SplitModal` |

Tokens de color de Tailwind que expone el tema: `bg-body`, `bg-light-dark`, `bg-brand`,
`text-brand`, `text-foreground`, `text-muted`, `border-border`, `bg-accent`, `text-error`,
`text-warning`, `text-success`, `text-info`. Si te falta un paso intermedio de escala (ej.
`zinc-150`), definilo en `@theme` con `color-mix(in oklab, var(--color-zinc-100) 50%, var(--color-zinc-200))`
en vez de un hex suelto.

## Modo claro / oscuro

- Clase `dark` en `<html>`; `defaultMode="system"` sigue al SO. `useTheme()` (store Zustand
  persistido) expone `mode`, `layout`, `lang`, `direction` y los slots de color.
- `@custom-variant dark (&:where(.dark, .dark *));` en tu CSS si escribís `dark:` propio.
- Diseñá los dos modos a la vez: cada superficie y cada texto con su par. Probalos ambos.

## Motion global

`ThemeProvider` envuelve en `MotionConfig reducedMotion="user"`; `motion={{ reducedMotion }}` lo
cambia. Coreografías y tokens de motion: skill `crafted-motion`.
