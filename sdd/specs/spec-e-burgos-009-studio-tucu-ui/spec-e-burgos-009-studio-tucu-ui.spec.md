# SPEC-e-burgos-009: Studio adopta tucu-ui (tema y primitivas)

> Estado: **completed** — `cycle-01` cerrado el 2026-10-27 (flow `lite`). CA-003 no se cumplió: los modales siguen custom (ver reviewer_report).

## Resumen Ejecutivo

Studio tiene unas 12.700 líneas de UI propia en Tailwind: botones, campos, modales y paleta hechos a mano. Esta spec lo pasa a `@e-burgos/tucu-ui@3.4.0` mediante el entry `@e-burgos/tucu-ui/next`: toma el tema, la paleta y la tipografía de la librería y reemplaza las primitivas, sin mover ninguna pantalla de lugar.

## Contexto de Negocio

tucu-ui es la librería de UI que el kit va a ofrecer en los proyectos que genera, y el agente de front tiene que conocerla. Studio es el primer consumidor real en Next: lo que se aprenda acá alimenta el skill de tucu-ui y la conexión de su MCP en el kit.

## Evidencia y decisiones

- Evidencia: análisis del código (2026-10-27) → Studio en Next 16.4.3; 85 `<button>` en 33 archivos, 8 `<input>`, 2 `<textarea>`, 2 `<select>`, 2 modales, 404 usos de los tokens `ink-*`/`accent-*`/`amberish`/`roseish`.
- Evidencia: `npm view @e-burgos/tucu-ui@3.4.0` (2026-10-27) → publicada con el entry `./next`.
- Evidencia: el layout `clean` de tucu-ui es un `div` flex sin header ni menú.
- Decisión del dev (2026-10-27): alcance base + primitivas; adoptar el look de tucu-ui conservando la distribución actual; Studio antes que el skill del kit; flow `lite`.

## Requisitos Funcionales (RF)

- RF-1: `app/layout.tsx` monta `NextThemeProvider` en layout `clean`, modo oscuro, sin settings ni menú.
- RF-2: La paleta y la tipografía de Studio salen del tema de tucu-ui.
- RF-3: Botones, campos, modales, alertas, badges, tooltips y spinners son componentes de tucu-ui.
- RF-4: Ninguna pantalla cambia su distribución; el viewport no scrollea.
- RF-5: El build estático (`build:local`) y el deploy siguen funcionando.

## Requisitos No Funcionales (RNF)

- RNF-1: La dependencia es la versión publicada en npm, exacta.
- RNF-2: Los selectores accesibles que usan los e2e no cambian.

## Criterios de Aceptación (CA)

- CA-001: Las tres pantallas (ConnectScreen, `/w`, Mission Control) conservan grilla, paneles y orden; los colores, la tipografía y los estados son los de tucu-ui.
- CA-002: No quedan `<button>`, `<input>`, `<textarea>` ni `<select>` con estilos propios fuera de las excepciones del plan.
- CA-003: `GateStatusModal` y `DocumentViewerModal` usan `Modal` de tucu-ui y cierran con Escape.
- CA-004: `pnpm build && pnpm typecheck && pnpm test` verdes y el e2e de Studio pasa sin cambiar selectores.
- CA-005: `build:local` genera `out/` y el viewport no scrollea.

## Fuera de alcance

Reemplazar AppShell/StudioHeader por un layout de tucu-ui, rediseñar Mission Control o la topología, modo claro, y el skill de tucu-ui con su MCP en el kit.
