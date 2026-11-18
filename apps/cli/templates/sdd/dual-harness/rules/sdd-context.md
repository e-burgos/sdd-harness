---
trigger: model_decision
description: Cierre de un ciclo o fix - fragmentos aditivos de contexto de subproyectos, CONTEXTO GATE y MEMORIA GATE (lessons + journal). Leelo antes de escribir cycle.json completed o de cerrar un fix.
---

# 🧩 Contexto de subproyectos: actualizaciones ADITIVAS (anti merge-conflict)

> [!IMPORTANT]
> `sdd/context/[apps|libs|tools]/[nombre]/constitution.md` y `context_prompt.md` son la
> fuente de verdad técnica de cada subproyecto y los archivos más disputados del repo. Por
> eso **durante un ciclo o fix nunca se editan directamente**: se escribe un fragmento
> aditivo (patrón changesets) y un solo actor los consolida después.

1. **Escribir** (quien cierra el ciclo o fix): `updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
   (fixes: `YYYY-MM-DD-fix-[gh-user]-[seq].md`) — solo el delta, cuatro secciones: Estado ·
   Estructura · Dependencias · Qué sigue. Único por construcción: dos devs jamás chocan.
   Template: `sdd/skills/sdd-file-structure/SKILL.md` §3.7.
2. **Leer** (cualquier agente): contexto vigente = archivos base + `updates/*.md` en orden de
   nombre. La línea `> Última actualización:` del base **no** es la verdad si hay fragmentos.
3. **Consolidar** (un solo actor, nunca en paralelo con un ciclo abierto sobre ese subproyecto):
   el orquestador al abrir el próximo ciclo, o el reviewer si se acumulan ≥5 fragmentos
   (`pnpm sdd:validate` lo avisa), funde los fragmentos en los base (lo obsoleto se reemplaza,
   nunca se acumula), actualiza `> Última actualización:`, **borra los fragmentos** y commitea
   aparte (`chore(sdd): consolidate context updates for [nombre]`).
4. **Contexto global** (`sdd/context/constitution.md` y `context_prompt.md`): tablas de
   referencia — tocar **solo la fila del subproyecto propio**, jamás reformatear la tabla.

# ⛔ CONTEXTO GATE — regla global de cierre (INVIOLABLE)

**Al cerrar CUALQUIER ciclo** (o fix que cambió estructura/patrones/dependencias), quien
cierra deja el contexto actualizado ANTES de escribir `status: "completed"`:

1. Fragmento aditivo del subproyecto en `updates/` (sección anterior — los archivos base **no** se
   editan durante el ciclo).
2. `sdd/context/constitution.md` → solo la fila del subproyecto en la tabla-snapshot.
3. `sdd/context/context_prompt.md` → fila nueva solo si se creó una app/lib/tool.

`cycle.json` **no puede quedar `completed`** con el contexto desactualizado; `pnpm sdd:validate`
exige el fragmento del ciclo. El `cycle.json` se crea al **iniciar** (`status: "in-progress"`,
orquestador) y solo el reviewer lo pasa a `"completed"`. Reglas completas:
`sdd/dual-harness/rules/sdd-gates.md` y `sdd/agents/sdd-reviewer.agent.md`.

# 🧠 MEMORIA GATE — autoaprendizaje entre sesiones (lessons + journal)

> [!IMPORTANT]
> El contexto registra **qué es** el sistema; la memoria registra **qué aprendimos**
> trabajándolo. `sdd/memory/` viaja con git y sirve a cualquier agente, máquina o CI.

- **Leer** al iniciar toda sesión: `sdd/memory/lessons.md` completo (lecciones destiladas,
  cap duro 120 líneas — la única memoria que se carga siempre). `sdd/memory/journal/` jamás se
  lee entero: grep dirigido cuando una lección remite a su detalle.
- **Escribir** al cerrar un ciclo o fix, **solo si hubo lección real**:
  `sdd/memory/journal/YYYY-MM-DD-[spec-id]-cycle-[XX].md` (fixes:
  `YYYY-MM-DD-fix-[gh-user]-[seq].md`) con tres secciones: Qué pasó · Lección (1 línea) ·
  Costo evitable. **Filtro anti-ruido:** si no cambiaría el comportamiento de un agente
  futuro (lo obvio, lo ya documentado, el detalle del ciclo), no se escribe.
- **Destilar** (un solo actor, nunca en paralelo con un ciclo): con ≥5 entradas
  (`sdd:validate` avisa) el orquestador, al abrir el próximo ciclo, funde cada una en una
  línea de `lessons.md` (Proceso / Técnica / Costo), actualiza `> Última destilación:`, borra
  las destiladas y commitea aparte (`chore(sdd): distill memory journal into lessons`).
  Lección específica de un subproyecto → a su `constitution.md` vía consolidación (primera
  sección). Durante ciclos/fixes `lessons.md` **no se edita**.
