# Montaje de tucu-ui

Peers: `react >=18`, `react-dom`, `tailwindcss >=4`; `next >=16` opcional (App Router con React 19).
Se instala con el package manager del repo (`pnpm add @e-burgos/tucu-ui`).

## Exports del paquete

| Import | Qué trae | Cuándo |
| --- | --- | --- |
| `@e-burgos/tucu-ui` | componentes, hooks (`useTheme`), `cn`, `ReactRouter`, `LucideIcons` | siempre |
| `@e-burgos/tucu-ui/styles` | CSS completo **con Tailwind v4 empaquetado** | app sin Tailwind propio |
| `@e-burgos/tucu-ui/styles-core` | igual sin temas macOS (la mitad de peso) | app sin Tailwind y sin macOS |
| `@e-burgos/tucu-ui/theme` | tokens + CSS de componentes, **sin** Tailwind | app con Tailwind propio (lo normal) |
| `@e-burgos/tucu-ui/theme-core` | `theme` sin macOS | Tailwind propio, sin macOS |
| `@e-burgos/tucu-ui/next` | `NextThemeProvider`, `ThemeModeScript` | Next 16 |

## A. App con Tailwind v4 propio (caso más común)

```css
@import 'tailwindcss';
@import '@e-burgos/tucu-ui/theme';
@source '<ruta-relativa>/node_modules/@e-burgos/tucu-ui/**/*.mjs';
@source '<ruta-relativa>/libs/<ui-compartida>/src';
```

- **Nunca** `styles` junto con tu `@import 'tailwindcss'`: son dos Tailwind y se pisan.
- El `@source` apunta a los `*.mjs` del paquete (escanear todo el paquete es lento y trae falsos
  positivos). La ruta es relativa al CSS: en un monorepo pnpm suele ser `../../../../node_modules/…`
  hasta la raíz. Si los componentes de tucu-ui aparecen sin estilos, el `@source` está mal.
- Las fuentes van por `@import url(...)` de Google Fonts **antes** de `@import 'tailwindcss'`
  (Vite) o con `next/font` (Next). Se declaran en `@theme { --font-sans: ...; --font-mono: ...; }`.
- Tus overrides de tokens van **después** del `@import` del tema (ver `02-theming.md`).
- Tema `macos-tahoe`: estiliza `p`/`h1`… sin layer; si tus utilidades pierden contra él, usá
  `@import 'tailwindcss' important;`.

## B. SPA Vite (ThemeProvider es el router y el shell)

```tsx
import { ThemeProvider } from '@e-burgos/tucu-ui';

<ThemeProvider
  architecturalPatterns="standalone"
  layout="admin"
  menuItems={menuItems}
  logo={<Logo />}
  customPaletteColor={{ primary: '#0ea5e9', darkPrimary: '#0ea5e9' }}
  defaultMode="system"
  lang="es"
  showSettings={false}
/>
```

- Las páginas cuelgan de `menuItems` (`name`, `href`/`path`, `icon`, `component`, `hide`).
  Rutas fuera del menú (auth, detalle) por `customRoutes`. Hooks de router: namespace
  `ReactRouter` que exporta tucu-ui; no instales otro `react-router-dom`.
- **MFE**: `architecturalPatterns="mfe"` + `basePath` + `appRoutesConfig` + `isAuthenticated`.
- `lang` (`es` | `en` | `fr`, acepta `es-AR`) traduce validaciones, aria-labels, paginación y el
  date picker.
- En tests (Vitest) puede hacer falta `server.deps.inline: ['@e-burgos/tucu-ui']`.

## C. Next 16 App Router

```tsx
import { NextThemeProvider, ThemeModeScript } from '@e-burgos/tucu-ui/next';

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><ThemeModeScript defaultMode="system" /></head>
      <body>
        <NextThemeProvider layout="admin" menuItems={menuItems} logo={<Logo />}>{children}</NextThemeProvider>
      </body>
    </html>
  );
}
```

- `globals.css` = receta A.
- Todos los módulos traen `'use client'`: se importan desde Server Components, pero **funciones no
  cruzan la frontera** — `cell` de DataTable, `onClick`, render props van en un componente cliente.
- Vite-only: `ThemeProvider` con router propio, el namespace `ReactRouter`, `useTabParam` sin
  contexto de router. En Next se navega con `next/link` / `useRouter`.
- Export estático funciona. App de referencia: `apps/next-demo` del repo de tucu-ui.

## D. Landing o storefront sin el shell

Para páginas públicas usá `MarketingLayout` (nav + main + footer) o `SplitAuthLayout` (auth)
dentro de un layout `clean`; no hace falta el chrome de admin. Si la landing es Next y la app es
Vite, comparten **tokens** (CSS) y componentes de `libs/`, no el provider.

## Checklist de montaje

- [ ] Un solo Tailwind (receta A o `styles`, nunca ambos).
- [ ] `@source` a `**/*.mjs` de tucu-ui y a cada lib propia con clases.
- [ ] Provider correcto para el framework (Vite: `ThemeProvider`; Next: `NextThemeProvider` +
  `ThemeModeScript` + `suppressHydrationWarning`).
- [ ] Fuentes declaradas en `@theme`.
- [ ] `html.dark` alterna bien y no hay flash del modo equivocado al cargar.
