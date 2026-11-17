# Proyecto SDD

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Única fuente de verdad: este archivo nunca los hardcodea (`pnpm sdd:validate` falla si el nombre se filtra).

Proyecto con Spec-Driven Development (SDD). Contexto general, stack y reglas de desarrollo:
**[sdd/context/context_prompt.md](sdd/context/context_prompt.md)**. Leelo antes de cambiar nada, salvo que
seas un subagente con el paquete o el brief de tu unidad: ese es tu contexto, no releas lo que ya trae.

<!-- regla-cero:start -->
## ⓪ REGLA CERO — modelo, esfuerzo y contexto (INVIOLABLE, antes de cualquier acción)

> [!IMPORTANT]
> **Antes de CUALQUIER acción de una tarea nueva —incluida la primera de la sesión, antes de
> verificar el workspace, leer archivos o editar— escribí UNA línea visible:**
>
> `Regla cero → tier: <económico|estándar|alto|máximo> · modelo: <…> · esfuerzo: <…>`
>
> Sin esa línea no se empieza. Tabla de tiers: `sdd/dual-harness/rules/sdd-model-budget.md`.

- **Agentes y subagentes:** los agentes de `.github/agents/*.agent.md` llevan `model:` pinneado por
  rol; declarales tier + modelo + esfuerzo en la misma línea (Copilot CLI: `--model` / `/model` y
  `--reasoning-effort`; en chat/coding agent verificá el modelo del picker antes de ejecutar).
- **Modelo activo:** si es MÁS caro que el tier que pide el trabajo, delegalo a un agente más
  barato o pedile al usuario cambiar el picker; nunca quemes en silencio el tier caro. Si es MÁS
  barato que el necesario, avisá y escalá.
- **Máximo no es el default del trabajo difícil.** Antes de elegir el tier máximo, decidí
  explícitamente «máximo o alto» y escribí por qué el tier alto no alcanza. Vale para diseño
  crítico sin precedente en el repo, trade-offs entre muchos subsistemas o un verify/judge
  adversarial. Ningún subagente va en máximo sin esa justificación.
- **Contexto mínimo:** si existe `graphify-out/graph.json`, consultalo antes de grep/lecturas a
  ciegas; no releas lo ya establecido en la sesión ni narres opciones que no vas a seguir.

## ① REGLA UNO — la unidad SDD de la sesión, visible y atada (INVIOLABLE, antes de trabajarla)

> [!IMPORTANT]
> **Antes de escribir CUALQUIER cosa de una spec, un ciclo o un fix —en flow full o lite, sea
> spec nueva, ciclo nuevo, documento, código, fix o improvement— escribí UNA línea visible y atá
> la sesión a esa unidad:**
>
> `Unidad SDD → <spec-id · cycle-XX · flow | spec-id (preparando) | FIX-id (tipo)> · worktree: <ruta>`
>
> Atarla es correr, **desde el worktree donde vive la unidad**, `pnpm sdd:use <spec> [cycle-XX]`
> o `pnpm sdd:use <FIX-id>` (el GATE A y el GATE B también atan). Al cambiar de unidad, otra línea
> y otra atadura. Sin línea no se trabaja la unidad.

- **Varias sesiones en paralelo:** cada sesión trabaja UNA unidad; nunca toques documentos ni
  código de una unidad atada a otra sesión.
- **Worktrees:** si la unidad vive en otro worktree (uno que abriste o al que entraste con `cd`),
  la ruta va en la línea y `sdd:use` se corre ahí: la marca `SDD-BIND` lleva ese worktree.
- **Sin mod:** la línea es la única señal de en qué trabaja la sesión; repetila al retomar.
<!-- regla-cero:end -->

## Siempre

- **pnpm es el único package manager** (jamás `npm`/`yarn`: generan un lockfile rival). Los
  proyectos viven en `apps/`, `libs/` y `tools/`, nunca en `packages/`.
- **SPEC GATE:** sin spec registrada y `cycle.json` `in-progress` no se escribe una línea de código.
  `pnpm sdd:gate <spec-id|slug>` (A: abrir ciclo) · `pnpm sdd:gate <spec-id|slug> cycle-XX`
  (B: implementar). `BLOCKED` = parar y completar lo que el script señala.
- **Código sin comentarios:** nombres declarativos, funciones cortas, ningún `// TODO`
  (`sdd/dual-harness/rules/sdd-code-style.md`).
- **Registros tipados:** todo `sdd/**/*.json` tiene schema en `sdd/schemas/`: leelo antes de
  escribir; después `pnpm sdd:validate` y `pnpm sdd:rebuild-tasks-index`.
- **Telemetría:** ninguna unidad (task, documento, ciclo, fix) se cierra sin `usage`
  (`sdd/dual-harness/rules/sdd-model-budget.md`).
- **Edición rechazada** (`SPEC GATE: …`, `SDD reserva: …`): nunca la rodees con shell; seguí lo
  que dice el mensaje.
- **graphify, rtk, sdd-mod, tucu-ui, video-maker:** prenderlos, apagarlos o cambiarles el modo es
  del dev; nunca por tu cuenta.

## Disparadores — leé el archivo antes de seguir

Reglas en `sdd/dual-harness/rules/`.

| Si pasa… | Leé |
| -------- | --- |
| El pedido trae `[HOTFIX]` `[BUGFIX]` `[FIX]` `[IMPROVEMENT]` | `sdd-gates.md` § FIX GATE |
| Abrís o ejecutás un ciclo (bloques, `sdd:task`, `sdd:verify`) | `sdd-execution.md` |
| Cerrás un ciclo o fix (contexto, memoria) | `sdd-context.md` |
| Sos la sesión principal y es tu primera acción de trabajo | `sdd/memory/lessons.md` + el chequeo de `sdd-workspace.md` |
| Crear apps/libs, o tocás Nx | `sdd-workspace.md` |
| Rechazo del mod, graphify, rtk, tucu-ui, video-maker | `sdd-tools.md` |
| Elegís modelo de un subagente o registrás `usage` | `sdd-model-budget.md` |

Si existe `sdd/dual-harness/project.md`, leelo antes de trabajar: son las instrucciones propias de este repo.
