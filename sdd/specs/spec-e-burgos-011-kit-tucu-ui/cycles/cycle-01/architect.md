# Architect — Cycle 1: kit-tucu-ui

> **Input:** sdd/specs/spec-e-burgos-011-kit-tucu-ui/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-011-kit-tucu-ui/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/opus, effort high)

---

## Alcance del diseño

Este ciclo no tiene base de datos ni endpoints REST. Los contratos son cuatro:

- el comando `pnpm sdd:tucu` (argumentos, códigos de salida y JSON de `--status`);
- la clave `tucu_ui` de `sdd/tools.json` y su schema;
- la forma de la entrada `tucu-ui` en los tres archivos MCP;
- la ubicación de la skill instalada y de sus enlaces.

Por eso **no se escribe en `sdd/schema.json`, `sdd/api.json` ni `sdd/components.json`**. `components.json` solo registra componentes de `apps/studio` y el kit no registra nada ahí.

Stack respetado:

- **Kit** (`apps/cli/templates/sdd/`): scripts Node ESM planos, sin dependencias, Node ≥ 18. Es lo que corre en el repo del usuario.
- **CLI** (`apps/cli/src`): TypeScript, citty, @clack/prompts, fs-extra y vitest.
- **Puente** (`apps/studio-bridge`): ajv 8 contra el schema del repo.

El código va sin comentarios. El uso de cada script se documenta en su mensaje de uso y en `documentation/`, no en un bloque de cabecera. Este repo no es un workspace Nx: las tareas se corren con `pnpm --filter <paquete> <script>`.

## Hallazgos del código que condicionan el diseño

| # | Hallazgo | Consecuencia |
| - | -------- | ------------ |
| H-1 | `setup-agents.sh` hace de `.claude/skills` un **symlink de directorio entero** a `../sdd/skills`. Solo cuando `.claude/skills` es un directorio real enlaza ítem por ítem (`link_dir` → `link_items`). En `.github/skills` y `.agents/skills` siempre enlaza por ítem. | Si se crea `.claude/skills/tucu-ui-design` sobre el symlink, el enlace queda escrito **dentro de `sdd/skills/`**, que es kit-owned. Hay que convertir `.claude/skills` en directorio real antes de enlazar (D-04). |
| H-2 | `rebuild-catalog.mjs` lista todo directorio de `sdd/skills` que tenga `SKILL.md`, siguiendo symlinks (`statSync`). `validate-sdd` falla si el catálogo no coincide con el filesystem. | Nada de tucu-ui puede vivir ni aparecer dentro de `sdd/skills/` (D-01). |
| H-3 | `validate-sdd` busca filtraciones del nombre del proyecto en `KIT_DIRS = agents, documentation, prompts, skills, schemas, docs, templates`. | Una carpeta fuera de esa lista no entra en el chequeo de portabilidad. |
| H-4 | `kit-manifest.ts`: un archivo es kit-owned salvo que esté en `DATA_FILES`, `GENERATED_FILES` o `DATA_PREFIXES`. `update` solo recorre los archivos del template y los del manifiesto viejo, así que **nunca borra lo que el kit no shippeó**. | Una carpeta nueva bajo `sdd/` sobrevive a cualquier `update`, también con CLIs viejas. Igual se la declara dato para que la frontera quede explícita (D-01, D-11). |
| H-5 | `prune_stale_links` (sh/ps1) borra en `.claude/skills`, `.github/skills` y `.agents/skills` los enlaces colgados o `*.new` que resuelven dentro de `sdd/`. A los demás no los toca. | Un enlace de tucu-ui que apunte dentro de `sdd/` se limpia solo si la carpeta instalada desaparece. Con eso alcanza: no hace falta lógica nueva en sh/ps1. |
| H-6 | `setup-agents.ps1` enlaza directorios con `Junction` (target absoluto) y archivos con `HardLink`, porque PowerShell 5.1 pide elevación para SymbolicLink. En Windows, `fs.lstatSync` de Node reporta las junctions como `isSymbolicLink()`. | El script de Node usa `symlinkSync(abs, link, 'junction')` en `win32` y `symlinkSync(rel, link, 'dir')` en el resto. Es el mismo mecanismo de fallback que ya usa el kit (CA-029). |
| H-7 | `setup-agents.{sh,ps1}` llama a `node sdd/scripts/setup-rtk.mjs \|\| true` al final. | Ya existe el patrón para delegar en Node la lógica que tiene que ser igual en las dos plataformas (D-04). |
| H-8 | `sdd-mod.mjs` es el molde del interruptor: `readTools()` sale con 1 si el JSON está roto, crea `tools.json` con defaults si falta, aplica `{ defaults, ...actual, ...patch }`, serializa `JSON.stringify(x, null, 2) + '\n'` y sale con 2 ante un argumento inválido. | `sdd-tucu.mjs` sigue la misma semántica, así el puente puede seguir haciendo paridad byte a byte en el futuro. |
| H-9 | `tools.schema.json` tiene `additionalProperties: false` en la raíz y `required: ["rtk"]`. El puente compila **el schema del repo del usuario** con ajv. Su fallback zod es `looseObject`. `applyToolsChange` hace spread del documento, así que conserva las claves que no conoce. | Agregar `tucu_ui` como propiedad opcional de la raíz no rompe al puente. Los tests de paridad necesitan entradas con `tucu_ui` (D-03). |
| H-10 | `kit-tools.parity.spec.ts` y `kit-tools.spec.ts` leen los scripts y el schema de **`sdd/` de este repo** (la instalación dogfood), no de `apps/cli/templates/sdd/`. | Hasta que el dogfood `sdd/` se sincronice con el template, los tests del puente no ven el schema nuevo. Hay una task explícita de sincronización (orden de la sección final). |
| H-11 | `configure mcp` escribe `.mcp.json` desde cero con lo seleccionado. `configure memory` ya hace merge: lee, conserva `...existing` y los servidores ajenos, y sale con 1 si el JSON está roto. | El helper compartido generaliza el algoritmo de `configure memory` (D-05). |
| H-12 | Hoy `setup-agents` mergea `.gemini/settings.json` (`context.fileName`) y `setup-rtk` le agrega hooks. Los dos conservan lo ajeno. | Ese archivo ya lo editan tres actores. El helper solo toca `mcpServers.tucu-ui`. |
| H-13 | Los scripts `sdd:*` del `package.json` salen de `templates/sdd/templates/nx-workspace/package.json`. `ensureHarnessPackageJson` los agrega si faltan, tanto en init y configure como en update. | Alcanza con agregar `"sdd:tucu": "node sdd/scripts/sdd-tucu.mjs"` en ese archivo para que llegue a repos nuevos y actualizados. |
| H-14 | `detectAppType` devuelve `nextjs` (`next.config.*`) o `react` (`vite.config.ts`). Los tipos de app de `init` incluyen `react` y `nextjs`. La CLI declara `engines.node >= 18`; `@e-burgos/tucu-ui-mcp` 0.16.0 exige Node ≥ 20. | La oferta se decide con el tipo de app (D-09). `--enable` verifica Node ≥ 20 antes de cualquier escritura (D-06). |
| H-15 | `citty` parsea con `mri`: `--no-tucu-ui` da `false`, pero `--tucu-ui --no-tucu-ui` deja el último valor sin avisar. `run()` recibe `rawArgs`. | El conflicto de flags se detecta sobre `rawArgs` (D-09). |
| H-16 | `validate-sdd.mjs` ya importa dinámicamente un script hermano (`rebuild-catalog.mjs`) y acumula avisos con `warn(file, msg)`, que no cambian el código de salida. | Los avisos de tucu-ui reutilizan el cálculo de estado del módulo común (D-10). |

