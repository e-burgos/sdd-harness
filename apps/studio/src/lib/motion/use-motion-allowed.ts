'use client';

import { useEffect, useState } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function readMotionAllowed(minWidth: number): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(min-width: ${minWidth}px)`).matches && !window.matchMedia(REDUCED_QUERY).matches;
}

export function useMotionAllowed(minWidth = 0): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const queries = [window.matchMedia(`(min-width: ${minWidth}px)`), window.matchMedia(REDUCED_QUERY)];
    const apply = () => setAllowed(readMotionAllowed(minWidth));
    apply();
    for (const query of queries) query.addEventListener('change', apply);
    return () => {
      for (const query of queries) query.removeEventListener('change', apply);
    };
  }, [minWidth]);
  return allowed;
}
