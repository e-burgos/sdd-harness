# Hermes — de una idea a producto, con SDD como corazón

> Documento de arquitectura y roadmap del salto "next level" del sistema: que el usuario
> pase **una idea en lenguaje natural** y el sistema configure el stack, siembre el backlog
> SDD y conduzca ciclos punta a punta — aprendiendo entre sesiones y gastando el mínimo de
> tokens sin sacrificar calidad. Estado: **las 5 fases implementadas** —
> este documento describe la arquitectura completa y las decisiones tomadas.

## La tesis

El kit SDD ya resuelve lo difícil: gates inviolables (SPEC, CONTEXTO, TIPADO), registros
JSON estrictos, agentes especializados y contexto aditivo anti-conflictos. Lo que faltaba
para el punta-a-punta autónomo eran cuatro piezas, en orden de palanca:

1. **Memoria y autoaprendizaje** — sin ella, cada sesión re-paga en tokens los mismos
   descubrimientos y repite los mismos errores.
2. **Entrada no interactiva** — un agente no puede responder prompts de `@clack`; sin una
   vía por archivo de configuración, "que el sistema configure el stack solo" era imposible.
3. **Un conductor del loop** — los agentes SDD son fases; nadie encadenaba idea →
   stack → specs → ciclos → cierre con condiciones de corte explícitas.
4. **Gobierno de uso** — el loop largo necesita presupuesto por fase y cortes limpios
   cuando el cupo del plan se agota.

## Pilar 1 — Memoria portable (`sdd/memory/`) ✅ implementado

### Por qué archivos y no un plugin

Se investigó el ecosistema 2025-2026 de memoria para agentes Claude antes de decidir:

