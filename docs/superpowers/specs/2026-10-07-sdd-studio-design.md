# SDD Studio — diseño (v1)

> Fecha: 2026-10-07 · Estado: aprobado en brainstorming, pendiente de revisión escrita
> Alcance de este documento: sub-proyectos **A (puente local)** y **B (web Slack-like)**.
> Sub-proyectos C (paridad con el visor) y D (telemetría en vivo en el kit) tendrán su propia spec.

## 1. Objetivo

Una aplicación web, estilo Slack, que sea el **centro de operación** de un repo que tiene
instalado el kit SDD. El repo es la "organización"; los 8 agentes del kit son los "miembros".
Desde la app el usuario:

- envía prompts y conversa con el Orchestrator (que delega) o directamente con un agente (DM);
- ve en tiempo real qué agente/subagente está trabajando, en qué spec/ciclo, con qué
  herramienta, modelo, esfuerzo, tokens y costo;
- ve el progreso de specs, ciclos, tasks y fixes a medida que cambian en `sdd/`;
- aprueba o deniega las acciones de los agentes (ediciones, comandos) desde el chat;
- elige modelo, esfuerzo y modo de permisos según los tiers que define el kit;
- corre los scripts del kit (`sdd:gate`, `sdd:validate`, `rebuild-*`) sin salir de la app.

Sin depender de VS Code ni de otro cliente para promptear.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Despliegue | Web hosteada + puente local en la máquina del usuario |
| Usuarios v1 | Un humano por puente + los agentes. Sin backend compartido |
| Ruteo | Orchestrator que delega (por defecto) + DMs directos a cualquier agente |
| Permisos | Aprobación interactiva en el chat (`canUseTool`) |
| Historial | `.sdd-studio/` en el repo, auto-ignorada |
| Motor | Claude Agent SDK detrás de una interfaz `AgentEngine` |
| Web | Next.js (App Router) en Cloudflare vía OpenNext |
| Kit | **Sin cambios** en `apps/cli/templates/sdd/` durante la v1 |

### Descartado y por qué

- **LangChain/LangGraph**: no entiende el formato del kit (agentes, skills, `CLAUDE.md`,
  hooks); habría que reimplementar herramientas, subagentes y permisos, y exige API key.
- **Parsear `claude -p` a mano**: reinventa lo que el Agent SDK ya resuelve tipado.
- **PTY sobre Claude Code interactivo**: frágil, sin eventos estructurados.
- **Servidor remoto con el repo clonado**: contradice el uso de la suscripción local.
- **Puente dentro de `@e-burgos/sdd-harness`**: sumaría `ws` y procesos largos a la CLI.

## 2. Estructura en el monorepo

```
apps/studio/            Next.js (App Router) → Cloudflare (OpenNext). Paquete privado.
apps/studio-bridge/     Puente Node → npm `@e-burgos/sdd-studio` (bin `sdd-studio`).
libs/studio-protocol/   Tipos + esquemas zod de comandos/eventos. Privado; se empaqueta
                        dentro de los otros dos.
```

`pnpm-workspace.yaml` suma `libs/*`. Los scripts raíz (`build`, `test`, `typecheck`) dejan de
filtrar sólo la CLI.

## 3. Arquitectura y conexión

```
Navegador ─ apps/studio (Next.js en Cloudflare)
   │  workspace = client component; route handlers reservados p/ auth/equipos futuros
   │  WS 127.0.0.1:4320 · eventos tipados (libs/studio-protocol)
   ▼
Máquina del usuario ─ @e-burgos/sdd-studio
   ├─ WorkspaceReader + watcher de sdd/
   ├─ AgentEngine (interfaz)
   │    ├─ ClaudeAgentSdkEngine → query() por hilo, settingSources: ['project']
   │    │    · canUseTool → aprobación en el chat + SPEC GATE
   │    │    · hooks SubagentStart/SubagentStop/PreToolUse → presencia
   │    │    · resume, model, effort, agente principal (DMs)
   │    └─ FakeEngine (tests y `--engine=fake`)
   ├─ AuthMode: local-claude-login | api-key (visible en la UI)
   ├─ CommandRunner (allowlist de scripts del kit)
   └─ Store .sdd-studio/
```

