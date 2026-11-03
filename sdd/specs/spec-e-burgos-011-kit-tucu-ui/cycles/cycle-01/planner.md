## Sprint Plan — Ciclo 1 — kit-tucu-ui

**Duración estimada:** 3.6 semanas (un dev, ~6 h efectivas/día)
**Story points totales:** 86  ·  **Horas totales:** 108

Orden en tres etapas que se pueden implementar por separado: (1) plantillas del kit en `apps/cli/templates/sdd` (schema, helper de merge MCP compartido, script `sdd-tucu.mjs`, `setup-agents.sh` y `.ps1`, avisos del validador, playbook del steward); (2) CLI en `apps/cli/src` (oferta y flags en `init` y `configure sdd`, `configure mcp` con merge, `update sdd` que conserva el estado, specs); (3) documentación bilingüe, textos de arneses, generación real en `examples/` y verificación integral. El ciclo toca `apps/cli` (el kit viaja dentro de su paquete) y, solo en TASK-026, los tests de `apps/studio-bridge` y el `sdd/` dogfood de este repo.

Reglas del ciclo que valen para todas las tasks: retrocompatibilidad (ningún campo nuevo a `required`, el validador avisa y no falla), `sdd/tools.json` es dato del proyecto, paridad sh/ps1 y sin red salvo para instalar la skill. Nada de comentarios en el código. Las tasks ya están ajustadas a `architect.md` (decisiones D-01 a D-14); el implementador lo lee antes de empezar cada una.

**Camino crítico:** TASK-002 → TASK-023 → TASK-003 → TASK-004 → TASK-024 → TASK-005 → TASK-013 → TASK-016 → TASK-018 → TASK-019 → TASK-021 → TASK-022 (60 h).

**Paralelismo:** TASK-001, TASK-002 y TASK-025 arrancan sin dependencias; TASK-023 sigue a 001 y 002; tras TASK-003 se abren TASK-004, TASK-009 y TASK-011; TASK-010 solo necesita 001 y 023; el `.ps1` (TASK-008) sigue al `.sh` (TASK-007); en la etapa 2 TASK-014, TASK-015 y TASK-016 son independientes entre sí tras TASK-013.

**Verificación por etapa:** etapa 1 cierra con TASK-012 (specs de integración del kit) y TASK-026 (dogfood y puente), etapa 2 con TASK-018, etapa 3 con TASK-022 (`pnpm build && pnpm typecheck && pnpm test` y `pnpm sdd:validate`).

## Etapa 1 — Plantillas del kit

### TASK-001: Esquema: clave opcional tucu_ui, default apagado en el template e integrations/ como dato del kit

**Historia:** US-1-004, US-2-004
**App:** apps/cli
**Descripción:** Decisiones D-01, D-02. Agregar `tucu_ui` como propiedad opcional de la raíz de `tools.schema.json` (la raíz conserva `additionalProperties:false` y `required` sigue siendo solo `rtk`). Dentro de `tucu_ui`: `type:object`, sin `required`, `additionalProperties:true`, con `enabled`/`skill`/`mcp` boolean y `version` string con pattern semver; las claves conocidas tienen tipo estricto. El template `tools.json` suma `"tucu_ui": { "enabled": false, "skill": true, "mcp": true }` y una oración en `_description`. En `kit-manifest.ts` se agrega `'integrations/'` a `DATA_PREFIXES` para que `update sdd` nunca barra ni genere `.new` sobre la skill instalada. Un `tools.json` anterior sin la clave valida igual.
**Archivos:** `apps/cli/templates/sdd/schemas/tools.schema.json`, `apps/cli/templates/sdd/tools.json`, `apps/cli/src/generators/kit-manifest.ts`, `apps/cli/src/generators/__tests__/sdd.generator.integration.spec.ts`, `apps/cli/src/generators/__tests__/update.generator.spec.ts`
**CA cubiertos:** CA-017, CA-018, CA-019, CA-021, CA-082, CA-084, CA-086
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test`
**Criterio de done:**

- [ ] `tools.json` sin `tucu_ui` valida contra el schema
- [ ] `tucu_ui` con clave desconocida adentro valida y la raíz sigue rechazando claves ajenas
- [ ] Ningún campo nuevo en `required`
- [ ] `isKitOwned("integrations/skills/tucu-ui-design/SKILL.md")` es falso y `update` no la toca
- [ ] Spec del generador y de update verdes

### TASK-002: Helper compartido de merge de archivos MCP (mcp-config.mjs)

**Historia:** US-3-001, US-3-002
**App:** apps/cli
**Descripción:** Decisión D-05. ESM plano, sin dependencias ni imports de otros scripts del kit. API: `MCP_TARGETS` (`.mcp.json`/`mcpServers`, `.vscode/mcp.json`/`servers` con `stdioType`, `.gemini/settings.json`/`mcpServers`), `readMcpConfig` (`missing`/`broken`/`ok`, quita BOM), `containerState`, `planUpsert` (`created`/`updated`/`unchanged`/`custom`/`invalid-container`; agrega al final y conserva el orden; reemplaza en el lugar solo si `isOwn`), `planRemove` (`removed`/`absent`/`custom`/`invalid-container`; contenedor vacío queda `{}`) y `writeMcpConfig` (mkdir -p, archivo temporal + rename, `JSON.stringify(doc,null,2)+'\n'`, sin reescribir si no hay cambios). Las claves de primer nivel ajenas no se tocan. No hay copia en TypeScript: la CLI lo carga con el wrapper de TASK-013.
**Archivos:** `apps/cli/templates/sdd/scripts/mcp-config.mjs`, `apps/cli/src/utils/__tests__/mcp-config.spec.ts`
**CA cubiertos:** CA-041, CA-044, CA-045, CA-047, CA-048, CA-049, CA-050, CA-051, CA-052
**Estimación:** 6h · **Story points:** 5
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- mcp-config`
**Criterio de done:**

