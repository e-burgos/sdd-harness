import React from 'react';
import { Scale, DoorOpen, ShieldCheck, Puzzle, Zap, Brain, HelpCircle } from 'lucide-react';
import type { GateId } from '@/lib/gates';

export function GateIcon({ gateId, className }: { gateId: GateId; className?: string }) {
  switch (gateId) {
    case 'regla-cero':
      return <Scale className={className} />;
    case 'gate-a':
      return <DoorOpen className={className} />;
    case 'gate-b':
      return <ShieldCheck className={className} />;
    case 'contexto-gate':
      return <Puzzle className={className} />;
    case 'fix-gate':
      return <Zap className={className} />;
    case 'memoria-gate':
      return <Brain className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}
