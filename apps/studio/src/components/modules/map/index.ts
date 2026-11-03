import type { ModuleSlots } from '@/lib/nav/module-slots';
import { MapCenter } from './MapCenter';
import { MapPanel } from './MapPanel';
import { MapRight } from './MapRight';
import { SwarmPlaybackProvider } from './swarm-playback';

export const mapModule: ModuleSlots = { Panel: MapPanel, Center: MapCenter, Right: MapRight, Scope: SwarmPlaybackProvider };