- [ ] Merge conserva servidores, orden y claves ajenas en los tres formatos
- [ ] Quitar elimina solo la entrada propia y deja una personalizada
- [ ] JSON inválido y contenedor inválido no se reescriben y devuelven resultado tipado
- [ ] Idempotente: segunda corrida no cambia bytes
- [ ] BOM inicial tolerado

### TASK-023: tucu-ui-common.mjs: constantes, entrada MCP canónica, estado y reglas de versión

**Historia:** US-1-001, US-1-004, US-2-001, US-3-001
**App:** apps/cli
**Descripción:** Decisión D-06 (módulo común). Importa `mcp-config.mjs`; sus raíces son parámetros, no se derivan de su ubicación, para poder usarlo desde la CLI. Exporta `TUCU_UI_PACKAGE`, `TUCU_UI_PINNED_VERSION` (0.16.0, único lugar), `TUCU_UI_SERVER_NAME`, `TUCU_UI_SKILL_NAME`, `TUCU_UI_INSTALL_DIR` (`sdd/integrations/skills/tucu-ui-design`), `TUCU_UI_LINK_DIRS`, `TUCU_UI_KNOWN_KEYS`, `tucuUiSettings(tools)` (defaults de D-02 y claves desconocidas), `kitTucuEntry(version,target)` (`npx -y @e-burgos/tucu-ui-mcp@<v>`; `type:stdio` en `.vscode/mcp.json`), `isKitTucuEntry` (reconoce `npx` y `cmd /c npx`), `isSkillInstallComplete` (SKILL.md, references/checklist.md, references/design-guide.md), comparación de versión sin red y `tucuUiStatus(root)` con la forma JSON de D-07 (`state`, `parts`, `version`, `kit_version`, `update_available`, `node_ok`, `skill.links`, `mcp`, `harnesses`, `unknown_keys`, `repair`).
**Archivos:** `apps/cli/templates/sdd/scripts/tucu-ui-common.mjs`, `apps/cli/src/utils/__tests__/tucu-ui-common.spec.ts`
**CA cubiertos:** CA-002, CA-004, CA-017, CA-020, CA-042, CA-043, CA-044, CA-046, CA-082, CA-085
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- tucu-ui-common`
**Criterio de done:**

- [ ] `tucuUiStatus` no escribe ni usa red y reporta `off` con `tools.json` ausente o anterior
- [ ] `isKitTucuEntry` distingue entrada propia (npx y cmd /c) de personalizada
- [ ] La versión fijada vive en una sola constante
- [ ] Defaults y claves desconocidas cubiertos por spec

### TASK-003: sdd-tucu.mjs base: parseo de argumentos y --status

**Historia:** US-1-001, US-1-004
**App:** apps/cli
**Descripción:** Decisión D-07. Crear `sdd/scripts/sdd-tucu.mjs` con el molde de `sdd-mod.mjs` (`readTools` sale con 1 si el JSON está roto, `tools.json` ausente o sin clave equivale a apagado, serialización `JSON.stringify(x,null,2)+'\n'`). Sin argumentos o `--status`: imprime el JSON de `tucuUiStatus` (TASK-023), solo lectura y sin red. Códigos de salida: 0, 1 si falla un paso, 2 ante uso inválido (argumento desconocido, `--enable` con `--disable`, `--parts` inválido, `--purge` sin `--disable`, `--force` sin `--enable`) con el texto de uso. Deja el esqueleto de `--enable`, `--disable` y `--sync` que implementan TASK-004 a TASK-006 y TASK-024.
**Archivos:** `apps/cli/templates/sdd/scripts/sdd-tucu.mjs`
**CA cubiertos:** CA-001, CA-002, CA-003, CA-004, CA-005, CA-011, CA-017, CA-020
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-001, TASK-023
**Verificación:** `node apps/cli/templates/sdd/scripts/sdd-tucu.mjs --status` en un workspace de prueba
**Criterio de done:**

- [ ] `--status` no modifica archivos y sale 0 con `tools.json` viejo o ausente
- [ ] Reporta `incomplete` por arnés con el comando que repara
- [ ] JSON inválido corta con mensaje accionable y sin escribir
- [ ] Uso inválido devuelve 2

### TASK-004: Instalación de la skill desde @e-burgos/tucu-ui-mcp (versión fija, atómica, sin red)

**Historia:** US-2-001, US-2-004
**App:** apps/cli
**Descripción:** Decisión D-06 (instalación) y D-01. Preflight sin escrituras: Node >= 20 (`needs Node >= 20 (found X)`). Staging `sdd/integrations/skills/.tucu-ui-design.staging-<pid>`; `spawnSync('npx',['--yes','-p','@e-burgos/tucu-ui-mcp@<v>','tucu-ui-skill','install','--dir',staging,'--force'])` con `shell` en win32, `stdio:'pipe'` y timeout de 180 s. Acepta `SKILL.md` en `staging/` o en `staging/tucu-ui-design/` (R-1). Verifica completitud; reemplazo por rename (`.old`) y limpieza del staging ante cualquier error, así nunca queda la carpeta final a medias. Solo instala si falta, está incompleta o hay `--force`; con la skill vigente no consulta la red. Error de red (`ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNREFUSED`, `ENETUNREACH`): mensaje con versión intentada, `tools.json` sin cambios y comando de reintento. Costura de test: `SDD_TUCU_NPX` ejecuta `process.execPath [SDD_TUCU_NPX, ...args]` en lugar de `npx`. Informa versión y carpeta.
**Archivos:** `apps/cli/templates/sdd/scripts/sdd-tucu.mjs`
**CA cubiertos:** CA-022, CA-023, CA-024, CA-025, CA-026, CA-037, CA-038, CA-040
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-003
**Verificación:** `node apps/cli/templates/sdd/scripts/sdd-tucu.mjs --enable` con `SDD_TUCU_NPX` apuntando a un stub
**Criterio de done:**

- [ ] Segunda corrida no reinstala ni usa red
- [ ] Sin red y sin skill: falla con mensaje accionable y sin carpeta parcial ni staging
- [ ] Sin red con skill ya instalada: no falla
- [ ] Node < 20 corta antes de escribir
- [ ] `sdd/skills` y `catalog.json` quedan intactos

### TASK-024: sdd-tucu.mjs: enlazado de tucu-ui-design en los tres lugares, conversión de .claude/skills y --sync

**Historia:** US-2-002, US-2-003, US-5-003
**App:** apps/cli
**Descripción:** Decisión D-04. Un enlace del kit es un symlink o junction cuyo `realpathSync` resuelve a `sdd/integrations/skills/tucu-ui-design`; cualquier otra cosa con ese nombre es ajena (se reporta `foreign` y no se toca). Forma: symlink relativo `../../sdd/integrations/skills/tucu-ui-design` en POSIX y junction con target absoluto en win32. Si `.claude/skills` es un symlink/junction hacia `sdd/skills`, se convierte en directorio real con un enlace por entrada (omite `*.new`, incluye plugins como `sdd-mod`) antes de enlazar, para no escribir dentro de `sdd/skills`; la conversión es permanente. Modo `--sync` (lo llaman `setup-agents.sh` y `.ps1`): sin red ni instalación, crea los enlaces que faltan si está prendido con `skill:true` y carpeta completa, y en cualquier otro caso quita solo los enlaces del kit; siempre sale 0 e imprime líneas con el formato de `setup-agents` (`created`/`kept`).
**Archivos:** `apps/cli/templates/sdd/scripts/sdd-tucu.mjs`
**CA cubiertos:** CA-027, CA-028, CA-029, CA-030, CA-031, CA-032, CA-033, CA-034, CA-035, CA-036, CA-087
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-003, TASK-004
**Verificación:** `node sdd/scripts/sdd-tucu.mjs --sync` dos veces sobre un workspace de prueba con la skill instalada
**Criterio de done:**

- [ ] Dos corridas dejan el árbol idéntico
- [ ] Las skills `sdd-*` y `sdd-mod` siguen visibles tras convertir `.claude/skills`
- [ ] Un `tucu-ui-design` ajeno no se pisa y se avisa
- [ ] Apagado o parte skill deshabilitada: `--sync` quita solo los enlaces del kit
- [ ] Nada se escribe dentro de `sdd/skills`

### TASK-005: sdd-tucu.mjs --enable: orquestación, todo o nada, partes y reparación

**Historia:** US-1-002, US-3-001, US-3-002
**App:** apps/cli
**Descripción:** Decisiones D-07, D-08, D-06. Orden: (1) preflight sin escrituras (Node >= 20 y los tres archivos MCP parsean; un archivo roto o con contenedor inválido aborta con 1 listando archivo y motivo, sin escribir ni `tools.json`; con `--parts=skill` no se inspeccionan), (2) instalar la skill (TASK-004), (3) enlazar (TASK-024), (4) upsert MCP en los tres archivos con `planUpsert` (entrada personalizada: se avisa y no se reemplaza), (5) en win32 intento best effort de `claude mcp add --scope local tucu-ui -- cmd /c npx -y @e-burgos/tucu-ui-mcp@<v>` (si falla se imprime el comando exacto), (6) escribir `tools.json` al final. `--parts=skill,mcp` es el conjunto exacto de partes (`--parts=skill` escribe `mcp:false` y quita las entradas MCP propias); sin `--parts` respeta lo existente. Escribe `tucu_ui = { enabled:true, skill:true, mcp:true, ...actual, ...patch }`, completa `version` si falta y con `--force` la sube a la del kit y reescribe el token de versión de las entradas propias; conserva `$schema`, `_description`, `rtk` y `claude_mod`. Crea `tools.json` si no existe. Cierre: una línea por harness y la versión con su carpeta; `already on and complete` si no hubo cambios.
**Archivos:** `apps/cli/templates/sdd/scripts/sdd-tucu.mjs`
**CA cubiertos:** CA-006, CA-007, CA-008, CA-009, CA-010, CA-041, CA-043, CA-045, CA-049, CA-050, CA-085
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-002, TASK-004, TASK-024
**Verificación:** `node apps/cli/templates/sdd/scripts/sdd-tucu.mjs --enable` y luego `--status`, con stub de npx
**Criterio de done:**

- [ ] Un paso fallido deja `tools.json` como estaba
- [ ] Archivo MCP roto aborta antes de instalar o enlazar
- [ ] Segunda corrida reporta `already on and complete` sin cambiar bytes
- [ ] `--parts` fija el conjunto exacto
- [ ] Otras claves de `tools.json` conservadas byte a byte

### TASK-006: sdd-tucu.mjs --disable: quitar enlaces y entradas MCP sin borrar datos del dev

**Historia:** US-1-003, US-2-003, US-3-002
**App:** apps/cli
**Descripción:** Decisiones D-07, D-04, D-05. Sin red: quita solo los enlaces del kit en los tres lugares, solo la entrada `tucu-ui` propia de los tres archivos MCP (contenedor vacío queda `{}`) y en win32 `claude mcp remove --scope local tucu-ui` con el mismo criterio best effort; después escribe `tools.json` con `enabled:false`. Conserva la carpeta instalada salvo `--purge`, que borra `sdd/integrations/skills/tucu-ui-design`. Faltantes, enlaces ajenos, entradas personalizadas y archivos MCP rotos se informan y no hacen fallar (solo un `tools.json` roto sale con 1); un archivo roto se deja como está y el mensaje avisa que puede conservar la entrada. Si ya estaba apagado y limpio imprime `tucu_ui: already off` y no escribe.
**Archivos:** `apps/cli/templates/sdd/scripts/sdd-tucu.mjs`
**CA cubiertos:** CA-012, CA-013, CA-014, CA-015, CA-016, CA-033, CA-034, CA-035, CA-036, CA-051, CA-052
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-005
**Verificación:** `node apps/cli/templates/sdd/scripts/sdd-tucu.mjs --disable` sobre un workspace con servidores ajenos
**Criterio de done:**

- [ ] Apagar dos veces no cambia nada la segunda
- [ ] Enlace ajeno o entrada personalizada no se toca
- [ ] Apagar y volver a prender no vuelve a descargar
- [ ] `--purge` borra solo la carpeta de la skill
- [ ] Funciona sin red

### TASK-007: setup-agents.sh: delegar el enlazado de tucu-ui-design en sdd-tucu.mjs --sync

**Historia:** US-2-002, US-5-003
**App:** apps/cli
**Descripción:** Decisión D-04. Agregar al final de `setup-agents.sh`, junto a la llamada a `setup-rtk.mjs`, una línea `node sdd/scripts/sdd-tucu.mjs --sync || true` (tolerante a fallos y a que el script no exista en kits a medio actualizar). La lógica de enlazado vive en TASK-024; acá solo se garantiza el orden respecto de `prune_stale_links` y `link_dir`, que con `.claude/skills` ya convertido entra por `link_items` y reporta `kept`. Con la integración apagada no se escribe nada de tucu-ui.
**Archivos:** `apps/cli/templates/sdd/scripts/setup-agents.sh`
**CA cubiertos:** CA-027, CA-028, CA-030, CA-031, CA-032, CA-035, CA-087
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-024
**Verificación:** `bash apps/cli/templates/sdd/scripts/setup-agents.sh` dos veces sobre un workspace de prueba
**Criterio de done:**

- [ ] Dos corridas seguidas dejan el árbol idéntico
- [ ] Las skills `sdd-*` siguen visibles en los cuatro arneses
- [ ] Con tucu-ui apagado no hay enlaces de tucu-ui
- [ ] Si `sdd-tucu.mjs` falla o no existe, `setup-agents` termina igual

### TASK-008: setup-agents.ps1: paridad Windows de la delegación a sdd-tucu.mjs --sync

**Historia:** US-2-002
**App:** apps/cli
**Descripción:** Decisiones D-04 y D-06. Misma delegación que el `.sh` con `try/catch` y `node sdd/scripts/sdd-tucu.mjs --sync`, tras el bloque de `setup-rtk.mjs`. Como la lógica es un solo archivo Node, la paridad de comportamiento sale por construcción (junctions con target absoluto). El caso con `skipIf(!win32)` y la paridad textual viven en TASK-012. La verificación manual en Windows real (R-2: Claude Code nativo y la forma `npx`) queda anotada para el cierre.
**Archivos:** `apps/cli/templates/sdd/scripts/setup-agents.ps1`
**CA cubiertos:** CA-029, CA-030, CA-031, CA-032, CA-087
**Estimación:** 2h · **Story points:** 1
**Dependencias:** TASK-007
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- windows`
**Criterio de done:**

