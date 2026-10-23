# SPEC-e-burgos-001: SDD Studio: aprobaciones de sesión, imágenes en el chat y lista de hilos activos

> Estado: **in-progress** — `cycle-01` abierto el 2026-10-23 (flow `full`). Re-scope del
> 2026-10-23: la spec se corta en dos ciclos (ver «Corte de ciclos»).

## Resumen Ejecutivo

Mejoras de UX de sesión para SDD Studio (web `apps/studio` + puente `apps/studio-bridge` +
contrato `libs/studio-protocol`), para el desarrollador que opera agentes desde el navegador:

1. **Adjuntos en el chat**: imágenes, PDF y texto/código, con preview, recompresión de imágenes en
   el cliente y persistencia por hash para verlos al recargar el hilo.
2. **@archivo**: referenciar archivos del repo con un buscador; el agente recibe la ruta y los lee.
3. **@agente y /skill**: delegar en un subagente o pedir el uso de una skill/prompt del kit,
   descubiertos de lo cargado en el repo.
4. **Menú lateral SPECS y FIXES**: specs → ciclos → conversaciones; fixes → conversaciones, con
   asociación hilo↔ciclo/fix automática y editable.
5. **Secciones del menú colapsables**.
6. **"Always" real** en la aprobación (Edit/Write por herramienta, MCP por tool, Bash por prefijo).
7. **Lista de hilos activos** en el Sidebar con navegación.
8. **Indicadores de agentes trabajando** (typing dots / shimmer / spinner).
9. **Arreglos de scroll** en timeline, paneles y sidebar.
10. **Mensajes encolados sin interrumpir**: escribir al hilo mientras la sesión trabaja; el mensaje
    se encola y la sesión lo lee en el próximo punto de corte del turno (como Claude Code).

## Corte de ciclos

- **cycle-01**: HU-4..HU-10 + los contratos de protocolo de **toda** la spec (incluidos los de
  HU-1..HU-3: adjuntos, búsqueda de archivos, skills/agentes) con un único bump de
  `PROTOCOL_VERSION`, y el paso del puente a prompt streaming del SDK (lo exige HU-10).
- **cycle-02** (siguiente, aún no abierto): HU-1, HU-2, HU-3 — puente y Composer sobre los
  contratos ya publicados en cycle-01, sin otro bump de versión.

## Contexto de Negocio

- "Always (thread)" hoy no hace nada para Edit/Write/MultiEdit/NotebookEdit ni para `mcp__*`
  (el bridge degrada el scope a `once`) y para Bash recuerda solo el comando literal: en modo
  `ask` el dev reaprueba lo mismo una y otra vez. `FIX-e-burgos-002` (modo `bypassPermissions`)
  es el extremo opuesto; esta spec cubre el término medio.
- El Composer solo envía texto plano: no se puede mostrar una captura, un PDF ni un archivo, ni
  apuntar al agente a un archivo del repo, a un subagente o a una skill sin tipearlo a mano.
- Las conversaciones no quedan ligadas al trabajo SDD que las originó: no hay forma de ver qué
  hilos trabajaron un ciclo o un fix, ni cuáles están corriendo o esperando aprobación ahora.
- La UI no comunica bien que un agente está trabajando, y hay problemas de scroll en paneles.
- Mientras la sesión trabaja no se le puede escribir: `SessionManager.send` responde `conflict`
  ("the thread is busy: wait or interrupt it") y hay que interrumpir para corregir el rumbo.

## Evidencia y decisiones

- Evidencia (código, 2026-10-23): `alwaysKeyOf` (`apps/studio-bridge/src/sessions/session-manager.ts`)
  devuelve `null` para `EDIT_TOOLS` y `mcp__*` y usa `Bash:<comando exacto>`; el allowlist vive en
  memoria por hilo (`Live.alwaysAllow`).
- Evidencia (código, 2026-10-23): `thread.send`/`thread.create` llevan `text: string` (máx 100k);
  el bridge llama `query({ prompt: string })`; `ws-server.ts` fija `maxPayload = 1 MiB` (cierre 1009);
  el cliente no mide el frame.
- Evidencia (código, 2026-10-23): `ThreadInfo` no tiene vínculo a spec/ciclo/fix (solo `channelId`);
  `Sidebar.tsx` lista canales y DMs, no hilos ni specs/fixes; navegación por `useState` en `Workspace.tsx`.
- Evidencia (código, 2026-10-23): el snapshot descubre agentes solo de `sdd/agents`; los prompts de `/`
  están fijos en `apps/studio/src/lib/slash.ts`; no existe comando de búsqueda de archivos del repo.
- Evidencia (código, 2026-10-23): `SessionManager.send` lanza `SessionError('conflict')` si el hilo
  tiene turno vivo o mensaje en cola; el engine solo expone `interrupt`.
