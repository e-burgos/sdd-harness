'use client';

import { useEffect, useRef } from 'react';
import { createSeamShader, type SeamState } from '@/lib/motion/seam-shader';

export function SeamCanvas({ state }: { state: SeamState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shader = createSeamShader(canvas, state);
    if (!shader) return;
    let frame = 0;
    let inView = true;
    const startedAt = performance.now();
    const render = () => {
      frame = 0;
      if (!inView || document.hidden) return;
      shader.draw((performance.now() - startedAt) / 1000);
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (frame === 0 && inView && !document.hidden) frame = requestAnimationFrame(render);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      resume();
    });
    const resize = new ResizeObserver(() => shader.resize());
    visibility.observe(canvas);
    resize.observe(canvas);
    document.addEventListener('visibilitychange', resume);
    resume();
    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', resume);
      shader.dispose();
    };
  }, [state]);

  return <canvas ref={canvasRef} aria-hidden data-testid="seam-canvas" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
