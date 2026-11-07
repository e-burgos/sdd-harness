import { duration, gsapEase, stagger } from '@/lib/motion/motion-tokens';
import type { BuildSectionMotion, Gsap, MotionLoop } from '@/lib/motion/use-section-motion';

type Select = (selector: string) => Element[];

const SPOTLIGHT_HOLD = 1.8;
const MAGNET_RADIUS = 160;
const MAGNET_PULL = 0.25;

function center(el: Element): { x: number; y: number } {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function playIntro(gsap: Gsap, q: Select): void {
  const [hub] = q('[data-hub]');
  const hubCenter = hub ? center(hub) : null;
  const timeline = gsap.timeline({ defaults: { ease: gsapEase.out } });
  timeline
    .from(q('[data-hero-eyebrow]'), { opacity: 0, letterSpacing: '0.5em', duration: duration.entrance })
    .from(q('[data-hero-copy] > *'), { opacity: 0, y: 26, duration: duration.entrance, stagger: stagger.piece }, 0.35)
    .from(q('[data-hub]'), { opacity: 0, scale: 0.86, filter: 'blur(10px)', duration: duration.hero }, 0.1)
    .fromTo(q('[data-link]'), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.9, ease: gsapEase.rail, stagger: 0.05 }, 0.35);
  q('[data-node]').forEach((node, index) => {
    const own = center(node);
    const offset = hubCenter ? { x: hubCenter.x - own.x, y: hubCenter.y - own.y } : { x: 0, y: 0 };
    timeline.from(node, { ...offset, opacity: 0, scale: 0.2, duration: duration.entrance, ease: gsapEase.pop }, 0.25 + index * 0.045);
  });
}

function lightUp(root: HTMLElement, q: Select, active: number): void {
  root.dataset.active = String(active);
  for (const el of q('[data-spot]') as HTMLElement[]) el.dataset.lit = String(Number(el.dataset.spot) === active);
}

function buildSpotlight(gsap: Gsap, root: HTMLElement, q: Select): MotionLoop {
  const count = q('[data-node]').length;
  const timeline = gsap.timeline({ repeat: -1, delay: 1.6 });
  for (let index = 0; index < count; index += 1) {
    timeline.call(() => lightUp(root, q, index)).to({}, { duration: SPOTLIGHT_HOLD });
  }
  return timeline;
}

function buildFloat(gsap: Gsap, q: Select): MotionLoop {
  return gsap.to(q('[data-float]'), { y: -8, duration: 3.2, ease: gsapEase.float, yoyo: true, repeat: -1, delay: 1.6 });
}

function bindInteractions(gsap: Gsap, root: HTMLElement, q: Select, spotlight: MotionLoop): () => void {
  const removers: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, handler: EventListener) => {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  };
  const [orbit] = q('[data-orbit]');
  if (orbit) {
    listen(orbit, 'pointerenter', () => spotlight.pause());
    listen(orbit, 'pointerleave', () => spotlight.resume());
  }
  for (const node of q('[data-node]') as HTMLElement[]) {
    const index = Number(node.dataset.node);
    listen(node, 'pointerenter', () => lightUp(root, q, index));
  }
  for (const magnet of q('[data-magnet]') as HTMLElement[]) {
    const moveX = gsap.quickTo(magnet, 'x', { duration: 0.5, ease: gsapEase.follow });
    const moveY = gsap.quickTo(magnet, 'y', { duration: 0.5, ease: gsapEase.follow });
    listen(root, 'pointermove', ((event: PointerEvent) => {
      const { x, y } = center(magnet);
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      const near = Math.hypot(dx, dy) < MAGNET_RADIUS;
      moveX(near ? dx * MAGNET_PULL : 0);
      moveY(near ? dy * MAGNET_PULL : 0);
    }) as EventListener);
    listen(root, 'pointerleave', () => {
      moveX(0);
      moveY(0);
    });
  }
  return () => {
    for (const remove of removers) remove();
  };
}

export const buildWelcomeMotion: BuildSectionMotion = (gsap, root) => {
  const q = gsap.utils.selector(root);
  playIntro(gsap, q);
  const spotlight = buildSpotlight(gsap, root, q);
  const unbind = bindInteractions(gsap, root, q, spotlight);
  return {
    loops: [spotlight, buildFloat(gsap, q)],
    dispose() {
      unbind();
      delete root.dataset.active;
    },
  };
};
