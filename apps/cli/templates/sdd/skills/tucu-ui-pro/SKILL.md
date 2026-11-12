---
name: tucu-ui-pro
description: Usar siempre que un frontend React/Next use (o vaya a usar) @e-burgos/tucu-ui — montarlo en Vite, Next 16 o una app con Tailwind propio, elegir ThemeProvider/layout/preset, tematizar con customPaletteColor y tokens --tucu-*, elegir el componente correcto con sus props válidos y esquivar las trampas que rompen en runtime, con o sin el MCP tucu-ui conectado.
---

# Skill: tucu-ui-pro

tucu-ui (`@e-burgos/tucu-ui`) es una librería React + Tailwind v4 que trae **el shell completo**
(ThemeProvider = router + layout + tema), ~110 componentes, gráficos, DataTable sobre TanStack,
formularios Zod + react-hook-form, iconos y temas macOS. Esta skill es el oficio de usarla bien. El
criterio visual (qué lenguaje, qué jerarquía) vive en la skill `design-languages`; el motion en
`crafted-motion`. Si el subproyecto declara reglas propias en su `constitution.md`, esas mandan.

> Base verificada: **tucu-ui 3.10.0** y **tucu-ui-mcp 0.16.0**. Antes de escribir código leé la
> versión del `package.json` del subproyecto: si es anterior, verificá cada prop con el MCP
> (`get_props`) o con los tipos en `node_modules/@e-burgos/tucu-ui` — entre 3.0 y 3.10 hubo
> renombres (ej. el `Button variant="brand"` de 3.0 no existe en 3.10: es `variant="solid"`).

## Flujo de trabajo (siempre en este orden)

1. **Montaje**: confirmar cómo está instalado (o instalarlo) → `references/01-montaje.md`. Un
   montaje mal hecho (doble Tailwind, `@source` mal apuntado, providers de Vite en Next) produce
   estilos que faltan sin ningún error.
2. **Lenguaje visual**: si la task es de diseño, elegir o leer el lenguaje en `design-languages`.
3. **Tema**: ThemeProvider (`themeStyle`, `layout`, `preset`, `customPaletteColor`) y overrides de
   tokens → `references/02-theming.md`.
4. **Componentes**: elegir del catálogo antes de escribir uno propio → `references/03-componentes.md`.
   Con el MCP conectado, `get_component` / `get_props` por cada componente que uses por primera
   vez en la task; los generadores (`generate_page`, `generate_form`, `generate_datatable`) dan un
   punto de partida, no el resultado final.
5. **Trampas**: repasar `references/04-trampas.md` antes de dar la task por terminada.
6. **Verificar en el navegador**: desktop y 375 px, light y dark, `prefers-reduced-motion`, foco
   visible y navegación por teclado. Sin consola con errores ni warnings de React.

## Con MCP y sin MCP

| Situación | Fuente de verdad |
| --- | --- |
| MCP `tucu-ui` conectado (`pnpm sdd:tucu -- --status`) | `get_component`, `get_props`, `search_components`, `search_icons`; recursos `tucu://tokens`, `tucu://theme`, `tucu://layouts`, `tucu://styling-overrides`, `tucu://design-guide`; prompt `design-review` al cerrar |
| Sin MCP | esta skill + los tipos `.d.ts` de `node_modules/@e-burgos/tucu-ui` (grep del nombre del prop) |
| Skill `tucu-ui-design` instalada (integración prendida) | su `design-guide.md` y `checklist.md` como segunda opinión de composición |

Nunca inventes un prop: si no aparece en el MCP ni en los tipos, no existe.

## Reglas de oficio

- **Componente de tucu-ui antes que uno propio.** Antes de escribir una card, badge, tabs, tabla,
  filtro, KPI o modal, buscalo (`search_components` o `03-componentes.md`). Lo propio solo si no
  existe, y entonces se compone con primitivos de tucu-ui y tokens, no con colores sueltos.
- **Tokens, no hex.** Color de acción = marca (`bg-brand`, `text-brand`, `Button` sólido). Texto
  `text-foreground` / `text-muted`, bordes `border-border`, superficies `bg-body` / `bg-light-dark`.
  Clases que parecen de shadcn (`text-muted-foreground`, `bg-card`, `bg-popover`,
  `text-destructive`) **no existen** en tucu-ui y no pintan nada.
- **La marca se define una vez** en `customPaletteColor` (o `brandColor` / `preset`), nunca
  repartida en clases `sky-500` por los componentes.
- **El mismo dato lleva el mismo tono en todas las pantallas** (estado pagado = `green` siempre).
- **Números en mono tabular** (`font-mono tabular-nums`, `MoneyText` para dinero).
- **`cn()` de tucu-ui para unir clases**: usa tailwind-merge, así tu `className` gana sobre el
  default del componente.
- **Light y dark son de primera clase**: nunca fijes `text-white` o `text-zinc-*` en el contenedor
  raíz de una página (se hereda y deja invisibles los títulos en el modo opuesto).

## Cuándo leer cada reference

| Necesidad | Archivo |
| --- | --- |
| Instalar, CSS de entrada, `@source`, Vite vs Next, MFE | `references/01-montaje.md` |
| ThemeProvider, themeStyle/layout, presets, ThemeScope, paleta, tokens y overrides | `references/02-theming.md` |
| Qué componente usar y sus props clave, por categoría | `references/03-componentes.md` |
| Props que rompen en runtime, comportamientos sorpresivos, checklist | `references/04-trampas.md` |