### 3.1 Arranque

1. `npx @e-burgos/sdd-studio` en la raíz del repo (opciones: `--port`, `--allow-origin`,
   `--engine`, `--local-ui`, `--no-open`).
2. Verifica que exista `sdd/` (si no, sale con mensaje y código ≠ 0) y detecta el modo de
   auth: `api-key` si hay `ANTHROPIC_API_KEY`, si no `local-claude-login`.
3. Levanta el WS en `127.0.0.1:4320` (siguiente puerto libre si está ocupado).
4. Genera un token de emparejamiento aleatorio (32 bytes, base64url) y abre
   `https://studio.sdd.estebanburgos.com.ar/w#bridge=<port>&token=<token>`.
   El token viaja en el fragmento: nunca llega al servidor web.

### 3.2 Seguridad

Un puerto local que ejecuta Claude con permisos sobre el repo es un blanco atractivo:

- bind exclusivo a loopback;
- `Origin` validado contra allowlist (producción + `http://localhost:*` de desarrollo +
  `--allow-origin`);
- token obligatorio en el `hello`; rota en cada arranque; la web lo guarda sólo en
  `sessionStorage`;
- el puente **no lee, guarda ni transmite credenciales**; sólo informa el modo de auth;
- `workspace.readFile` limitado a `sdd/` con la misma protección que `sdd/docs/serve.mjs`
  (sin `..`, sin dotfiles, sin symlinks que escapen);
- `command.run` con allowlist fija; no hay shell arbitrario desde el cliente.

### 3.3 Multi-repo y fallos de conexión

- Un puente = un repo. Otro repo levanta otro puente en otro puerto; la web los lista como
  workspaces (guardados en `localStorage`, sin token).
- Sin puente: pantalla "Conectá tu repo" con el comando para copiar.
- WS caído: reconexión con backoff exponencial (máx. 30 s); las sesiones siguen vivas en el
  puente.
- Fallback de navegador (si HTTPS → `ws://127.0.0.1` está bloqueado, p. ej. Safari):
  `--local-ui` sirve un export estático de la ruta del workspace en `http://127.0.0.1:<port>/`.

## 4. Modelo Slack

```
┌──────────────────┬──────────────────────────────────────────┬─────────────────────┐
│ ▣ mi-repo        │ # spec-003-pagos   ● in-progress  ▓▓▓░ 6/9│ Actividad · Detalles│
│ bridge ● · login │──────────────────────────────────────────│ ▸ hilo "pagos v2"   │
│ CANALES          │ 📌 cycle-02 · full · 6/9 tasks           │   Orchestrator ⟳    │
│ # general        │ Vos: abrí el ciclo 2 para refunds        │   ├ Planner ✓ 2m    │
│ # spec-001-auth ✓│   └ 12 respuestas · Orchestrator, Planner│   └ Impl-back ⟳     │
│ # spec-003-pagos●│ sdd-bot: Gate B ✅ cycle-02 (full)        │      Edit api.ts    │
│ # fixes          │ ┌ Aprobación ─────────────────────────┐  │      sonnet·medium  │
│ AGENTES          │ │ Impl-back quiere: pnpm nx test api  │  │ Tasks cycle-02      │
│ ● Orchestrator   │ │ [Aprobar] [Denegar] [Siempre (hilo)]│  │ ✓ BE-001 ✓ BE-002   │
│ ○ Planner …      │ └─────────────────────────────────────┘  │ ▸ BE-004 · FE-001   │
│ VISTAS (futuro)  │ [Mensaje…  /gate /validate]              │                     │
│ ▤ Dashboard …    │ Orchestrator ▾  kit ▾  medium ▾ default ▾│                     │
└──────────────────┴──────────────────────────────────────────┴─────────────────────┘
```

- **Workspace** = repo (`global.json → project`). Encabezado: estado del puente, modo de
  auth, versión del kit (`kit.json`).
