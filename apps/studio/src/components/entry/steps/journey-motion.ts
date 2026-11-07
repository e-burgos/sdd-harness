import { duration, gsapEase } from '@/lib/motion/motion-tokens';
import type { BuildSectionMotion, Gsap, MotionLoop } from '@/lib/motion/use-section-motion';

type Select = (selector: string) => Element[];

const STOP_GAP = 0.3;
const TRAVEL = 0.9;
const DWELL = 1.1;

function playIntro(gsap: Gsap, q: Select): void {
  const timeline = gsap.timeline({ defaults: { ease: gsapEase.out } });
  timeline.fromTo(q('[data-journey-fill]'), { scaleX: 0 }, { scaleX: 1, duration: duration.hero, ease: gsapEase.rail }, 0.1);
  q('[data-stop-node]').forEach((node, index) => {
    timeline.from(node, { scale: 0, rotate: -40, duration: duration.pop + 0.3, ease: gsapEase.pop }, 0.2 + index * STOP_GAP);
  });
  q('[data-stop-copy]').forEach((copy, index) => {
    timeline.from(copy, { opacity: 0, y: 26, duration: duration.entrance }, 0.3 + index * STOP_GAP);
  });
}

function stopCenters(root: HTMLElement, q: Select): number[] {
  const origin = root.querySelector('[data-journey]')?.getBoundingClientRect().left ?? 0;
  return q('[data-stop-node]').map((node) => {
    const box = node.getBoundingClientRect();
    return box.left + box.width / 2 - origin;
  });
}

function setLit(q: Select, active: number): void {
  for (const el of q('[data-spot]') as HTMLElement[]) el.dataset.lit = String(Number(el.dataset.spot) === active);
}

function buildTravel(gsap: Gsap, root: HTMLElement, q: Select): MotionLoop | null {
  const [token] = q('[data-journey-token]');
  const centers = stopCenters(root, q);
  if (!token || centers.length === 0) return null;
  gsap.set(token, { x: centers[0], opacity: 1 });
  const timeline = gsap.timeline({ repeat: -1, delay: 0.4 + centers.length * STOP_GAP + duration.entrance });
  centers.forEach((x, index) => {
    timeline.to(token, { x, duration: index === 0 ? 0.01 : TRAVEL, ease: gsapEase.rail }).call(() => setLit(q, index)).to({}, { duration: DWELL });
  });
  timeline.call(() => setLit(q, -1)).to(token, { x: centers[0], duration: TRAVEL, ease: gsapEase.inOut });
  return timeline;
}

export const buildJourneyMotion: BuildSectionMotion = (gsap, root) => {
  const q = gsap.utils.selector(root);
  playIntro(gsap, q);
  const travel = buildTravel(gsap, root, q);
  return {
    loops: travel ? [travel] : [],
    dispose() {
      setLit(q, -1);
    },
  };
};