## Decisiones técnicas

### D-01. La skill instalada vive en `sdd/integrations/skills/tucu-ui-design/` y es dato del proyecto (pregunta 1; CA-023, CA-025, CA-084, RN-14)

- **Carpeta:** `sdd/integrations/skills/tucu-ui-design/`, con `SKILL.md`, `references/checklist.md` y `references/design-guide.md`.
- **Prefijo genérico:** `integrations/skills/` deja lugar para futuras integraciones con skill propia sin otra decisión de ubicación.
- **Dentro de `sdd/` y no en `.claude/`:** la carpeta viaja con git y con `sdd/` cuando se copia a otro repo. Un compañero que clona el repo la tiene sin red, y `setup:agents` la enlaza (CA-038, CA-039). Se commitea: son tres Markdown.
- **Fuera de `sdd/skills`:** el catálogo no la ve (H-2) y el chequeo de portabilidad tampoco (H-3).
- **Frontera de datos:** `kit-manifest.ts` agrega `'integrations/'` a `DATA_PREFIXES`. Así `isKitOwned('integrations/…') === false`: nunca entra al manifiesto, nunca la barre `update` y nunca recibe un `.new`. Con CLIs anteriores tampoco hay riesgo (H-4).
- **Rechazado — `.claude/skills/tucu-ui-design` real**, que es el default del instalador: por H-1 caería dentro de `sdd/skills/` en la mayoría de los repos.
- **Rechazado — una carpeta oculta en la raíz** (`.sdd/`): no viaja con `sdd/` y suma otra raíz que documentar.
- **Formas de entrada:** el kit **no** shippea un `.gitkeep` en `sdd/integrations/`. La carpeta nace con la primera instalación. Ni el validador ni el catálogo la exigen.

### D-02. Forma de `tucu_ui` en `sdd/tools.json` y cambio en `tools.schema.json` (CA-002, CA-007, CA-017..021, CA-082, CA-085, RN-13)

```json
"tucu_ui": {
  "enabled": true,
  "skill": true,
  "mcp": true,
  "version": "0.16.0"
}
```

| Campo | Tipo | Default cuando falta | Quién lo escribe |
| ----- | ---- | -------------------- | ---------------- |
| `enabled` | boolean | `false` | `--enable` / `--disable` |
| `skill` | boolean | `true` | `--enable --parts=…` |
| `mcp` | boolean | `true` | `--enable --parts=…` |
| `version` | string semver `^\d+\.\d+\.\d+$` | versión fijada por el kit | `--enable` la escribe si falta; `--enable --force` la sube a la del kit |

Schema (`templates/sdd/schemas/tools.schema.json`):

- La raíz suma `tucu_ui` en `properties`. **No** va a `required`. La raíz mantiene `additionalProperties: false`.
- Dentro de `tucu_ui`: `"type": "object"`, **sin `required`** y **`additionalProperties: true`**.
- Una clave desconocida dentro de `tucu_ui` valida, y el validador la avisa (D-10, CA-082).
- Las claves conocidas tienen tipo estricto (boolean y pattern). Un tipo equivocado es un error de schema real, igual que en `rtk.version`.

Reglas:

- **Sin la clave o con `enabled: false`:** la integración está apagada (RN-1).
- **`skill: false` y `mcp: false` juntos:** equivale a apagada; `--status` reporta `state: "off"` (RN-6).
- **`version` es la versión que usa el proyecto,** no un override. `update sdd` no la cambia porque `tools.json` es DATA_FILE (CA-085). Responde la pregunta 6: hay versión nueva cuando la que fija el kit (constante, D-06) es mayor que `tucu_ui.version`. Se compara sin red.
- **`--enable`** escribe `tools.tucu_ui = { enabled: true, skill: true, mcp: true, ...actual, ...patch }`, completa `version` si falta y deja el resto de `tools.json` intacto (CA-018). Si `tools.json` no existe, se crea con el default de `sdd-mod.mjs` (`$schema` + `rtk`) más `tucu_ui` (CA-019).
- **El template** `templates/sdd/tools.json` suma `"tucu_ui": { "enabled": false, "skill": true, "mcp": true }` y una oración en `_description`. Solo lo reciben las instalaciones nuevas: es DATA_FILE y `update` no lo toca (CA-084).

### D-03. Efecto en `apps/studio-bridge` (CA-021)

