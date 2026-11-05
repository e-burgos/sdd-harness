# spec-e-burgos-016-studio-wizard-motion — cycle-01 — 2026-11-05

## Estado
El wizard de «Nuevo proyecto» tiene graphic motion. El paso Alcance es una escena de dos puertas (front cálido, back frío) sobre un shader WebGL de costura que sigue al cursor y a la elección, con mockups que se arman solos, parallax y un pill de full stack sobre la costura. Los pasos cambian con una transición dirigida (framer-motion), título palabra por palabra, opciones escalonadas y brillo/pop al elegir; el panel tiene un riel de progreso con el paso actual latiendo; la generación es un pipeline con barra por etapas, check con pop y una celebración breve al terminar bien. Con `prefers-reduced-motion`, en pantallas < 1024 px o sin WebGL, todo se ve y se usa igual, sin animación.

## Estructura
- `src/lib/motion/`: `motion-tokens.ts` (eases, duraciones, distancias, stagger, `MOTION_MIN_WIDTH`), `use-motion-allowed.ts`, `use-section-motion.ts` (GSAP con `import()` al entrar en vista, build en `useLayoutEffect` dentro de `gsap.context`, loops pausables, `dispose`, estado `off|loading|running|failed`) y `seam-shader.ts`.
- `src/components/modules/new-project/motion/` (`StepStage`, `WordTitle`, `use-step-focus`) y `steps/scope/` (`ScopeDoors`, `DoorMocks`, `SeamCanvas`, `scope-doors-motion.ts`).
- Keyframes `wizard-*` y la regla `[data-intro='pending']` en `globals.css`, dentro de `(min-width: 1024px) and (prefers-reduced-motion: no-preference)`. Token tipográfico nuevo `text-display` (1.625rem) solo para el título de las puertas.
- `wizard-context` expone `positioned`: el centro no pinta hasta ubicarse en el paso restaurado. Cambiar de paso vuelve el scroll arriba, mueve el foco al título y anuncia «Paso N de M» con `aria-live`.

## Dependencias
- `gsap` 3.15.1 y `framer-motion` 12.43.0 (la misma que resuelve tucu-ui).

## Qué sigue
- Llevar el mismo lenguaje a la pantalla de conexión (onboarding wizard-first) y a la escena de bienvenida del launcher.
- El escenario de las puertas es oscuro también en tema claro (decisión de diseño, como los heros de referencia).
