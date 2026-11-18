# spec-e-burgos-025 cycle-02 — contrato de interfaces (paquetes)

> Fuente única para los bloques del ciclo. Rutas relativas a `apps/cli/templates/sdd/` salvo que
> empiecen con `apps/`. Convenciones del kit: scripts `.mjs` sin dependencias nuevas, salida de
> consola en inglés y compacta, código sin comentarios, lógica pura en `scripts/lib/*.mjs`.
> El contrato de cycle-01 (`../cycle-01/artifacts/interfaces.md`) sigue vigente.

## 1. `sdd/packs.json`

```json
{
  "$schema": "./schemas/packs.schema.json",
  "execution": { "max_tasks_per_batch": 4, "max_points_per_batch": 12, "max_parallel_batches": 1 },
  "limits": { "context_inline_max_bytes": 12000, "max_pack_bytes": 60000 },
  "context_always": ["regla", "gotcha", "restric", "stack", "comando", "rule", "constraint", "command"],
  "roles": {
    "implementor-back": {
      "unit": "batch",
      "include": ["cycle", "tasks:@unit", "plan:@unit", "refs:@unit", "context:@app",
                  "registry:api@unit", "verify:@app",
                  "section:dual-harness/rules/sdd-execution.md#Protocolo del implementador"]
    },
    "implementor-front": {
      "unit": "batch",
      "include": ["cycle", "tasks:@unit", "plan:@unit", "refs:@unit", "context:@app",
                  "registry:api@unit", "registry:components@app:index", "verify:@app",
                  "section:dual-harness/rules/sdd-execution.md#Protocolo del implementador"]
    },
    "reviewer": {
      "unit": "cycle",
      "include": ["cycle", "tasks:@all:summary", "acceptance", "verify-results",
                  "context:@app:index",
                  "section:dual-harness/rules/sdd-context.md#CONTEXTO GATE"]
    },
    "functional": {
      "unit": "cycle",
      "include": ["cycle", "spec", "context:@app:index",
                  "section:skills/sdd-file-structure/SKILL.md#3.4"]
    },
    "planner": {
      "unit": "cycle",
      "include": ["cycle", "doc:functional", "index:architect", "context:@app:index",
                  "section:skills/sdd-file-structure/SKILL.md#3.5",
                  "section:skills/sdd-file-structure/SKILL.md#3.3b"]
    },
    "architect": {
      "unit": "cycle",
      "include": ["cycle", "doc:functional", "registry:api@app", "registry:schema@app",
                  "context:@app", "section:skills/sdd-file-structure/SKILL.md#3.6"]
    }
  }
}
```

- Archivo del kit (gobernado por hash en `update sdd`: sin modificar se reemplaza, modificado
  recibe `.new`). Schema en `schemas/packs.schema.json`; `roles` admite cualquier nombre de rol;
  `unit` ∈ `batch` | `cycle`; `include` es una lista de selectores. Todo opcional salvo `roles`.
- Sin entrada para un rol, `sdd:pack` sale con código 3 y el agente trabaja como hasta ahora.
- `execution` es lo que ya lee el validador para el tope de bloques (cycle-01).

## 2. Selectores

Cada selector emite una sección del paquete. Uno que no encuentra su fuente emite una línea
«(sin fuente: <motivo>)» y no falla.

