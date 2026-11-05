import type { WizardScope } from '@/lib/wizard/catalog';
import { duration, gsapEase } from '@/lib/motion/motion-tokens';
import type { SeamState } from '@/lib/motion/seam-shader';
import type { BuildSectionMotion, Gsap, MotionLoop } from '@/lib/motion/use-section-motion';

type Select = (selector: string) => Element[];

export const SPLIT_BY_SCOPE: Record<WizardScope, number> = { front: 0.62, back: 0.38, fullstack: 0.5 };

export interface DoorsController {
  settle(scope: WizardScope | null): void;
}

const NEUTRAL_SPLIT = 0.5;
const PILL_TRAVEL = 1;
const MAGNET_RADIUS = 160;
const MAGNET_PULL = 0.25;

function playIntro(gsap: Gsap, q: Select): void {
  gsap
    .timeline({ defaults: { ease: gsapEase.out } })
    .from(q('[data-door-copy="front"] > *'), { opacity: 0, x: -50, stagger: 0.07, duration: duration.entrance }, 0.35)
    .from(q('[data-door-copy="back"] > *'), { opacity: 0, x: 50, stagger: 0.07, duration: duration.entrance }, 0.35)
    .from(q('[data-mock="front"]'), { opacity: 0, x: -140, rotate: -8, scale: 0.85, duration: duration.hero }, 0.25)
    .from(q('[data-mock="back"]'), { opacity: 0, x: 140, rotate: 8, scale: 0.85, duration: duration.hero }, 0.35)
    .from(q('[data-pill]'), { opacity: 0, y: 20, scale: 0.6, duration: 0.9, ease: gsapEase.pop }, 0.9);
}

function buildFrontLoop(gsap: Gsap, q: Select): MotionLoop | null {
  const blocks = q('[data-mock="front"] [data-block]') as HTMLElement[];
  const [selector] = q('[data-mock="front"] [data-select]') as HTMLElement[];
  const [status] = q('[data-mock="front"] [data-status]') as HTMLElement[];
  const [statusText] = q('[data-mock="front"] [data-status-text]') as HTMLElement[];
  if (!selector || !status || !statusText || blocks.length === 0) return null;
  const setStatus = (live: boolean) => {
    status.dataset.online = String(live);
    statusText.textContent = (live ? statusText.dataset.live : statusText.dataset.building) ?? '';
  };
  const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.8, delay: 1.6 });
  timeline.call(() => setStatus(false)).set(blocks, { opacity: 0.15 }).set(selector, { opacity: 1 });
  for (const block of blocks) {
    timeline
      .to(selector, {
        x: block.offsetLeft - 2,
        y: block.offsetTop - 2,
        width: block.offsetWidth + 4,
        height: block.offsetHeight + 4,
        duration: 0.45,
        ease: gsapEase.out,
      })
      .to(block, { opacity: 1, duration: 0.5, ease: gsapEase.out }, '<0.1');
  }
  timeline
    .to(selector, { opacity: 0, duration: 0.3 }, '+=0.2')
    .call(() => setStatus(true))
    .fromTo(status, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: gsapEase.popStrong });
  return timeline;
}

function buildBackLoop(gsap: Gsap, q: Select): MotionLoop | null {
  const requests = q('[data-mock="back"] [data-req]');
  if (requests.length === 0) return null;
  const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 1.4 });
  timeline.set(requests, { opacity: 0, x: -10 });
  requests.forEach((request, index) => {
    const code = request.querySelector('[data-code]');
    timeline
      .to(request, { opacity: 1, x: 0, duration: 0.45, ease: gsapEase.out }, index * 0.7)
      .fromTo(code ?? [], { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: gsapEase.popStrong }, '>-0.1');
  });
  timeline.to(requests, { opacity: 0.35, duration: 0.4, stagger: 0.05 }, '+=1.6');
  return timeline;
}

function buildFloat(gsap: Gsap, q: Select): MotionLoop {
  return gsap.to(q('[data-float]'), { y: -8, duration: 3.2, ease: gsapEase.float, yoyo: true, repeat: -1, delay: 1.6, stagger: 0.6 });
}

