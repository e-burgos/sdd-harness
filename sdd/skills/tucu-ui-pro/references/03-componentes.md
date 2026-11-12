# Catálogo de tucu-ui por necesidad

Nombres exactos de 3.10. Para el detalle de un componente: `get_component <Nombre>` en el MCP o
los tipos del paquete. Primero buscá acá; recién si nada encaja, componé uno propio.

## Elegir por necesidad

| Necesito | Usá | No |
| --- | --- | --- |
| Acción | `Button` (`variant` solid · ghost · outline · transparent; `size` large · medium · small · mini · tiny · xs; `shape` rounded · pill · circle · square; `color` primary · white · gray · success · info · warning · danger; `isLoading`; `tooltip`) | `<button>` con clases |
| Acción solo ícono | `IconButton` o `Button shape="circle"`/`"square"` con `aria-label` | — |
| Superficie / card | `Card` (`title`, `subtitle`, `footer`, `density` compact · default · comfortable, `bodyClassName`) | `div` con borde y sombra a mano |
| Superficie de vidrio | `GlassPanel` (`material` thin · regular · thick · sub, `radius` control · card · panel, `elevation` none · card · panel · float, `condense`, `as`) | `backdrop-blur` suelto |
| KPI | `StatCard` (`title`, `value`, `subtitle`, `icon`, `tone` brand · neutral · success · warning · danger · info, `trend {value,direction,label,positiveIsGood}`, `progress {value,max,label}`, `loading`, `onClick`/`href`) | card propia con número grande |
| Dinero | `MoneyText` (`value`, `currency`, `variant` total · subtotal · row, `tone` default · positive · negative · auto, `showSign`) | `toFixed` |
| Estado de negocio | `StateBadge` (`tone` green · orange · red · teal · purple · neutral, `dot`, `struck`, `size` sm · md) | `Badge` con colores a mano |
| Etiqueta genérica | `Badge` (`variant` solid · ghost · outline · soft · ink · line; `tone` primary · success · info · warning · danger · neutral · green · orange · red · teal · purple; `struck`) | — |
| Texto de campo | `Input` (`label`, `error`, `icon`, `suffix` = adorno **inicial**, `endAdornment`, `mask` phone · cuit · currency · number, `unmask`, `type="date"`, `autoValidate`, `size="xs"`) | `<input>` |
| Selección | `Select` (`options [{name,value,description?,group?}]`, `selectedOption`+`onChange` **o** `value`+`onSelect`, `native`, `menuWidth`, `maxMenuHeight`, `renderValue`) | `<select>` salvo `native` |
| Otros campos | `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `DatePicker`, `FileInput`, `ColorPicker`, `RangeSlider`, `InputSearcher` | — |
| Formulario | `Form` (Zod + RHF; defaults en `useFormProps={{ defaultValues }}`) + `FormField name="…"` envolviendo cada input | registrar inputs a mano |
| Elegir 1 de N (vista, período) | `SegmentedControl` (`options`, `value`, `onChange`, `size` xs · sm · md, `semantics` radio · tabs · nav) | tabs para esto |
| Filtros rápidos | `FilterPill` (`active`, `count`, `tone`) dentro de `FilterBar` (`search`, `filters`, `pills`, `toggle`, `onClear`, `collapsible`) | botones toggle propios |
| Secciones de una pantalla | `AnimatedTabs` (`tabs`, `activeTab`, `onChange`, `mobile` select · scroll, `queryParamKey`) o `TabGroup`+`TabList`/`TabItem`/`TabPanels`/`TabPanel`; `ParamTab`/`useTabParam` para `?tab=` | — (no existe `Tabs`) |
| Tabla simple | `BasicTable` (`columns [{key,label,render}]`, `data`, `striped`, `density`, `mobileCards` por defecto) | `<table>` |
| Tabla de datos | `DataTable` (TanStack: orden, filtros, paginación client/server, selección, filas expandibles, `columnSizing`, `mobileCards`) | — |
| Diálogo | `Modal` (`isOpen`, `setIsOpen`, `text.title`, `size` sm · md · lg · xl · full, `role`), `ConfirmDialog`, `SplitModal` / `SplitModalWizard` (`validateStep` async) | modal propio |
| Panel lateral | `Drawer` (`type` sidebar · sidebar-menu, `setIsOpen`, `position`) o `DrawerContainer` | — |
| Avisos | `Alert` (`variant` error · success · info · warning, `appearance` soft · ink · line, `live`), `InlineNotice`, `Toast` (ya montado por el provider) | — |
| Estados de pantalla | `EmptyState`, `ErrorState`, `SystemStatePage`, `Skeleton`, `Spinner`, `LoadingOverlay` | spinner suelto en página vacía |
| Texto | `Title`, `Subtitle`, `Text`, `Label` | — |
| Navegación pública | `MarketingLayout` (`nav`, `footer`, `transparentUntilScroll`, `blurOnScroll`), `MarketingNav`, `MarketingFooter` | nav a mano |
| Auth | `SplitAuthLayout` (`variant` split · centered, `brand`, `title` = h1, `surface` glass · solid · plain) + `SignInForm` / `SignUpForm` | — |
| Gráficos | `TucuLineChart`, `TucuBarChart`, `TucuAreaChart`, `TucuPieChart`, `TucuRadarChart`, `TucuComposedChart` | recharts directo |
| Íconos | `LucideIcons.<Nombre>` (5000+ Lucide + propios); `search_icons` en el MCP | otro paquete de íconos |
| Otros | `Avatar`, `Tooltip`, `Popover`, `Accordion`, `Collapse`, `Divider`, `Carousel`, `Lightbox`, `Image`/`SafeImage`, `Link`/`NavLink`, `ListContainer` | — |
| Escritorio macOS | `MacOSWindow`/`Dock`/`Desktop`; `TahoeWindow`/`TahoeDock`/`TahoeDesktop`/`TahoeMenuBar` | — |

## Composiciones que conviene saber de memoria

```tsx
<GlassPanel material="regular" radius="card" elevation="card" className="overflow-hidden p-0">
  <DataTable … />
</GlassPanel>

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title="Ingresos" value={<MoneyText value={48200} currency="ARS" variant="total" />}
    tone="success" trend={{ value: '12%', direction: 'up', label: 'vs mes anterior' }} />
</div>

<FilterBar search={{ value: q, onChange: setQ, placeholder: 'Buscar' }}
  pills={<><FilterPill active={s === 'all'} onClick={() => setS('all')}>Todos</FilterPill>
           <FilterPill tone="orange" count={4} active={s === 'pending'} onClick={() => setS('pending')}>Pendientes</FilterPill></>}
  onClear={reset} collapsible />
```

## Generadores del MCP

`generate_page {name, layout, sections, framework}`, `generate_form {fields, withValidation}`,
`generate_datatable`, `generate_chart`, `generate_component` aceptan `framework: "vite" | "next"`
(y `style`, `motion`, `density` en página y componente). Usalos como borrador: después aplicás el
lenguaje visual, los tokens del proyecto y la checklist de `04-trampas.md`.