| Selector | Emite |
| -------- | ----- |
| `cycle` | De `cycle.json`: spec, ciclo, flow, apps, `objectives`. De `brief.yaml` si existe: `objective`, `scope`, `out_of_scope` y `facts` (texto tal cual). En `lite`, sin brief: solo lo de `cycle.json` |
| `spec` | El archivo `.spec.md` de la spec, entero |
| `tasks:@unit` | Las entradas de `tasks.json` de la unidad como JSON, sin `usage` |
| `tasks:@all:summary` | Una línea por task: id · status · SP · título · cantidad de `files` |
| `plan:@unit` | De `planner.md`: la sección cuyo encabezado empieza con el id de cada task de la unidad. En `lite`: `plan.md` entero |
| `refs:@unit` | Las secciones de `architect.md` y `functional.md` que la unidad referencia (§3), sin duplicar, en orden de documento |
| `index:<doc>` | Índice de encabezados del documento del ciclo (`architect`, `functional`, `planner`, `plan`) con su rango de líneas |
| `doc:<doc>` | El documento del ciclo entero |
| `context:@app` | `context_prompt.md` y `constitution.md` del subproyecto y sus `updates/*.md` en orden de nombre. Si `constitution.md` supera `limits.context_inline_max_bytes`: su índice de encabezados con rangos de líneas, más —enteras— las secciones cuyo encabezado contiene alguna palabra de `context_always` (sin distinguir mayúsculas ni acentos), más los `updates/*.md` enteros |
| `context:@app:index` | `context_prompt.md` entero y solo el índice de `constitution.md` |
| `registry:<api\|schema\|components>@app` | Las entradas del registro `sdd/<api\|schema\|components>.json` bajo el app-key del subproyecto, como JSON |
| `registry:<…>@app:index` | Una línea por entrada (nombre/ruta y `status`) |
| `registry:api@unit` | Solo los endpoints cuyo `path` aparece en el texto ya emitido de `tasks`, `plan` y `refs` de la unidad; si ninguno aparece, el `:index` |
| `verify:@app` | Los comandos `quick` y `full` de `sdd/verify.json` para el subproyecto, y las dos líneas de uso de `pnpm sdd:verify` |
| `verify-results` | Una línea por archivo de `artifacts/verify/*.json`: unidad, nivel, ok, commit corto, duración |
| `acceptance` | De `functional.md`: cada sección de historia reducida a su encabezado y sus líneas de criterio (`- [ ] CA-…` / `- [x] CA-…`) |
| `section:<ruta>#<token>` | Una sección de cualquier archivo bajo `sdd/` (ruta relativa a `sdd/`), resuelta como en §3 |

`@app` = el `app` del bloque (`batches[].app`), o `--app`, o el único elemento de `cycle.apps`.
Con varios apps y sin poder decidir: error de uso que lista los candidatos.

## 3. Secciones y referencias

Modelo de sección: un encabezado markdown (`#`..`######`, fuera de bloques de código cercados) y
todo lo que sigue hasta el próximo encabezado de nivel igual o superior.

Resolver `<token>` contra los encabezados de un documento, en este orden:
1. El texto del encabezado (sin los `#`) empieza con el token seguido de fin de texto o de un
   carácter que no sea letra, dígito ni guion (`D-04` matchea «D-04. Enlazado…», no «D-041»).
2. Igualdad del texto normalizado (minúsculas, sin acentos, sin signos, espacios colapsados).
3. El texto normalizado del encabezado contiene el token normalizado, si hay un solo candidato.
Sin match, o con varios en el paso 3: no resuelto.

Qué referencia una unidad (`refs:@unit`), como unión:
- `refs` explícitas de cada task (`"architect#D-04"`, `"functional#US-2-001"`).
- **Derivadas, sin que nadie las escriba:** los ids de encabezado de `architect.md` y
  `functional.md` que aparecen como token entero en la sección de `planner.md` de la task o en
  su entrada de `tasks.json` (incluye `user_stories`). Un id de encabezado es el primer token del
  encabezado si tiene la forma `LETRAS-…dígitos` (`D-04`, `US-2-001`, `RN-12`). Un rango
  `D-01..D-03` o `D-01..03` se expande.
- Refs no resueltas: se listan en la cabecera del paquete y el paquete agrega al final el índice
  de encabezados del documento. `sdd:validate` avisa por cada ref explícita no resuelta.
- Si la unidad no referencia nada de un documento que existe: el paquete trae el índice de ese
  documento con rangos de líneas («leé solo lo que necesites con offset/limit»).

## 4. `pnpm sdd:pack`