function bindPointer(gsap: Gsap, root: HTMLElement, q: Select, state: SeamState, baseSplit: () => number): () => void {
  const listeners: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, handler: EventListener) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const [pill] = q('[data-pill]') as HTMLElement[];
  const applySplit = () => {
    if (pill) gsap.set(pill, { x: (state.split - NEUTRAL_SPLIT) * root.clientWidth * PILL_TRAVEL });
  };
  const toSplit = (value: number) => gsap.to(state, { split: value, duration: duration.split, ease: gsapEase.out, onUpdate: applySplit, overwrite: 'auto' });
  const toHover = (value: number) => gsap.to(state, { hover: value, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });

  for (const door of q('[data-door]') as HTMLElement[]) {
    const scope = door.dataset.door as WizardScope;
    const enter = () => {
      toSplit(SPLIT_BY_SCOPE[scope]);
      toHover(1);
    };
    const leave = () => {
      toSplit(baseSplit());
      toHover(root.dataset.selected === 'fullstack' ? 1 : 0);
    };
    listen(door, 'pointerenter', enter);
    listen(door, 'focus', enter);
    listen(door, 'pointerleave', leave);
    listen(door, 'blur', leave);
  }

  const layers = (q('[data-depth]') as HTMLElement[]).map((el) => ({
    depth: Number(el.dataset.depth),
    x: gsap.quickTo(el, 'x', { duration: duration.follow, ease: gsapEase.follow }),
    y: gsap.quickTo(el, 'y', { duration: duration.follow, ease: gsapEase.follow }),
  }));
  listen(root, 'pointermove', ((event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) / rect.width;
    state.mouseY = (event.clientY - rect.top) / rect.height;
    const dx = state.mouseX - 0.5;
    const dy = state.mouseY - 0.5;
    for (const layer of layers) {
      layer.x(-dx * layer.depth);
      layer.y(-dy * layer.depth * 0.6);
    }
  }) as EventListener);

  for (const magnet of q('[data-magnet]') as HTMLElement[]) {
    const host = root;
    const moveX = gsap.quickTo(magnet, 'x', { duration: 0.5, ease: gsapEase.follow });
    const moveY = gsap.quickTo(magnet, 'y', { duration: 0.5, ease: gsapEase.follow });
    listen(host, 'pointermove', ((event: PointerEvent) => {
      const box = magnet.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const near = Math.hypot(dx, dy) < MAGNET_RADIUS;
      moveX(near ? dx * MAGNET_PULL : 0);
      moveY(near ? dy * MAGNET_PULL : 0);
    }) as EventListener);
    listen(host, 'pointerleave', () => {
      moveX(0);
      moveY(0);
    });
  }

  applySplit();
  return () => {
    for (const remove of listeners) remove();
  };
}

export function createScopeDoorsMotion(state: SeamState, controller: { current: DoorsController | null }): BuildSectionMotion {
  return (gsap, root) => {
    const q = gsap.utils.selector(root);
    const baseSplit = () => {
      const selected = root.dataset.selected as WizardScope | undefined;
      return selected ? SPLIT_BY_SCOPE[selected] : NEUTRAL_SPLIT;
    };
    state.split = baseSplit();
    state.hover = root.dataset.selected === 'fullstack' ? 1 : 0;
    playIntro(gsap, q);
    const unbind = bindPointer(gsap, root, q, state, baseSplit);
    controller.current = {
      settle(scope) {
        gsap.to(state, {
          split: scope ? SPLIT_BY_SCOPE[scope] : NEUTRAL_SPLIT,
          hover: scope === 'fullstack' ? 1 : 0.4,
          duration: duration.split,
          ease: gsapEase.out,
          overwrite: 'auto',
        });
      },
    };
    const loops = [buildFrontLoop(gsap, q), buildBackLoop(gsap, q), buildFloat(gsap, q)].filter((loop): loop is MotionLoop => loop !== null);
    return {
      loops,
      dispose() {
        unbind();
        controller.current = null;
      },
    };
  };
}