- **Sin cambios en `kit-tools.ts`.** Valida contra el schema del repo, que ahora acepta `tucu_ui`. `applyToolsChange` conserva la clave por spread y el fallback zod es `looseObject` (H-9).
- **`kit-tools.parity.spec.ts`:** suma dos entradas a `inputs`: `'tucu enabled'` (`tucu_ui` completo) y `'tucu with unknown key'` (`tucu_ui: { enabled: true, extra: 1 }`). Cada cambio de rtk/mod sobre ellas tiene que dar los mismos bytes que los scripts y conservar `tucu_ui` sin tocarlo.
- **`kit-tools.spec.ts`:** suma dos casos.
  - Un documento con `tucu_ui` (incluida una clave desconocida adentro) pasa `setKitTool` con el schema del repo.
  - El caso `surprise: true` en la raíz sigue rechazado: la raíz conserva `additionalProperties: false`.
- **Protocolo y web:** sin cambios. Mostrar o operar tucu-ui desde Studio queda fuera de alcance. El puente solo tiene que seguir escribiendo el archivo sin perder la clave.
- **Precondición (H-10):** estos tests leen `sdd/` de este repo. La task de sincronizar el dogfood `sdd/` con el template va **antes** de la del puente.

### D-04. Enlazado de la skill: lógica única en Node, llamada por `setup-agents.{sh,ps1}` (CA-027..036, RN-15, RN-19)

**Lugares y harnesses** (`tucu-ui-common.mjs`):

| Lugar | Harness |
| ----- | ------- |
| `.claude/skills` | Claude Code |
| `.github/skills` | Copilot |
| `.agents/skills` | Gemini CLI y Antigravity |

**Qué es un enlace del kit:** un symlink o junction cuyo destino resuelto (`realpathSync`) es la carpeta de D-01. Cualquier otra cosa llamada `tucu-ui-design` es **ajena**: no se toca y se reporta `foreign` (CA-032, CA-035).

**Forma del enlace:**

- macOS y Linux: symlink relativo `../../sdd/integrations/skills/tucu-ui-design`. Coincide con `prune_stale_links`, que limpia el enlace si la carpeta desaparece (H-5).
- Windows: junction con target absoluto (H-6).

**Conversión de `.claude/skills` (H-1):**

- Si `.claude/skills` es un symlink o junction que resuelve a `sdd/skills`, antes de enlazar tucu-ui se reemplaza por un **directorio real** con un enlace por cada entrada de `sdd/skills`.
- Se replican las reglas de `link_items`: se omiten los `*.new` y se incluyen los plugins (`sdd-mod`), porque `.claude` sí los recibe.
- Se usa la misma forma de enlace que `setup-agents`: `../../sdd/skills/<name>` en POSIX y junction absoluta en Windows. Así la próxima corrida de `setup-agents` entra por `link_dir` → directorio real → `link_items` y reporta «kept» (CA-028, CA-031).
- La conversión es permanente: `--disable` no vuelve al symlink entero. Un directorio real con enlaces por ítem es un estado que `setup-agents` ya soporta y testea (`sdd-mod.integration.spec.ts`, caso «.claude/skills propio»).
- Se documenta que en git aparece como cambio de tipo de `.claude/skills`.

**Modo `--sync`** (interno; lo llaman `setup-agents.sh` y `.ps1` al final, junto a `setup-rtk`, con `|| true` o `try/catch`):

- Sin red y sin instalar nunca.
- Si la integración está prendida, con `skill: true` y la carpeta completa: crea los enlaces que falten (CA-030).
- En cualquier otro caso: quita solo los enlaces del kit. Eso cubre al compañero que hace `git pull` de un `tools.json` apagado (RN-4).
- Siempre sale con 0 e imprime líneas con el formato de `setup-agents` (`created  symlink : .github/skills/tucu-ui-design`, `kept …`).
- Como la lógica vive en un solo archivo Node, sh y ps1 solo agregan **una línea cada uno**: la paridad Windows sale por construcción (RN-19).

**Por qué no en bash/PowerShell:** habría que leer `tools.json` y comparar destinos dos veces, en dos lenguajes. El precedente de `setup-rtk.mjs` (H-7) muestra que delegar en Node es el camino del kit.

### D-05. Helper compartido de merge MCP: `templates/sdd/scripts/mcp-config.mjs` (CA-041..052, CA-053/054, RN-9..11)

Es Node ESM plano, sin dependencias y sin importar otros scripts del kit, porque la CLI lo carga desde su propio directorio de templates. API pura (planificar) separada de la E/S (leer y escribir):

```js
export const MCP_TARGETS = [
  { file: '.mcp.json', container: 'mcpServers', harnesses: ['claude'] },
  { file: '.vscode/mcp.json', container: 'servers', harnesses: ['copilot'], stdioType: true },
  { file: '.gemini/settings.json', container: 'mcpServers', harnesses: ['gemini', 'antigravity'] },
];

export function readMcpConfig(absPath)
// → { state: 'missing' }
// | { state: 'broken', reason }                       JSON inválido o raíz que no es objeto
// | { state: 'ok', doc }

export function containerState(doc, container)
// → 'absent' | 'ok' | 'invalid'                         'invalid' = existe y no es objeto

export function planUpsert(doc, container, name, entry, isOwn)
// → { doc, outcome: 'created' | 'updated' | 'unchanged' | 'custom' | 'invalid-container' }

export function planRemove(doc, container, name, isOwn)
// → { doc, outcome: 'removed' | 'absent' | 'custom' | 'invalid-container' }

export function writeMcpConfig(absPath, doc)
// mkdir -p, escribe en <archivo>.tmp-<pid> y renombra; JSON.stringify(doc, null, 2) + '\n'
```

Reglas del helper:

- **Lectura:** se quita el BOM inicial antes de `JSON.parse`, igual que `readJsonFile` de `rtk-common`.
- **`planUpsert`:**
  - Si la entrada no existe, se agrega al final del contenedor y se conserva el orden de los demás (CA-047).
  - Si existe y `isOwn(entry)` es verdadero, se reemplaza en el mismo lugar (`updated`), salvo que sea igual en profundidad (`unchanged`, CA-008).
  - Si existe y no es del kit, se devuelve `custom` y no se toca (RN-10).
  - Contenedor ausente: se crea (CA-044, CA-050). Contenedor que no es objeto: `invalid-container`, sin modificar nada (CA-050).