- [ ] Misma llamada y misma tolerancia a fallos que el `.sh`
- [ ] Sin enlace duplicado en segunda corrida (por `--sync`)
- [ ] Spec de paridad textual verde
- [ ] Verificación manual en Windows anotada para el cierre

### TASK-009: Script sdd:tucu en el package.json de workspaces nuevos y existentes

**Historia:** US-1-002, US-5-001
**App:** apps/cli
**Descripción:** Decisión D-07 y hallazgo H-13. Agregar `"sdd:tucu": "node sdd/scripts/sdd-tucu.mjs"` junto a `sdd:mod` y `sdd:rtk` en `templates/nx-workspace/package.json`. `ensureHarnessPackageJson` ya agrega los scripts que faltan en init, configure y update, así que no hace falta migración nueva; se verifica con spec que repos nuevos (nx y standalone) lo traen y que `update sdd` lo agrega sin tocar otros scripts del dev.
**Archivos:** `apps/cli/templates/sdd/templates/nx-workspace/package.json`, `apps/cli/src/generators/__tests__/root-package.spec.ts`, `apps/cli/src/generators/__tests__/standalone.generator.spec.ts`
**CA cubiertos:** CA-006, CA-072
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test`
**Criterio de done:**

- [ ] Workspace nuevo trae `sdd:tucu` en nx y standalone
- [ ] `update sdd` lo agrega si falta y no toca otros scripts
- [ ] Specs verdes

### TASK-010: validate-sdd: avisos de tucu-ui por arnés, por archivo MCP, por clave y por versión

**Historia:** US-5-002
**App:** apps/cli
**Descripción:** Decisión D-10. Tras `validate('tools.json','tools.schema.json')` importar dinámicamente `tucu-ui-common.mjs` dentro de `try` (si falla no se avisa nada) y emitir todo con `warn()`, sin cambiar el código de salida: clave desconocida dentro de `tucu_ui` (siempre, aunque esté apagado); con integración apagada nada más; prendido con `skill`: carpeta incompleta, un aviso por lugar `missing` y `foreign`; prendido con `mcp`: un aviso por archivo `missing`, `no-file`, `broken` o `invalid-container`; y `update_available` con el comando `pnpm sdd:tucu -- --enable --force`. Cada aviso trae el comando de reparación; la parte deshabilitada no se vigila; sin red.
**Archivos:** `apps/cli/templates/sdd/scripts/validate-sdd.mjs`
**CA cubiertos:** CA-016, CA-056, CA-076, CA-077, CA-078, CA-079, CA-080, CA-081, CA-082, CA-085
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001, TASK-023
**Verificación:** `node apps/cli/templates/sdd/scripts/validate-sdd.mjs` sobre un workspace de prueba
**Criterio de done:**

- [ ] Todos los avisos son warnings con el comando de reparación
- [ ] Código de salida intacto en todos los casos
- [ ] Repo con `tools.json` anterior sin salida nueva
- [ ] Falla de importación del módulo común no avisa ni rompe

### TASK-011: Playbook del sdd-steward: operar sdd:tucu a pedido del dev

**Historia:** US-5-001
**App:** apps/cli
**Descripción:** Agregar al playbook de herramientas la fila de estado (`node sdd/scripts/sdd-tucu.mjs --status`) y la operación de prender y apagar a pedido, junto a rtk y mod; sin prender por iniciativa propia.
**Archivos:** `apps/cli/templates/sdd/skills/sdd-steward/SKILL.md`
**CA cubiertos:** CA-075
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-003
**Verificación:** `pnpm sdd:validate`
**Criterio de done:**

- [ ] Fila de estado y de operación agregadas
- [ ] Aclara que decide el dev

### TASK-012: Specs de integración del kit para sdd:tucu (POSIX y Windows)

**Historia:** US-1 a US-5 (ver tasks.json)
**App:** apps/cli
**Descripción:** Decisión D-13. `tucu-ui.integration.spec.ts` con el molde de `sdd-mod.integration.spec.ts`: copia `templates/sdd` a un tmp, corre `setup-agents.sh` real y `sdd-tucu.mjs` con `SDD_TUCU_NPX` apuntando a un stub `.mjs` (variantes completo, offline e incompleto), `describe.skipIf(win32)`. Casos: `--status` sin clave; `--enable` completo (carpeta, `.claude/skills` pasa de symlink a directorio real con `sdd-*` y `sdd-mod` visibles, tres enlaces, tres archivos MCP con servidores y claves ajenas, `context.fileName` y hooks de rtk de `.gemini/settings.json` preservados); idempotencia por hash; `--disable` con entrada personalizada y `tucu-ui-design` ajeno; `--purge`; archivo MCP roto; stub offline; skill ya instalada con stub offline; `setup-agents` prendido y apagado; `--parts=skill`; `update_available`; avisos de `validate-sdd`; exit 2. Caso Windows en `sdd.generator.windows.spec.ts` (`skipIf(!win32)`): junctions, `.claude/skills` convertido, `--sync` idempotente y `--disable`. Cierra la etapa 1.
**Archivos:** `apps/cli/src/generators/__tests__/tucu-ui.integration.spec.ts`, `apps/cli/src/generators/__tests__/sdd.generator.windows.spec.ts`
**CA cubiertos:** CA-001, CA-006, CA-008, CA-010, CA-012, CA-013, CA-027, CA-031, CA-037, CA-038, CA-047, CA-051, CA-076, CA-077, CA-087
**Estimación:** 9h · **Story points:** 8
**Dependencias:** TASK-006, TASK-007, TASK-008, TASK-010
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test`
**Criterio de done:**

