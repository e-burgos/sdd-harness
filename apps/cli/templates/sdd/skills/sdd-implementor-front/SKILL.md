---
name: sdd-implementor-front
description: Skill del Agente Implementador Frontend SDD. Implementa un bloque de tasks frontend, una por vez en la misma conversación, siguiendo el contrato de API y el stack del subproyecto. Invocar solo después de que el backend esté listo.
---

# Skill: sdd-implementor-front

> El stack lo define **el contexto del subproyecto** (`sdd/context/apps/[app]/constitution.md`),
> no esta skill. Para scaffolding usar la skill `generate-*` que corresponda al stack
> (ej: `generate-react-component` para React).

> **UI y diseño**: si el subproyecto usa `@e-burgos/tucu-ui`, leé `tucu-ui-pro` antes de la primera
> task (montaje, props válidos, trampas). Si la task diseña o rediseña pantallas, `design-languages`
> define el lenguaje visual (contrato de tokens, superficies, componentes firma) y su verificación;
> `crafted-motion`, el motion. El lenguaje que ya declara `constitution.md` manda.

## Protocolo de bloque

Trabajás un bloque (`batches` de `tasks.json`): las tasks llegan de a una, en la misma conversación.
Protocolo completo: `sdd/dual-harness/rules/sdd-execution.md`.

1. Leer la task actual en `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` y su detalle en `planner.md`
   y verificar que **todo endpoint consumido esté `"implemented"`** en `sdd/api.json` — si no, la task está bloqueada
2. Implementar exactamente lo del contrato (código + tests; cada task deja el build en verde)
3. `pnpm sdd:verify <app> quick --files <archivos tocados> --unit TASK-NNN` (código 3 = el subproyecto
   no tiene entrada en `sdd/verify.json`: verificá con sus comandos de lint/test y decilo)
4. Commit y responder **UNA línea**: task, sha, resultado del verify
5. Última task del bloque: además `pnpm sdd:verify <app> full --unit B-NN`
6. Si la task falla 2 veces → avisar al orquestador con el detalle, no improvisar fuera del contrato

El orquestador cierra cada task con `pnpm sdd:task` (estado, `files`, `usage`): **no edites
`tasks.json` a mano**. Sin continuación de subagentes (Copilot, Gemini), la sesión cierra cada task
con `pnpm sdd:task <spec> cycle-XX TASK-NNN done --commit <sha> --tokens <n> --model … --effort …
--agent implementor-front --approx`.

## Archivos que modificás por task

- `sdd/components.json` — bajo el **app-key correcto** (ej: `"apps/example-app"`)


### Regla al registrar un componente nuevo

`id` correlativo por app-key (`COMP-001`, `COMP-002`…). Todos los campos son obligatorios
(schema: `sdd/schemas/components.schema.json`):

```json
// Agregar en: data["<app-key>"].components
{
  "id": "COMP-[NNN]",
  "name": "NombreComponente",
  "type": "page | component | hook | layout",
  "module": "nombre-del-modulo",
  "spec": "sdd/specs/spec-[gh-user]-[NNN]-[slug]",
  "path": "src/pages/...",
  "status": "implemented",
  "created_in_cycle": N,
  "updated_in_cycle": null,
  "description": "qué hace",
  "consumes": ["EP-001"],
  "created_at": "YYYY-MM-DD",
  "changelog": []
}
```

### Regla al actualizar un componente existente

```json
// Buscar: data["<app-key>"].components.find(c => c.id === "COMP-NNN")
{
  "status": "updated",
  "updated_in_cycle": N,
  "changelog": [
    // append:
    { "cycle": N, "date": "YYYY-MM-DD", "change": "descripción del cambio" }
  ]
}
```

## Registro de consumo

Lo registra el orquestador con `pnpm sdd:task … done` (ver `sdd/dual-harness/rules/sdd-model-budget.md`).
