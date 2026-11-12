# SPEC-e-burgos-020: El agente de frontend del kit diseña con tucu-ui como un profesional

> Estado: **in-progress** (2026-11-12). cycle-01 abierto (flow lite). Sigue a spec-e-burgos-011/012
> (integración tucu-ui del kit y generadores con tucu-ui).

## Resumen ejecutivo
El kit trae la integración de tucu-ui (skill `tucu-ui-design` + MCP, opt-in) pero el agente de
frontend no la menciona: no sabe montar tucu-ui (Vite vs Next, Tailwind v4, providers), no conoce
los props que rompen en runtime y no tiene recetas de diseño. El dev quiere que el agente pueda
replicar exactamente los dos lenguajes visuales probados en producción —el de **Display Ads**
(consola oscura sky/teal, mesh y grid de puntos) y el **Cristal Líquido** de **ópticagestión**
(vibrancy de vidrio sobre una escena aurora)— y, sobre todo, que pueda encarar el diseño de
cualquier proyecto usando tucu-ui con criterio profesional.

## Historias de usuario
- US-1 — tucu-ui sin tropiezos. Como agente de frontend, sé instalar y montar tucu-ui en una SPA
  Vite, en Next 16 y en una app con Tailwind propio; elijo `ThemeProvider` / layout / preset y
  conozco los props válidos y las trampas que rompen en runtime, con o sin el MCP conectado.
- US-2 — Replicar Display Ads. Como agente, con una receta de tokens, tipografía, superficies,
  componentes característicos y motion, reproduzco el lenguaje de Display Ads en otro proyecto.
- US-3 — Replicar Cristal Líquido. Como agente, con la receta de materiales (thin/regular/thick/sub),
  escena ambiente, fallbacks y reglas de jerarquía, reproduzco el Liquid Glass sobre tucu-ui.
- US-4 — Cualquier proyecto. Como agente, ante un proyecto sin lenguaje definido sigo un método
  para elegir o derivar uno (contrato de tokens, jerarquía, escena, motion, a11y) y verificarlo.
- US-5 — El agente las usa. El agente y la skill de implementador front del kit cargan estas
  skills cuando el subproyecto usa tucu-ui o cuando la task es de diseño.

## Decisiones (dev, 2026-11-12)
- Las skills viven en el kit (`apps/cli/templates/sdd/skills/`), disponibles aunque la integración
  tucu-ui esté apagada; complementan a `tucu-ui-design` (MCP) y a `crafted-motion` (motion).
- Fuente de verdad del contenido: el código real de display-ads y opticagestion y tucu-ui 3.10.0.

## Restricciones
- Solo `apps/cli/templates/sdd/` (+ espejo `sdd/`) y docs del kit. Sin cambios de código de la CLI.
- Nada de props inventados: todo prop citado se verificó contra tucu-ui 3.10.0.

## Ciclos propuestos
- cycle-01 — Skills `tucu-ui-pro` y `design-languages` + cableado en el agente front (US-1..US-5).
