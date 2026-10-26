# FIX-e-burgos-003 — SDD Studio: erradicar emojis y unificar iconografía con LucideIcons

| Campo         | Valor                                                               |
| ------------- | ------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-003                                                    |
| **Tipo**      | IMPROVEMENT                                                         |
| **Severidad** | low                                                                 |
| **Keyword**   | [IMPROVEMENT]                                                       |
| **Fecha**     | 2026-10-26                                                          |
| **Autor**     | e-burgos                                                            |
| **Estado**    | implemented                                                         |
| **Spec**      | N/A (repo-level / apps/studio)                                      |

## Problema

La aplicación SDD Studio (`apps/studio`) utiliza emojis hardcodeados dispersos en más de 15 componentes y archivos de definición (StudioHeader, Mission Control, GateCards, drawers, avatares, inspectores, feeds y timelines). Los emojis producen inconsistencias de renderizado según el sistema operativo / fuente y rompen la estética técnica e industrial del harness.

## Justificación del bypass

Mejora cosmética y de coherencia visual sin alteración de modelos de datos, protocolos ni contratos de API. Si bien afecta ~20 archivos de presentación (excediendo el umbral estándar de 5 archivos de FIX GATE), fue autorizada explícitamente vía FIX GATE por tratarse de un refactor puramente visual de iconografía.

## Solución aplicada

1. Instalar `lucide-react` en `apps/studio` y remover `@phosphor-icons/react`.
2. Reemplazar todas las ocurrencias de emojis de UI y de definición de Gates por sus componentes correspondientes de `lucide-react` (`Scale`, `DoorOpen`, `ShieldCheck`, `Puzzle`, `Zap`, `Brain`, `Bot`, `User`, `Folder`, `FileText`, `Crown`, `ArrowRight`, `Pause`, `Play`, `SkipForward`, `Moon`, `Activity`, `Cpu`, `Users`, `Feather`, `Check`, `X`, `ChevronRight`, `ChevronDown`, `ChevronUp`, `PanelLeft`, `PanelRight`, `ShieldAlert`, `Send`, `Pencil`, `Trash2`, `LayoutGrid`, `PlugZap`, `ExternalLink`, etc.).
3. Crear `GateIcon.tsx` para abstraer los iconos de gates.
4. Actualizar tests unitarios que realizaban assertions sobre caracteres emoji o texto de botones (`agentavatar.spec.tsx`, `rightpanel.spec.tsx`, `agentmap.spec.tsx`).
5. Validar compilación, typecheck y tests completos en `apps/studio` (58 archivos, 439 tests pasando).

### Archivos modificados

- `apps/studio/package.json`
- `pnpm-lock.yaml`
- `apps/studio/src/lib/gates.ts`
- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/components/ConnectScreen.tsx`
- `apps/studio/src/components/mission-control/GateIcon.tsx`
- `apps/studio/src/components/mission-control/GateCard.tsx`
- `apps/studio/src/components/mission-control/GateInspectorDrawer.tsx`
- `apps/studio/src/components/mission-control/AgentNode.tsx`
- `apps/studio/src/components/mission-control/AgentMapCanvas.tsx`
- `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`
- `apps/studio/src/components/mission-control/ChatDialogueCard.tsx`
- `apps/studio/src/components/mission-control/DocumentViewerModal.tsx`
- `apps/studio/src/components/mission-control/EcosystemDashboard.tsx`
- `apps/studio/src/components/mission-control/LiveAgentChatFeed.tsx`
- `apps/studio/src/components/mission-control/LiveSwarmComms.tsx`
- `apps/studio/src/components/mission-control/LiveTelemetryHUD.tsx`
- `apps/studio/src/components/mission-control/agentmap.spec.tsx`
- `apps/studio/src/components/workspace/ActivityIndicator.tsx`
- `apps/studio/src/components/workspace/AgentAvatar.tsx`
- `apps/studio/src/components/workspace/agentavatar.spec.tsx`
- `apps/studio/src/components/workspace/ApprovalCard.tsx`
- `apps/studio/src/components/workspace/AttachmentTray.tsx`
- `apps/studio/src/components/workspace/AttachmentView.tsx`
- `apps/studio/src/components/workspace/ChannelView.tsx`
- `apps/studio/src/components/workspace/Composer.tsx`
- `apps/studio/src/components/workspace/NavTree.tsx`
- `apps/studio/src/components/workspace/PanelRail.tsx`
- `apps/studio/src/components/workspace/PendingMessages.tsx`
- `apps/studio/src/components/workspace/RightPanel.tsx`
- `apps/studio/src/components/workspace/rightpanel.spec.tsx`
- `apps/studio/src/components/workspace/Sidebar.tsx`
- `apps/studio/src/components/workspace/ThreadView.tsx`
- `apps/studio/src/components/workspace/Timeline.tsx`
- `sdd/context/apps/studio/updates/2026-10-26-fix-e-burgos-003.md`
- `sdd/fixes/fix-e-burgos-003.md`

### Test de validación

- **Referencia:** `pnpm --filter sdd-studio-web test` (58 test files, 439 tests pasando) y `pnpm --filter sdd-studio-web typecheck` (limpio, sin errores).