| Opción | Veredicto para un kit portable |
| --- | --- |
| [claude-mem](https://github.com/thedotmack/claude-mem) (hooks + SQLite + Chroma) | ❌ Dependencia pesada y madurez volátil para bundlear en repos de terceros |
| [mem0 / OpenMemory MCP](https://github.com/mem0ai/mem0) | ❌ La ruta cloud exige API key; la self-hosted exige servidor + embeddings |
| [Letta (MemGPT)](https://www.letta.com) | ❌ Infraestructura de servidor obligatoria |
| memory-bank MCP (forks varios) | ❌ Fragmentado, sin canon ni mantenimiento unificado |
| [basic-memory](https://github.com/basicmachines-co/basic-memory) | ⚠️ Razonable, pero agrega runtime MCP y duplica lo que archivos versionados ya dan |
| **Archivos Markdown versionados en `sdd/`** | ✅ Cero dependencias, viaja con git, sirve a cualquier agente (Claude/Copilot/Cursor), a cualquier máquina y a CI |

La auto-memory nativa de Claude Code (`~/.claude/projects/<repo>/memory/`) valida el
patrón — índice destilado siempre cargado + detalle bajo demanda — pero es local a la
máquina y no viaja con el repo. `sdd/memory/` implementa el mismo patrón **dentro del
kit**, con la misma mecánica de actor único que el kit ya usa para el contexto.

### Diseño (regla 🧠 MEMORIA GATE del dual-harness)

- **`sdd/memory/lessons.md`** — lecciones destiladas en 3 categorías (Proceso / Técnica /
  Costo), **cap duro de 120 líneas**, se lee completo al inicio de cada sesión. Es la única
  memoria siempre cargada: entrada de tokens barata, constante y acotada por diseño.
- **`sdd/memory/journal/`** — entradas episódicas append-only al cerrar ciclo/fix
  (naming idéntico a los fragmentos de contexto → único por construcción, sin merge
  conflicts). **Jamás se lee entero**: solo grep dirigido.
- **Filtro anti-ruido**: solo se escribe lo que cambiaría el comportamiento de un agente
  futuro. La literatura es clara en que memoria sin curación se degrada
  ([arXiv 2605.12978](https://arxiv.org/pdf/2605.12978)).
- **Destilación de actor único**: con ≥5 entradas, el orquestador (al iniciar el próximo
  ciclo) funde cada entrada en una línea de `lessons.md` y borra lo destilado —
  `pnpm sdd:validate` avisa cuando hay destilación pendiente y cuando `lessons.md`
  supera el cap.
- **Frontera de update**: `lessons.md` es híbrido (el update respeta ediciones locales por
  hash), `journal/` es data (el update jamás lo toca). Instalaciones existentes reciben
  `memory/` automáticamente con `harness update sdd`.

## Pilar 2 — Auto-configuración del stack (`init --config`) ✅ implementado

El flag `--config` existía pero no estaba cableado. Ahora `harness init --config
./harness.config.json` genera el workspace completo **sin un solo prompt**: config
JSON (o `.mjs`/`.js` con `defineConfig`) validada con zod (modo nx/standalone, apps,
libs, services), errores con path exacto, y el mapeo directo a los generadores. Es la
interfaz que un agente usa para materializar la decisión de stack.

## Pilar 3 — El conductor: skill `sdd-hermes` ✅ implementado

`sdd/skills/sdd-hermes/skill.md` define el loop punta a punta:

```
idea → FASE 1 descubrimiento (1 ronda de preguntas máx)
     → FASE 2 stack (matriz de decisión + checkpoint humano)
     → FASE 3 configuración (init --config | harness add) + validate/build verdes
     → FASE 4 specs por módulo (harness add spec + checkpoint humano)
     → FASE 5 loop de ciclos SDD (orchestrator → functional → planner+architect
              → implementors → reviewer) hasta agotar pending_modules
```

Principios: Hermes **no bypassea ningún gate** — su único privilegio es encadenar fases;
dos checkpoints son siempre humanos (stack y specs); presupuesto modelo/esfuerzo declarado
por fase; y todo estado vive en los registros SDD, así el loop es interrumpible y
retomable por cualquier sesión futura.

Condiciones de corte obligatorias: validación/tests rojos 2× en el mismo punto → parar y
reportar; decisión de producto fuera de spec → preguntar; presupuesto agotado → cierre
limpio + reporte de posición en el backlog.

## Pilar 4 — Gobierno de tokens y suscripción

**Lo honesto primero:** no existe API para que un agente administre la suscripción de
Claude (billing/plan) — y un agente no debería tocar facturación. Lo que sí es
gobernable, y el sistema ya hace o queda en roadmap:

- ✅ **Política modelo/esfuerzo obligatoria** (dual-harness ⚙️): el modelo más barato que
  cumple, escalando solo con justificación — aplicada además por fase en hermes.
- ✅ **Entrada de contexto acotada por diseño**: briefs mínimos por agente, contexto
  aditivo, `lessons.md` con cap, journal grep-only, graphify opcional.
- ✅ **Cortes limpios por presupuesto** en el loop (los registros SDD son el checkpoint).
- ✅ **Telemetría de uso** por task y ciclo (`usage` en los schemas) con costo visible en
  el dashboard del visor — lo que se mide se puede gobernar.
- 🗺️ Queda para el futuro: pacing contra rate limits con reintentos programados y guía
  de monitoreo (`/usage`, ccusage, OTEL) integrada al kit.

## Roadmap

| Fase | Qué | Estado |
| --- | --- | --- |
| **F1** | Memoria (`sdd/memory/` + MEMORIA GATE + validador + frontera de update) | ✅ esta rama |
| **F1** | `init --config` no interactivo + skill `sdd-hermes` | ✅ esta rama |
| **F2** | `harness idea "<texto>"`: comando que persiste la idea, imprime el protocolo hermes y deja el config-stub listo — entrada única del punta-a-punta | ✅ esta rama |
| **F2** | Export del JSON Schema del config (`harness config schema`) para que agentes validen sin correr la CLI | ✅ esta rama |
| **F3** | Telemetría de tokens por task y por ciclo (`usage` en los schemas) + `sdd/pricing.json` | ✅ esta rama |
| **F3** | Automatización del loop (`prompts/hermes-resume.prompt.md` + `/loop`/Routines/hook `SessionStart` documentados en la skill) | ✅ esta rama |
| **F4** | Integraciones de memoria opt-in (`harness configure memory`: basic-memory, knowledge-graph oficial en `sdd/memory/`) | ✅ esta rama |
| **F5** | Dashboard de costos y telemetría en el visor SDD (`sdd/docs/`) — ver sección "Fase final" | ✅ esta rama |

## Fase final (F5) — Dashboard de costos en el visor SDD ✅ implementado

El visor de `sdd/docs/` pasó de catálogo de documentos a **tablero del proyecto**: la
vista **Costos** muestra tokens y tiempos por task/ciclo/spec con la comparativa de costo
aproximado del modo agéntico versus la estimación tradicional que los registros ya traen
(`estimation_hours` en `tasks.json`).

**Captura (F3):** los agentes registran `usage` (`tokens_in`/`tokens_out`/
`duration_minutes`/`model_tier`) por task y agregado por ciclo en `cycle.json.metrics.usage`
(campos opcionales de los schemas estrictos — los registros viejos validan igual).

**Dashboard:** KPIs (horas estimadas, costo tradicional, tokens, costo agéntico, ahorro
proyectado), barras comparativas por spec, tokens entrada/salida apilados por ciclo, tabla
de detalle con los números exactos y tarjeta de metodología con las tarifas. Se calcula
**en vivo desde los registros** (sin intermedio generado — se descartó el `metrics.json`
del diseño original: un archivo generado agrega staleness justo donde se pide
reactividad). Tarifas editables en `sdd/pricing.json` (híbrido: el update respeta
ediciones locales); tokens sin tier declarado se tarifan como `sonnet` y se marcan. La
paleta de series se validó con chequeos de daltonismo/contraste sobre la superficie dark
del visor; tooltips de hover y labels directos incluidos.

**Reactividad en JS vanilla:** `serve.mjs` expone `/sdd/docs/__state` — un fingerprint
sha1 de los mtimes de todos los registros (`docs/` y `templates/` excluidos). El visor lo
pollea cada 4 segundos en localhost y, ante un cambio, invalida el cache y re-renderiza la
vista activa: task done, ciclo cerrado o spec completada se manifiestan sin recargar. En
hosting estático (sin `serve.mjs`) queda el refresh manual de siempre; el polling se pausa
con la pestaña oculta o un modal abierto y se apaga tras fallas repetidas.

## Decisiones registradas

- **SDD sigue siendo el corazón**: hermes es un conductor, no un atajo — cada gate del
  kit aplica igual en modo autónomo.
- **Memoria en el repo, no en servicios**: portabilidad y CI le ganan a la búsqueda
  vectorial; quien la quiera, la suma como capa opt-in (F4).
- **La CLI queda determinista**: la inteligencia (descubrimiento, matriz de stack,
  redacción de specs) vive en las skills del kit; la CLI solo ejecuta configs validadas.
  Por eso `pending_modules` no se siembra desde el config: exige spec-id con autor, y eso
  es trabajo de la FASE 4 de hermes vía `harness add spec`.
