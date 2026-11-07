import { duration, gsapEase } from '@/lib/motion/motion-tokens';
import type { SeamState } from '@/lib/motion/seam-shader';
import type { BuildSectionMotion } from '@/lib/motion/use-section-motion';

export interface SeamTarget {
  split: number;
  hover: number;
}

export interface BackdropController {
  settle(target: SeamTarget): void;
}

export function createBackdropMotion(state: SeamState, controller: { current: BackdropController | null }): BuildSectionMotion {
  return (gsap, root) => {
    const q = gsap.utils.selector(root);
    state.split = Number(root.dataset.split ?? state.split);
    state.hover = Number(root.dataset.hover ?? state.hover);
    gsap.from(q('[data-backdrop-layer]'), { opacity: 0, scale: 1.08, duration: duration.hero, ease: gsapEase.out });
    const followX = gsap.quickTo(state, 'mouseX', { duration: duration.follow, ease: gsapEase.follow });
    const followY = gsap.quickTo(state, 'mouseY', { duration: duration.follow, ease: gsapEase.follow });
    const track = (event: PointerEvent) => {
      followX(event.clientX / window.innerWidth);
      followY(event.clientY / window.innerHeight);
    };
    window.addEventListener('pointermove', track);
    controller.current = {
      settle(target) {
        gsap.to(state, { split: target.split, hover: target.hover, duration: duration.split, ease: gsapEase.out, overwrite: 'auto' });
      },
    };
    return {
      loops: [],
      dispose() {
        window.removeEventListener('pointermove', track);
        controller.current = null;
      },
    };
  };
}
