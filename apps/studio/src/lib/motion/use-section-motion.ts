'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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

function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export type SectionMotionStatus = 'off' | 'loading' | 'running' | 'failed';

export function useSectionMotion(ref: RefObject<HTMLElement | null>, build: BuildSectionMotion, enabled: boolean): SectionMotionStatus {
  const inView = useInView(ref);
  const visible = usePageVisible();
  const [gsap, setGsap] = useState<Gsap | null>(null);
  const [failed, setFailed] = useState(false);
  const loopsRef = useRef<readonly MotionLoop[]>([]);
  const buildRef = useRef(build);

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  useEffect(() => {
    if (!enabled || !inView || gsap) return;
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
  }, [enabled, inView, gsap]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!enabled || !gsap || !root) return;
    let dispose: (() => void) | undefined;
    const context = gsap.context(() => {
      const motion = buildRef.current(gsap, root);
      loopsRef.current = motion.loops;
      dispose = motion.dispose;
    }, root);
    return () => {
      dispose?.();
      loopsRef.current = [];
      context.revert();
    };
  }, [enabled, gsap, ref]);

  useEffect(() => {
    const running = inView && visible;
    for (const loop of loopsRef.current) {
      if (running) loop.resume();
      else loop.pause();
    }
  }, [inView, visible, gsap]);

  if (!enabled) return 'off';
  if (failed) return 'failed';
  return gsap ? 'running' : 'loading';
}
