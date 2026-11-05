---
name: crafted-motion
description: Usar al diseñar o implementar motion en un frontend React/Next (landing, wizard, onboarding, pantallas de producto) — elegir la herramienta por capa (CSS, motion/framer-motion, GSAP, WebGL), tokens de motion compartidos, coreografías por sección con loops pausables, transiciones de pasos, y las reglas de SSR, performance, reduced motion y accesibilidad que no se negocian.
---

# Skill: crafted-motion

Lenguaje de motion destilado de webs reales en producción (Next 16 y Vite + Tailwind v4). La idea
es motion con intención: **una entrada fuerte por sección, loops sutiles que se pausan fuera de
vista y un primer paint que nunca depende de JavaScript**. Si el proyecto tiene su propio design
system (tucu-ui, tokens de marca) o reglas en su `constitution.md`, esas mandan; esta skill aporta
el método y las recetas.

## Cuándo leer cada reference

| Necesidad                                                                 | Archivo                          |
| ------------------------------------------------------------------------- | -------------------------------- |
| Qué herramienta usar en cada capa y por qué                               | esta página, § Capas             |
| Eases, duraciones, distancias, stagger (`motion-tokens.ts` + variables CSS) | `references/01-tokens.md`        |
| Hook `useSectionMotion`, gate de viewport, chunks lazy en Next            | `references/02-runtime.md`       |
| Recetas: entrada, titular palabra por palabra, float, señales, token viajero, count-up, typing, draw SVG, clip-path reveal, wipe, cursor, dos puertas, botón magnético, constelación, escena que se arma | `references/03-recetas.md` |
| Fondo WebGL de costura con dos climas (GLSL completo y ciclo de vida) | `references/06-shader-costura.md` |
| Wizard / pasos / onboarding: transición entre pasos, progreso, foco       | `references/04-pasos-wizard.md`  |
| Trampas reales, QA y checklist de cierre                                  | `references/05-trampas-qa.md`    |

## Capas (elegir la más liviana que logra el efecto)

| Capa | Herramienta | Para qué | Nunca |
| --- | --- | --- | --- |
| 0. Primer paint | HTML/CSS final, sin motion | LCP, contenido legible sin JS | ocultar contenido esperando hidratación |
| 1. Entradas simples y loops decorativos | CSS `@keyframes` (`fade-up`, `float`, `marquee`) | home/landing, decoración | en mobile < 640px ni con reduced motion |
| 2. Estado de UI dentro de la app | `motion` / `framer-motion` (tucu-ui ya lo trae) | `AnimatePresence` en pasos, modales, listas, `layout` | en la home pública con SSR (`initial` oculto) |
| 3. Coreografía fuerte | GSAP con `import()` dinámico al entrar en vista | timelines con solapes, loops vivos, cursor | en el bundle inicial ni en mobile |
| 4. Fondos vivos | WebGL crudo (fragment shader) en un chunk `next/dynamic` | ruido fbm, costuras, climas | sin fallback estático; dibujar fuera de vista |

Regla práctica: si ya está `framer-motion` en el bundle (tucu-ui), usalo para estado de UI; sumá
GSAP solo cuando la coreografía necesite timeline con solapes o loops encadenados.

## Reglas innegociables

1. **El HTML ya es la versión final.** Sin JS, con reduced motion o en mobile, todo se ve y se usa.
   El motion solo *parte* de un estado oculto que él mismo setea al correr.
2. **Una sola timeline de entrada fuerte por sección**; lo demás son loops sutiles, pausados con
   `IntersectionObserver` y con `document.hidden`.
3. **Solo se anima `transform`, `opacity`, `filter` y `clip-path`.** Nunca layout (`width`,
   `height`, `top`), salvo barras chicas.
4. **`prefers-reduced-motion: reduce`** → no se carga GSAP, el shader dibuja un frame fijo, CSS
   con `animation: none; opacity: 1; transform: none`, autoplays detenidos.
5. **Mobile (< 640px) sin motion pesado**: un solo árbol por viewport (gate), chunks de WebGL/GSAP
   fuera del bundle del teléfono.
6. **Contrato `data-*` entre markup y motion.** El JSX marca nodos (`data-copy`, `data-feature`,
   `data-signal`); el build los selecciona con `gsap.utils.selector(root)`, nunca por clases de
   Tailwind.
7. **Nodo animado por GSAP = nodo sin `transition` CSS ni `.fade-up`.** Animá un wrapper (en
   StrictMode queda trabado en `opacity: 0`).
8. **Nunca `autoAlpha`/`visibility` sobre links o controles**: pierden el nombre accesible. Opacity
   sobre un wrapper.
9. **Autoplay con botón de pausa** (WCAG 2.2.2); clones decorativos `aria-hidden` + `tabIndex={-1}`.
10. **Tokens, no números sueltos**: todo ease/duración/distancia sale de `motion-tokens.ts` o de sus
    variables CSS espejo.

## Estructura recomendada

```
src/lib/motion/
  motion-tokens.ts          eases, duraciones, distancias, stagger (y su espejo en CSS)
  use-section-motion.ts     in-view + GSAP lazy + gsap.context + loops pausables + gate
  use-reduced-motion.ts     matchMedia reactivo
src/components/<seccion>/
  <Seccion>.tsx             markup con data-*, ya legible sin motion
  <seccion>-motion.ts       build<Seccion>Motion(gsap, root) => MotionLoop[]
  <Seccion>.module.css      3D, máscaras, keyframes propios
src/app/global.css          @theme (color, tipografía, --ease-*, --dur-*) + keyframes + bloques mobile/reduced
```

## Flujo

1. Decidí la dirección visual antes del motion: fondo, acento, tipografía (display + mono para
   labels), bordes y radios. El motion acompaña una composición que ya funciona quieta.
2. Definí los tokens (`01-tokens.md`) y el runtime (`02-runtime.md`).
3. Por sección: markup final → `data-*` → `build<Seccion>Motion` con una receta de `03-recetas.md`.
4. Wizards y flujos de pasos: `04-pasos-wizard.md`.
5. Cerrá cada sección con el QA corto y el checklist de `05-trampas-qa.md`.

## En un ciclo SDD

- El implementador front la carga cuando la task toca motion o dirección visual; el architect
  fija la capa (tabla de arriba) y las restricciones de performance en `architect.md`.
- Lo específico de una marca (paleta, copy prohibido, idioma de los comentarios) va al
  `constitution.md` del subproyecto, no a esta skill.
- El reviewer usa el checklist de `05-trampas-qa.md` como parte del cierre.
