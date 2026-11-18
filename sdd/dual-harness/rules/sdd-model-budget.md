---
trigger: always_on
description: Presupuesto de modelo y esfuerzo por tarea (regla obligatoria de optimización de tokens) y CONTRATO CANÓNICO de telemetría de costos — quién registra qué, cuándo y de dónde sale el número en cada arnés
---

# ⚙️ Presupuesto de modelo/esfuerzo (OBLIGATORIO)

Antes de encarar CUALQUIER tarea nueva —con cualquier proveedor o modelo— decidí explícitamente
qué tier de modelo y qué nivel de razonamiento conviene, para el trabajo propio y para CADA
subagente/workflow que dispares. Objetivo: el mínimo de tokens y contexto sin bajar la calidad.

**Regla base:** el tier más barato que aún cumple la tarea con calidad. Escalá solo cuando la
tarea lo justifique (ambigüedad, razonamiento cross-cutting, riesgo de error alto). Ante la duda
entre dos tiers, probá el más barato primero y escalá si el resultado no alcanza.

**Tabla canónica de tiers por proveedor** (única fuente de equivalencias — skills y agentes SDD
referencian estos tiers abstractos, no modelos concretos):

| Tier          | Tipo de tarea                                                                                     | Claude (`model`/`effort`) | Gemini (modelo/`thinking`)          | Copilot (picker/agents)               |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------- | ------------------------------------- |
| **económico** | Lectura de estado, formateo, edición mecánica, respuestas cortas, grep dirigido, fan-out de lectores | `haiku` / `low`–`medium`  | Flash-Lite o Flash / `minimal`–`low` | modelo económico (ej. `gpt-5-mini`)   |
| **estándar**  | Implementación de una task acotada, tests, edición multi-archivo simple, la mayoría de subagentes ejecutores | `sonnet` / `medium`       | Flash / `medium`                   | modelo estándar (ej. `claude-sonnet`) |
| **alto**      | Arquitectura, decisiones cross-cutting, debugging complejo, orquestación SDD, revisión final del ciclo, síntesis | `opus` / `high`–`xhigh`   | Pro / `low`–`high`                 | modelo alto (ej. `claude-opus`)       |
| **máximo**    | Solo con justificación escrita de por qué «alto» no alcanza (diseño crítico sin precedente, trade-offs entre muchos subsistemas, verify/judge adversarial) | `fable` / `xhigh`–`max`   | Pro / `high`                       | el tier más alto habilitado           |

**Máximo no es el default del trabajo difícil:** antes de elegirlo, escribí «máximo o alto» y el
motivo por el que alto no alcanza. Ningún subagente va en máximo sin esa justificación.

**Agentes del ciclo SDD (cualquier proveedor):** implementores → estándar; orquestador,
arquitecto y reviewer → alto (razonamiento y visión global); funcional/planner → estándar salvo
spec compleja. En un ciclo `flow: lite` el único actor trabaja en **alto** para `plan.md` y baja a
**estándar** para las tasks. Trabajo propio trivial: bajá el esfuerzo.

**Enforcement por proveedor:**

- **Claude Code:** `model` y `effort` explícitos en cada `Agent` y `Workflow`, acordes a la tabla;
  fan-out de lectores/mecánicos en económico, verificación o síntesis en alto. Nunca un fleet
  entero en el tier caro por defecto.
- **GitHub Copilot:** los agentes (`.github/agents/*.agent.md`) llevan `model:` pinneado por rol.
  El kit lo shippea con alias Claude (`opus`/`sonnet`); si tu equipo trabaja en Copilot, mapealo UNA
  vez al modelo del MISMO tier disponible en tu org editando `sdd/agents/*.agent.md` (nunca el
  symlink) y no lo cambies ad-hoc. Copilot CLI: `--model` / `/model` y `--reasoning-effort`; en
  chat/coding agent, verificá el modelo del picker antes de ejecutar.
- **Antigravity (dropdown del usuario):** el agente no puede cambiar el modelo. ANTES de ejecutar,
  comparar el activo con el tier requerido: si una tarea económica va a correr en Pro/`high`, o una
  de tier alto en Flash, **avisar y pedir el cambio de modelo o de thinking level** — nunca ejecutar
  en silencio con el tier equivocado.
- **Gemini CLI:** modelo por sesión/flag acorde al tier; fan-out de lectores en subagentes
  económicos, síntesis en Pro; `/stats` da el consumo real del main loop.

# Telemetría de uso (dashboard de Costos) — CONTRATO CANÓNICO, OBLIGATORIO

> Este es el contrato completo (v0.11.0). Los arneses raíz lo resumen y apuntan acá; se
> lee **al cerrar** una unidad de trabajo, no al abrir la sesión.

