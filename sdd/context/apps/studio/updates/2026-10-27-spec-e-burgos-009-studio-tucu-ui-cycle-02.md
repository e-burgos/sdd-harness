# spec-e-burgos-009 cycle-02 — 2026-10-27

## Estado
Studio tiene modo claro y oscuro con selector en el header (persistido en el store de tucu-ui; la primera visita sigue `prefers-color-scheme`) y todas las vistas son legibles en los dos modos. Usa una escala tipográfica única y los selectores, tooltips, badges, skeletons, tarjetas y tablas de tucu-ui. Los textos de interfaz pasan por el i18n es/en.

## Estructura
- `app/layout.tsx`: `NextThemeProvider` sin `mode`; script inline en `<head>` que pone `dark`/`light` en `<html>` antes de hidratar; `components/ColorModeBootstrap.tsx` aplica el modo de la primera visita después del montaje de tucu-ui.
- `StudioHeader`: botón Sol/Luna (`data-testid="mode-toggle"`) e idioma; el sidebar ya no tiene selector de idioma.
- `app/globals.css`:
  - Escala `text-micro` 10 · `text-meta` 11 · `text-ui` 12 · `text-small` 13 · `text-body` 14 · `text-title` 16. No se usan tamaños arbitrarios `text-[Npx]`.
  - Los `Button` de tucu-ui siguen la escala por `[data-tucu='button'][data-size]`.
  - Tokens mode-aware `sky`, `purple`, `amber`, `rose` y `yellow`, más `ink-400` e `ink-50`. `ink-500` es `--color-muted`, y `accent-300` y `emerald-200/300` se mezclan con `--color-foreground`.
  - Reglas `[data-tucu='table-element']` y tamaño compacto de `Select`.
  - No se usan `text-white`, `bg-white` ni `border-white`: se usan tokens.
- Envoltorios únicos sobre tucu-ui:
  - `HelpSelect` es `Select` con un `label` y un `helperText` ocultos, que dan el nombre y la descripción accesibles. Lo acompaña un `Tip` de ayuda.
  - `Tip` es `Tooltip` con `text-meta` en un span interno.
  - `StatusPill` es `Badge` soft con tonos sobre tokens.
  - `SegmentedControl` es propio, con semántica tabs, radio o nav.
  - `no-native-select.spec.ts` exige cero `<select>`.
- tailwind-merge de tucu-ui toma los tokens de fuente custom (`text-meta`, `text-ui`) como color: el tamaño va en un span envolvente, nunca junto a una clase de color en el mismo `className` de un componente de tucu-ui.
- `lib/test-utils/pick-option.ts` maneja el combobox de tucu-ui en los specs; `vitest.setup.ts` agrega un stub de `scrollIntoView`.
- `Sidebar`: `nav` con `overflow-hidden`, el header con `max-h-[55%] overflow-y-auto`, y el árbol scrollea entre el header y el pie.
- `next.config.ts`: `devIndicators: { position: 'bottom-right' }`.
- Excepciones nativas: los colapsables (NavTree, RelatedDocuments, Timeline, ApprovalCard), el gate chip del header, los `title` de texto truncado y los dos modales.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
- Cuando tucu-ui publique la versión de su spec-002 (Button sin wrapper con escala propia, Modal accesible, Select con id/aria/data, Tooltip/Badge/Skeleton/Table con tokens, `defaultMode`), abrir un ciclo corto para borrar los overrides de `globals.css`, `ColorModeBootstrap` y los wrappers que sobren, y migrar `GateStatusModal` y `DocumentViewerModal` a `Modal`.
- Tres colores de identidad de agentes (`#e2e8f0`, `#a1a1aa`, `#94a3b8`) quedan pálidos como texto en modo claro.