- [ ] Cubre los casos listados de D-13
- [ ] Corre offline gracias al stub
- [ ] Suite del paquete verde

### TASK-026: Sincronizar el dogfood sdd/ con el template y cubrir tucu_ui en los tests del puente

**Historia:** US-1-004
**App:** apps/cli
**Descripción:** Decisión D-03 y hallazgos H-10, R-4. Copiar verbatim al `sdd/` de este repo lo que cambió en el template (`schemas/tools.schema.json`, `scripts/mcp-config.mjs`, `scripts/tucu-ui-common.mjs`, `scripts/sdd-tucu.mjs`, `scripts/setup-agents.sh` y `.ps1`, `scripts/validate-sdd.mjs`) y agregar `sdd:tucu` al `package.json` raíz. `sdd/tools.json` de este repo no se toca: el interruptor lo decide el dev. Sin cambios en `kit-tools.ts`: agregar a `kit-tools.parity.spec.ts` las entradas `tucu enabled` y `tucu with unknown key`, y a `kit-tools.spec.ts` un caso con `tucu_ui` (incluida clave desconocida) que pasa `setKitTool` y mantener el rechazo de `surprise:true` en la raíz. Debe ir después de cerrar la etapa 1 porque esos tests leen el `sdd/` de este repo.
**Archivos:** `sdd/schemas/tools.schema.json`, `sdd/scripts/mcp-config.mjs`, `sdd/scripts/tucu-ui-common.mjs`, `sdd/scripts/sdd-tucu.mjs`, `sdd/scripts/setup-agents.sh`, `sdd/scripts/setup-agents.ps1`, `sdd/scripts/validate-sdd.mjs`, `package.json`, `apps/studio-bridge/src/workspace/kit-tools.parity.spec.ts`, `apps/studio-bridge/src/workspace/kit-tools.spec.ts`
**CA cubiertos:** CA-021
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-012
**Verificación:** `pnpm --filter @e-burgos/studio-bridge test && pnpm sdd:validate`
**Criterio de done:**