- Decisión del dev (2026-10-23): flow `full` (contrato compartido); corte en dos ciclos — cycle-01 =
  HU-4..HU-10 + contratos de protocolo de toda la spec; cycle-02 = HU-1..HU-3.
- Decisión del dev (2026-10-23): HU-10 es imperativa — mensajes al hilo sin interrumpir, encolados y
  leídos en el próximo punto de corte del turno (p. ej. tras el tool en curso), no al final del turno;
  la UI los muestra pendiente → entregado y permite editarlos/quitarlos mientras estén pendientes.
- Decisión del dev (2026-10-23): los canales `spec:*` salen de CANALES y viven solo bajo SPECS.
- Decisión del dev (2026-10-23): el Composer conserva el borrador (texto y adjuntos) por hilo en
  memoria al cambiar de hilo; se pierde al recargar.
- Decisión del dev (2026-10-23): las imágenes se re-encodean siempre en el cliente (quita EXIF/GPS).
- Decisión del dev (2026-10-23): adjuntos png/jpg/webp/gif, PDF y texto/código/markdown; hasta 5 por
  mensaje; lado mayor de imagen 1568 px; respetar 1 MiB por frame midiendo el JSON serializado;
  persistencia en `.sdd-studio/attachments/<sha256>.<ext>`.
- Decisión del dev (2026-10-23): `@archivo` pasa la ruta, no el contenido.
- Decisión del dev (2026-10-23): `@agente` = delegar en ese subagente; `/skill` = instruir al agente a
  usar esa skill; descubrimiento desde `.claude/skills`, `.claude/agents`, `sdd/skills`, `sdd/agents`.
- Decisión del dev (2026-10-23): SPECS muestra todas las specs (incluidas completadas); FIXES muestra
  los abiertos + los últimos cerrados; asociación hilo↔ciclo/fix automática al crear (spec del canal +
  ciclo in-progress o fix abierto), reasignable desde el hilo; hilos previos se asocian por canal.
- Decisión del dev (2026-10-23): "Always" por herramienta (Edit/Write/MultiEdit/NotebookEdit), por
  tool puntual (MCP `mcp__srv__tool`) y por prefijo de comando (Bash); vale mientras viva el hilo en
  el puente (en memoria). Los `warn` del SPEC GATE siguen preguntando siempre; los `deny` bloquean.

## Requisitos Funcionales (RF)

- RF-1: El Composer acepta adjuntos por pegado, drag & drop y selector de archivo: imágenes
  png/jpg/webp/gif, PDF y texto/código/markdown; preview con quitar; máximo 5 por mensaje.
- RF-2: Las imágenes se redimensionan (lado mayor ≤ 1568 px) y recomprimen en el navegador; el
  mensaje serializado completo debe entrar en el frame de 1 MiB, si no, error claro y no se envía.
- RF-3: El puente entrega imágenes como bloques `image`, PDF como bloques `document` y texto como
  contenido textual del mensaje del usuario al Claude Agent SDK.
- RF-4: Los adjuntos se persisten por hash (`.sdd-studio/attachments/<sha256>.<ext>`) y la timeline
  los muestra en vivo y al recargar el historial del hilo.
- RF-5: `@` en el Composer abre un menú con archivos del repo (búsqueda) y agentes; elegir un archivo
  inserta su ruta y el agente recibe la ruta para leerla él.
- RF-6: `@agente` instruye delegar en ese subagente; `/` lista los comandos existentes más las
  skills/prompts del kit, y `/skill` instruye al agente a usar esa skill. Skills y agentes se
  descubren del repo.
- RF-7: El Sidebar tiene secciones SPECS (todas las specs → ciclos → conversaciones) y FIXES (abiertos
  + últimos cerrados → conversaciones), además de CANALES y AGENTES.
- RF-8: Cada hilo se asocia automáticamente a spec+ciclo o fix al crearse, puede reasignarse desde el
  hilo, y los hilos previos se asocian por canal.
- RF-9: Todas las secciones y subsecciones del menú son colapsables/expandibles.
- RF-10: "Always" aplica por herramienta a Edit/Write/MultiEdit/NotebookEdit, por tool puntual a MCP
  y por prefijo de comando a Bash, durante la vida del hilo en el puente; la tarjeta muestra la regla.
- RF-11: Los `warn` del SPEC GATE siempre preguntan y los `deny` siempre bloquean, haya o no "Always".
- RF-12: El Sidebar muestra los hilos activos (`running`, `waiting-approval`, `queued`) con navegación.
- RF-13: Indicadores animados de trabajo (typing dots / shimmer / spinner) en el hilo, en la lista de
  hilos y en el avatar del agente, distinguiendo "corriendo" de "esperando aprobación".
- RF-14: Se corrigen los problemas de scroll detectados (autoscroll de timeline/hilo, paneles, overflow
  del sidebar).
