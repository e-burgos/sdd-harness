'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const STICK_THRESHOLD_PX = 48;

export function useStickToBottom() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const distanceFromBottom = () => {
    const el = scrollerRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
  };

  const scrollToBottom = useCallback(() => {
    const el = scrollerRef.current;
    stick.current = true;
    setAtBottom(true);
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const near = distanceFromBottom() <= STICK_THRESHOLD_PX;
    stick.current = near;
    setAtBottom(near);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stick.current) scroller.scrollTop = scroller.scrollHeight;
      else setAtBottom(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= STICK_THRESHOLD_PX);
    });
    observer.observe(scroller);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { scrollerRef, contentRef, atBottom, onScroll, scrollToBottom };
}