- **Canales** (derivados, no persistidos):
  - `#general` — Orchestrator: ideas, specs nuevas (flujo Hermes), preguntas de estado.
  - `#spec-NNN-slug` — uno por entrada de `specs/index.json`, con badge de estado;
    completados/archivados colapsados; el ciclo `in-progress` fijado como tarjeta de progreso
    (`metrics.tasks_completed / tasks_total`).
  - `#fixes` — fixes y hotfixes (flujo `hotfix-bypass-gate`).
- **Hilos**: cada prompt raíz abre un hilo = una sesión del motor. Concurrencia: libre entre
  specs distintos; **una sola sesión con escritura por spec** (las demás quedan `queued` o se
  ofrecen en modo `plan`). `#general` y `#fixes` cuentan como un "spec" cada uno a efectos de
  esta regla.
- **Miembros**: los 8 agentes (`sdd/agents/sdd-*.agent.md`: orchestrator, functional,
  planner, architect, implementor-back, implementor-front, reviewer, steward), con avatar y
  color propios. Presencia: ⟳ trabajando (spec · ciclo · herramienta), ⏸ esperando
  aprobación, ● sesión abierta, ○ inactivo.
- **DMs**: sesión con ese agente como principal.
- **Atribución de subagentes**: un mensaje con `parent_tool_use_id` se atribuye al
  `subagent_type` de la llamada `Agent` que lo originó; en el hilo "habla el Planner".

### 4.1 Tipos de mensaje

| Tipo | Origen |
|---|---|
| Usuario | composer |
| Agente (markdown) | motor |
| Actividad de herramientas | motor; agrupada y colapsable ("editó 3 archivos · corrió 2 comandos"), diffs para Edit/Write |
| Aprobación | `canUseTool`; diff o comando; Aprobar / Denegar (con motivo que vuelve al agente) / Siempre en este hilo |
| sdd-bot | watcher de `sdd/`: spec nuevo, ciclo abierto/cerrado, task cambia de estado, fix nuevo/cerrado, resultado de gate/validate |
| Pie de uso | fin de turno: modelo, esfuerzo, tokens, costo (`sdd/pricing.json`) |

### 4.2 Composer

- Agente: Orchestrator por defecto; fijo en DMs.
- Modelo: `kit` (el agente decide según AGENTS.md) · `haiku` · `sonnet` · `opus` · `fable`.
- Esfuerzo: `low` · `medium` · `high` · `xhigh` · `max` (deshabilitado con modelo `kit`).
- Permisos: `default` · `acceptEdits` · `plan`.
- El override de modelo/esfuerzo aplica a la **sesión principal**; los subagentes respetan el
  `model` de su frontmatter.
- Slash: `/gate [spec] [cycle]` y `/validate` corren scripts (sin tokens); `/new-spec`,
  `/open-cycle`, `/review`, `/hotfix` envían los prompts del kit (`sdd/prompts/*.prompt.md`).

### 4.3 SPEC GATE en la app

`canUseTool` aplica la regla de `sdd-mod` (`judgeEdit`): Edit/Write/NotebookEdit sobre un
archivo fuera de `sdd/` sin ciclo `in-progress` ni fix abierto → `block` (deniega con motivo)
o `warn` (pide aprobación con advertencia), según `sdd/tools.json → claude_mod.gate`
(default `block`). Si `sdd/` no se puede leer, no bloquea (mismo criterio que el mod).

### 4.4 Panel derecho

- **Actividad**: árbol vivo sesión → subagentes, con herramienta actual, duración, tokens,
  costo.
- **Detalles**: tarjeta del ciclo (flow, objetivos, apps) + checklist de tasks en vivo.

## 5. Protocolo (`libs/studio-protocol`)

JSON sobre WS, esquemas zod compartidos, `protocolVersion` entero.

- **Handshake**: `hello {token, protocolVersion, clientVersion}` →
  `welcome {workspace, kitVersion, bridgeVersion, authMode, capabilities}` o
  `error {code: 'bad-token' | 'protocol-mismatch', ...}`.
- **Comandos** (cliente → puente, con `id`; respuesta `result {id, ok, data | error}`):

