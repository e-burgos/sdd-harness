---
trigger: model_decision
description: Estructura del workspace - chequeo de inicio de sesión (nx.json, pnpm-workspace.yaml, .npmrc, .nxignore), invariantes de pnpm/Nx, guías de Nx, scaffolding y superficies de Antigravity/Gemini CLI. Leelo en la primera acción de trabajo de la sesión o al crear apps/libs.
---

# 🚀 Estructura del workspace — skill `init-nx-workspace` (AL INICIAR SESIÓN)

> [!IMPORTANT]
> **Primero la regla cero: su línea de declaración va antes que cualquier acción, incluido este
> chequeo.** Después, antes de la primera acción de trabajo, verificá que el workspace esté
> montado. Es un solo comando y define si podés trabajar o si primero hay que inicializar:
>
> ```bash
> ls nx.json pnpm-workspace.yaml .npmrc .nxignore 2>&1; ls package-lock.json yarn.lock 2>/dev/null
> ```
>
> **Si falta alguno de los cuatro primeros, o si aparece un lockfile de npm/yarn → invocá la skill
> `init-nx-workspace` (tool `Skill` en Claude Code; en otros arneses, leé
> `sdd/skills/init-nx-workspace/SKILL.md`) ANTES de cualquier otra cosa** y seguila hasta su
> checklist de cierre. Un workspace desalineado falla de formas silenciosas y caras: tipos que solo
> andan después de `build`, libs que pnpm no linkea, `nx run-many` reventando en CI.
>
> Si los cuatro están y no hay lockfile rival, el workspace está sano: seguí con la tarea sin
> leer la skill (no gastes contexto en ella).

Invariantes que la skill garantiza y que **ningún cambio puede romper**:

- **pnpm es el único package manager.** `packageManager` pinneado en `package.json`; jamás
  `npm install` ni `yarn` en este repo — generan un lockfile rival y Nx infiere el PM del lockfile.
- **Los proyectos viven en `apps/`, `libs/` y `tools/`** — nunca en `packages/`. Los globs de
  `pnpm-workspace.yaml` y todo el sistema SDD asumen eso.
- **Si el repo usa el TS solution setup (`customConditions` en `tsconfig.base.json`), ese valor
  === `name` del `package.json` raíz.** Nx lo deriva literal de ahí; si divergen, TypeScript
  resuelve a `dist` en vez de a `src`. El template del kit (`sdd/templates/nx-workspace/`) usa el
  wiring legacy `paths` y no declara `customConditions`: ahí no aplica. `pnpm sdd:validate` avisa
  si divergen.
- **`.nxignore` contiene `sdd/templates`** — son blueprints, no proyectos Nx.
- **Crear apps/libs es otra skill:** `scaffold-nx`, y siempre dentro de un ciclo SDD.

# Guías generales para trabajar con Nx

- Para navegar/explorar el workspace, invocá primero la skill `nx-workspace`: tiene patrones para
  consultar proyectos, targets y dependencias.
- Las tareas (build, lint, test, e2e…) se corren siempre vía `nx` (`nx run`, `nx run-many`,
  `nx affected`), no con la herramienta de abajo directamente.
- Prefijá `nx` con el package manager del workspace (`pnpm nx build`): evita el CLI global.
- Si tenés el MCP de Nx, usalo. Plugins de Nx: `node_modules/@nx/<plugin>/PLUGIN.md` si existe.
- NUNCA adivines flags de un CLI: consultá `nx_docs` o `--help`.
- **Scaffolding** (apps, libs, estructura, setup): invocá PRIMERO la skill `nx-generate`, antes de
  explorar o llamar MCPs; ella descubre los generadores, no hace falta `nx_docs` para su sintaxis.
- **`nx_docs`:** usalo para opciones avanzadas, flags desconocidos, guías de migración,
  configuración de plugins y casos borde; no para sintaxis básica de generadores ni comandos
  estándar que ya conocés.

# 🛰️ Superficies del arnés en Antigravity y Gemini CLI

`pnpm setup:agents` expone el sistema SDD completo a este arnés (mismas fuentes que `.claude/` y
`.github/` — todo vive en `sdd/` y se symlinkea/genera):

| Superficie                 | Path                                           | Fuente                         |
| -------------------------- | ---------------------------------------------- | ------------------------------ |
| Contexto raíz              | `GEMINI.md`                                    | `sdd/dual-harness/GEMINI.md`   |
| Rules (Antigravity)        | `.agents/rules/sdd-*.md`                       | `sdd/dual-harness/rules/`      |
| Skills (estándar SKILL.md) | `.agents/skills/<skill>/`                      | `sdd/skills/`                  |
| Workflows (Antigravity)    | `.agent/workflows/<prompt>.md` → `/<prompt>`   | `sdd/prompts/`                 |
| Comandos (Gemini CLI)      | `.gemini/commands/<prompt>.toml` → `/<prompt>` | generados desde `sdd/prompts/` |
| Roles de agentes SDD       | `sdd/agents/*.agent.md`                        | leerlos al asumir un rol       |

- Los **roles de agentes** no tienen registro nativo en este arnés: al asumir un rol del ciclo
  (orquestador, implementor, reviewer…), leé su `*.agent.md` y su skill como parte del brief.
- En **Gemini CLI**, `/stats` da el consumo real de la sesión (fuente de la telemetría). Es un
  comando del cliente: el agente no puede ejecutarlo, se lo pide al dev al cerrar el ciclo; si no
  está a mano, se registra una estimación declarada (`approx: true`) — nunca se omite.