- [ ] `sdd/` de este repo idéntico al template en los archivos listados
- [ ] `sdd/tools.json` sin cambios
- [ ] Paridad y schema del puente verdes con `tucu_ui`
- [ ] `pnpm sdd:validate` verde

## Etapa 2 — CLI

### TASK-025: Config de init --config: clave opcional sdd.tucu_ui

**Historia:** US-4-001, US-4-003
**App:** apps/cli
**Descripción:** Decisión D-09. Agregar `sdd.tucu_ui?: boolean` opcional al schema de configuración y a su JSON Schema (nada requerido); si hay flag en la línea de comandos, el flag gana. Retrocompatibilidad: un archivo de config sin la clave se comporta igual que hoy.
**Archivos:** `apps/cli/src/config/schema.ts`, `apps/cli/src/config/json-schema.ts`, `apps/cli/src/config/__tests__/load.spec.ts`, `apps/cli/src/config/__tests__/json-schema.spec.ts`
**CA cubiertos:** CA-066, CA-067, CA-070
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- config`
**Criterio de done:**

- [ ] `sdd.tucu_ui` opcional valida en schema y en JSON Schema
- [ ] Config sin la clave sigue válida
- [ ] Specs de config verdes

### TASK-013: Utilidades CLI de tucu-ui: wrapper de scripts del kit, decisión de oferta y ejecución

**Historia:** US-4-001, US-4-002, US-4-003
**App:** apps/cli
**Descripción:** Decisiones D-05 y D-09. (a) `utils/kit-scripts.ts`: wrapper tipado que carga con `import(pathToFileURL(resolve(getTemplatesDir(),'sdd/scripts/...')).href)` `mcp-config.mjs` y `tucu-ui-common.mjs` y los castea a interfaces TS declaradas ahí (sin segunda copia del algoritmo ni de la versión). (b) `utils/tucu-ui-offer.ts`: `resolveTucuUiChoice({flag,hasFrontend,interactive,current})` pura con la tabla de D-09 (flag true enable, flag false skip, sin frontend skip, completo skip, no interactivo skip, incompleto ask-repair, resto ask-enable) y detección del conflicto `--tucu-ui` + `--no-tucu-ui` sobre `rawArgs`. (c) ejecución de `node sdd/scripts/sdd-tucu.mjs --status|--enable` en el directorio destino que devuelve éxito o error acotado con stderr; `--yes` cuenta como no interactivo.
**Archivos:** `apps/cli/src/utils/kit-scripts.ts`, `apps/cli/src/utils/tucu-ui-offer.ts`, `apps/cli/src/utils/tucu-ui-run.ts`, `apps/cli/src/utils/__tests__/tucu-ui-offer.spec.ts`, `apps/cli/src/utils/__tests__/kit-scripts.spec.ts`
**CA cubiertos:** CA-066, CA-067, CA-068, CA-069
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-002, TASK-005, TASK-023
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- tucu-ui`
**Criterio de done:**

