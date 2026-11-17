---
name: sdd-implementor-back
description: Skill del Agente Implementador Backend SDD. Implementa un bloque de tasks backend, una por vez en la misma conversación, siguiendo el contrato del Arquitecto y el stack del subproyecto.
---

# Skill: sdd-implementor-back

> El stack lo define **el contexto del subproyecto** (`sdd/context/apps/[app]/constitution.md`),
> no esta skill. Para scaffolding usar la skill `generate-*` que corresponda al stack
> (ej: `generate-springboot-api` para Spring Boot, `generate-nestjs-module` para NestJS).

## Protocolo de bloque

Trabajás un bloque (`batches` de `tasks.json`): las tasks llegan de a una, en la misma conversación.
Protocolo completo: `sdd/dual-harness/rules/sdd-execution.md`.

1. Leer la task actual en `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` y su detalle en `planner.md`; el contrato está en `architect.md`
2. Implementar exactamente lo del contrato (código + tests; cada task deja el build en verde)
3. `pnpm sdd:verify <app> quick --files <archivos tocados> --unit TASK-NNN` (código 3 = el subproyecto
   no tiene entrada en `sdd/verify.json`: verificá con sus comandos de lint/test y decilo)
4. Commit y responder **UNA línea**: task, sha, resultado del verify
5. Última task del bloque: además `pnpm sdd:verify <app> full --unit B-NN`
6. Si la task falla 2 veces → avisar al orquestador con el detalle, no improvisar fuera del contrato

El orquestador cierra cada task con `pnpm sdd:task` (estado, `files`, `usage`): **no edites
`tasks.json` a mano**. Sin continuación de subagentes (Copilot, Gemini), la sesión cierra cada task
con `pnpm sdd:task <spec> cycle-XX TASK-NNN done --commit <sha> --tokens <n> --model … --effort …
--agent implementor-back --approx`.

## Archivos que modificás por task

- `sdd/api.json` — endpoint bajo el **app-key correcto** → `"status": "implemented"`

```json
// Buscar: data["<app-key>"].endpoints.find(e => e.id === "EP-NNN")
{
  "status": "implemented",
  "updated_in_cycle": N  // solo si "created_in_cycle" es de otro ciclo anterior
  // si se crea y se implementa en el mismo ciclo, "updated_in_cycle" permanece null
}
// Agregar al changelog SOLO si la implementación difirió del contrato del Arquitecto:
// { "cycle": N, "date": "YYYY-MM-DD", "change": "descripción" }
```

## Desviaciones del contrato

Si el contrato del Arquitecto no es implementable tal cual (limitación de librería, comportamiento
real distinto al asumido): implementar la alternativa mínima razonable y **documentar la desviación**
únicamente con una entrada en `## Pendiente de documentar en contexto` del `planner.md` (nunca como
comentario en el código — `rules/sdd-code-style.md`) para que el Reviewer la evalúe al
cerrar. Nunca desviarse en silencio.

## Registro de consumo

Lo registra el orquestador con `pnpm sdd:task … done` (ver `sdd/dual-harness/rules/sdd-model-budget.md`).
