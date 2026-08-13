# AGENTS.md — @e-burgos/sdd-harness

> Arnés para agentes AI que trabajen en **este repo** (la CLI). Este proyecto **no usa el ciclo
> SDD** — es la herramienta que lo instala en otros repos. Fuente única: este archivo;
> `CLAUDE.md` apunta acá.

## Qué es este repo

CLI (`harness`) que genera repos AI-agent-ready con la metodología SDD, en **tres modos**:

| Modo             | Comando                     | Resultado                                                    |
| ---------------- | --------------------------- | ------------------------------------------------------------ |
| **Nx monorepo**  | `harness init` (modo nx)    | Workspace Nx (`apps/`, `libs/`, `tools/`) + sistema SDD       |
| **Standalone**   | `harness init --standalone` | UNA app con el código en la raíz del repo (sin Nx) + SDD      |
| **SDD harness**  | `harness configure sdd`     | Solo el sistema SDD + arnés dual sobre un proyecto existente  |

Stack: TypeScript ESM, citty (CLI), @clack/prompts, fs-extra, esbuild (build), vitest.
Package manager: **pnpm**.

## Reglas duras (violarlas rompe el producto)

1. **`apps/cli/templates/sdd/` es el kit SDD portable canónico y se copia VERBATIM.** No renderizar
   templates sobre él (no EJS — se eliminó a propósito), no hardcodear nombres de proyecto en
   ningún archivo del kit: `sdd/global.json` es la única fuente del nombre/descripción y
   `sdd/scripts/validate-sdd.mjs` **falla** si se filtran (regla de portabilidad).
2. **El kit es su propia fuente de verdad.** No existe "upstream": los SDD de los repos YPF
   (`inv-trading`, `front-ypf-bo-mfe`) evolucionan por separado — no sincronizar en ninguna
   dirección. Para actualizar el kit: editar `apps/cli/templates/sdd/` y correr la suite.
3. **Los schemas del kit son estrictos** (`additionalProperties: false`). Todo JSON que escriba
   un generador (`global.json`, `specs/index.json`, etc.) debe matchear la forma exacta —
   verificar contra `apps/cli/templates/sdd/schemas/*.schema.json` antes de cambiar un generador.
4. **Blueprints y renombre de tokens** (`apps/cli/src/utils/blueprint.ts`): `java-api` usa
   `example-api` / `exampleapi` / `Exampleapi`; `react-app` usa `example-app`; `ts-lib` usa
   `shared-lib`. El renombre aplica a paths Y contenidos. Si agregás un blueprint, respetá el
   patrón y probalo con generación real.
5. **Ejecutores Nx**: `@nx/vite:test` NO existe en Nx 23 (ya rompió react-app y hono) — para
   targets de test usar `nx:run-commands` → `vitest run --passWithNoTests`. Spring Boot integra
   por **Maven** vía `nx:run-commands` (nada de Gradle). El kit usa el wiring legacy `paths` en
   `tsconfig.base.json` — no mezclar con TS solution setup.
6. **Skills en `skill.md` minúscula.** Linux es case-sensitive; `SKILL.md` ya dejó skills
   inaccesibles una vez.
7. **Convención standalone**: el repo generado se registra como app lógica única `apps/<nombre>`
   en los registros SDD (los schemas exigen ese patrón; el validador no chequea que exista en
   disco). No "arreglar" esto cambiando schemas.
8. **En modo nx, `.nxignore` con `sdd/templates` es obligatorio** — sin él Nx registra los
   blueprints como proyectos y CI explota.
9. **`configure sdd` sobre repos existentes nunca destruye**: los `AGENTS.md`/`CLAUDE.md`
   previos se absorben en `sdd/dual-harness/` antes de symlink-ear; el `package.json` se
   mergea, no se pisa.
10. **`update sdd` jamás toca datos del usuario.** El baseline de hashes vive en `sdd/kit.json`
    (lo escribe cada install — no borrarlo del flujo). La frontera kit/data/generado está en
    `apps/cli/src/generators/kit-manifest.ts`: si agregás un archivo al kit que acumula datos
    del usuario, registralo ahí como data o el update lo va a pisar.

## Workflow de desarrollo

```bash
pnpm install
npm run build        # esbuild bundle + .d.ts → dist/
npm run typecheck    # tsc lib + spec
npx vitest run       # suite completa (incluye integración real)
```