- RF-15: Se puede enviar un mensaje a un hilo `running`/`waiting-approval` sin interrumpirlo; queda
  encolado en el puente.
- RF-16: La sesión entrega los mensajes encolados al modelo en el próximo punto de corte del turno
  (después del tool en curso), no al terminar el turno completo, vía prompt streaming del SDK.
- RF-17: La UI muestra los mensajes encolados con estado pendiente → entregado y permite editarlos o
  quitarlos mientras estén pendientes; un mensaje entregado ya no se edita.
- RF-18: CANALES no lista los canales `spec:*` (solo bajo SPECS).
- RF-19: El Composer conserva por hilo, en memoria, el borrador de texto y adjuntos al cambiar de hilo.
- RF-20: Toda imagen adjunta se re-encodea en el cliente, eliminando metadatos EXIF/GPS.

## Requisitos No-Funcionales (RNF)

- RNF-1: Cambios de protocolo validados con zod en ambos extremos; incremento de `PROTOCOL_VERSION`
  si no son retrocompatibles (el handshake exige igualdad).
- RNF-2: La web sigue siendo static export y zero-credentials.
- RNF-3: Un frame que exceda el límite nunca corta la conexión sin feedback.
- RNF-4: El JSONL del hilo no guarda el binario de los adjuntos (solo referencia por hash).
- RNF-5: La búsqueda de archivos y la lectura de adjuntos respetan `safePathWithinRoot`.
- RNF-6: Animaciones respetan `prefers-reduced-motion`.
- RNF-7: La cola de mensajes no se pierde ni se duplica ante interrupt, error o fin de turno; si el
  turno termina con mensajes pendientes, se entregan como el siguiente turno.
- RNF-8: Tests vitest en los tres subproyectos para cada contrato y comportamiento nuevo;
  `pnpm typecheck && pnpm test` en verde.

## Dependencias

- Subproyectos: `apps/studio`, `apps/studio-bridge`, `libs/studio-protocol`
- Sin specs previas. Convive con `FIX-e-burgos-002` (modo `bypassPermissions`, en curso):
  `PermissionModeChoice` ya incluye `bypassPermissions`.
- Externa: `@anthropic-ai/claude-agent-sdk` 0.3.292 (prompt como stream de `SDKUserMessage` con
  content blocks `image`/`document`/`text`).

## Criterios de Aceptación

- CA-001: Pegar, arrastrar o elegir una imagen, un PDF o un `.md` los muestra en preview; quitar los
  descarta; un sexto adjunto se rechaza.
- CA-002: Una imagen de 8 MB se envía recomprimida (≤ 1568 px) dentro del frame y el modelo la recibe
  como bloque `image`; un PDF llega como bloque `document`.
- CA-003: Tras recargar, el hilo muestra los adjuntos enviados (servidos desde `.sdd-studio/attachments`).
- CA-004: `@` busca archivos del repo; el mensaje enviado contiene la ruta, no el contenido.
- CA-005: `@agente` y `/skill` se ofrecen desde lo descubierto en el repo y producen la instrucción
  de delegación / uso de skill en el prompt.
- CA-006: SPECS lista todas las specs con sus ciclos y las conversaciones de cada ciclo; FIXES lista
  abiertos + últimos cerrados con sus conversaciones; un hilo nuevo aparece bajo el ciclo in-progress
  de su spec y puede reasignarse.
- CA-007: Cada sección del menú se colapsa y expande.
- CA-008: "Always" sobre Edit evita la tarjeta en las siguientes Edit del hilo; sobre `mcp__srv__tool`
  solo para esa tool; sobre Bash para comandos con el mismo prefijo.
- CA-009: Un `warn` del gate vuelve a preguntar y un `deny` bloquea aunque exista "Always".
- CA-010: Los hilos `running`/`waiting-approval`/`queued` aparecen en el Sidebar en vivo y un clic abre el hilo.
- CA-011: Mientras un agente corre o espera aprobación se ven los indicadores en hilo, lista y avatar.
- CA-012: El hilo hace autoscroll al fondo salvo que el usuario haya scrolleado hacia arriba; sidebar y
  paneles scrollean sin cortar contenido.
- CA-013: Con un hilo `running`, enviar un mensaje no interrumpe el turno; el mensaje aparece como
  pendiente y pasa a entregado cuando el modelo lo recibe tras el tool en curso, antes del fin del turno.
- CA-014: Un mensaje pendiente puede editarse y quitarse; uno entregado no.
- CA-015: Si el turno termina o se interrumpe con mensajes pendientes, no se pierden: se entregan como
  el siguiente turno (o quedan pendientes y visibles tras el interrupt).
- CA-016: CANALES no muestra `spec:*`; al volver a un hilo, el borrador previo está intacto; una imagen
  con EXIF/GPS llega al modelo sin esos metadatos.
