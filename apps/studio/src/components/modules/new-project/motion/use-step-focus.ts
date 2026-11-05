'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { StepDirection } from './StepStage';

export function useStepDirection(position: number): StepDirection {
  const [previous, setPrevious] = useState(position);
  const [direction, setDirection] = useState<StepDirection>(1);
  if (previous !== position) {
    setPrevious(position);
    setDirection(position > previous ? 1 : -1);
  }
  return direction;
}

export function useFocusOnStepChange(stepKey: string | null, target: RefObject<HTMLElement | null>, scroller: RefObject<HTMLElement | null>): void {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const changed = previous.current !== null && stepKey !== null && previous.current !== stepKey;
    previous.current = stepKey;
    if (!changed) return;
    if (scroller.current) scroller.current.scrollTop = 0;
    target.current?.focus({ preventScroll: true });
  }, [stepKey, target, scroller]);
}
