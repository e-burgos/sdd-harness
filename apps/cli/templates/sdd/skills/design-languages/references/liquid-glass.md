# Cristal Líquido — el Liquid Glass de ópticagestión

Vibrancy estilo Apple, **no refracción física**: no hay filtros SVG de desplazamiento, ni brillo
especular, ni textura de ruido. El efecto sale de cinco capas: tinte translúcido + `backdrop-filter:
blur() saturate()` + borde de luz de **0,5 px** + sombra **teñida de azul** (nunca negra en light)
sobre una **escena aurora** con dos orbes difuminados. Light por defecto, dark de primera clase.
Principio rector: **el vidrio es jerarquía, no decoración**.

## 1. Materiales (jerarquía)

| Material | Fondo light | Fondo dark | Blur / saturate | Borde | Para |
| --- | --- | --- | --- | --- | --- |
| `thin` | `rgba(255,255,255,.5)` | `rgba(60,60,67,.5)` | 16px / — | `rgba(255,255,255,.75)` · dark `.12` | chips, pills, segmented, controles |
| `regular` | `rgba(255,255,255,.58)` | `rgba(44,44,52,.55)` | 26px / 1.6 | ídem | cards, tablas, paneles de ajustes |
| `thick` | `rgba(255,255,255,.7)` | `rgba(44,44,50,.6)` | 34px / 1.7 | `rgba(255,255,255,.85)` · dark `.16` | toolbars, modales, toasts, dropdowns, drawers |
| `sub` | `rgba(255,255,255,.6)` | `rgba(0,0,0,.3)` | **sin blur** | línea `rgba(0,0,0,.12)` · dark `rgba(255,255,255,.15)` | inputs y celdas **dentro** de vidrio |

Reglas: saturate solo en superficies grandes; **máximo dos capas de blur superpuestas**; nunca
vidrio en filas, listas que scrollean ni celdas (la fila es transparente, el panel tiene el blur).

## 2. Montaje sobre tucu-ui 3.10

```css
@import 'tailwindcss' important;
@import '@e-burgos/tucu-ui/theme';
@source '<ruta>/node_modules/@e-burgos/tucu-ui/**/*.mjs';

:root {
  --tucu-glass-thin-bg: rgba(255, 255, 255, 0.5);
  --tucu-glass-regular-bg: rgba(255, 255, 255, 0.58);
  --tucu-glass-thick-bg: rgba(255, 255, 255, 0.7);
  --tucu-glass-sub-bg: rgba(255, 255, 255, 0.6);
  --tucu-glass-border: rgba(255, 255, 255, 0.75);
  --tucu-glass-blur-thin: 16px;
  --tucu-glass-blur-regular: 26px;
  --tucu-glass-blur-thick: 34px;
  --tucu-radius-control: 10px;
  --tucu-radius-card: 16px;
  --tucu-radius-panel: 20px;
  --tucu-shadow-card: 0 6px 24px rgba(31, 38, 74, 0.1);
  --tucu-shadow-panel: 0 10px 32px rgba(31, 38, 74, 0.13);
  --tucu-shadow-float: 0 12px 40px rgba(31, 38, 74, 0.15);
  --cl-glass-saturate: 1.6;
  --cl-canvas: #e8eaf0;
  --cl-ambient: linear-gradient(150deg, #c7d4ee 0%, #e2d5ea 45%, #f2ded3 100%);
  --cl-orb-a: rgba(100, 150, 255, 0.3);
  --cl-orb-b: rgba(255, 160, 120, 0.24);
  --cl-action: #0a6cff;
  --cl-action-ring: rgba(10, 108, 255, 0.3);
}
.dark {
  --tucu-glass-thin-bg: rgba(60, 60, 67, 0.5);
  --tucu-glass-regular-bg: rgba(44, 44, 52, 0.55);
  --tucu-glass-thick-bg: rgba(44, 44, 50, 0.6);
  --tucu-glass-sub-bg: rgba(0, 0, 0, 0.3);
  --tucu-glass-border: rgba(255, 255, 255, 0.12);
  --tucu-shadow-card: 0 6px 24px rgba(0, 0, 0, 0.3);
  --tucu-shadow-panel: 0 10px 32px rgba(0, 0, 0, 0.35);
  --tucu-shadow-float: 0 12px 40px rgba(0, 0, 0, 0.4);
  --cl-canvas: #101322;
  --cl-ambient: linear-gradient(160deg, #101322 0%, #1d1730 60%, #231b26 100%);
  --cl-orb-a: rgba(90, 120, 255, 0.25);
  --cl-orb-b: rgba(255, 150, 120, 0.12);
  --cl-action: #409cff;
}

[data-tucu='glass-panel'] {
  border-width: 0.5px;
  contain: paint;
  backdrop-filter: blur(var(--tucu-glass-blur)) saturate(var(--cl-glass-saturate));
  -webkit-backdrop-filter: blur(var(--tucu-glass-blur)) saturate(var(--cl-glass-saturate));
}
[data-tucu='glass-panel'][data-material='thin'] { --cl-glass-saturate: 1; }
[data-tucu='glass-panel'][data-material='thick'] { --cl-glass-saturate: 1.7; }

@utility glass-thin { background: var(--tucu-glass-thin-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 0.5px solid var(--tucu-glass-border); }
@utility glass { background: var(--tucu-glass-regular-bg); backdrop-filter: blur(26px) saturate(1.6); -webkit-backdrop-filter: blur(26px) saturate(1.6); border: 0.5px solid var(--tucu-glass-border); }
@utility glass-thick { background: var(--tucu-glass-thick-bg); backdrop-filter: blur(34px) saturate(1.7); -webkit-backdrop-filter: blur(34px) saturate(1.7); border: 0.5px solid var(--tucu-glass-border); }
@utility glass-sub { background: var(--tucu-glass-sub-bg); border: 0.5px solid rgba(0, 0, 0, 0.12); }
@utility focus-cl { &:focus-visible { outline: 3px solid var(--cl-action-ring); outline-offset: 0; border-color: var(--cl-action); } }

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --tucu-glass-thin-bg: rgba(255,255,255,.92); --tucu-glass-regular-bg: rgba(255,255,255,.94); --tucu-glass-thick-bg: rgba(255,255,255,.97); }
  .dark { --tucu-glass-thin-bg: rgba(50,50,58,.94); --tucu-glass-regular-bg: rgba(44,44,52,.96); --tucu-glass-thick-bg: rgba(40,40,48,.97); }
}
html[data-material='solid'] [data-tucu='glass-panel'],
html[data-material='solid'] .glass, html[data-material='solid'] .glass-thin, html[data-material='solid'] .glass-thick {
  backdrop-filter: none; -webkit-backdrop-filter: none;
}
@media (prefers-reduced-transparency: reduce) {
  [data-tucu='glass-panel'], .glass, .glass-thin, .glass-thick { backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  [data-tucu='glass-panel'], .glass, .glass-thin, .glass-thick { border: 1px solid currentColor; }
}
```

