# FIX-e-burgos-003-001: Fix undefined filter error y caras dibujadas en avatares con rol

> **Tipo:** BUGFIX / IMPROVEMENT · **Severidad:** Media · **Fecha:** 2026-10-23 · **Spec:** spec-e-burgos-003-studio-mission-control

## 1. Problema

1. En el render inicial de `StudioHeader` y componentes de Mission Control, se intentaba desestructurar `presence` y `snapshot` desde `useBridge()`, el cual provee el contexto base pero no el estado reactivo del store (que se accede vía `useStudio()`). Esto causaba el error runtime `TypeError: Cannot read properties of undefined (reading 'filter')`. Asimismo, en `Composer.tsx`, `snapshot?.agents.map` carecía del operador opcional en `agents`.
2. Los avatares de los agentes mostraban siglas/iniciales de texto plano (`CL`, `CH`, `VU`, etc.) en lugar de caras o ilustraciones distintivas.
3. El rol del agente no figuraba debajo de su nombre en mensajes de chat, mapa ni árbol de agentes, dificultando identificar rápidamente qué función cumple cada uno en el enjambre.

## 2. Solución

1. **Corrección de Store y Guards**:
   - `StudioHeader.tsx`, `AgentMapCanvas.tsx`, `EcosystemDashboard.tsx` y `LiveTelemetryHUD.tsx` ahora consumen el store reactivo mediante `useStudio((s) => s.snapshot)` y `useStudio((s) => s.presence ?? [])`.
   - Se añadió `snapshot?.agents?.map` en `Composer.tsx`.
2. **Caras Dibujadas en SVG (`AgentFace.tsx`)**:
   - Se creó el componente `AgentFace.tsx` con gráficos vectoriales puros personalizados para los 9 agentes (Clara con peinado elegante, corona dorada y headset de comandante; Chronos con monóculo tecnológico de engranajes; Daedalus con gafas rectangulares de arquitectura; Vulcan con gafas de forjador y soldador; Aurora con flequillo artístico neón y clip; Argus con visor óptico láser; Atlas con rostro amigable de androide y antena; Hermes con casco alado de piloto; Sophia con gafas de diseñadora).
   - Se integró `AgentFace` tanto en `AgentAvatar.tsx` como en el nodo 2D del `AgentMapCanvas`.
3. **Rol Visible debajo del Nombre**:
   - En `Timeline.tsx`: se añadió el subtítulo `{meta.role} · {meta.title}` debajo del nombre del agente en cada mensaje.
   - En `AgentNode.tsx`: se rediseñó la píldora inferior para mostrar tanto el nombre como el rol en mayúsculas de alto contraste.
   - En `NavTree.tsx` y `RightPanel.tsx`: se incluyó el rol debajo del nombre en las listas de DMs y actividad.

## 3. Archivos Afectados

- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/components/mission-control/AgentMapCanvas.tsx`
- `apps/studio/src/components/mission-control/AgentNode.tsx`
- `apps/studio/src/components/mission-control/EcosystemDashboard.tsx`
- `apps/studio/src/components/mission-control/LiveTelemetryHUD.tsx`
- `apps/studio/src/components/workspace/AgentAvatar.tsx`
- `apps/studio/src/components/workspace/AgentFace.tsx`
- `apps/studio/src/components/workspace/Composer.tsx`
- `apps/studio/src/components/workspace/NavTree.tsx`
- `apps/studio/src/components/workspace/RightPanel.tsx`
- `apps/studio/src/components/workspace/Timeline.tsx`

## 4. Verificación

- `pnpm --filter sdd-studio-web test`: 54 test files, 409 tests passed (100% green).
- `pnpm sdd:validate`: OK.
