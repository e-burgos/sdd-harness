'use client';

import { Button } from '@e-burgos/tucu-ui';
import { useEffect, useState } from 'react';

export interface CopyButtonProps {
  text: string | (() => string);
  label: string;
  doneLabel: string;
}

export function CopyButton({ text, label, doneLabel }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={() => void copy()}>
      {copied ? doneLabel : label}
    </Button>
  );
}