```bash
pnpm sdd:pack <spec-id|slug> cycle-XX <rol> [B-NN | TASK-NNN[,TASK-NNN…]] [--app <id>] [--stdout]
pnpm sdd:pack <spec-id|slug> cycle-XX --stats [--json]
```

- Rol con `unit: batch`: la unidad es obligatoria (un bloque de `batches`, o una lista de tasks
  para ciclos sin `batches`). Rol con `unit: cycle`: no lleva unidad.
- Escribe `sdd/specs/<spec>/cycles/cycle-XX/artifacts/packs/<unidad>.<rol>.md` (`<unidad>` =
  `B-NN`, `TASK-NNN` —o `TASK-001+TASK-002`—, o `cycle`). El directorio lo crea el script con un
  `.gitignore` propio (`*`): el paquete es derivado y nunca se commitea.
- Salida: UNA línea — `<ruta> · <bytes> bytes (~<tokens>k tokens) · sources <bytes> bytes`, donde
  `sources` es la suma de los archivos fuente completos de los que salió el paquete. `--stdout`
  imprime el paquete en vez de escribirlo.
- Forma del paquete:
  ```markdown
  # Pack · <spec> · cycle-XX · <unidad> · <rol>
  > Generado por `pnpm sdd:pack` (<ISO>). Derivado: no se edita ni se commitea.
  > Este paquete es tu contexto. Si te falta algo, leé la fuente que indica cada sección y
  > avisalo en tu respuesta (pack-miss) para que el paquete se ajuste.
  > Fuentes: <ruta>@<sha256 8 chars> · …
  > Refs sin resolver: <lista o «ninguna»>

  # [1] Ciclo
  # [2] Tasks de la unidad
  …
  ```
  Cada extracto va precedido por una línea `<!-- src: <ruta relativa al repo>#L<inicio>-L<fin> -->`.
  El contenido fuente no se altera (ni niveles de encabezado ni espacios).
- Si el paquete supera `limits.max_pack_bytes`, la cabecera lo dice y `--stats` lo marca; no se
  trunca.
- `--stats`: una fila por rol y unidad posible del ciclo con `pack_bytes`, `source_bytes` y la
  razón, más el total; y, si hay `usage.pack_misses` en las tasks del ciclo, las rutas más
  repetidas. No escribe nada.
- Códigos de salida: `0` ok · `2` uso inválido, spec/ciclo/unidad inexistente · `3` el rol no
  tiene entrada en `packs.json` o `packs.json` no existe.
- Determinista: mismas fuentes ⇒ mismo paquete byte a byte, salvo la línea de fecha.
- Robustez: documentos con CRLF o BOM, encabezados dentro de bloques de código (se ignoran),
  encabezados repetidos, documentos vacíos o ausentes, `tasks.json` sin `batches`.

## 5. Agentes

- Orquestador: antes de despachar un bloque corre `pnpm sdd:pack <spec> cycle-XX <rol> B-NN` y
  el prompt de despacho lleva: rol, unidad, ruta del paquete, primera task y notas propias. Para
  functional, planner, architect y reviewer: `pnpm sdd:pack <spec> cycle-XX <rol>`. Si el comando
  sale con 3, despacha como antes.
- Cada `agents/sdd-<rol>.agent.md`: la lista de documentos a leer se reemplaza por «tu contexto
  es el paquete que te indica el orquestador; leelo entero antes de empezar y no leas documentos
  del ciclo fuera de él salvo que te falte algo; lo que leas afuera, decilo en tu respuesta». Sin
  paquete (repo sin `packs.json`, o arnés sin orquestador), el agente lee las fuentes que el
  paquete habría resumido: el `agent.md` conserva esa lista en una sola línea de fallback.
- `rules/sdd-execution.md` gana una sección `## Protocolo del implementador` (los pasos por task
  del bloque, autocontenidos) que el selector `section:` incluye en el paquete.
- El orquestador pasa los pack-miss que le reporta un agente a `pnpm sdd:task … --pack-miss`.
