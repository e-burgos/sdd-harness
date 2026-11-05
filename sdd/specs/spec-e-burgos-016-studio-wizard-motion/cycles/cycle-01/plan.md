# spec-e-burgos-016-studio-wizard-motion — cycle-01 · plan (lite)

> Módulo: studio-wizard-motion | Subproyectos: apps/studio, apps/cli (kit) | Fecha: 2026-11-05
> Objetivo: llevar el graphic motion de la landing de Display Ads al wizard de Studio y destilarlo
> en el skill `crafted-motion` del kit.
> Rama `feat/studio-wizard-motion`, solo commits (el PR #64 del release queda aparte).

## Historias
- US-1 — Skill `crafted-motion`. CA: `SKILL.md` + 5 references (tokens, runtime, recetas, pasos de
  wizard, trampas y QA) en `apps/cli/templates/sdd/skills/` y en el `sdd/` del repo; el
  implementador front lo nombra; catálogo regenerado; `sdd:validate` verde.
- US-2 — Escena de puertas en Alcance. CA: dos puertas (front y back) sobre un shader de costura
  cálido/frío; hover/foco corre la costura, la selección la fija (full stack = centro, ambos lados
  encendidos); parallax por cursor; solo ≥1024px y sin reduced motion; fallback estático con
  gradientes; las opciones siguen siendo radios accesibles.
- US-3 — Transición de pasos. CA: título palabra por palabra, opciones con stagger, selección con
  brillo y pop del check, dirección según avance/retroceso, foco al título y anuncio "Paso N de M".
- US-4 — Riel de progreso en el panel. CA: relleno `scaleY` hasta el paso actual, token con glow en
  el paso actual, checks con pop al completar.
- US-5 — Generación viva. CA: la etapa en curso late, barra de progreso por etapas, check con pop
  al terminar cada una, celebración breve al terminar bien; el log no se anima.

## Tasks
- TASK-001 — US-1 skill `crafted-motion` en el kit y en el repo, nombrado por el implementador front.
- TASK-002 — Runtime de motion en Studio: deps `gsap` y `framer-motion`, `lib/motion` (tokens,
  `useMotionAllowed`, `useSectionMotion`), keyframes y bloque reduced motion en el CSS global.
- TASK-003 — US-3 transición entre pasos, título animado, opciones y selección.
- TASK-004 — US-2 escena de puertas con shader en el paso Alcance.
- TASK-005 — US-4 riel de progreso en el panel.
- TASK-006 — US-5 generación viva.
- TASK-007 — Verificación y cierre: tests (reduced motion, accesibilidad), e2e del wizard, QA
  visual en el navegador (1440 dark/light y 390), `pnpm build && pnpm typecheck && pnpm test`.

## Decisiones técnicas
- Capas (skill § Capas): estado de UI con `framer-motion` 12.43.0 (la misma que trae tucu-ui, sin
  duplicar); coreografías con `gsap` 3.15.1 (última estable, consultada en npm 2026-11-05) con
  `import()` dinámico; fondo con WebGL crudo, sin three.
- Studio corre del lado cliente detrás del token del puente: no hay riesgo de LCP por SSR, pero se
  respeta igual la regla "HTML final primero" para reduced motion y pantallas angostas.
- El shader se adapta del `path-scene.ts` de la landing: mismos uniforms (`r`, `t`, `s`, `m`, `h`),
  resolución al 60 % con DPR ≤ 1.5 y frame fijo con reduced motion.
- Flow lite por perfil `solo`: no hay contratos que consuma otro subproyecto.
