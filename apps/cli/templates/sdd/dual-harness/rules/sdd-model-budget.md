---
trigger: always_on
description: Presupuesto de modelo y esfuerzo por tarea (regla obligatoria de optimización de tokens) y registro de telemetría de costos
---

# ⚙️ Presupuesto de modelo/esfuerzo (OBLIGATORIO)

Antes de encarar CUALQUIER tarea: decidir explícitamente qué tier de modelo y qué
nivel de razonamiento conviene, para el trabajo propio y para cada subagente que se
dispare. Regla base: **el tier más barato que aún cumple con calidad**; escalar solo
con justificación. Tabla canónica completa: `GEMINI.md` raíz, sección ⚙️.

| Tier          | Tarea típica                                             | Gemini (modelo/thinking)             |
| ------------- | -------------------------------------------------------- | ------------------------------------ |
| **económico** | lectura, formateo, edición mecánica, grep, fan-out       | Flash-Lite o Flash / `minimal`–`low` |
| **estándar**  | implementación de una task, tests, edición multi-archivo | Flash / `medium`                     |
| **alto**      | arquitectura, debugging complejo, orquestación, review   | Pro / `low`–`high`                   |
| **máximo**    | solo el paso más difícil (verify adversarial, judge)     | Pro / `high`                         |

Agentes del ciclo SDD: implementores → estándar; orquestador/arquitecto/reviewer →
alto; funcional/planner → estándar salvo spec compleja.

**En Antigravity el modelo lo elige el usuario en el dropdown.** ANTES de ejecutar,
comparar el modelo activo con el tier requerido: si no coinciden (tarea económica por
correr en Pro/high, o tarea de tier alto en Flash), **avisar y pedir el cambio de
modelo o thinking level** — nunca ejecutar en silencio con el tier equivocado.

**En Gemini CLI:** modelo por sesión/flag acorde al tier; fan-out de lectores en
subagentes económicos, síntesis en Pro; `/stats` da el consumo real.

## Telemetría (dashboard de Costos)

Al cerrar cada ciclo: `cycle.json → metrics.usage` con `tokens_in`/`tokens_out` y
`by_tier` con claves `proveedor/modelo` (`gemini/pro`, `gemini/flash`,
`claude/opus`, `copilot/gpt-5-mini`). Por task: `tasks.json → usage.model_tier`.
Todo fix: `usage` en `sdd/fixes.json`. En Gemini CLI el número sale de `/stats`; en
Antigravity, aproximación declarada. Una aproximación honesta vale; un número
inventado no — ante la duda, omitir. Tarifas editables en `sdd/pricing.json`.