| Comando | Efecto |
|---|---|
| `workspace.snapshot` | global, specs, ciclos, tasks, fixes, agentes, pricing, tools |
| `workspace.readFile {path}` | contenido de un archivo bajo `sdd/` |
| `thread.create {channelId, agent, model, effort, permissionMode, text}` | crea hilo + sesión |
| `thread.send {threadId, text}` | nuevo turno (con `resume`) |
| `thread.interrupt {threadId}` | corta el turno en curso |
| `thread.setOptions {threadId, model?, effort?, permissionMode?}` | aplica desde el próximo turno |
| `thread.list {channelId}` / `thread.history {threadId, sinceSeq}` | índice / replay |
| `approval.respond {approvalId, decision, reason?, scope: 'once' \| 'thread'}` | resuelve `canUseTool` |
| `command.run {name: 'gate' \| 'validate' \| 'rebuild-tasks-index' \| 'rebuild-catalog', args}` | corre script del kit |

- **Eventos** (puente → cliente):
  - `thread.event {threadId, seq, event}` con `event` normalizado:
    `message.start|delta|end {messageId, author: {agent, parentToolUseId?}}`,
    `tool.start|end {toolUseId, author, tool, summary, diff?, isError?}`,
    `subagent.start|stop {agentId, agentType, parentToolUseId}`,
    `approval.requested|resolved`,
    `turn.end {usage: {model, effort, tokensIn, tokensOut, costUsd}}`,
    `session.status {status: queued|running|waiting-approval|idle|interrupted|error, error?}`.
  - `presence.changed {agent, state, threadId?, specId?, tool?}`.
  - `workspace.changed {areas, slices}` (sólo áreas modificadas).
  - `bot.event {channelId, kind, payload}`.
  - `command.output {runId, stream, chunk}` / `command.exit {runId, exitCode}`.

La web nunca ve tipos del Agent SDK: el mapeo SDK → evento normalizado vive en
`ClaudeAgentSdkEngine`.

## 6. Datos y persistencia

### 6.1 Watcher de `sdd/`

chokidar con debounce ~200 ms → recalcula fingerprint por área (misma partición que
`__state` de `serve.mjs`: global, tasks, fixes, specs, …) → diff snapshot anterior/nuevo →
eventos de sdd-bot + `workspace.changed`. JSON inválido a mitad de escritura: se conserva el
último snapshot válido, el área se marca `stale` y se reintenta en el siguiente cambio.

### 6.2 `.sdd-studio/`

```
.sdd-studio/
  .gitignore            "*"  (se auto-ignora; no se toca el .gitignore del repo)
  threads.json          [{id, channelId, title, agent, engineSessionId, options,
                          createdAt, lastActivity}]
  threads/<id>.jsonl    eventos normalizados, append-only, con seq
  settings.json         defaults del workspace (modelo, esfuerzo, permisos)
```

### 6.3 Escrituras en `sdd/`

El puente **nunca escribe** en `sdd/` directamente: sólo los agentes (vía aprobaciones) y los
scripts de la allowlist. La telemetría `usage` la siguen registrando los agentes según las
reglas del kit; la app sólo muestra el uso en vivo que reporta el motor.

## 7. Errores

| Situación | Comportamiento |
|---|---|
| Sin login / sin API key | banner con acción concreta ("corré `claude login`") |
| Límite de uso / rate limit | sesión `error` con motivo y horario de reset si el SDK lo da |
| WS caído | sesiones y aprobaciones siguen en el puente; replay por `thread.history` desde el último `seq` |
| Puente reiniciado | sesiones en curso → `interrupted`; se retoman con `resume`; aprobaciones pendientes se pierden con aviso en el hilo |
| Aprobación sin respuesta | no vence; agente ⏸ hasta responder o interrumpir |
| Versión incompatible | pantalla "actualizá el puente" con el comando |
| `sdd/` inexistente | el puente no arranca; mensaje indicando instalar el kit con `harness init` |

## 8. Testing