Todo agente que participe de un flujo SDD o de un fix y consuma tokens registra, al **cerrar
su unidad de trabajo** (task, documento, ciclo, fix), `provider_model` (`claude/sonnet`,
`gemini/pro`, `copilot/claude-sonnet`), `effort`/thinking, `tokens_in`, `tokens_out`, `source`
y `approx`. Sin ese registro la unidad no está cerrada. Modelo y effort se declaran ANTES de
ejecutar (regla cero); los tokens se registran AL CERRAR. No es una estimación reconstruida al
final: es un registro por unidad.

**Quién escribe qué, y cuándo:**

- **Task** → `tasks.json → tasks[].usage` (quien la ejecuta, al cerrarla):
  `{provider_model, effort, tokens_in, tokens_out, approx, source, recorded_at, agent,
  tokens_total?}`. `model_tier` es el alias legacy — se lee, no se escribe.
- **Documentos** functional/planner/architect (o `plan.md` en `lite`) → una entrada en
  `cycle.json → metrics.usage.by_agent[]` al terminar el documento. El orquestador crea
  `metrics` con contadores en 0 y `usage: {tokens_in: 0, tokens_out: 0, by_agent: []}` al
  abrir el ciclo.
- **Ciclo** → el reviewer **consolida `by_agent`, no estima el total**: `by_agent[]` = una
  entrada por unidad `{agent, label?, provider_model, effort, tokens_in, tokens_out,
  tokens_total?, approx, source, recorded_at}`; `by_tier` se **deriva** de `by_agent`
  agrupando por `provider_model` (no se llena a mano); el top-level es la suma. El reviewer
  agrega su propia entrada (la revisión también consume tokens) y no cierra el ciclo sin
  `by_agent` completo y la suma consistente. En `flow: lite`, plan + revisión van en **una**
  entrada `agent: "orchestrator"`, `label: "solo"`.
- **Fix** → `sdd/fixes.json → fixes[].usage`, mismos campos; si trabajaron varios agentes,
  `by_agent[]` con una entrada por agente. El FIX GATE no cierra un fix sin `usage`.
- `agent` ∈ `functional | planner | architect | implementor-back | implementor-front |
  reviewer | orchestrator | steward | hermes | custom`.

**Declarar proveedor y modelo no es opcional.** El modelo siempre se conoce: es el que estás
usando. De dónde sale el número de tokens:

| Arnés                                             | Fuente                                                                                                                                                   | `source`                    | `approx` |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| Claude Code — subagente vía tool `Agent`          | notificación al padre al terminar: `<usage><subagent_tokens>N</subagent_tokens>…</usage>` — exacta, sin pedirle nada al dev; `tokens_total: N`, split por defecto 85/15 en in/out. **Al reanudar el mismo subagente con `SendMessage`, `N` es el acumulado del agente desde que se lanzó, no lo de esa task: registrar `N − N_anterior`** | `agent-usage-notification`  | `false`  |
| Claude Code — main loop                           | reporte de uso de la sesión (comando del cliente: se lo pide al dev)                                                                                     | `session-report`            | `false`  |
| Gemini CLI — main loop                            | `/stats` (comando del cliente)                                                                                                                           | `stats-command`             | `false`  |
| Gemini CLI — subagentes                           | sin reporte separado → estimación declarada                                                                                                              | `declared-estimate`         | `true`   |
| GitHub Copilot (CLI, coding agent, custom agents) | sin contador → estimación declarada                                                                                                                      | `declared-estimate`         | `true`   |
| Antigravity                                       | sin contador → estimación declarada (registra bajo `gemini/*`)                                                                                           | `declared-estimate`         | `true`   |

> `/stats` solo cubre el **main loop** de Gemini CLI; sus subagentes van con estimación
> declarada. Antigravity registra bajo `gemini/*` — corre modelos Gemini.

**Sin contador se estima; no se omite.** `/stats` y el reporte de sesión son comandos del
cliente: un agente no puede ejecutarlos (pedíselos al dev). Lo prohibido es inventar un número
preciso y presentarlo como medido: `approx: false` con `source: declared-estimate` es **ERROR**
del validador.

**Reglas del validador (`pnpm sdd:validate`):** error si un ciclo `completed` (con
`completed_at` ≥ 2026-09-02) o un fix resuelto (`resolved_at` ≥ 2026-09-02) no tiene `usage`
con proveedor/modelo y tokens; warning si falta `by_agent` o `sum(by_agent) ≠ by_tier`;
registros anteriores a esa fecha: warning, no error.

Alimenta la vista **Costos** del visor SDD (comparativa contra la estimación tradicional de
las tasks); las tarifas por proveedor se editan en `sdd/pricing.json`.