- **`planRemove`:** quita solo la entrada propia. Un contenedor que queda vacío se conserva como `{}` (CA-051).
- **Claves ajenas:** las claves de primer nivel que no son el contenedor nunca se tocan (CA-048). Un documento sin cambios no se reescribe; se compara el JSON serializado.
- **Uso desde la CLI:** wrapper tipado `apps/cli/src/utils/kit-scripts.ts`. Hace `import(pathToFileURL(resolve(getTemplatesDir(), 'sdd/scripts/mcp-config.mjs')).href)` y lo castea a una interfaz TS declarada ahí mismo. Hay un precedente de `import()` dinámico en `config/load.ts`. El mismo wrapper carga `tucu-ui-common.mjs` (D-06) para `configure mcp`.
- **No hay copia TS del algoritmo:** una sola fuente, sin test de paridad que mantener.

### D-06. Versión fijada, entrada MCP e instalación de la skill (CA-022, CA-024, CA-026, CA-037..046, RN-12, RN-17, preguntas 2 y 6)

**Módulo común** `templates/sdd/scripts/tucu-ui-common.mjs`. Importa `mcp-config.mjs`. Sus raíces son parámetros, no se derivan de su propia ubicación, así puede usarse desde la CLI.

```js
export const TUCU_UI_PACKAGE = '@e-burgos/tucu-ui-mcp';
export const TUCU_UI_PINNED_VERSION = '0.16.0';
export const TUCU_UI_SERVER_NAME = 'tucu-ui';
export const TUCU_UI_SKILL_NAME = 'tucu-ui-design';
export const TUCU_UI_INSTALL_DIR = 'sdd/integrations/skills/tucu-ui-design';
export const TUCU_UI_LINK_DIRS = [
  { dir: '.claude/skills', harnesses: ['claude'] },
  { dir: '.github/skills', harnesses: ['copilot'] },
  { dir: '.agents/skills', harnesses: ['gemini', 'antigravity'] },
];
export const TUCU_UI_KNOWN_KEYS = ['enabled', 'skill', 'mcp', 'version'];
export function tucuUiSettings(tools)           // defaults de D-02 + unknownKeys
export function kitTucuEntry(version, target)   // entrada canónica por archivo
export function isKitTucuEntry(entry)           // ¿la escribió el kit?
export function isSkillInstallComplete(root)
export function tucuUiStatus(root)              // JSON de --status, sin red (D-07)
```

**Entrada MCP canónica, igual en los tres archivos** (CA-042):

```json
{ "command": "npx", "args": ["-y", "@e-burgos/tucu-ui-mcp@0.16.0"] }
```

En `.vscode/mcp.json` se agrega además `"type": "stdio"`, que es la forma que documenta VS Code (RN-11). `-y` evita la confirmación interactiva de npx. La versión va fija, nunca `latest` (RN-12).

**`isKitTucuEntry`** es verdadero cuando:

- `command` es `npx` y algún arg empieza con `@e-burgos/tucu-ui-mcp`; o
- `command` es `cmd`, `args[0]` es `/c`, `args[1]` es `npx` y algún arg es el paquete.

Cualquier otra cosa es personalizada (RN-10).

**Upsert de una entrada propia:** si ya referencia `@e-burgos/tucu-ui-mcp@<tucu_ui.version>`, es `unchanged` aunque tenga el envoltorio `cmd /c`. Si referencia otra versión, se reescribe solo ese token y se conserva el envoltorio. Así un equipo mixto no alterna la forma del archivo en cada `--enable`.

**Windows (pregunta 2, CA-043):**

- Los archivos commiteados llevan **siempre la forma canónica `npx`**, para que sirvan en todas las plataformas. VS Code y Gemini CLI resuelven `npx` en Windows.
- Claude Code nativo en Windows exige el envoltorio `cmd /c` para `npx` (lo avisa su `/doctor`). En `win32`, `--enable` intenta además un override **de alcance local**, que no se commitea y tiene precedencia sobre el de proyecto: `claude mcp add --scope local tucu-ui -- cmd /c npx -y @e-burgos/tucu-ui-mcp@<v>`.
- Si `claude` no está en el PATH o falla, se imprime el comando exacto como aviso. No es fatal.
- En `win32`, `--disable` corre `claude mcp remove --scope local tucu-ui` con el mismo criterio.
- Se verifica en Windows real antes de cerrar (R-2).

**Instalación de la skill** (solo si falta, la carpeta está incompleta o se pasa `--force`; CA-024, CA-038):

1. **Preflight sin escrituras:**
   - Node ≥ 20. Si no, sale con 1: `@e-burgos/tucu-ui-mcp 0.16.0 needs Node >= 20 (found X)`.
   - `tools.json` y los tres archivos MCP parsean. Si alguno no, se aplica D-08.
2. **Staging:** carpeta vacía `sdd/integrations/skills/.tucu-ui-design.staging-<pid>`. El punto inicial evita que nada la enlace o la cataloge.
3. **Ejecución:** `spawnSync('npx', ['--yes', '-p', `${TUCU_UI_PACKAGE}@${version}`, 'tucu-ui-skill', 'install', '--dir', staging, '--force'])`, con `shell: process.platform === 'win32'` (npx.cmd), `stdio: 'pipe'` y `timeout: 180000`.
4. **Ubicación del resultado:** se acepta `SKILL.md` en `staging/` o en `staging/tucu-ui-design/`. La semántica exacta de `--dir` (carpeta de la skill o carpeta padre) no está verificada en 0.16.0 (R-1), y el kit tolera las dos.
5. **Verificación de completitud:** `SKILL.md`, `references/checklist.md` y `references/design-guide.md`. Si falta algo, sale con 1: «el paquete no produjo la skill esperada», y se borra el staging.
6. **Reemplazo:** la carpeta final se renombra a `.old`, el staging se renombra a la final y se borra `.old`. Ante cualquier error se borra el staging. **Nunca queda una carpeta final a medias** (CA-040). Si quedara una incompleta por un corte externo, `isSkillInstallComplete` la reporta incompleta y `--enable` la reinstala.
7. **Error de red:** salida de npx distinta de cero, con `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNREFUSED` o `ENETUNREACH` en stderr. El mensaje dice: «could not download @e-burgos/tucu-ui-mcp@0.16.0 (no network?) — sdd/tools.json unchanged; retry with network: pnpm sdd:tucu -- --enable» (CA-037, RN-18). Cualquier otro fallo de npx muestra las últimas 20 líneas de stderr y el mismo cierre.

