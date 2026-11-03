'use client';

import { useEffect, useState } from 'react';

export type ViewportTier = 'narrow' | 'medium' | 'wide';

export const NARROW_MAX = 768;
export const MEDIUM_MAX = 1024;

export const tierOfWidth = (width: number): ViewportTier => (width < NARROW_MAX ? 'narrow' : width < MEDIUM_MAX ? 'medium' : 'wide');

export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>('wide');
  useEffect(() => {
    const update = () => setTier(tierOfWidth(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return tier;
}