- [ ] Tabla de decisión completa cubierta por specs
- [ ] Flags excluyentes devuelven error de uso
- [ ] Sin terminal y sin flag queda apagado
- [ ] El wrapper carga los módulos del template sin duplicar lógica

### TASK-014: harness init: oferta de tucu-ui, flags y tolerancia a fallo de red

**Historia:** US-4-001, US-4-003
**App:** apps/cli
**Descripción:** Decisión D-09. Flag `--tucu-ui`/`--no-tucu-ui` sin default y con ayuda; el conflicto aborta antes de generar. `hasFrontend` = alguna app elegida (interactiva o por config) de tipo `react` o `nextjs`. Prompt `p.confirm({initialValue:true})` que dice qué escribe y que necesita red. Corre `sdd-tucu.mjs --enable` después de `generateSDD`/`generateWorkspace`/`generateStandalone` y antes del gate FASE 3, para que el validador vea el estado final; si sale distinto de cero emite `logger.warn` con stderr y comando de reintento sin abortar. Resumen final: `tucu-ui: on (skill + MCP)` o `tucu-ui: off — pnpm sdd:tucu -- --enable`. Respeta nx y standalone y la config de TASK-025.
**Archivos:** `apps/cli/src/commands/init.ts`, `apps/cli/src/commands/__tests__/init-target.spec.ts`
**CA cubiertos:** CA-057, CA-058, CA-059, CA-060, CA-061, CA-066, CA-067, CA-068, CA-069, CA-070
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-013, TASK-025
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- init`
**Criterio de done:**

- [ ] Sin frontend no hay pregunta
- [ ] Aceptar deja prendido y completo; rechazar deja apagado
- [ ] Fallo de red no aborta init
- [ ] Flags visibles en la ayuda

### TASK-015: harness configure sdd: oferta sobre proyectos existentes y flags

**Historia:** US-4-002, US-4-003
**App:** apps/cli
**Descripción:** Decisión D-09. Mismos flags con ayuda. `hasFrontend` según `detectAppType` sobre cada app (con `--apps`, sobre cada path). `current` se lee con `sdd-tucu.mjs --status` después de `generateSDD`. No pregunta si ya está prendido y completo ni sin frontend; con `incomplete` ofrece reparar. La pregunta va al final y no altera las existentes (modo, rtk, mod).
**Archivos:** `apps/cli/src/commands/configure/sdd.ts`, `apps/cli/src/commands/configure/sdd-apps.ts`, `apps/cli/src/commands/__tests__/configure-sdd-apps.spec.ts`
**CA cubiertos:** CA-062, CA-063, CA-064, CA-065, CA-066, CA-067, CA-068, CA-069, CA-070
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-013
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- configure`
**Criterio de done:**

- [ ] No re-pregunta cuando ya está completo
- [ ] Respuestas de rtk, mod y modo intactas
- [ ] Flags funcionan en CI sin terminal

### TASK-016: configure mcp y configure memory con merge compartido, y tucu-ui en el catálogo

