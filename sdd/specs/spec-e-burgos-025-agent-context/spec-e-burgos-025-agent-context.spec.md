# SPEC-e-burgos-025: Contexto por agente y ejecución de ciclos — núcleo mínimo, paquete por unidad, bloques y verify en dos niveles

> Estado: **in-progress** (2026-11-17). Pedido del dev tras medir un ciclo real (spec-eburgos-048 en
> opticagestion, 24 tasks): cada task arranca un agente que relee decenas de miles de tokens de kit y
> documentos, y repite una verificación pesada. Diseño aprobado:
> `cycles/cycle-01/artifacts/design.md`.

## Resumen ejecutivo
El costo fijo por agente se paga una vez por task: medido sobre este repo, un implementador back
carga hasta ~56k tokens antes de escribir código, uno de front ~80k y el reviewer ~75k. La unidad de
despacho es la task, el input son documentos enteros, el contexto compartido (28 KB) no es opcional
y hay un solo nivel de verificación. La spec baja ese costo sin perder trazabilidad: la task sigue
siendo la unidad de status, `files`, `usage` y commit.

## Historias de usuario
- US-1 — Núcleo compartido mínimo. `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` del kit quedan en ≤ 6.000 B
  con una tabla de disparadores; el resto pasa a reglas bajo demanda. Las instrucciones propias del
  repo viven en `sdd/dual-harness/project.md` y dejan de volver híbrido el archivo del kit. La regla
  cero dice que el tier máximo no es el default y exige justificar por qué el alto no alcanza.
- US-2 — Bloques. El planner agrupa tasks contiguas de la misma app y rol en bloques
  (`tasks.json → batches`) y fusiona las de menos de una hora; el orquestador lanza un agente por
  bloque y lo continúa task por task, con telemetría exacta por task. `pnpm sdd:task` abre y cierra
  una task sin editar `tasks.json` a mano.
- US-3 — Verificación en dos niveles. `sdd/verify.json` declara `quick` y `full` por subproyecto;
  `pnpm sdd:verify` los corre, persiste el resultado (el reviewer lo reutiliza) y serializa `full`
  con un lease de máquina.
- US-4 — Gate de edición. Un `.md`/`.mdx` fuera de `apps/`, `libs/` y `tools/` no es código;
  `sdd/tools.json → claude_mod.exempt` suma globs del dev.
- US-5 — Paquete por unidad. `sdd/packs.json` declara qué recibe cada rol; `pnpm sdd:pack` arma un
  archivo determinista por unidad (bloque o ciclo) con las secciones citadas en `refs` de cada task.
  Los `agent.md` se adelgazan y apuntan al paquete.
- US-6 — Medición. `sdd:pack --stats` y los `usage` reales permiten comparar antes y después; el
  informe distingue lo medido de lo proyectado.

## Restricciones
- Retrocompatibilidad: nada nuevo es `required` en `sdd/schemas/`; el validador avisa, no falla; los
  archivos híbridos no se actualizan solos (`.new`); la migración a `project.md` es un paso explícito.
- Máximo 12.000 caracteres por archivo en `dual-harness/rules/`; `sdd-gates.md` no crece.
- `session-registry.mjs` no cambia de contrato (Studio lo carga en tiempo de ejecución).
- Código sin comentarios; solo pnpm.

## Ciclos propuestos
- cycle-01 — ejecución: US-1, US-2, US-3, US-4 (flow lite, apps/cli).
- cycle-02 — paquetes y medición: US-5, US-6 (flow lite, apps/cli).