Las reglas sin layer van **después** del tema: así le ganan al `GlassPanel` de tucu-ui, que en
3.10 aplica solo blur, borde de 1 px y sin fallback. `html[data-material="solid"]` es el modo
opaco para equipos lentos (además de los fondos casi opacos, poné los mismos valores del
`@supports` bajo ese selector). `backdrop-filter` siempre con su `-webkit-`.

Provider:

```tsx
<ThemeProvider architecturalPatterns="standalone" themeStyle="macos-tahoe" layout="macos-tahoe"
  customPaletteColor={{ primary: '#0a6cff', darkPrimary: '#409cff' }} menuItems={menuItems} showSettings={false} />
```

Pantallas sin chrome (auth, landing, estados de sistema): `layout="macos-tahoe-clean"`.

## 3. Escena (sin escena, el vidrio se ve gris y plano)

```tsx
<div className="relative isolate min-h-dvh overflow-hidden">
  <div aria-hidden className="fixed inset-0 z-0" style={{ background: 'var(--cl-ambient), var(--cl-canvas)' }}>
    <span className="absolute -top-20 left-[35%] size-[300px] rounded-full blur-[90px]" style={{ background: 'var(--cl-orb-a)' }} />
    <span className="absolute -bottom-24 right-[5%] size-[280px] rounded-full blur-[90px]" style={{ background: 'var(--cl-orb-b)' }} />
  </div>
  <main className="relative z-10">…</main>
</div>
```

- La escena es **estática**: nada de orbes en movimiento perpetuo.
- Multi-tenant: solo el ambiente se tiñe con el acento del cliente —
  `linear-gradient(150deg, color-mix(in srgb, ACC 18%, transparent) 0%, color-mix(in srgb, ACC 5%, transparent) 60%, transparent 100%), var(--cl-ambient)`.
  El vidrio y los componentes no cambian por cliente.
- Herramientas internas (backoffice): versión opaca — fondos `#fff`, borde `rgba(0,0,0,.1)`, sin
  ambiente ni blur, radios 8/12/16.

## 4. Tipografía y color

