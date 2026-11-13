# Sky Console — el lenguaje de Display Ads

Consola de precisión para un SaaS de datos. Neutros zinc profundos, marca **sky `#0ea5e9`** con
**teal `#14b8a6`** de secundario, fondo con grid de puntos y un mesh de color apenas perceptible,
superficies que se elevan con borde fino y sombra larga muy suave, glows contenidos detrás de las
piezas protagonistas, labels técnicos en mono mayúscula. La app trabaja en light y dark; la
landing es dark por defecto.

## 1. Tokens (CSS de entrada, después del tema de tucu-ui)

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300..900&family=Geist+Mono:wght@300..700&family=Outfit:wght@300..900&display=swap');
@import 'tailwindcss';
@import '@e-burgos/tucu-ui/theme';
@source '<ruta>/node_modules/@e-burgos/tucu-ui/**/*.mjs';

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: 'Geist', 'Outfit', sans-serif;
  --font-mono: 'Geist Mono', monospace;
  --color-brand-5: color-mix(in srgb, var(--color-brand) 5%, transparent);
  --color-brand-10: color-mix(in srgb, var(--color-brand) 10%, transparent);
  --color-brand-20: color-mix(in srgb, var(--color-brand) 20%, transparent);
  --color-brand-40: color-mix(in srgb, var(--color-brand) 40%, transparent);
  --color-zinc-150: color-mix(in oklab, var(--color-zinc-100) 50%, var(--color-zinc-200));
  --color-zinc-450: color-mix(in oklab, var(--color-zinc-400) 50%, var(--color-zinc-500));
  --color-zinc-550: color-mix(in oklab, var(--color-zinc-500) 50%, var(--color-zinc-600));
  --color-zinc-850: color-mix(in oklab, var(--color-zinc-800) 50%, var(--color-zinc-900));
}

html:root { --color-accent: var(--color-zinc-100); }
html.dark {
  --color-accent: var(--color-zinc-850);
  --color-body: #0a0a0a;
  --color-light-dark: color-mix(in oklab, var(--color-zinc-900) 80%, transparent);
}

::selection { background: rgba(14, 165, 233, 0.25); }

.bg-grid-dots {
  background-size: 24px 24px;
  background-image: radial-gradient(circle, var(--color-zinc-200) 1px, transparent 1px);
}
.dark .bg-grid-dots { background-image: radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px); }

.bg-mesh-gradient {
  background-image:
    radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.08) 0, transparent 50%),
    radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.03) 0, transparent 50%),
    radial-gradient(at 100% 0%, rgba(244, 63, 94, 0.05) 0, transparent 50%);
}
.dark .bg-mesh-gradient {
  background-image:
    radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.06) 0, transparent 50%),
    radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.02) 0, transparent 50%),
    radial-gradient(at 100% 0%, rgba(244, 63, 94, 0.03) 0, transparent 50%);
}