**Costura para tests:** si `SDD_TUCU_NPX` está definida, en lugar de `npx …` se ejecuta `process.execPath [SDD_TUCU_NPX, ...mismosArgs]`. Es el mismo criterio que `SDD_RTK_SKIP_INSTALL`: lo usan solo los tests y no se documenta para usuarios.

**Versión nueva (CA-085):** `--enable --force` reinstala con la versión que fija el kit, escribe `tucu_ui.version` y reescribe el token de versión en las entradas propias.

### D-07. Contrato de `sdd-tucu.mjs` (US-1; CA-001..016, CA-019, CA-020, RN-2, RN-5..8)

`package.json` (template nx-workspace): `"sdd:tucu": "node sdd/scripts/sdd-tucu.mjs"`.

| Invocación | Efecto | Salida |
| ---------- | ------ | ------ |
| *(sin args)* / `--status` | Solo lectura, sin red | 0 + JSON |
| `--enable [--parts=skill,mcp] [--force]` | Prende o repara | 0 / 1 |
| `--disable [--purge]` | Apaga y limpia lo propio; `--purge` borra además `sdd/integrations/skills/tucu-ui-design` | 0 (1 solo si `tools.json` está roto) |
| `--sync` | Interno de `setup-agents` (D-04) | siempre 0 |
| arg desconocido, `--enable` con `--disable`, `--parts` inválido, `--purge` sin `--disable`, `--force` sin `--enable` | Nada | 2 + uso |

**`--parts` (pregunta 5, CA-007):** es el **conjunto exacto** de partes habilitadas. `--enable --parts=skill` escribe `skill: true, mcp: false` y quita las entradas MCP propias. Sin `--parts`, `--enable` respeta los valores que ya tiene `tools.json` (default: los dos).

**Orden de `--enable`.** Todo o nada sobre `tools.json` (RN-5, CA-010):

1. Preflight (D-06.1, D-08).
2. Instalar la skill si hace falta.
3. Enlazar en los tres lugares, con la conversión de D-04.
4. Upsert MCP en los tres archivos.
5. En `win32`, el override local de Claude Code.
6. **Por último,** escribir `tools.json`.

Si un paso falla, el comando sale con 1 antes del paso 6. Lo ya escrito en disco es seguro: `--enable` lo completa y `--disable` lo limpia.

**Orden de `--disable`:**

- Quitar los enlaces propios, las entradas MCP propias y, en `win32`, el override local. Después escribir `tools.json` con `enabled: false`.
- Faltantes, ajenos y archivos rotos se informan y no hacen fallar el comando (CA-015, CA-035, CA-052). Un archivo MCP roto se deja como está y el mensaje dice que puede conservar una entrada `tucu-ui`.
- Si todo ya estaba apagado y limpio, imprime `tucu_ui: already off` y no escribe nada (CA-013).

**Mensaje de cierre:** una línea por harness y la versión con su carpeta (CA-026). Ejemplo: `claude: skill linked · mcp .mcp.json created`. Si no hubo cambios: `tucu_ui: already on and complete` (CA-008).

**JSON de `--status`** (CA-002, CA-004):

```json
{
  "enabled": true,
  "state": "complete",
  "parts": { "skill": true, "mcp": true },
  "version": "0.16.0",
  "kit_version": "0.16.0",
  "update_available": false,
  "node_ok": true,
  "skill": {
    "dir": "sdd/integrations/skills/tucu-ui-design",
    "installed": true,
    "links": { ".claude/skills": "linked", ".github/skills": "linked", ".agents/skills": "missing" }
  },
  "mcp": { ".mcp.json": "present", ".vscode/mcp.json": "custom", ".gemini/settings.json": "broken" },
  "harnesses": { "claude": "complete", "copilot": "complete", "gemini": "incomplete", "antigravity": "incomplete" },
  "unknown_keys": [],
  "repair": "pnpm sdd:tucu -- --enable"
}
```

Valores posibles:

| Campo | Valores |
| ----- | ------- |
| `state` | `off` · `complete` · `incomplete` |
| `links.*` | `linked` · `missing` · `foreign` · `n/a` (parte deshabilitada) |
| `mcp.*` | `present` · `custom` (cuenta como presente: decisión del dev) · `missing` · `no-file` · `broken` · `invalid-container` · `n/a` |

Reglas: `repair` solo aparece si el estado es `incomplete`. Con `state: "off"`, `skill`, `mcp` y `harnesses` se calculan igual (para diagnóstico), pero no definen el estado.

### D-08. Archivo MCP roto o con contenedor inválido al prender (pregunta 3; CA-049, CA-050, RN-9)

- **`--enable` aborta en el preflight,** antes de instalar o enlazar. Sale con 1 y lista cada archivo con su motivo: «`.gemini/settings.json` is not valid JSON — fix it and re-run pnpm sdd:tucu -- --enable». No escribe nada, ni siquiera `tools.json`.
- No hay modo «seguí con los demás». Es la opción más simple que cumple las dos condiciones del funcional: nunca se pierde contenido y `tools.json` refleja la realidad.
- Con `--parts=skill` los archivos MCP no se inspeccionan. Una parte no bloquea a la otra (RN-6).
- `--disable` y `--status` nunca abortan por un archivo roto (D-07).

### D-09. Oferta en `harness init` y `harness configure sdd` (US-4; CA-057..070, RN-20..23)

**Flag:** `'tucu-ui': { type: 'boolean', description: 'Turn on the tucu-ui design skill + MCP (React/Next apps). --no-tucu-ui keeps it off' }`, sin default, en los dos comandos (CA-070). Si `rawArgs` incluye a la vez `--tucu-ui` y `--no-tucu-ui`, sale con 1 y un mensaje de uso antes de generar (CA-068, H-15).

**Config de `init --config`:** `sdd.tucu_ui?: boolean`, opcional, en `config/schema.ts` y su JSON Schema (`config/json-schema.ts`). Si hay flag, el flag gana.

**Decisión pura** en `apps/cli/src/utils/tucu-ui-offer.ts`:

