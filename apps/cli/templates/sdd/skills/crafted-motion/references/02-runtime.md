# Runtime: hook de sección, gate de viewport y chunks lazy

## `useSectionMotion`

Importa GSAP recién cuando la sección entra en vista, corre el build dentro de `gsap.context`
(se revierte al desmontar: seguro en StrictMode) y pausa los loops fuera de pantalla.

```ts
'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

export type Gsap = typeof import('gsap').gsap;
export interface MotionLoop {
  pause: () => unknown;
  resume: () => unknown;
}
export interface SectionMotion {
  loops: readonly MotionLoop[];
  dispose?: () => void;
}
export type BuildSectionMotion = (gsap: Gsap, root: HTMLElement) => SectionMotion;
export type SectionMotionStatus = 'off' | 'loading' | 'running' | 'failed';

function motionAllowed(minWidth = 640): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia(`(min-width: ${minWidth}px)`).matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function useInView(ref: RefObject<HTMLElement | null>, rootMargin: string): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

export function useSectionMotion(
  ref: RefObject<HTMLElement | null>,
  build: BuildSectionMotion,
  rootMargin = '0px 0px -12% 0px',
): SectionMotionStatus {
  const inView = useInView(ref, rootMargin);
  const [gsap, setGsap] = useState<Gsap | null>(null);
  const [failed, setFailed] = useState(false);
  const loopsRef = useRef<readonly MotionLoop[]>([]);
  const buildRef = useRef(build);

  useEffect(() => {
    if (!inView || gsap || !motionAllowed()) return;
    let cancelled = false;
    import('gsap').then(
      (mod) => {
        if (!cancelled) setGsap(mod.gsap);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [inView, gsap]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!gsap || !root) return;
    let dispose: (() => void) | undefined;
    const ctx = gsap.context(() => {
      const motion = buildRef.current(gsap, root);
      loopsRef.current = motion.loops;
      dispose = motion.dispose;
    }, root);
    return () => {
      dispose?.();
      loopsRef.current = [];
      ctx.revert();
    };
  }, [gsap, ref]);

  useEffect(() => {
    for (const loop of loopsRef.current) {
      if (inView) loop.resume();
      else loop.pause();
    }
  }, [inView, gsap]);

  if (!motionAllowed()) return 'off';
  if (failed) return 'failed';
  return gsap ? 'running' : 'loading';
}
```

- El build corre en `useLayoutEffect`: así el estado inicial de los `from()` se aplica antes del
  primer paint y no hay un frame con el contenido final visible.
- `dispose` suelta lo que `gsap.context` no revierte: listeners de puntero, `quickTo` atados a
  eventos, controladores expuestos a React.
- **Sin flash antes de la entrada:** mientras el estado es `loading`, el contenedor lleva
  `data-intro="pending"` y el CSS oculta solo las piezas que la entrada va a animar, dentro de la
  misma media query que habilita el motion. Si GSAP falla (`failed`) o no corre (`off`), no hay
  `pending` y se ve el HTML final.

```css
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  [data-intro='pending'] [data-copy],
  [data-intro='pending'] [data-device] {
    opacity: 0;
  }
}
```

## Build de sección (separado del JSX)

```ts
export const buildFeaturesMotion: BuildSectionMotion = (gsap, root) => {
  const q = gsap.utils.selector(root);
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from(q('[data-copy] > *'), { y: 26, opacity: 0, duration: 1, stagger: 0.08 })
    .from(q('[data-feature]'), { x: 36, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.45)
    .from(q('[data-feature-icon]'), { scale: 0, rotate: -40, duration: 0.8, stagger: 0.12, ease: 'back.out(2.2)' }, 0.55);
  const float = gsap.to(q('[data-device]'), { y: -12, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 });
  return { loops: [float] };
};
```

Las posiciones absolutas (`0.45`, `0.55`) solapan tramos: eso da coreografía y no una lista
secuencial. El `delay` del loop es ≥ la duración de la entrada para que no se peleen.

## Gate de viewport en Next (un solo árbol)

Montar mobile y desktop a la vez con `sm:hidden`/`hidden sm:block` duplica DOM, links y testids.
Un componente cliente mínimo decide por `matchMedia`; los dos árboles llegan como props ya
resueltos por el Server Component, así no entran al bundle cliente.

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function ViewportGate({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isDesktop ? desktop : mobile;
}
```

Default en SSR = **mobile**: si el visitante es mobile no hay swap; si es desktop, corrige al
montar y sin JS igual ve contenido real.

## Chunks pesados con `next/dynamic`

```tsx
'use client';

import dynamic from 'next/dynamic';

export const HeroSceneLazy = dynamic(() => import('./HeroScene'), {
  loading: () => <section aria-hidden="true" style={{ height: 'max(720px, min(100svh, 980px))' }} />,
});
```

El placeholder ocupa el mismo alto (sin CLS). Solo se monta del lado desktop del gate.

## `framer-motion` sin romper el SSR

- Nunca `initial={{ opacity: 0 }}` en contenido que tiene que verse en el primer paint de una
  página con SSR: el servidor inyecta `style="opacity:0"` y el contenido queda invisible hasta
  hidratar (medido: ~10 s de LCP en un teléfono medio).
- Para estado de UI (pasos, modales, listas) sí: `AnimatePresence` + `initial={false}` en el primer
  render, y `useReducedMotion()` para apagar desplazamientos.

## Estado compartido React ↔ GSAP

Cuando React decide algo que el motion tiene que reflejar (la opción elegida mueve la costura del
shader), el build expone un controlador por un ref y React lo llama en un efecto; React nunca
escribe el mismo estilo inline que GSAP anima:

```ts
const controller = useRef<{ settle(value: Choice | null): void } | null>(null);
const build = useMemo(() => createSceneMotion(sharedState, controller), [sharedState]);
const status = useSectionMotion(stageRef, build, animate);
useEffect(() => controller.current?.settle(choice), [choice]);
```

El build lee la elección inicial de un `data-*` del root (`data-selected`) para arrancar en el
lugar correcto, y en `dispose` pone `controller.current = null`.
