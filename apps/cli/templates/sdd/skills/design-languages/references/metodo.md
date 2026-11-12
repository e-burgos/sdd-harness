# Método: derivar un lenguaje visual para cualquier proyecto

Para un proyecto sin lenguaje definido o cuando ninguno del catálogo encaja. El resultado es un
**contrato** escrito en el CSS de entrada y resumido en `constitution.md` del subproyecto (vía el
fragmento de contexto del ciclo), no una pantalla linda aislada.

## 1. Brief (cinco respuestas antes de tocar CSS)

1. **Quién lo usa y cuánto tiempo**: operación diaria de 8 h pide calma y densidad; una landing
   pide impacto en 5 s.
2. **Densidad de datos**: tablas y KPIs → escala tipográfica chica, mono tabular, superficies
   sobrias. Contenido editorial → aire, tipografía display grande.
3. **Modo por defecto**: dónde se usa (oficina con luz → light; terminal, dashboards nocturnos,
   público técnico → dark). El otro modo igual se diseña completo.
4. **Tres adjetivos de marca** (p. ej. «preciso, sobrio, rápido» o «cálido, claro, cercano»). Cada
   decisión de abajo tiene que poder justificarse con uno.
5. **Referencias y anti-referencias**: dos productos que se parezcan a lo que se busca y uno que
   no. Si el pedido nombra uno del catálogo, usalo.

## 2. Contrato de tokens

| Grupo | Decidir | Regla |
| --- | --- | --- |
| Marca | 1 color de acción (+ par dark) y, si hace falta, 1 secundario | la acción siempre es la marca; contraste AA del texto sobre ella |
| Neutros | **una** familia (zinc, slate, neutral, stone o propia) | nunca mezclar familias; pasos intermedios con `color-mix` |
| Semánticos | success, warning, error, info y tonos de estado | con tinta oscura propia para texto sobre fondo suave |
| Superficies | página, superficie, elevada, overlay (y materiales si hay vidrio) | cada nivel distinguible en los dos modos |
| Bordes | línea suave, normal, fuerte | alfa sobre la tinta, no grises sueltos |
| Radios | control, card, panel (+ pill) | 3 pasos; coherentes con la personalidad (8/12/16 sobrio, 10/16/20 amable) |
| Sombras | card, panel, float | tinte del fondo (azulado, cálido), no negro puro en light |
| Tipografía | sans (UI), mono (datos), display opcional | 5–7 pasos; tracking negativo en títulos grandes |
| Motion | 1 easing firma, 3 duraciones (150 / 300 / 500 ms), distancias | ver `crafted-motion` |

Implementación: marca en `customPaletteColor` (o preset registrado), tokens `--tucu-*` en `:root`
y `.dark`, utilidades propias con `@utility` solo para lo que tucu-ui no cubre.

## 3. Jerarquía de superficies

Definí qué distingue cada nivel (página → sección → card → overlay) y con qué recurso: borde,
tono de superficie, sombra, blur. Un recurso por nivel; si dos niveles se distinguen con lo mismo,
se confunden.

## 4. Escena

Qué hay detrás de la interfaz: color liso, grid de puntos, mesh tenue, aurora con orbes,
fotografía. La escena da profundidad y es estática; si la escena compite con el contenido, bajala.

## 5. Componentes firma (3 a 5)

Las piezas que hacen reconocible el producto: el KPI, la card de lista, el header de página, el
CTA primario, el badge de estado, el login. Escribí su receta exacta (componente de tucu-ui +
clases + tokens) y usalas siempre igual.

## 6. Motion

Una entrada por sección o pantalla, micro-feedback en acciones (press, hover), transiciones de
paso. Nada en loop en la escena. Todo desactivable con `prefers-reduced-motion`.

## 7. Accesibilidad

AA en todo texto (medí también sobre vidrio, gradientes y fondos de estado), foco visible con
anillo propio, teclado completo, objetivos táctiles ≥ 44 px en mobile, `prefers-reduced-motion`,
`prefers-reduced-transparency` y `prefers-contrast` si hay translucidez.

## Verificación (antes de cerrar cualquier task de diseño)

- [ ] Desktop (≥ 1280 px) y mobile 375 px sin scroll horizontal.
- [ ] Light y dark completos, sin textos invisibles ni superficies que se funden.
- [ ] Reduced motion: todo en su estado final, nada se queda en `opacity: 0`.
- [ ] Contraste AA medido en los peores casos (texto chico sobre la superficie más translúcida).
- [ ] Mismo dato, mismo tono, en todas las pantallas; una sola familia de neutros.
- [ ] Ningún hex suelto en componentes: todo sale del contrato.
- [ ] Consola limpia.
- [ ] El contrato quedó escrito (CSS de entrada + fragmento de contexto del subproyecto).