- **studio-protocol**: round-trip de cada esquema; rechazo de payloads inválidos.
- **studio-bridge** (vitest):
  - `FakeEngine` → SessionManager, aprobaciones, regla de escritura por spec, persistencia y
    replay, SPEC GATE en `canUseTool`;
  - watcher sobre copia temporal de `examples/viewer-costs-check` (mutaciones → eventos de
    sdd-bot; JSON inválido → `stale`);
  - seguridad: `Origin` ajeno, sin token, path traversal/symlink en `readFile`, comando fuera
    de allowlist → rechazados;
  - `ClaudeAgentSdkEngine`: mapeo con streams reales grabados como fixtures jsonl;
  - smoke e2e real opt-in (`SDD_STUDIO_E2E=1`, haiku/low, ejemplo generado). Fuera de CI.
- **studio** (web): vitest + Testing Library para el store (evento → estado) y componentes
  clave (aprobación, hilo con subagentes, composer); Playwright contra el puente con
  `--engine=fake` (conectar → hilo → subagentes hablan → aprobar → mutar fixture → evento
  sdd-bot).
- **CI**: `ci.yml` suma build/typecheck/test de los tres paquetes; el puente en ubuntu +
  windows.

## 9. Despliegue y versionado

- **Web**: `@opennextjs/cloudflare` → Cloudflare Workers en `studio.sdd.estebanburgos.com.ar`;
  workflow `deploy-studio.yml` disparado por cambios en `apps/studio/**` o
  `libs/studio-protocol/**`.
- **Puente**: `@e-burgos/sdd-studio` en npm, versión propia; tag `studio-v*` publica
  (separado de los `v*` de la CLI). Build esbuild que empaqueta `studio-protocol`. Node ≥ 20.
  Dependencias principales: `@anthropic-ai/claude-agent-sdk` (versión fijada), `ws`, `chokidar`,
  `zod`.
- **Compatibilidad**: la web declara el rango de `protocolVersion` aceptado.
- **Docs**: página "Studio" (es/en) en `apps/documentation` + README por app.

## 10. Alcance

**Entra en v1 (A + B):** todo lo descripto en §3–§9, i18n es/en desde el arranque.

**Fuera (sub-proyectos siguientes):**
- C — paridad con el visor: Dashboard, Planning, Costos, Contexto, Memoria,
  Agentes/Skills/Prompts, Arquitectura, Ayuda (en v1 sólo el lugar reservado en la sidebar);
- D — telemetría en vivo dentro del kit (hooks en `templates/sdd/`);
- backend en la nube: auth, equipos, multi-humano, historial compartido;
- otros motores (Copilot, Gemini);
- forzar tier de subagentes, búsqueda en mensajes, notificaciones de escritorio, layout mobile
  (sólo responsive básico).

## 11. Riesgos

La primera tarea del plan es un **spike** que verifica 2–4 antes de construir encima.

1. **Política de Anthropic sobre login de suscripción.** La doc del Agent SDK indica que, sin
   aprobación previa, terceros no pueden ofrecer login de claude.ai ni sus rate limits en sus
   productos. Mitigación: el modo de auth es explícito y visible; el modo API key está
   soportado; **antes de cualquier release público con modo suscripción, consultar a
   Anthropic.** Decisión del dueño del proyecto.
2. **HTTPS → `ws://127.0.0.1`** bloqueado en algunos navegadores (Safari; prompt de Local
   Network Access en Chrome). Mitigación: `--local-ui`.
3. **Superficie del Agent SDK**: confirmar opción de esfuerzo, campos de hooks
   (`agent_type`, `agent_id`), atribución por `parent_tool_use_id`, interrupción y `resume`;
   fijar versión.
4. **OpenNext + versión de Next.js** en Cloudflare.

## 12. Política de modelo/esfuerzo para construir esto

Según la regla del kit (AGENTS.md § Selección de modelo y esfuerzo): implementación de tasks
acotadas en `sonnet`/`medium`; spike, protocolo, `ClaudeAgentSdkEngine` y SPEC GATE en
`opus`/`high`; lecturas, scaffolding mecánico y formateo en `haiku`/`low`; verificación
adversarial final en `opus`/`high`.
