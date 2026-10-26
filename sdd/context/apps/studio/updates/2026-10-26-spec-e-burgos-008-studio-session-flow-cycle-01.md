# spec-e-burgos-008 cycle-01 — 2026-10-26

## Estado
Studio ofrece un selector único con ayuda (`HelpSelect`) en todos los selectores, el formulario de las preguntas del proveedor dentro del chat, el contexto restante en la cabecera de la conversación, la elección del modo de desarrollo (`solo`/`team`) y de implementación (`automática`/`lite`/`full`) antes de arrancar una spec, la actividad sin duplicados con el agente en curso y una conversación nueva preparada y asociada por cada spec, ciclo o fix creado. Un puente anterior sigue funcionando: cada capacidad se activa con su feature (`questions`, `context-usage`, `profile-set`).

## Estructura
- `components/HelpSelect.tsx` envuelve un `<select>` nativo con icono `CircleHelp` y tooltip (`group/help`, hover y foco); `no-native-select.spec.ts` falla si aparece un `<select>` fuera de él.
- `components/workspace/QuestionForm.tsx` (ítem `question` de `lib/store/timeline.ts`; `Timeline` y `ThreadView` envían `question.answer`).
- `components/workspace/ContextMeter.tsx` y `lib/context-meter.ts` (`CONTEXT_WARN_PERCENT` 70, `CONTEXT_CRITICAL_PERCENT` 90); `sameInfo` de `lib/store/state.ts` compara `contextUsage`.
- `components/workspace/ModeSelectors.tsx` y `lib/flow-choice.ts` (`applyFlowChoice` antepone `[LITE]`/`[FULL]` al texto libre o a los argumentos de un comando de prompt; `fullExceptionOf` avisa si la spec depende de otras o de ella dependen otras).
- `lib/auto-conversation.ts` (`prepareFromBotEvent`, `briefingFor`), `StudioState.prepared`/`openedPreparedId` y acciones `openPrepared`/`dismissPrepared`; `components/workspace/PreparedConversations.tsx`; el `Composer` asocia el hilo al crearlo solo si el texto conserva el encabezado del briefing.
- `lib/store/nav-tree.ts`: `buildNavTree(snapshot, threads, view, presence)`, `NavThread.workingAgents`/`tool` y `threadCount` por ids únicos.
- `lib/bootstrap.ts` pide `includeQuestions` solo si el puente anuncia `questions`.

## Dependencias
Sin dependencias nuevas (`lucide-react` ya estaba).

## Qué sigue
- La conversación preparada no se envía sola: el dev la abre y la lanza.
- El aviso de excepción a full solo cubre `depends_on`; los contratos entre subproyectos no se detectan desde la web.