- **Inter** para la UI, **JetBrains Mono** para todo número, ID, fecha, dinero y encabezado de
  tabla (`font-mono tabular-nums`). Con `macos-tahoe`, la escala se ajusta por variables en
  `html:root.macos-tahoe`: `--macos-font-family: 'Inter', -apple-system, …`; large title 30 px/700
  (tracking −0,9 px), title1 22/700, title2 19/600, title3 15/600, body 13,5, callout 12,5,
  subheadline 12, footnote 11,5, caption 11 / 10,5 (600, +0,8 px). Base `font-size: 13.5px;
  line-height: 1.5`.
- Label de sección: mono 10,5 px / 600 / `tracking-[.08em]` / mayúsculas / tinta sutil.
- Tinta light `#1d1d1f` · `#48484a` · `#6e6e73` · `#aeaeb2`; dark `#f5f5f7` y `rgba(235,235,245,.72/.62/.52)`.
- Acción `#0a6cff` (hover `#0353c9`, glow `0 2px 12px rgba(10,108,255,.35)`); dark `#409cff`.
- Estados con **tinta oscura propia** para AA sobre vidrio (soft = base al 16 %, line = 35 %):
  green `#28a745`/tinta `#0b6623`, orange `#e8890c`/`#8a5200`, red `#e5372e`/`#c42b22`,
  teal `#00a8b5`/`#00646e`, purple `#8250df`/`#5a2fb0` → en tucu-ui, `--tucu-state-<tone>-{soft,ink,line}`
  y `StateBadge`. Cancelado/vencido: `neutral` + `struck`.
- Radios: control 10, card 16, panel 20; pills y badges `rounded-full`; segmented 12 afuera / 9 adentro.

## 5. Componentes firma

| Pieza | Receta |
| --- | --- |
| Card / tabla | `<GlassPanel material="regular" radius="card" elevation="card" className="overflow-hidden p-0">` con `DataTable`/`BasicTable` adentro |
| Tabla re-tematizada | `--color-table-box-bg`, `--color-table-default-bg`, `--color-table-row-bg: transparent`; `--color-table-header-bg` = superficie; `--color-table-row-pinned` y `--color-table-header-pinned` = `--tucu-glass-regular-bg`; hover = tinte de acción al 10 %; divider = línea suave. Confirmá los nombres con `tucu://tokens` (familia `--tucu-table-*`) |
| Modal | `glass-thick shadow-[var(--tucu-shadow-float)] overflow-hidden` + backdrop `bg-black/40 backdrop-blur-sm` |
| Toast | `glass-thick fixed right-4 top-4 z-[200] w-[min(380px,calc(100vw-2rem))] rounded-[16px] p-4 text-[13px]` |
| Bottom sheet | `glass-thick rounded-t-[20px] h-[85dvh]` |
| Dropdown | `glass-thick rounded-[10px] shadow-[var(--tucu-shadow-float)]` |
| Segmented | `SegmentedControl` sobre `glass-thin` (`rounded-[12px] p-[3px]`); activo `bg-[var(--cl-action)] text-white shadow-[0_2px_12px_rgba(10,108,255,.35)]` |
| Filtro rápido | `FilterPill`: inactivo `glass-thin`, activo tinta invertida (`bg-[#1d1d1f] text-white`) |
| Input dentro de vidrio | `glass-sub focus-cl rounded-[10px]` |
| Badge | `StateBadge tone dot` (`rounded-full border-[0.5px] px-2.5 py-1 text-[10.5px] font-semibold`) |

## 6. Motion

- Entrada de paneles **condense**: `from { opacity: 0; transform: translateY(10px) scale(.985) }`,
  320 ms `cubic-bezier(0.2, 0.8, 0.25, 1)` (`GlassPanel condense`).
- Skeleton: pulso de opacidad .45 → .8 en 1,6 s; **nunca** un barrido de brillo.
- Hover: CTAs y cards de producto `scale-[1.02–1.03]` 180–220 ms; botones de ícono
  `hover:scale-105 active:scale-95`; pills `transition-colors duration-150`; fila de tabla cambia
  solo el fondo.
- Todo apagado con `prefers-reduced-motion`.

## 7. No hacer

- Vidrio sin escena detrás, o sobre fondo blanco liso.
- Más de dos capas de blur apiladas; blur en filas, celdas o listas largas.
- Sombras negras en light; bordes de 1 px gruesos (es 0,5 px).
- Texto de estado en el color base sobre vidrio (usa la tinta oscura, si no falla AA).
- Barridos de brillo, orbes animados, refracción falsa con SVG "porque queda bien".
- Teñir el vidrio o los componentes por cliente (solo el ambiente).
