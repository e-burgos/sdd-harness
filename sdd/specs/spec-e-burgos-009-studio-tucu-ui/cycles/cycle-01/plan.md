# spec-e-burgos-009-studio-tucu-ui — cycle-01 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: Studio adopta `@e-burgos/tucu-ui@3.4.0` vía `@e-burgos/tucu-ui/next`: toma el tema, la paleta y la tipografía de tucu-ui y reemplaza sus primitivas (botones, campos, modales, badges, tooltips, alerts, spinners) por las de la librería, **sin cambiar la distribución de ninguna pantalla** (ConnectScreen, workspace `/w`, Mission Control, paneles y header quedan donde están).
> Fuera de alcance: reemplazar AppShell/StudioHeader por un layout de tucu-ui, rediseñar Mission Control o la topología, el skill de tucu-ui y la conexión del MCP en el kit (ciclo posterior, alimentado por este).

## Historias
- US-001 — Como usuario de Studio quiero la misma app con el lenguaje visual de tucu-ui para que se vea más pulida sin reaprender dónde está cada cosa. CA: cada pantalla conserva su grilla, paneles y orden; colores, tipografía, radios y estados hover/focus son los de tucu-ui en modo oscuro.
- US-002 — Como dev de Studio quiero que las primitivas vengan de tucu-ui para dejar de mantener botones, campos y modales hechos a mano. CA: ningún `<button>`, `<input>`, `<textarea>` ni `<select>` con estilos propios fuera de los casos listados como excepción en el plan; los modales usan `Modal` de tucu-ui.
- US-003 — Como dev quiero que el build estático (`build:local`, `output: 'export'`) y el deploy de Cloudflare sigan andando. CA: `pnpm --filter sdd-studio-web build:local` genera `out/` y el e2e existente pasa contra él.

## Tasks (detalle en tasks.json)
- TASK-001 — Base: dependencia `@e-burgos/tucu-ui@3.4.0`; `globals.css` importa `@e-burgos/tucu-ui/theme` con `@source` hacia el paquete; `app/layout.tsx` monta `NextThemeProvider` con `layout="clean"` (solo un `div` flex, sin header ni menú), `mode="dark"`, `menuItems={[]}`, `showSettings={false}` y `lang` tomado del i18n de Studio. Reconciliar el contenedor `fixed inset-0 overflow-y-auto` de `ThemeWrapper` con las reglas de `html[data-app-shell]` (el viewport no puede volver a scrollear). Valida: typecheck, vitest y e2e verdes; `build:local` genera `out/`.
- TASK-002 — Puente de tokens: los tokens de Studio (`ink-*`, `accent-*`, `amberish`, `roseish`, 404 usos) pasan a resolver a las variables del tema de tucu-ui (fondo, superficie, borde, fg, primary, warning, error) y la tipografía a la de tucu-ui (`font-mono` se mantiene para código). Así todo componente no migrado adopta la paleta sin tocar su JSX. Valida: captura antes/después de las tres pantallas, sin cambios de layout (mismas cajas, distinto color).
- TASK-003 — Botones: los 85 `<button>` de 33 archivos → `Button` de tucu-ui con variante/tamaño mapeados (primario, ghost, icono, peligro). Se conservan `aria-label`, `role` y texto accesible: el e2e los busca con `getByRole('button')`. Valida: vitest + e2e sin tocar selectores.
- TASK-004 — Campos: `<input>` (8), `<textarea>` (2), `<select>` (2) → `Input`/`Textarea`/`Select` de tucu-ui. Excepción: el composer con menú `@` (MentionMenu, `role="listbox"`/`option`) conserva su lógica de teclado y solo toma estilos. Valida: tests del composer y del menú @ sin cambios.
- TASK-005 — Modales y overlays: `GateStatusModal` y `DocumentViewerModal` → `Modal` de tucu-ui (Escape, foco atrapado, scroll interno); `ConnectionBanner` → `Alert`; badges de estado, tooltips y spinners → `Badge`/`Tooltip`/`Spinner`. Valida: specs de los modales y del banner.
- TASK-006 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, e2e contra el build exportado, revisión visual en el navegador (ConnectScreen, `/w`, Mission Control, ambos modales) y lista de fricciones encontradas con tucu-ui para el ciclo del skill del kit.

## Decisiones técnicas
- `NextThemeProvider` con `layout="clean"` → tema y navegación de tucu-ui sin chrome propio; AppShell y StudioHeader siguen siendo de Studio.
- Puente de tokens en `@theme` en lugar de reescribir 404 clases → el cambio de look es global y reversible en un archivo; las clases se migran a tokens semánticos de tucu-ui cuando cada componente se toque por otra razón.
- Solo modo oscuro en este ciclo (Studio no tiene modo claro hoy); el selector de settings de tucu-ui queda apagado.
- Dependencia por npm (`3.4.0` exacta), no `link:` al repo local → lo que se verifica es lo publicado (lección del ciclo de Next en tucu-ui).

## Riesgos
- Vitest/jsdom importando el paquete: si algún módulo de tucu-ui importa CSS, hay que tratarlo en `vitest.config.mts` (`css`/`server.deps.inline`).
- El contenedor de `ThemeWrapper` puede reintroducir el scroll del viewport que FIX/regla de constitución de Studio prohíbe; TASK-001 lo cubre antes de migrar nada.
- Fricciones de API (variantes de `Button`, `Select` controlado) se anotan para tucu-ui en vez de parchearse en Studio.