- La suite de integración corre `setup-agents.sh` y `validate-sdd.mjs` **de verdad** sobre
  workspaces generados en tmpdir — si tocás generadores o el kit, tiene que quedar verde.
- **Antes de declarar terminado un cambio de generador: generación real.** Las pruebas E2E van
  en `examples/` (gitignoreado): `test-sdd-nx-workspace`, `test-sdd-standalone`,
  `test-sdd-harness`. Así se encontraron los 6 bugs de v0.3.0 que los unit tests no veían.
- Versionado: SemVer + `CHANGELOG.md` (Keep a Changelog) + `src/version.ts` sincronizado con
  `package.json`. Commits convencionales (`feat:`, `fix:`, `chore:` con scope).
- **Cada release se publica sola en [`e-burgos/sdd-harness-examples`](https://github.com/e-burgos/sdd-harness-examples)**:
  ese repo regenera sus examples desde el paquete **ya publicado** en npm y commitea el
  resultado. Es la vidriera del producto y además un smoke test del release — si una versión
  no puede generar un workspace, ese repo se pone en rojo. No se editan a mano: el arreglo va
  siempre acá, en la CLI o en el kit.

## Mapa del código

| Path                                  | Rol                                                                |
| ------------------------------------- | ------------------------------------------------------------------ |
| `apps/cli/src/cli.ts` + `src/commands/`        | Comandos citty: `init`, `add app|spec|skill|service`, `configure`, `info` |
| `apps/cli/src/generators/workspace.generator`  | Modo nx: config raíz desde `apps/cli/templates/sdd/templates/nx-workspace/` |
| `apps/cli/src/generators/standalone.generator` | Modo standalone: 7 tipos de app en la raíz                          |
| `apps/cli/src/generators/sdd.generator`        | Instalación del kit: copia verbatim + global.json + contexto + setup-agents; `layout` nx/standalone, merge de package.json, absorción de arnés previo |
| `apps/cli/src/generators/app|lib.generator`    | Apps/libs nx (react/springboot/ts-lib vía blueprints)               |
| `apps/cli/src/utils/blueprint.ts`              | Copia de blueprints con renombre de tokens                          |
| `apps/cli/templates/sdd/`                      | **Kit SDD portable canónico** (se publica en npm)                   |
| `apps/cli/templates/workspace/`                | `eslint.config.mjs` del modo nx (la CLI agrega `@nx/eslint-plugin` + `typescript-eslint` a las deps) |
| `apps/documentation/`                          | Sitio de docs interactivo (React/Vite/Tailwind v4, independiente). Contenido bilingüe en `src/data/content.ts` + `content.en.ts` — si cambia la CLI, actualizar ambos. Deploy automático a Cloudflare Pages vía `.github/workflows/deploy-docs.yml` (el proyecto de Pages es direct upload: no buildea solo) |

## 🔎 Búsqueda y exploración del repo (graphify — OPCIONAL)

> graphify indexa el repo como grafo de conocimiento en `graphify-out/` (código vía AST +
> capa semántica de docs). Es **opt-in por dev**: `graphify-out/` está gitignoreado, no viaja
> con el repo y en un clon nuevo no existe. **Nada del workflow de este repo depende de él.**

**Si `graphify-out/graph.json` existe**, consultalo antes de hacer `grep`/`Read` a ciegas o de
lanzar un agente de exploración: una consulta devuelve una respuesta acotada citando
`source_file`/`source_location`, en vez de leer archivos completos para reconstruir la misma
información. Es la opción más barata en tokens.

| Comando                        | Para qué                                                          |
| ------------------------------ | ----------------------------------------------------------------- |
| `graphify query "<pregunta>"`  | Arquitectura, dependencias, flujos. `--budget N` acota la salida. |
| `graphify explain "<nodo>"`    | Un archivo, clase o concepto **antes de tocarlo**.                |
| `graphify path "<A>" "<B>"`    | Camino más corto entre dos partes lejanas del sistema.            |
| `graphify affected "<nodo>"`   | Traversal inverso: qué se impacta si cambiás ese nodo.            |
| `graphify-out/GRAPH_REPORT.md` | God Nodes, hyperedges y comunidades etiquetadas.                  |

**Si no existe**, no lo menciones ni intentes construirlo por tu cuenta (consume cupo de API
del dev): trabajá con `grep`/`Read`/agentes de exploración con normalidad. Para habilitarlo,
la guía completa está en `apps/cli/templates/sdd/skills/setup-graphify/skill.md` (instalación, backend
gratuito Gemini free tier u Ollama local, y protocolo de validación del modelo).

**Mantenimiento — solo si lo tenés instalado.** Un grafo desactualizado **miente** (archivos
movidos, símbolos nuevos). Actualizalo al cerrar cada unidad de trabajo — feature, fix o antes
de cerrar un PR — **no** después de cada edición individual:

```bash
set -a && source .env && set +a   # ⚠️ imprescindible: graphify NO lee el .env
graphify check-update .           # ¿hay re-extracción semántica pendiente?
graphify update .                 # solo código (AST): gratis, sin LLM
graphify cluster-only . --no-viz  # o `graphify label .` → re-etiquetar comunidades
```

> [!CAUTION]
> Dos trampas silenciosas: (1) `source .env` a secas no exporta — la key no llega y graphify
> cae al fan-out de subagentes del harness (se paga el modelo caro creyendo usar el gratuito);
> (2) varios modelos "lite" devuelven un grafo vacío (0 edges) sin avisar. Si el modelo
> gratuito falla o se agotó el cupo diario (resetea 00:00 UTC): **avisá al dev y dejá la
> actualización para después** — no escales a un modelo pago sin autorización explícita.

## ⚙️ Selección de modelo y esfuerzo (OBLIGATORIO — optimización de tokens/contexto)

> [!IMPORTANT]
> **Antes de encarar CUALQUIER tarea nueva —sin importar con qué modelo estés corriendo en
> ese momento— decidí explícitamente qué modelo y qué nivel de esfuerzo conviene, para el
> trabajo propio y para CADA subagente/workflow que dispares.** El objetivo es gastar el
> mínimo de tokens y contexto sin bajar la calidad. No arranques a ejecutar sin esta decisión.

**Regla base:** elegí el modelo/esfuerzo más barato que aún cumple la tarea con calidad.
Escalá de tier sólo cuando la tarea lo justifique (ambigüedad, razonamiento cross-cutting,
riesgo de error alto). Ante la duda entre dos tiers, probá el más barato primero y escalá si
el resultado no alcanza.

**Modelos disponibles** (`model`): `haiku` · `sonnet` · `opus` · `fable`.
**Esfuerzo** (`effort`): `low` · `medium` · `high` · `xhigh` · `max`.

| Tipo de tarea                                                                                                        | Modelo sugerido | Esfuerzo       |
| -------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- |
| Lectura de estado, formateo, edición mecánica/puntual, respuestas cortas, grep/glob dirigido                         | `haiku`         | `low`–`medium` |
| Implementación estándar (una task acotada), tests, edición multi-archivo simple, la mayoría de subagentes ejecutores | `sonnet`        | `medium`       |
| Arquitectura, decisiones cross-cutting, debugging complejo, cambios en generadores o en el kit, síntesis             | `opus`          | `high`–`xhigh` |
| Sólo el paso más difícil (verify adversarial, judge, diseño crítico)                                                 | según tarea     | `xhigh`–`max`  |

**Cómo aplicarlo en este repo:**

- **Subagentes (`Agent`) y workflows (`Workflow`):** pasá `model` y `effort` explícitos en
  cada llamada, acordes a la tabla. Un fan-out de lectores/mecánicos va en `haiku`/`low`;
  el paso de verificación o síntesis en `opus`/`high`. Nunca dispares todo un fleet en el
  tier más caro por defecto.
- **Cambios en `apps/cli/templates/sdd/` o en generadores** son de la fila `opus`/`high`: se publican
  verbatim a npm y se copian a los repos de los usuarios — el costo de equivocarse es alto.
- **Trabajo propio (main loop):** si la tarea es trivial, bajá el esfuerzo; no quemes
  contexto releyendo lo ya establecido ni narrando opciones que no vas a seguir.
- **Si el repo tiene grafo de graphify** (regla anterior, opcional), consultalo antes de
  pagar lecturas a ciegas: es parte de la misma optimización de tokens.

## Estilo

- Código, identificadores y commits en inglés; comentarios y docs de usuario pueden ir en
  español (es el idioma del kit).
- Comentarios solo para restricciones que el código no puede expresar — este repo sigue la
  misma filosofía anti-comentarios del kit.
- Preferir generación programática (`fs.writeJSON`, patch de objetos) sobre templates de texto.
