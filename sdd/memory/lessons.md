# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.3 | Última destilación: 2026-11-17 (journal de spec-e-burgos-018, 019, 020, 023 y 024 cycle-01)
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
- Depreciar o reapuntar en `sdd/components.json` todo componente que una task borra o mueve,
  en el mismo cambio: Studio lee ese registro y muestra como vivos los archivos que ya no existen.
- Validar sobre el payload exacto todo lo que habilita una acción irreversible (generar, escribir,
  publicar): una cola o caché que fusiona pedidos sirve solo para vistas previas.
- Cuando un subproyecto consume el contrato de otro, los límites los publica el productor (en el
  catálogo) y un spec de contrato corre el binario real: nunca duplicar topes a mano en el consumidor.
- Antes de diagnosticar motion "trabado", medir los fps de `requestAnimationFrame` y confirmar que
  la pestaña o el panel esté visible: un panel oculto frena rAF a ~2 fps.
- Validar una subida de mayor de una herramienta de build con una generación real y una migración
  real antes de publicar: las notas de release y los peerDependencies no alcanzan.
- Extraer una receta de diseño del código real y verificarla prop por prop contra la fuente de la
  versión de la librería que el kit fija, nunca contra la skill o la doc del proyecto de origen.
- Llevar el worktree en toda referencia a una unidad SDD que cruce sesiones (marca, atadura,
  gate): nunca asumir que la raíz de la sesión es donde se trabaja.

## Técnica (stack, herramientas, gotchas transversales)

- No tratar este repo como workspace Nx: es la fuente del kit (CLI `harness`) sobre pnpm
  workspaces y usa el kit solo para sus propios flujos de desarrollo. Que falten `nx.json`,
  `.nxignore` y `.npmrc` es lo esperado; no invocar `init-nx-workspace` ni correr `pnpm nx`.
- Verificar con `pnpm build && pnpm typecheck && pnpm test`: `sdd:validate` no compila nada.
- Si `pnpm test` raíz falla por un timeout, correr cada paquete con `pnpm --filter <pkg> test`
  antes de concluir que algo se rompió: el primer paquete que falla oculta el resultado del resto.
- Verificar props y tipos de una librería contra el paquete publicado en `node_modules`, no
  contra su fuente local (tucu-ui local va por delante del npm); y no cerrar un generador sin
  una generación real en `examples/` con `lint test build`: los tests unitarios no lo detectan.
- Revisar en modo claro y oscuro todo override sobre un componente con variantes `dark:`:
  revisar uno solo esconde la regresión del otro.
- Cerrar una task de UI async solo con sus specs pasando con la suite completa del paquete (no
  filtrados); subir el timeout de `findBy`/`waitFor` en los specs con mucho render.
- Probar un mod de Claude Code en uso real con el binario del motor de la app de escritorio
  (`~/Library/Application Support/Claude/claude-code/<ver>/…/claude`, `--plugin-dir`): el CLI de
  terminal puede ser viejo y `-p` no autocarga mods de carpetas de skills.
- Para que un mod entregue al modelo algo que aparece a mitad de sesión, usar el `context` del
  resultado de un `tool.call` o `$.session.send`; `prompt.compose`/`context`/`section` se cachean.
- Verificar un template de GitHub Actions corriéndolo en un repo real: los ids de job no admiten
  `:` y el nombre del check requerido sale del `name:` del job, no de su id.
- Leer en cada render, con el dato vigente, todo valor persistido que depende de un dato async
  (raíz, usuario, conexión), no en el inicializador de `useState`; el test monta primero sin ese
  dato y después con él.
- Usar `overflow: clip` (no `hidden`) y `focus({ preventScroll: true })` en contenedores de
  pantalla completa con capas animadas; jsdom no hace layout, así que solo se ve en el navegador.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Registrar el consumo por unidad de trabajo al cerrarla (task, documento, fix): sin
  registro por agente el total del ciclo se reconstruye de memoria al final y el
  dashboard de Costos miente.
- Capturar `subagent_tokens` de la notificación de cada subagente (Claude Code) en el
  momento: es la única medición exacta gratuita y no se recupera después.
- Definir en el architect el contrato entre subproyectos y el uso de colas, y correr la suite
  completa del paquete en cada task de front: evita un ciclo de fix de revisión (~363K tokens).
