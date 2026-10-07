'use client';

import { useStudio } from '../BridgeProvider';

export function Workspace() {
  const project = useStudio((s) => s.snapshot?.project ?? '…');
  return <main className="p-6">{project}</main>;
}