* { scrollbar-width: thin; scrollbar-color: rgba(0, 0, 0, 0.16) transparent; }
.dark * { scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
```

Provider (Vite):

```tsx
<ThemeProvider architecturalPatterns="standalone" layout="admin" background="none" showSettings={false}
  customPaletteColor={{ primary: '#0ea5e9', darkPrimary: '#0ea5e9', secondary: '#14b8a6', darkSecondary: '#14b8a6' }}
  menuItems={menuItems} logo={<Logo />} />
```

- Un solo neutro: **zinc** (no mezclar con `neutral` ni `slate`).
- El `--color-accent` se fija porque el de tucu-ui es amarillo.
- Paleta de apoyo: indigo y rose **solo** en el mesh y en glows decorativos, nunca como acción.

### Landing (dark por defecto, sin el shell)

`<html class="dark">`; tokens propios en `@theme`: `--color-page:#09090b`, `--color-edge:rgb(255 255 255/.08)`,
`--color-edge-strong:rgb(255 255 255/.2)`, `--color-fill-ghost:rgb(255 255 255/.05)`, `--color-ink:#fff`,
`--color-border:#27272a`, `--color-light-dark:#18181b`. Para AA en dark, aclarar
`--color-zinc-500:#8b8b95` y `--color-zinc-600:#7c7c86`. Light (`.light`): `--color-page:#fafafa`,
`--color-edge:rgb(9 9 11/.1)`, `--color-edge-strong:rgb(9 9 11/.22)`, `--color-ink:#18181b`,
`--color-border:#e4e4e7`, `--color-light-dark:#f4f4f5`. Fuentes con `next/font`: **Outfit**
(display y texto) + **JetBrains Mono** (labels y datos).

## 2. Tipografía

| Uso | Clases |
| --- | --- |
| H1 de hero / CTA | `text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[0.95]` — segunda mitad del titular en `text-zinc-500` |
| H2 de sección | `text-4xl sm:text-5xl font-bold tracking-tighter` |
| Título de página (app) | `text-xl sm:text-2xl font-bold tracking-tight` + subtítulo `text-sm text-muted` |
| Título de card | `text-lg font-semibold tracking-tight` |
| Apoyo | `text-base text-zinc-500 max-w-[50ch] leading-relaxed` (landing `text-lg text-zinc-400 max-w-[44ch]`) |
| Eyebrow | punto `size-1 rounded-full bg-sky-400` + `text-[11px] font-mono font-medium text-sky-400 uppercase tracking-widest` |
| Micro-label de datos | `text-[10px] font-mono uppercase tracking-widest text-muted` |
| KPI | `text-3xl font-extrabold tracking-tight font-mono leading-none` + label `text-xs font-semibold uppercase tracking-wider` |

## 3. Layout

`max-w-7xl mx-auto` para páginas; hero y CTA en `max-w-4xl` centrado. Secciones de landing
`px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-24`. Grids `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
con `gap-4`–`gap-6` en app y hasta `gap-12` en landing. Header de página:
`flex flex-col sm:flex-row justify-between gap-4 border-b border-border/40 pb-4`. Contenido de
página entra con `animate-in fade-in slide-in-from-bottom-4 duration-300`.

## 4. Superficies y componentes firma

| Pieza | Receta |
| --- | --- |
| Card de app | `rounded-2xl bg-light-dark backdrop-blur-md border border-border shadow-[0_8px_30px_rgba(0,0,0,.02)] p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,.06)]` |
| KPI | `StatCard` de tucu-ui con `tone`; si se compone a mano: card de app + glow `absolute -top-6 -right-6 size-24 rounded-full blur-xl opacity-60 dark:opacity-40 group-hover:scale-150 duration-500` en el tono + ícono `p-2.5 rounded-xl border group-hover:scale-110` + barra `h-1.5 rounded-full` con relleno `duration-1000 ease-out` |
| Pantalla de auth | raíz `bg-zinc-50 dark:bg-[#0a0a0a] bg-grid-dots bg-mesh-gradient`; luces `size-[600px] rounded-full blur-[120px] bg-sky-500/5` (arriba-izq.) e `bg-indigo-500/5` (abajo-der.); columna izquierda `lg:w-1/2 p-12 border-r` con un mockup del producto en `perspective-1000`; o `SplitAuthLayout` con esa escena en `brand.background` |
| Card de login | `rounded-[2rem] p-8 backdrop-blur-xl bg-white/60 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,.05),inset_0_1px_0_rgba(255,255,255,.4)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.05)]` |
| CTA primario | `Button` sólido con `className="h-11 rounded-xl font-semibold shadow-lg shadow-sky-600/10 active:scale-[0.98] transition-all duration-200"` (landing: `bg-sky-700 hover:bg-sky-600 shadow-[0_0_0_1px_rgba(14,165,233,.3),0_12px_32px_rgba(14,165,233,.2)]`) |
| CTA secundario | `border border-edge hover:border-edge-strong text-zinc-400 rounded-xl` |
| Tabs | `AnimatedTabs`; si se compone: barra `p-1 bg-light-dark/50 backdrop-blur-md rounded-xl border border-border/50` + pill activa `bg-brand rounded-lg shadow-sm` compartida con `layoutId` y spring |
| Badge de estado | `StateBadge` / `Badge variant="soft"`; a mano: `rounded-full px-3 py-0.5 text-xs font-semibold border bg-{c}-500/10 text-{c}-500 border-{c}-500/25`. blue = info/admin, emerald = activo, red = error, amber = alerta |
| Pill de estado en vivo | `rounded-full bg-black/40 backdrop-blur-md border border-white/5` + punto `bg-emerald-500 animate-pulse` |
| Pricing destacado | `rounded-3xl p-8 lg:p-10 bg-zinc-900 border border-sky-500/40 shadow-[0_0_0_1px_rgba(14,165,233,.15),0_32px_64px_rgba(14,165,233,.08),0_16px_48px_rgba(0,0,0,.5)]` + chip `-top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-mono text-sky-400 bg-sky-500/15 border border-sky-500/30` |
| Dropdown | `w-60 rounded-2xl border border-edge bg-zinc-950/95 backdrop-blur-xl shadow-[0_12px_48px_rgba(0,0,0,.6)] p-1.5`, ítems `rounded-xl hover:bg-fill-ghost` |
| CTA final | glow `w-[800px] h-[400px] rounded-full blur-[120px] bg-sky-600/8` (solo `sm+`) detrás del titular |
| Bento / mockups | paneles `bg-zinc-800/50 rounded-xl p-4`, filas `bg-zinc-900/60 rounded-lg`, datos `font-mono text-[10px]`, punto vivo `animate-ping bg-emerald-400 opacity-50`, beam `via-sky-400` |

## 5. Motion

- Easing firma **`cubic-bezier(0.16, 1, 0.3, 1)`** (expo-out): `fade-up` 0,4 s (hero 0,5 s) con
  `translateY(12px)`; menús 0,15 s.
- Springs (framer-motion) `stiffness: 120, damping: 18` para entradas escalonadas; tabs con
  `layoutId`.
- Micro: botones `active:scale-[0.97–0.98]`, cards `hover:-translate-y-0.5`.
- Landing: GSAP lazy, **una entrada fuerte por sección**, loops (`float` 4 s ±7 px, `marquee`
  32 s, `beam-sweep` 3,5 s) pausados fuera de vista; **nada animado bajo 640 px**; con
  `prefers-reduced-motion` todo queda en su estado final. Nunca animes con GSAP un nodo que ya
  tiene `transition` o `fade-up`: animá un wrapper. Recetas en `crafted-motion`.

## 6. No hacer

- Indigo, purple o violet como color de acción; gradientes arcoíris.
- Mezclar `neutral`, `slate` y `zinc`.
- Glows sin contención (sin `blur` grande y opacidad ≤ 8 %) o detrás de texto largo.
- `text-white` en la raíz de una página de la app (rompe light).
- Animar el fondo (grid o mesh) en loop.
