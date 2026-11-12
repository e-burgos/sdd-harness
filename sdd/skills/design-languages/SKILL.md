---
name: design-languages
description: Usar al diseñar o rediseñar la UI de un frontend (app, dashboard, landing, auth, storefront) o cuando el pedido nombra un look ("como Display Ads", "liquid glass", "cristal líquido", "oscuro tipo consola", "estilo Apple") — elegir o derivar un lenguaje visual completo (tokens, tipografía, superficies, escena, componentes firma, motion, accesibilidad), aplicarlo con tucu-ui y verificarlo. Trae dos lenguajes probados en producción listos para replicar.
---

# Skill: design-languages

Un **lenguaje visual** es el conjunto cerrado de decisiones que hace que todas las pantallas de un
producto se vean del mismo autor: paleta y tokens, tipografía, superficies y elevación, escena de
fondo, componentes firma, motion y reglas de accesibilidad. Esta skill te da un método para
elegirlo o derivarlo en **cualquier** proyecto y dos lenguajes probados en producción para
replicarlos tal cual. La implementación con tucu-ui está en `tucu-ui-pro`; el motion en detalle en
`crafted-motion`. Si el subproyecto ya define su lenguaje en `constitution.md`, ese manda: esta
skill sirve para respetarlo y extenderlo sin romperlo.

## Flujo

1. **¿El proyecto ya tiene lenguaje?** Leé `constitution.md` del subproyecto, su CSS de entrada
   (`@theme`, `:root`, `.dark`) y 2–3 pantallas existentes. Si lo tiene, extraé su contrato (paso 3)
   y seguilo. No mezcles lenguajes en un producto.
2. **¿El pedido nombra uno de los del catálogo?** Abrí su reference y replicalo completo — tokens,
   escena, componentes firma y motion juntos; replicar solo los colores no replica el lenguaje.
3. **Si no hay ninguno**, derivalo con `references/metodo.md`: brief → contrato de tokens →
   jerarquía de superficies → escena → componentes firma → motion → accesibilidad. Escribí el
   contrato en el CSS de entrada y en `constitution.md` del subproyecto (vía el fragmento de
   contexto del ciclo) para que el próximo agente lo herede.
4. **Implementá con tucu-ui** (`tucu-ui-pro`): marca en `customPaletteColor`/preset, tokens
   `--tucu-*` sobreescritos, primitivos de la librería antes que CSS propio.
5. **Verificá** con la checklist de `metodo.md` § Verificación (desktop y 375 px, light y dark,
   reduced-motion, contraste AA, consola limpia).

## Catálogo

| Lenguaje | Carácter | Base tucu-ui | Para | Reference |
| --- | --- | --- | --- | --- |
| **Sky Console** (origen: Display Ads) | consola oscura de precisión: zinc profundo, marca sky + teal, grid de puntos y mesh tenue, labels mono en mayúsculas, glows contenidos | `themeStyle="default"`, `layout="admin"`, `customPaletteColor` sky/teal | SaaS B2B, dashboards de datos, consolas, landings técnicas | `references/sky-console.md` |
| **Cristal Líquido** (origen: ópticagestión) | vibrancy estilo Apple: vidrio translúcido con blur + saturate, borde de luz de 0,5 px, sombras teñidas, escena aurora con orbes | `themeStyle="macos-tahoe"`, `GlassPanel`, tokens `--tucu-glass-*` | apps operativas cálidas, comercios, storefronts, productos de consumo | `references/liquid-glass.md` |
| Derivado | el que pida el brief | según el brief | cualquier otro proyecto | `references/metodo.md` |

Elegir entre los dos cuando el pedido no lo dice: datos densos, público técnico y modo oscuro por
defecto → Sky Console. Operación diaria de un comercio, público no técnico, claridad y calidez,
light por defecto → Cristal Líquido. Si ninguno encaja con la marca o el público, derivá uno.

## Reglas que valen para cualquier lenguaje

- **La marca es una sola** y vive en un token; el color de acción es la marca. Los tonos
  semánticos (éxito, alerta, error, info) no se usan como decoración.
- **Jerarquía antes que decoración**: cada efecto (blur, glow, gradiente, sombra) indica un nivel
  de la interfaz. Si no indica nada, sacalo.
- **Dos modos de primera clase**: cada token tiene su par light/dark diseñado, no invertido.
- **Una escala tipográfica corta** (5–7 pasos) con tracking negativo en títulos grandes y mono
  tabular para números, IDs y fechas.
- **Escena quieta, interfaz viva**: el fondo no se anima en loop; el motion acompaña acciones y
  entradas (ver `crafted-motion`).
- **Accesibilidad no negociable**: AA en todo texto (también sobre vidrio y gradientes), foco
  visible, teclado, `prefers-reduced-motion`, `prefers-reduced-transparency` cuando hay vidrio.