**Historia:** US-3-003
**App:** apps/cli
**Descripción:** Decisión D-12. `configure mcp` deja de reescribir `.mcp.json` y usa `readMcpConfig`/`planUpsert`/`planRemove`: agrega o actualiza lo seleccionado, quita lo deseleccionado del catálogo (`tucu-ui` solo si `isKitTucuEntry`) y no toca lo que no está en el catálogo; JSON roto sale con 1 sin escribir. `MCP_CATALOG` suma `tucu-ui` (hint `Design MCP for @e-burgos/tucu-ui (React/Next frontends)`) con `kitTucuEntry(TUCU_UI_PINNED_VERSION,'.mcp.json')` cargado con el wrapper de TASK-013. No lee ni escribe `sdd/tools.json`: el validador avisa la inconsistencia. `configure memory` migra al mismo helper sin cambiar su comportamiento.
**Archivos:** `apps/cli/src/commands/configure/mcp.ts`, `apps/cli/src/commands/configure/memory.ts`, `apps/cli/src/commands/__tests__/configure-mcp.spec.ts`
**CA cubiertos:** CA-053, CA-054, CA-055, CA-056
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-002, TASK-013
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- configure-mcp`
**Criterio de done:**

- [ ] Servidor ajeno sobrevive a `configure mcp`
- [ ] `tucu-ui` aparece en el catálogo y no cambia `tools.json`
- [ ] JSON roto no se pisa
- [ ] `configure memory` mantiene su comportamiento

### TASK-017: harness update sdd: conservar tucu-ui y verificar la frontera de datos

**Historia:** US-5-003
**App:** apps/cli
**Descripción:** Decisión D-11. `update.generator.ts` no cambia: los scripts, el schema y `setup-agents.*` son kit-owned y llegan con el update; `tools.json` es dato e `integrations/` es prefijo de dato (TASK-001). Esta task agrega los specs: un repo con la skill instalada y tucu-ui prendido sale del update sin cambios ni `.new` en `tools.json`, la skill y las entradas MCP; el schema nuevo valida un `tools.json` anterior; `sdd:tucu` se agrega si falta; la corrida de `setup-agents` conserva los enlaces; la versión de `tucu_ui` no cambia sola y `--status` la reporta como `update_available` sin red.
**Archivos:** `apps/cli/src/generators/__tests__/update.generator.spec.ts`
**CA cubiertos:** CA-083, CA-084, CA-085, CA-086, CA-087
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-001, TASK-007, TASK-008, TASK-009
**Verificación:** `pnpm --filter @e-burgos/sdd-harness test -- update.generator`
**Criterio de done:**

- [ ] Estado de tucu-ui idéntico antes y después del update
- [ ] Sin `.new` sobre `tools.json` ni sobre la skill
- [ ] Versión no cambia sola y se informa sin red
- [ ] Specs con `tools.json` anterior y posterior verdes

### TASK-018: Specs de la CLI: init, configure sdd, configure mcp y update con tucu-ui

**Historia:** US-3-003, US-4-001, US-4-002, US-4-003, US-5-003
**App:** apps/cli
**Descripción:** Spec de flujo que recorre los comandos con el script del kit y un stub de red y, si el e2e existente lo permite, un caso con `--tucu-ui` en modo no interactivo. Cierra la etapa 2.
**Archivos:** `apps/cli/src/commands/__tests__/tucu-ui-flow.spec.ts`, `apps/cli/src/__e2e__/`
**CA cubiertos:** CA-057, CA-058, CA-061, CA-062, CA-066, CA-068, CA-053, CA-083
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-014, TASK-015, TASK-016, TASK-017
**Verificación:** `pnpm --filter @e-burgos/sdd-harness build && pnpm --filter @e-burgos/sdd-harness test`
**Criterio de done:**

- [ ] Escenarios principales de US-3-003, US-4 y US-5-003 cubiertos
- [ ] Suite de la CLI verde sin red real

## Etapa 3 — Docs, textos de arneses, generación real y verificación

### TASK-019: Documentación bilingüe del kit y README de la CLI

**Historia:** US-5-001
**App:** apps/cli
**Descripción:** Decisión D-14. Página nueva y entrada de índice en `documentation/es` y `documentation/en` con paridad de secciones: `pnpm sdd:tucu` (status, enable, disable, `--parts`, `--force`, `--purge`, sin red salvo la instalación), flags `--tucu-ui`/`--no-tucu-ui`, política de no pisar archivos MCP, ubicación de la skill en `sdd/integrations/skills/tucu-ui-design`, la conversión de `.claude/skills` que aparece en git como cambio de tipo (R-3), nota de Windows (R-2) y archivos híbridos que reciben `.new`. Actualizar el `README.md` de la CLI y el índice del visor de docs.
**Archivos:** `apps/cli/templates/sdd/documentation/es/README.md`, `apps/cli/templates/sdd/documentation/es/HOW-TO-USE-SDD.md`, `apps/cli/templates/sdd/documentation/es/INSTALL.md`, `apps/cli/templates/sdd/documentation/en/README.md`, `apps/cli/templates/sdd/documentation/en/HOW-TO-USE-SDD.md`, `apps/cli/templates/sdd/documentation/en/INSTALL.md`, `apps/cli/README.md`, `apps/cli/templates/sdd/docs/app.js`
**CA cubiertos:** CA-071, CA-072
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-018
**Verificación:** `pnpm sdd:validate`
**Criterio de done:**

- [ ] Mismas secciones en es y en
- [ ] README de la CLI menciona flags y comando
- [ ] Docs sin referencias rotas
- [ ] Cambio de tipo de `.claude/skills` documentado

### TASK-020: Textos de AGENTS, CLAUDE, GEMINI y copilot-instructions sobre la herramienta auxiliar tucu-ui

**Historia:** US-5-001
**App:** apps/cli
**Descripción:** Agregar a la sección de herramientas auxiliares de los cuatro archivos la descripción breve de tucu-ui y la regla de que prender o apagarlo es decisión del dev (como rtk y mod), sin agregar contenido por proveedor que rompa la paridad entre arneses. Verificar si el repo raíz también debe reflejar el cambio en su propio `AGENTS.md`.
**Archivos:** `apps/cli/templates/sdd/dual-harness/AGENTS.md`, `apps/cli/templates/sdd/dual-harness/CLAUDE.md`, `apps/cli/templates/sdd/dual-harness/GEMINI.md`, `apps/cli/templates/sdd/dual-harness/copilot-instructions.md`
**CA cubiertos:** CA-073, CA-074
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-011
**Verificación:** `pnpm sdd:validate`
**Criterio de done:**

- [ ] Los cuatro textos dicen que decide el dev
- [ ] Sin divergencias entre arneses
- [ ] Validador sin errores nuevos

### TASK-021: Generación real en examples/ con red real: init, enable, disable, update

**Historia:** US-1 a US-5 (ver tasks.json)
**App:** apps/cli
**Descripción:** Con `pnpm build`, generar en `examples/` (gitignoreado) un proyecto con app Next o React y `--tucu-ui`, con npx real y red real. Verificar la skill visible en los tres lugares, la entrada en los tres archivos MCP con un servidor ajeno preexistente que sobrevive, `--status`/`--disable`/`--enable` y `harness update sdd`, y correr `node sdd/scripts/validate-sdd.mjs` en el ejemplo. Confirmar R-1 (si `--dir` de `tucu-ui-skill install` es la carpeta de la skill o la padre) y anotarlo en el fragmento de contexto del ciclo. Anotar que R-2 (Claude Code nativo en Windows) requiere prueba manual en Windows.
**Archivos:** `examples/`
**CA cubiertos:** CA-006, CA-012, CA-027, CA-041, CA-057, CA-058, CA-076, CA-083
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-019, TASK-020, TASK-026
**Verificación:** `pnpm build` y luego `node apps/cli/dist/index.js init` con `--tucu-ui` en `examples/`
**Criterio de done:**

- [ ] Proyecto real generado con tucu-ui prendido y completo
- [ ] Ciclo de apagado y prendido sin pérdidas
- [ ] `validate-sdd.mjs` del ejemplo sin errores ni avisos de tucu-ui
- [ ] R-1 resuelto y anotado

### TASK-022: Verificación integral del ciclo

**Historia:** US-1 a US-5 (ver tasks.json)
**App:** apps/cli
**Descripción:** Correr `pnpm build && pnpm typecheck && pnpm test` y `pnpm sdd:validate`, recorrer la lista de CA contra specs y la prueba de examples, verificar que `sdd/skills`, `catalog.json` y `update sdd` no cambiaron de comportamiento, que el fragmento aditivo de contexto del subproyecto cli (incluidos R-1, R-2 y R-3) está listo para el reviewer y que la verificación manual en Windows queda pendiente y registrada.
**Archivos:** 
**CA cubiertos:** CA-001..CA-087
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-021
**Verificación:** `pnpm build && pnpm typecheck && pnpm test && pnpm sdd:validate`
**Criterio de done:**

- [ ] Build, typecheck y tests verdes
- [ ] `pnpm sdd:validate` sin errores
- [ ] Cada CA trazado a spec o prueba real
- [ ] Pendiente de Windows registrado para el reviewer

## Ajustes tras architect.md

Reconciliación con `architect.md` (D-01 a D-14). Los ids existentes se conservan; se agregan TASK-023 a TASK-026 y se re-estiman las tasks cuyo alcance cambió.

**Decisiones abiertas del planner resueltas**

| Decisión abierta | Resolución del architect | Tasks afectadas |
| ---------------- | ------------------------ | --------------- |
| Dónde vive la skill | `sdd/integrations/skills/tucu-ui-design/`, commiteada; `integrations/` entra en `DATA_PREFIXES` (D-01) | TASK-001, TASK-004, TASK-024, TASK-006 |
| Entrada MCP en Windows | Forma canónica `npx -y @e-burgos/tucu-ui-mcp@0.16.0` en los tres archivos; en win32 override local `cmd /c` de Claude Code, best effort (D-06) | TASK-023, TASK-005, TASK-006 |
| `--enable` con archivo MCP roto y partes | Aborta en el preflight sin escribir; `--parts` es el conjunto exacto (D-07, D-08) | TASK-005, TASK-003 |
| Dónde vive `mcp-config.mjs` | `templates/sdd/scripts/`, una sola copia; la CLI lo carga con el wrapper `utils/kit-scripts.ts` (D-05) | TASK-002, TASK-013, TASK-016 |
| Forma de `tucu_ui` | `{enabled, skill, mcp, version}` opcional; dentro del objeto se aceptan claves desconocidas y el validador las avisa (D-02) | TASK-001, TASK-010 |
| `configure mcp` y el interruptor | Desacoplados: no toca `tools.json`; el validador avisa la inconsistencia (D-12, D-10) | TASK-016, TASK-010 |
| Versión nueva sin red | `tucu_ui.version` contra la constante del kit; lo informan `--status` y el validador; se aplica con `--enable --force` (D-02, D-06) | TASK-023, TASK-010, TASK-017 |

**Cambios en tasks**

- **TASK-023 (nueva):** `tucu-ui-common.mjs` no tenía dueño; concentra constantes, versión fijada, entrada canónica, `tucuUiStatus` y su spec. Lo consumen `sdd-tucu.mjs`, el validador y la CLI.
- **TASK-024 (nueva):** la lógica de enlazado y la conversión de `.claude/skills` viven en `sdd-tucu.mjs --sync` (D-04), no en bash/PowerShell.
- **TASK-025 (nueva):** `sdd.tucu_ui` opcional en la config de `init --config` (D-09).
- **TASK-026 (nueva):** sincronización del dogfood `sdd/` y tests del puente (D-03, R-4); va después de TASK-012.
- **TASK-001:** suma `kit-manifest.ts` (`integrations/` como dato) y define el schema final; 2 a 3 SP.
- **TASK-002:** el spec se mueve a `apps/cli/src/utils/__tests__/mcp-config.spec.ts`.
- **TASK-003:** el estado sale de `tucuUiStatus` y baja de 3 a 2 SP.
- **TASK-005:** suma preflight D-08, partes exactas, override win32 y escritura final de `tools.json`; 3 a 5 SP.
- **TASK-007 y TASK-008:** pasan a ser una línea que delega en `--sync`; 5 a 2 SP y 3 a 1 SP. El caso Windows pasa a TASK-012.
- **TASK-009:** `ensureHarnessPackageJson` ya agrega scripts, no hace falta migración nueva; solo el template y specs.
- **TASK-010:** depende de TASK-023 en lugar de TASK-002 y suma los avisos de versión y de clave desconocida.
- **TASK-012:** se reordena a los archivos de D-13 y sube de 5 a 8 SP.
- **TASK-013:** suma el wrapper `kit-scripts.ts` y la ejecución del script; 3 a 5 SP.
- **TASK-015:** 4 a 5 h por la lectura de `current` con `--status`.
- **TASK-016:** suma la migración de `configure memory`; 3 a 5 SP.
- **TASK-017:** `update.generator.ts` no cambia (D-11); queda solo con specs y baja de 3 a 2 SP.
- **TASK-019, TASK-021, TASK-022:** reflejan R-1, R-2 y R-3.

**Riesgos con dueño:** R-1 en TASK-004 y TASK-021; R-2 en TASK-008 y TASK-022 (prueba manual en Windows, no automatizable acá); R-3 en TASK-019; R-4 en TASK-026; R-5 en el caso de `.gemini/settings.json` de TASK-012; R-6 en el mensaje de TASK-004.