```ts
type TucuUiState = 'off' | 'complete' | 'incomplete';
type TucuUiChoice = 'enable' | 'skip' | 'ask-enable' | 'ask-repair';
export function resolveTucuUiChoice(input: {
  flag: boolean | undefined;
  hasFrontend: boolean;
  interactive: boolean;
  current: TucuUiState;
}): TucuUiChoice;
```

| Condición | Resultado |
| --------- | --------- |
| `flag === true` | `enable`, aunque no haya frontend (CA-066) |
| `flag === false` | `skip` (CA-067) |
| `!hasFrontend` | `skip` sin mención (CA-060, CA-064) |
| `current === 'complete'` | `skip` (CA-063) |
| `!interactive` | `skip` (CA-069) |
| `current === 'incomplete'` | `ask-repair` |
| resto | `ask-enable` |

Detalles:

- **`interactive`** = `process.stdin.isTTY && !args.yes && !config`. `--yes` se trata como no interactivo: CI sin red por defecto.
- **`hasFrontend`:**
  - `init`: alguna app elegida (interactiva o por config) con `type ∈ {react, nextjs}`.
  - `configure sdd`: alguna `apps[].type ∈ {react, nextjs}` según `detectAppType`. Con `--apps`, se detecta sobre cada path.
- **`current`:** en `configure sdd` se lee corriendo `node sdd/scripts/sdd-tucu.mjs --status` en el repo, después de `generateSDD`. En `init` siempre es `off`.
- **Prompt:** `p.confirm({ initialValue: true })`. El mensaje dice qué escribe y que necesita red.
- **Ejecución:** después de que `generateSDD`/`generateWorkspace`/`generateStandalone` terminan (con `sdd/` y `setup-agents` listos) y **antes** del gate FASE 3 de `init`, para que el validador vea el estado final. Corre `node sdd/scripts/sdd-tucu.mjs --enable` con `exec` en el directorio destino. Si sale distinto de cero, se emite `logger.warn` con su stderr y el comando de reintento, y **no se aborta** (CA-061, RN-23).
- **Resumen final:** prendido → «tucu-ui: on (skill + MCP)» (CA-058). Rechazado con frontend → «tucu-ui: off — pnpm sdd:tucu -- --enable» (CA-059).
- **CA-065:** las preguntas existentes de `configure sdd` no se tocan. La de tucu-ui va al final.

### D-10. Avisos del validador (US-5-002; CA-016, CA-056, CA-076..082, CA-085, RN-24)

En `validate-sdd.mjs`, después de `validate('tools.json', 'tools.schema.json')`:

1. **Carga y alcance:** `const { tucuUiStatus } = await import(new URL('./tucu-ui-common.mjs', import.meta.url))` dentro de `try`. Si falla la importación, por ejemplo con un kit a medio actualizar, no se avisa nada. Solo se mira si el documento tiene `tucu_ui` y es un objeto.
2. **Siempre** (aunque esté apagado): una clave desconocida produce `tools.json: tucu_ui.<k> is not a known setting (enabled, skill, mcp, version) — ignored` (CA-082).
3. **Apagado:** nada más (CA-016, CA-079).
4. **Prendido con `skill`:**
   - Carpeta incompleta → `tools.json: tucu_ui on but sdd/integrations/skills/tucu-ui-design is missing or incomplete — run pnpm sdd:tucu -- --enable`.
   - Un aviso por lugar en `missing` → `tools.json: tucu_ui on but .github/skills/tucu-ui-design is not linked (Copilot) — run pnpm sdd:tucu -- --enable` (CA-076).
   - `foreign` → `… is not the kit's link (kept as is)`.
5. **Prendido con `mcp`:** un aviso por archivo en `missing`, `no-file`, `broken` o `invalid-container`, con el harness y el comando (CA-077, CA-078, CA-081). Cubre la inconsistencia que deja quitar `tucu-ui` con `configure mcp` (CA-056).
6. **`update_available`:** `tools.json: tucu_ui uses @e-burgos/tucu-ui-mcp 0.16.0, the kit pins X — pnpm sdd:tucu -- --enable --force to upgrade` (CA-085).

Todo pasa por `warn()`, así que el código de salida no cambia. La parte deshabilitada no se vigila (CA-080). El validador nunca usa red (CA-039).

### D-11. `harness update sdd` (CA-083..087)

No necesita cambios en `update.generator.ts`:

- `sdd-tucu.mjs`, `tucu-ui-common.mjs`, `mcp-config.mjs`, el schema, `setup-agents.*` y `validate-sdd.mjs` son kit-owned y llegan con el update.
- `tools.json` es DATA_FILE e `integrations/` es DATA_PREFIX (D-01). Ninguno se toca ni genera `.new` (CA-084).
- Los archivos MCP están fuera de `sdd/`.
- `ensureHarnessPackageJson` agrega `sdd:tucu` si falta (H-13).
- `runSetupAgents` vuelve a correr `setup-agents`, que con `--sync` conserva los enlaces (CA-087, CA-083).
- La versión no cambia sola (CA-085).
- Un repo viejo sin `tucu_ui` valida contra el schema nuevo (CA-086).

Se agrega un test de `kit-manifest` y uno de update que lo prueban (D-13).

### D-12. `harness configure mcp` con merge y `tucu-ui` en el catálogo (US-3-003; CA-053..056)

- `MCP_CATALOG` suma `'tucu-ui'`:
  - label `tucu-ui`;
  - hint `Design MCP for @e-burgos/tucu-ui (React/Next frontends)`;
  - `config` de `kitTucuEntry(TUCU_UI_PINNED_VERSION, '.mcp.json')`, cargado con el wrapper de D-05. No hay una segunda constante de versión.
- La escritura usa `readMcpConfig`, `planUpsert` y `planRemove` sobre `.mcp.json`/`mcpServers`.
  - Lo seleccionado se agrega o actualiza.
  - Lo deseleccionado del catálogo se quita. Para `tucu-ui`, solo si `isKitTucuEntry`; para los demás, por nombre, como hoy.
  - Lo que no está en el catálogo no se toca (CA-053, CA-054).
