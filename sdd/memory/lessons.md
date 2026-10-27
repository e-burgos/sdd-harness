# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.1 | Última destilación: 2026-10-26 (journal de spec-e-burgos-001, 005, 007 y 008)
> **Cap duro: 120 líneas.** Este archivo se lee COMPLETO al inicio de cada sesión de agente —
> cada línea acá cuesta tokens en todas las sesiones futuras. Si al destilar se supera el cap,
> primero podar lecciones obsoletas o absorbidas por constitutions/skills.

Reglas de este archivo (ver sección 🧠 MEMORIA GATE del dual-harness):

- **Solo lecciones destiladas**: una línea por lección, accionable, empezando por el verbo
  o la prohibición. Nada de narrativa ni historia — eso vive en `journal/`.
- **Nunca se edita durante un ciclo/fix**: las lecciones nuevas entran como entradas
  episódicas en `sdd/memory/journal/` y solo la destilación (un solo actor) las funde acá.
- **No duplicar** lo que ya dicen las constitutions, skills o el dual-harness: si una lección
  pertenece a un subproyecto concreto, va a su `constitution.md` en la consolidación de
  contexto; acá van las transversales al repo o al proceso.

## Proceso (cómo trabajan los agentes en este repo)

- Citar la evidencia y las decisiones desde `harness.idea.md` en las specs en vez de
  copiarlas a mano.
- Crear a mano con `git worktree add` el worktree de un subagente que tiene que commitear y
  pasarle la ruta: con `isolation: "worktree"` del Agent tool git queda bloqueado adentro.

## Técnica (stack, herramientas, gotchas transversales)

- No tratar este repo como workspace Nx: es la fuente del kit (CLI `harness`) sobre pnpm
  workspaces y usa el kit solo para sus propios flujos de desarrollo. Que falten `nx.json`,
  `.nxignore` y `.npmrc` es lo esperado; no invocar `init-nx-workspace` ni correr `pnpm nx`.
- Verificar con `pnpm build && pnpm typecheck && pnpm test`: `sdd:validate` no compila nada.
- Si `pnpm test` raíz falla por un timeout, correr cada paquete con `pnpm --filter <pkg> test`
  antes de concluir que algo se rompió: el primer paquete que falla oculta el resultado del resto.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Registrar el consumo por unidad de trabajo al cerrarla (task, documento, fix): sin
  registro por agente el total del ciclo se reconstruye de memoria al final y el
  dashboard de Costos miente.
- Capturar `subagent_tokens` de la notificación de cada subagente (Claude Code) en el
  momento: es la única medición exacta gratuita y no se recupera después.