- `.mcp.json` roto: sale con 1 sin escribir, igual que `configure memory`.
- **No** lee ni escribe `sdd/tools.json` (CA-056). Las dos vías quedan desacopladas a propósito (pregunta 4) y el validador avisa la inconsistencia.
- `configure memory` se migra al mismo helper. No cambia su comportamiento, solo deja de duplicar el algoritmo.

### D-13. Estrategia de tests (CA-5 de la spec)

| Nivel | Archivo | Qué prueba |
| ----- | ------- | ---------- |
| Integración kit (POSIX) | `apps/cli/src/generators/__tests__/tucu-ui.integration.spec.ts` | Patrón de `sdd-mod.integration.spec.ts`: copia `templates/sdd` a un tmp, corre `setup-agents.sh` real y después `sdd-tucu.mjs` con `SDD_TUCU_NPX` apuntando a un stub. Lista de casos debajo de la tabla. |
| Integración kit (Windows) | `sdd.generator.windows.spec.ts` (`skipIf !win32`) | `setup-agents.ps1` + `sdd-tucu.mjs --enable` con stub: junctions en los tres lugares, `.claude/skills` convertido, `--sync` idempotente, `--disable` limpia. |
| Unidad helper | `apps/cli/src/utils/__tests__/mcp-config.spec.ts` | Importa `templates/sdd/scripts/mcp-config.mjs`. Prueba `planUpsert`/`planRemove`: orden, contenedor ausente o inválido, `custom`, `unchanged`, contenedor vacío conservado y BOM. |
| Unidad común | `apps/cli/src/utils/__tests__/tucu-ui-common.spec.ts` | `isKitTucuEntry` (npx, cmd /c, ajenas), `tucuUiSettings` (defaults, claves desconocidas) y la comparación de versión. |
| Unidad oferta | `apps/cli/src/utils/__tests__/tucu-ui-offer.spec.ts` | Tabla completa de `resolveTucuUiChoice` y la detección del conflicto de flags sobre `rawArgs`. |
| Comandos | `apps/cli/src/commands/__tests__/configure-mcp.spec.ts` | Merge con servidores ajenos, deselección y `tucu-ui` en el catálogo sin tocar `tools.json`. |
| Manifiesto / update | `update.generator.spec.ts` + test de `isKitOwned` | `integrations/` es dato. Un repo con la skill instalada sale del update sin cambios ni `.new`. |
| Config | `config/__tests__/load.spec.ts`, `json-schema.spec.ts` | `sdd.tucu_ui` opcional. |
| Puente | `kit-tools.parity.spec.ts`, `kit-tools.spec.ts` | D-03. |
| Real | `examples/` (gitignoreado) | `harness init` con una app Next y `--tucu-ui`, con red y npx real: skill visible en los cuatro harnesses, MCP en los tres archivos, `sdd:validate` en verde (CA-1 de la spec). Además, verificar R-1. |

**Casos del test de integración POSIX:**

- `--status` sin clave o sin archivo.
- `--enable` completo:
  - carpeta instalada;
  - `.claude/skills` pasa de symlink a directorio real y las skills del kit (`sdd-*`, `sdd-mod`) siguen visibles;
  - tres enlaces;
  - tres archivos MCP con servidores y claves ajenas preservados byte a byte.
- Idempotencia: hash de todos los archivos antes y después de un segundo `--enable` y de un segundo `setup-agents`.
- `--disable` quita solo lo propio, con una entrada `tucu-ui` personalizada y un `tucu-ui-design` ajeno.
- `--purge`.
- Archivo MCP roto: `tools.json` intacto, sin staging.
- Stub offline (sale con 1 y `getaddrinfo ENOTFOUND registry.npmjs.org` en stderr): `tools.json` intacto, sin staging, mensaje con la versión.
- `--enable` con la skill ya instalada y el stub offline: funciona, y prueba que no hay red (CA-038).
- `setup-agents` con la integración prendida conserva los enlaces; apagada, los quita.
- `--parts=skill`.
- `update_available` con `version` vieja.
- Avisos de `validate-sdd` con un enlace borrado y con el interruptor apagado (silencio).
- Exit 2 ante un argumento inválido.

**El stub** es un `.mjs` escrito en el tmp. Lee `--dir` y escribe `SKILL.md` y `references/{checklist,design-guide}.md`. Tiene variantes «offline» e «incompleto». Va con `describe.skipIf(win32)`, como el molde.

### D-14. Documentación y arneses (US-5-001; CA-071..075)

Solo texto, sin decisiones de forma. Bloque tucu-ui con la estructura de rtk y del mod (qué es, quién decide, qué no hacer) en:

- `templates/sdd/dual-harness/AGENTS.md`, `CLAUDE.md` y `GEMINI.md`, y `copilot-instructions.md` si tiene la sección de herramientas;
- `documentation/{es,en}`: página nueva + índice;
- el README de la CLI;
- el playbook del sdd-steward (`templates/sdd/skills/sdd-steward/`): la fila de `sdd:tucu` en la tabla de ruteo.

Los archivos `dual-harness/*.md` son híbridos (`HYBRID_FILES`): los repos con cambios locales reciben `.new`. Es el comportamiento esperado del kit y no se evita.

## Respuestas a las preguntas abiertas del funcional

| # | Pregunta | Decisión |
| - | -------- | -------- |
| 1 | Dónde vive la skill | `sdd/integrations/skills/tucu-ui-design/`, con `integrations/` como DATA_PREFIX (D-01). |
| 2 | Entrada MCP en Windows | Forma canónica `npx -y` commiteada en los tres archivos. En `win32`, override local `cmd /c` de Claude Code, best effort. `isKitTucuEntry` reconoce las dos formas (D-06). |
| 3 | `--enable` con un archivo MCP roto | Aborta en el preflight sin escribir nada (D-08). |
| 4 | `configure mcp` y el interruptor | Desacoplados. `configure mcp` no toca `tools.json` y el validador avisa la inconsistencia (D-12, D-10). |
| 5 | Flags de parte | Entran: `--enable --parts=skill,mcp` como conjunto exacto (D-07). |
| 6 | Versión nueva sin red | `tucu_ui.version` contra la constante del kit. Lo informan `--status` (`update_available`) y el validador; se aplica con `--enable --force` (D-02, D-06, D-10). |

## Cambios en schema (sdd/schema.json)

Ninguno: no hay tablas. El único schema que cambia es `templates/sdd/schemas/tools.schema.json` (D-02), que es un registro del kit y no una tabla.

## Contratos de API (sdd/api.json)

Ninguno: no hay endpoints HTTP. Los contratos del ciclo son el comando `sdd:tucu` (D-07), el módulo `mcp-config.mjs` (D-05), la entrada MCP (D-06) y los flags de la CLI (D-09).

## Componentes (sdd/components.json)

Ninguno: el kit no registra componentes y `components.json` solo tiene `apps/studio`.

## Dependencias externas

- `@e-burgos/tucu-ui-mcp@0.16.0` (npm, Node ≥ 20). Se ejecuta con `npx` en tiempo de instalación y como servidor MCP. **No** entra en el `package.json` de nadie.
- El CLI de Claude Code (`claude`), opcional y solo en `win32` (D-06).
- No hay dependencias npm nuevas en `apps/cli` ni en el kit. El puente ya tiene ajv.

## Riesgos y verificaciones pendientes

| # | Riesgo | Mitigación |
| - | ------ | ---------- |
| R-1 | Semántica de `tucu-ui-skill install --dir` en 0.16.0: ¿la carpeta de la skill o la padre? | El kit acepta las dos (D-06.4). Se verifica con npx real en `examples/` y se anota en el fragmento de contexto. |
| R-2 | Claude Code nativo en Windows y la forma `npx`. | Override local `cmd /c` best effort + aviso con el comando. Verificación manual en Windows antes de cerrar. Si falla, se documenta WSL o el comando manual. |
| R-3 | La conversión de `.claude/skills` aparece en git como cambio de tipo en repos que commitean el symlink. | Documentado en las docs del kit. Es reversible borrando el directorio y corriendo `setup:agents` con tucu-ui apagado. |
| R-4 | Los tests del puente leen el `sdd/` dogfood (H-10). | Task de sincronización antes de la del puente. |
| R-5 | `.gemini/settings.json` lo editan tres scripts. | Cada uno solo toca su clave. El test de integración verifica que `context.fileName` y los hooks de rtk sobreviven a `--enable` y `--disable`. |
| R-6 | Timeout de npx en redes lentas (180 s). | Mensaje con el comando de reintento. El interruptor queda como estaba. |

## Trazabilidad CA → decisión

| CA | Decisión |
| -- | -------- |
| CA-001..005 | D-07 (status), D-06 (sin red) |
| CA-006..011 | D-07, D-08 |
| CA-012..016 | D-07, D-04, D-05 |
| CA-017..021 | D-02, D-03 |
| CA-022..026 | D-01, D-06 |
| CA-027..032 | D-04 |
| CA-033..036 | D-04, D-07 |
| CA-037..040 | D-06 |
| CA-041..046 | D-05, D-06 |
| CA-047..052 | D-05, D-08 |
| CA-053..056 | D-12 |
| CA-057..070 | D-09 |
| CA-071..075 | D-14 |
| CA-076..082 | D-10 |
| CA-083..087 | D-11, D-02 |

## Archivos a tocar por subproyecto

### 1. Kit — `apps/cli/templates/sdd/`

- `scripts/mcp-config.mjs`: nuevo (D-05).
- `scripts/tucu-ui-common.mjs`: nuevo (D-06).
- `scripts/sdd-tucu.mjs`: nuevo (D-07, D-04, D-08).
- `scripts/setup-agents.sh` y `scripts/setup-agents.ps1`: una línea cada uno, `node sdd/scripts/sdd-tucu.mjs --sync`, tolerante a fallos (D-04).
- `scripts/validate-sdd.mjs`: los avisos de D-10.
- `schemas/tools.schema.json` (D-02).
- `tools.json`: clave `tucu_ui` apagada + `_description` (D-02).
- `templates/nx-workspace/package.json`: `sdd:tucu` (D-07).
- `catalog.json`: regenerar solo si cambia algo de lo que lista (no debería: no hay skill ni schema nuevos).
- `dual-harness/*.md`, `documentation/{es,en}/…` y la skill `sdd-steward` (D-14).

### 2. CLI — `apps/cli/src/`

- `generators/kit-manifest.ts`: `'integrations/'` en `DATA_PREFIXES` (D-01).
- `utils/kit-scripts.ts`: wrapper tipado de los `.mjs` del template (D-05).
- `utils/tucu-ui-offer.ts`: decisión pura y conflicto de flags (D-09).
- `commands/init.ts`, `commands/configure/sdd.ts`: flag, prompt y ejecución (D-09).
- `config/schema.ts`, `config/json-schema.ts`: `sdd.tucu_ui` (D-09).
- `commands/configure/mcp.ts`: merge + catálogo (D-12). `commands/configure/memory.ts`: al helper (D-12).
- README de la CLI (D-14).
- Tests de D-13.

### 3. Dogfood — `sdd/` de este repo

- Sincronizarlo con el template (scripts, schema, `package.json` raíz) para que los tests del puente y `pnpm sdd:validate` de este repo vean la versión nueva (R-4).
- `sdd/tools.json` de este repo **no** se toca en este ciclo: el interruptor lo decide el dev.

### 4. Puente — `apps/studio-bridge/`

- `src/workspace/kit-tools.parity.spec.ts`, `src/workspace/kit-tools.spec.ts` (D-03). Sin cambios en código.

### Orden para el planner

1. `mcp-config.mjs` + `tucu-ui-common.mjs` con sus tests de unidad. Son la base de todo lo demás.
2. Schema + `tools.json` del template + `kit-manifest` (dato).
3. `sdd-tucu.mjs` (status → enable/disable → sync) + `setup-agents.sh`/`.ps1` + test de integración POSIX y caso Windows.
4. `validate-sdd.mjs` (avisos).
5. CLI: `configure mcp`/`memory` al helper; oferta en `init`/`configure sdd`; config.
6. Sincronización del dogfood `sdd/` → tests del puente.
7. Docs, arneses y steward.
8. Verificación: `pnpm build && pnpm typecheck && pnpm test` + generación real en `examples/` (R-1) + Windows (R-2).
