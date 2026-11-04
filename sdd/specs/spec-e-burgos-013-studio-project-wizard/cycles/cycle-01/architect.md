# Architect — Cycle 1: studio-project-wizard

> **Input:** sdd/specs/spec-e-burgos-013-studio-project-wizard/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-013-studio-project-wizard/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/opus, effort medium)

---

## Alcance del diseño

Este ciclo no tiene base de datos ni endpoints REST. Los contratos son:

- los comandos y eventos nuevos de `libs/studio-protocol` (WebSocket, zod), con `PROTOCOL_VERSION` en 2 (cambio aditivo anunciado por features);
- dos subcomandos nuevos de la CLI, `harness config catalog --json` y `harness config validate <file|-> --json`, genéricos y sin conocimiento de Studio;
- el modo **launcher** del puente (sin proyecto) y el cambio de proyecto en caliente (`workspace.open`);
- la invocación de `harness init` desde el puente (binario, argv, cwd, env, cancelación y lectura del progreso);
- la estructura del módulo «Nuevo proyecto» en `apps/studio`.

Por eso **no se escribe en `sdd/schema.json` ni en `sdd/api.json`**. Los componentes nuevos de `apps/studio` van a `sdd/components.json` (sección «Componentes»), y los registra el implementador front con `status: implemented`.

Stack respetado:

- **CLI** (`apps/cli`): TypeScript, citty, zod 3 con `zod-to-json-schema`, vitest. Node ≥ 18.
- **Protocolo** (`libs/studio-protocol`): zod 4, sin runtime propio. Se empaqueta dentro del puente.
- **Puente** (`apps/studio-bridge`): Node ≥ 20, citty, ws, esbuild y vitest. Los procesos se lanzan con spawn sin shell.
- **Studio** (`apps/studio`): Next con export estático, tucu-ui 3.10.0, zustand, vitest + RTL y Playwright en el puerto 4417.

El código va sin comentarios y este repo no es un workspace Nx: las tareas se corren con `pnpm --filter <paquete> <script>`.

**Regla de independencia (spec-e-burgos-015):** la CLI y el kit no conocen Studio. El puente consume la CLI **solo como proceso**. Nunca hace `import` de `@e-burgos/sdd-harness`, y un test del puente lo verifica (D-02).

## Hallazgos del código que condicionan el diseño

| # | Hallazgo | Consecuencia |
| - | -------- | ------------ |
| H-1 | `startBridge` resuelve `root`, exige `sdd/` (si no, lanza `BridgeStartError`) y cuelga de ese root `ThreadStore`, attachments, file-index, watcher, `KitIndexer`, `SessionManager` y `CommandRunner`. `createHandlers` cierra sobre `d.root`. | Sin proyecto no hay puente. El modo launcher obliga a separar el **host** (server, token, auth, wizard) del **runtime de proyecto** (todo lo que depende de root) (D-01). |
| H-2 | `Welcome.workspace` es `z.object({ root, project })` obligatorio. El cliente web descarta en silencio los mensajes que no decodifica (`decodeServerMessage` → `return`). Ante un cierre con código distinto de 4000/4001/4002 reintenta con backoff desde 500 ms y el mismo token. | Los eventos nuevos no rompen a una web vieja. Un cierre con un código propio (4010) provoca una reconexión automática con el mismo token: sirve para cambiar de proyecto sin pedir otro token (D-01). |
| H-3 | `harness init --config <f>` resuelve el destino con `resolveInitTarget`. Si el config vive en el cwd o se pasa `--here`, genera **en el lugar**. `resolveTargetDir` **rechaza** un destino que tenga algo fuera de `TOLERATED_ENTRIES` (`.git`, `.gitignore`, `.gitattributes`, `.DS_Store`, `README.md`, `LICENSE`, `harness.*`, `.vscode`, `.idea`, `.editorconfig`, `.npmrc`). `copyHarnessFiles` no pisa un archivo que ya está en el destino. | El puente escribe `harness.config.json` en el destino y corre la CLI con cwd en ese destino: el config queda byte a byte (US-3-040). Una carpeta con contenido no tolerado **no se puede generar**, con o sin confirmación (D-03). |
| H-4 | Orden real de `generateWorkspace`: estructura y config raíz → `pnpm install` + `nx reset` → docker, SDD, libs, apps y specs → gate → commit. En standalone es app en la raíz → `package.json` → `pnpm install --ignore-workspace` → docker y SDD → gate. El gate imprime `✓ [x] <label>` o `✗ [ ] <label> — FAILED` y **sigue** con el siguiente check. Si el gate queda rojo, la CLI lanza un error y sale con 1. | La instalación ocurre **antes** de generar las apps. Por eso las etapas se leen de la salida con un clasificador probado contra fixtures de la versión fijada (D-02). Reanudar después de un fallo de instalación no es posible sin tocar los generadores (D-05). |
| H-5 | `exec()` de la CLI usa `execSync` con shell e `stdio: inherit`. Los hijos (`pnpm`, `nx`) son nietos del proceso que lanza el puente. | Matar solo el pid de la CLI deja `pnpm install` vivo. La cancelación tiene que matar el **grupo de procesos** (D-02). |
| H-6 | `HarnessConfigSchema` valida la topología con `superRefine(validateAppTopology)`, pero `harness config schema` (`zodToJsonSchema`) **no** incluye esas reglas. Tampoco hay chequeo de nombres duplicados ni de choques de puertos. `toStandaloneOptions` lanza un error si hay ≠ 1 app, algo que el schema acepta. Los mensajes de topología son strings con `path: ['apps']`. | El JSON Schema solo no alcanza para un contrato completo. Hace falta un validador ejecutable de la CLI que devuelva issues estructurados (D-04). |
| H-7 | `toWorkspaceOptions`/`toStandaloneOptions` pasan a los generadores solo `services[].type`. `services[].port` y `version` **se ignoran**. El compose se genera si y solo si hay servicios. | Docker no es un campo propio sino el efecto de `services[]`. El puerto de un servicio no es editable en el wizard (D-05, Q-1). |
| H-8 | `pnpm` sigue `CI=true` con `--frozen-lockfile` por defecto, que falla sin lockfile. `NX_WORKSPACE_ROOT_PATH` heredado redirige `nx` a otro repo. `picocolors` colorea si detecta TTY o `CI`. | El entorno del proceso de generación se arma con una función pura que quita esas variables (D-02). |
| H-9 | `pnpm publish` (release-studio.yml) reemplaza `workspace:*` por la versión exacta al publicar. El build del puente bundlea con esbuild y deja las dependencias reales como external. | La CLI entra como dependencia **exacta** del puente vía `workspace:*`, sin bundlearla: se lanza el binario instalado (D-02). |
| H-10 | `initGitRepo` atrapa los errores de git y solo avisa. | Que falte git o la identidad de git no hace fallar la generación. El preflight lo informa sin bloquear (D-05). |
| H-11 | `MODULE_IDS` y `MODULES` registran los módulos de Studio con slots `Panel/Center/Right`. `ConnectedShell` asume un snapshot de proyecto. | En modo proyecto el wizard es un módulo más (`new-project`). Sin proyecto se muestra un `LauncherShell` dedicado (D-06). |

## Decisiones técnicas

### D-01. El wizard corre en un puente en modo launcher, y se abre el proyecto nuevo cambiando de proyecto en el mismo puente (Q-2; US-1-001, US-4-005, US-4-010)

**Decisión.**

1. `sdd-studio` lanzado en una carpeta sin `sdd/` **ya no falla**: arranca en **modo launcher** e imprime
   `No sdd/ in <dir>: launcher mode (New project). Run sdd-studio at a project root to open it.`
   En ese modo no se crea `ThreadStore`, watcher, `KitIndexer`, `SessionManager` ni motor de agentes. Solo existen el server WS (mismo token, mismos orígenes), `AuthState` y el `WizardService`.
2. `Welcome.workspace` pasa a `.nullable()`: `null` en launcher y el objeto de siempre en modo proyecto. Se suman las features `project-wizard` y `workspace-switch` a `BRIDGE_FEATURES`.
3. Refactor del puente:
   - `startBridge` arma un `BridgeHost` con `{ server, token, auth, wizard, runtime: ProjectRuntime | null }`.
   - `openProjectRuntime(root, deps)` extrae el cableado actual (de `store` a `runner`) y devuelve `{ root, project, handle(command), welcomePart(), isBusy(), close() }`.
   - El router despacha los comandos `wizard.*`, `workspace.open`, `auth.*` y `presence.get` al host. El resto va al runtime. Sin runtime responde `SessionError('not-found', 'no project open')`.
4. **Abrir el proyecto nuevo:** `workspace.open { generationId }`. El puente:
   - verifica que la generación sea de este proceso, esté terminada (`succeeded` o `gate-failed`) y tenga `sdd/` (`hasSdd`);
   - si hay runtime y `isBusy()` (turnos en curso, aprobaciones o preguntas abiertas), responde `conflict`: «hay agentes trabajando en <project>»;
   - cierra el runtime actual (`kitIndexer.close`, `watcher.close`, `store.flush`) y abre el nuevo con `realpath(target)`;
   - emite `workspace.switched { root, project }` y en el siguiente tick cierra cada socket con el código **4010**.

   La web reconecta sola con el mismo token (H-2), recibe un `Welcome` con el workspace nuevo, resetea el store si cambió `root` y navega a `#general`. El usuario no copia ningún token ni lanza otro puente.
5. El mismo mecanismo sirve **en modo proyecto**: el wizard está disponible también con un repo conectado, y «Abrir en Studio» cambia el puente a ese proyecto, con una confirmación en la web que nombra el proyecto que se cierra.

**Alternativas descartadas.**

- *Comando de generación en un puente conectado a un repo, con destino fuera del root:* obliga a tener un repo con `sdd/` para crear el primero. Contradice la decisión del dev del 2026-11-04 y US-1-001.
- *Segundo proceso puente lanzado por el primero (otro puerto y otro token, pasado por el socket autenticado):* evita el refactor del host, pero deja procesos huérfanos cuya salida no se ve en la terminal del dev, y dos puentes con ciclos de vida acoplados. Además el launcher queda vivo sin función.
- *Reiniciar el proceso:* corta la conexión y obliga a pegar otro token, porque el token es efímero por proceso. Si se fijara el token en disco para poder reiniciar, el secreto quedaría persistido.
- *Flag explícito `--launcher` en vez del fallback automático:* exige saber de antemano el flag. Con el fallback, `npx @e-burgos/sdd-studio` funciona en cualquier carpeta. Se conserva el mensaje claro para el caso de quien lo lanzó por error en una subcarpeta.
- *Abrir por ruta arbitraria (`workspace.open { path }`):* amplía la superficie (cualquier poseedor del token podría reapuntar el puente a cualquier repo). En este ciclo solo se abre lo que este proceso generó.

### D-02. El puente lanza la CLI fijada como dependencia, como proceso y sin shell (Q-3; US-3-011, US-3-013, US-3-016, US-5-007)

**Versión y ubicación.**

- `apps/studio-bridge/package.json` suma la dependencia `"@e-burgos/sdd-harness": "workspace:*"`. `pnpm publish` la convierte en la versión **exacta** del monorepo (H-9). No entra en el bundle de esbuild: se lanza el binario instalado.
- `wizard/cli-locator.ts` → `locateHarnessCli()`:
  1. `import.meta.resolve('@e-burgos/sdd-harness')`, que da `dist/index.js`;
  2. sube por los directorios hasta un `package.json` con `name === '@e-burgos/sdd-harness'`;
  3. devuelve `{ bin: <pkgDir>/<bin.harness>, version }`.
  
  No usa `require.resolve('…/package.json')`, porque `exports` no la expone. Se cachea por proceso. `startBridge` acepta la opción programática `harnessCli?: { bin, version }` para tests. **No** hay flag de CLI ni variable de entorno para esto: un binario sustituible por env sería un vector de ejecución.
- Test de frontera: ningún archivo de `apps/studio-bridge/src` importa `@e-burgos/sdd-harness` (grep en vitest).

**Invocación de la generación** (`wizard/generation.ts`):

```ts
spawn(process.execPath, [cli.bin, 'init', '--config', 'harness.config.json', '--here', '-y'], {
  cwd: target,            // realpath ya verificado (D-03)
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
  env: buildCliEnv(process.env),
  windowsHide: true,
});
```

- `--here` hace explícito el modo en el lugar, aunque el config en el cwd ya lo implica (H-3). Nunca se pasa `--skip-verify`: generar siempre instala y corre el gate (RB-2). El perfil y tucu-ui salen del config.
- El argv es constante. El cliente no aporta ningún argumento: solo el config (que se escribe a un archivo) y la ruta destino (que es el cwd).
- `wizard.catalog` devuelve `initArgv: ['harness','init','--config','harness.config.json','--here','-y']`, y el resumen lo muestra tal cual (US-2-004).

**Entorno** (`wizard/cli-env.ts` → `buildCliEnv(env)`, función pura):

- **Quita** `ANTHROPIC_API_KEY` y `ANTHROPIC_AUTH_TOKEN` (reusa `withoutCredentialEnv`; los postinstall de terceros no ven credenciales), `CI`, todo `NX_*` (incluido `NX_WORKSPACE_ROOT_PATH`), `npm_package_*`, `npm_lifecycle_*`, `npm_config_local_prefix`, `INIT_CWD` y `PNPM_SCRIPT_SRC_DIR` (contaminación del `npx`/`pnpm dlx` que lanzó al puente).
- **Fija** `NO_COLOR=1`, `FORCE_COLOR=0` y `NX_DAEMON=false`. El último evita dejar un daemon de Nx vivo atado a la carpeta y hace que la cancelación sea limpia.
- **Conserva** el resto (`PATH`, `HOME`, `NODE_AUTH_TOKEN`, `npm_config_registry` del usuario, proxies).

**Cancelación** (`wizard.generation.cancel`):

- En POSIX: `process.kill(-pid, 'SIGTERM')` al grupo y `SIGKILL` al grupo a los 5 s si sigue vivo.
- En `win32`: `spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: false })`.

Cancelar nunca borra nada. Al cerrar el puente (`SIGINT`/`SIGTERM`), `BridgeHost.close()` cancela la generación activa antes de cerrar el server. Un `SIGKILL` al puente deja el grupo huérfano (R-3).

**Progreso:** eventos nuevos, sin reusar `command.output`/`command.exit`. Hacen falta `seq` para resincronizar (US-3-017), un buffer reproducible y estado de etapas. Además Studio ya consume `command.*` en `GateStatusModal` y mezclar los flujos lo rompería.

- Hay un buffer de línea por stream y la salida se coalesce cada 50 ms. Cada chunk ocupa ≤ 32 KiB y cada uno lleva su `seq` creciente.
- El ring buffer de salida es de 4 MiB por generación (se descarta lo más viejo y se marca `truncatedBefore`).
- `wizard/init-output.ts` → `classifyInitLine(line, mode): StageSignal | null` es una función pura que quita ANSI y los prefijos de clack (`│ ◇ ●`) y busca por substring, sin anclas:

| Señal | Patrón (salida de la CLI 0.16.x / 0.17.x) |
| ----- | ----------------------------------------- |
| `scaffold` | estado inicial al hacer spawn |
| `install` | `Installing .*\(pnpm install`, `Initializing Nx workspace` |
| `generate` | `Generating Docker Compose`, `Configuring SDD`, `Generating lib:`, `Generating app:`, `Seeding \d+ module` |
| `validate` | `FASE 3 gate` |
| `validate.pass` / `validate.fail` | `[x] sdd:validate` / `[ ] sdd:validate — FAILED` |
| `build.pass` / `build.fail` | `[x] nx run-many -t lint test build` o `[x] pnpm (lint\|test\|build)` / `[ ] (nx run-many…\|pnpm …) — FAILED` |
| `install.network` | `ERR_PNPM_META_FETCH_FAIL`, `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`, `ETIMEDOUT`, `getaddrinfo` |
| `install.pnpm-missing` | `pnpm: command not found`, `'pnpm' is not recognized`, `spawn pnpm ENOENT` |

**Mapeo del cierre del proceso a `GenerationStatus`:**

| Condición | Resultado |
| --------- | --------- |
| `exit 0` con las marcas del gate en pass | `succeeded` |
| `exit 0` sin alguna marca | `gate-failed` (la etapa sin marca se marca fallida, US-3-014). Indica deriva del clasificador y la atrapa el test de fixtures (R-1). |
| `exit ≠ 0` después de `FASE 3 gate` con algún `FAILED` | `gate-failed` (US-3-033) |
| `exit ≠ 0` antes del gate | `failed`, con `failure.stage` = etapa activa y `failure.kind` ∈ `cli`, `install`, `network`, `pnpm-missing` |
| Muerte por señal sin cancelación pedida | `interrupted` |
| Muerte por señal con cancelación pedida | `cancelled` |
| `error` del spawn (falta el binario) | `failed` / `cli-missing` |

Al terminar se calcula `hasSdd = existsSync(target/sdd)`.

**Alternativas descartadas.**

- *`npx @e-burgos/sdd-harness@<v>`:* necesita red y es lento la primera vez. En `win32` `npx.cmd` exige shell (Node ≥ 20.12 rechaza `.cmd` sin shell). Además la versión resuelta depende de la caché.
- *Importar la API programática de la CLI:* viola la regla de independencia (el puente quedaría acoplado a módulos internos, a `ZodError` y a la versión de zod de la CLI) y comparte el proceso con una generación que hace `process.chdir`.
- *Flag nuevo `--progress=json` en la CLI:* sería un contrato más robusto, pero toca los generadores, que este ciclo deja fuera salvo lo imprescindible. Queda como seguimiento si el clasificador resulta frágil (R-1).
- *Reusar `command.output`/`command.exit`:* no tienen `seq` ni estado, y colisionan con el `GateStatusModal`.

### D-03. Carpeta destino: la elige el puente con un explorador de directorios y la valida contra bases permitidas (Q-6, Q-8; US-3-001…010, US-3-042, CE-4)

**Selección.**

- El navegador no entrega rutas absolutas: la File System Access API da handles, no paths, y no existe en Firefox ni Safari. Por eso el selector es un explorador servido por el puente: `wizard.listDirs { path?, showHidden }` devuelve **solo directorios**.
- El punto de partida es `suggestedParent`: el cwd del puente si está dentro de una base permitida, si no el home.
- Además hay un campo de texto para pegar o escribir la ruta, y el nombre de la carpeta nueva se escribe al final de la ruta.

**Bases permitidas.**

- `realpath(os.homedir())` más las rutas de `--allow-target <dir[,dir]>`, un flag nuevo del puente que sirve para volúmenes externos y para tests con `os.tmpdir()`.
- Fuera de esas bases, `listDirs` y `checkTarget` devuelven `outside-allowed`.

**Validación** (`wizard/target.ts` → `checkTarget(input, ctx)`, pura salvo por el fs; ctx = `{ bases, projectRoot | null, platform, tolerated }`):

1. **Forma.** La ruta tiene que ser un string de 1 a 1024 caracteres, sin NUL y `path.isAbsolute` para la plataforma. Se rechazan:
   - los segmentos `..` y `.` en la entrada, sin normalizarlos en silencio (US-3-008);
   - en `win32`, las rutas UNC o de dispositivo (`\\`, `\\?\`), los caracteres `<>:"|?*` en segmentos y los nombres reservados (`CON`, `NUL`, `COM1`…), así como los segmentos que terminan en punto o espacio.

   Si falla, `state: 'invalid'` con `reason` ∈ `relative`, `dot-segment`, `bad-char`, `reserved-name`, `unc`, `too-long`.
2. **Resolución.** Se busca el ancestro existente más profundo y se aplica `realpath` (resuelve symlinks y junctions, CB-8). `resolvedPath = realpath(ancestro) + segmentos restantes`.
3. **Base.** `resolvedPath` tiene que estar **dentro** de una base y **no ser** la base misma ni la raíz del filesystem. Si no, `outside-allowed` con `reason` ∈ `outside`, `base-itself`.
4. **Existencia.** Si no existe, `missing` (se crea al generar, US-3-003). Si existe y no es directorio, `not-directory`.
5. **Escritura.** `fs.access(W_OK)` sobre el destino si existe, si no sobre el ancestro. Si falla, `not-writable` (CB-9).
6. **Contenido.** `readdir` del destino:
   - vacío → `empty`;
   - todo dentro de `tolerated` → `tolerated`, con confirmación (US-3-004/005: un `.git` solo cuenta como contenido);
   - algo fuera de `tolerated` → `conflicting`, bloqueado. Se informa `conflicting[]` (hasta 10 nombres) y el mensaje dice que la CLI solo genera sobre carpetas vacías o con `.git`, README y `harness.*`.

   `tolerated` viene del catálogo de la CLI (`catalog.targetDir.tolerated`), no de una copia (H-3). `notable[]` marca `.git` y `harness.config.json` para la advertencia reforzada (US-3-006). `sdd/` nunca es tolerado: cae en `conflicting`.
7. **Dentro del proyecto conectado** (Q-8). Solo hay proyecto en modo proyecto: `insideProject = projectRoot !== null && (resolvedPath === projectRoot || resolvedPath.startsWith(projectRoot + sep))`. En launcher siempre es `false`. Si es `true`, se pide confirmación aunque la carpeta esté vacía o no exista (US-3-009). Un destino que contenga al proyecto (un ancestro del root) cae en `conflicting` por contenido.
8. **Confirmación.**
   - `needsConfirmation = state === 'tolerated' || insideProject`.
   - `fingerprint = sha256(resolvedPath, state, nombres ordenados, insideProject).slice(0, 16)`.

**Generar** (`wizard.generate { config, path, fingerprint? }`):

1. Se revalida el config con la CLI (D-04), sin confiar en la validación del cliente.
2. Se repite `checkTarget`. Si el estado es bloqueante, `outcome: 'blocked'`. Si hace falta confirmación y el fingerprint falta o no coincide, `outcome: 'needs-confirmation'` con el check nuevo. Eso cubre CE-4 y US-3-010: la confirmación vale para un estado concreto y Studio no la persiste (CB-15).
3. Se crean los segmentos que faltan **de a uno** con `mkdir` (no recursivo) y, después de cada uno, `lstat` verifica que sea un directorio y no un symlink. Al final, `realpath(target) === resolvedPath`.
4. `harness.config.json`:
   - si no existe, se escribe con `JSON.stringify(config, null, 2) + '\n'` y flag `wx` (CB-17);
   - si existe e **igual** byte a byte, se deja;
   - si existe y **distinto**, `outcome: 'blocked'` con `reason: 'config-differs'`. Studio nunca pisa un config ajeno (RB-5).

   Si algo de esto falla, `failed` en la etapa `prepare` con la causa (US-3-035), y no se lanza la CLI.
5. Recién entonces se lanza la CLI (D-02).

Studio no escribe nada más fuera del config: el resto lo escribe la CLI dentro del destino. La única excepción inherente es el store global de pnpm (R-6).

**Errores del protocolo.** No se agregan valores a `ErrorCode`.

- Los resultados de negocio (estado de la carpeta, confirmación, config inválido) son **datos** del resultado, no errores.
- Errores que quedan: `bad-path` cuando una ruta mal formada llega a `listDirs`; `conflict` cuando ya hay una generación activa (el mensaje incluye la ruta, US-3-018) o el proyecto está ocupado (D-01); `not-found` cuando no se conoce el `generationId` o no hay proyecto; `bad-request` para todo lo demás.

**Alternativas descartadas.**

- *Selector nativo del navegador:* no da la ruta.
- *Un diálogo nativo del SO lanzado por el puente (osascript/zenity/PowerShell):* depende de la plataforma, abre ventanas fuera del navegador y no se puede testear.
- *Sin bases permitidas (cualquier ruta absoluta):* expone `/`, `/etc` y `C:\Windows` a un error de tipeo o a un poseedor del token.
- *Confirmar y generar sobre contenido no tolerado:* la CLI lo rechaza igual (H-3). Ofrecerlo sería prometer algo que falla después de la confirmación.

### D-04. El contrato del config sale de la CLI en tiempo de ejecución: catálogo + validador (Q-5; US-5-001…004, US-1-020, US-1-032…035, US-1-050…057, US-2-001…003)

**Cambio imprescindible en la CLI** (aditivo, sin tocar generadores ni `init`): dos subcomandos dentro del grupo `config` que ya existe. Le sirven a cualquier agente o CI tanto como a Studio, con la misma justificación que `config schema`.

1. **`harness config catalog [--json]`** → `config/catalog.ts` → `buildConfigCatalog()`. Se arma **solo** con constantes de la CLI:
   - `AppTypeSchema.options`;
   - `APP_TYPE_OPTIONS` y `DEFAULT_APP_NAMES`, que se mueven de `commands/init.ts` a `config/app-options.ts` e `init` los importa de ahí;
   - `DEFAULT_APP_PORTS`, `describeAppStack(type, true|false)`, `WORKSPACE_ONLY_APP_TYPES` y `TUCU_UI_APP_TYPES`;
   - `DEFAULT_SERVICES` y `SERVICE_OPTIONS`;
   - los regex de nombre, scope y autor, extraídos a constantes con nombre en `config/schema.ts` y usados por el schema y por el catálogo (`.source`);
   - el rango de puertos y `TOLERATED_ENTRIES`, que se exporta;
   - `buildConfigJsonSchema()` embebido.

   Forma en «Contratos». `format: 1`.
2. **`harness config validate <file|-> [--json]`** → `config/validate.ts` → `validateHarnessConfig(raw)`. Lee `.json`/`.mjs`/`.js` como `loadHarnessConfig`, o JSON por stdin con `-` (tope de 64 KiB). Devuelve:
   - **issues `error`:**
     - los de `HarnessConfigSchema.safeParse` (path de zod, `code` = código de zod);
     - los de topología, ahora **estructurados**: `collectAppTopologyIssues(apps, mode)` devuelve `{ appIndex, field, code, message }` y `validateAppTopology` pasa a ser un envoltorio que mapea a strings, así que `superRefine` y los mensajes actuales no cambian;
     - las precondiciones de `init` que el schema no ve: `standalone-app-count` (≠ 1 app en standalone), `duplicate-app-name` y `duplicate-lib-name`.

     Los `code` de topología son `ml-not-python`, `tucu-ui-not-frontend`, `workspace-only-type`, `shell-not-mfe`, `shell-missing`, `shell-not-found`, `shell-not-mfe-shell` y `shell-ambiguous`, cada uno con path `['apps', i, field]`.
   - **issues `warning`:** `port-conflict` (dos apps con el mismo puerto **resuelto**, o una app con el puerto de un servicio, con path a las dos filas) y `standalone-libs-ignored`.
   - **`resolved`** (solo si no hay errores): la vista previa calculada **con las funciones del generador**:
     - puertos con `resolveAppPorts` y `portSource` ∈ `explicit`, `default`, `shifted`;
     - `tucuUi` efectivo con `resolveAppTucuUi`;
     - `stack` con `describeAppStack`;
     - shell y ruta `/<mfe>/` con `resolveMfeShell`;
     - path `apps/<name>`, o `.` en standalone;
     - servicios con el puerto y la versión de `DEFAULT_SERVICES`;
     - `dockerCompose = services.length > 0`;
     - perfil efectivo.

   Exit 0 = sin errores (puede haber warnings), 1 = con errores, 2 = archivo ilegible o uso inválido. Con `--json` el resultado sale siempre por stdout.

**En el puente** (`wizard/config-cli.ts`):

- `wizard.catalog` corre `config catalog --json` **una vez por proceso** (la versión es fija) y lo parsea con `ConfigCatalog` del protocolo. Si falla el parseo, `internal` con «CLI <v> output does not match the protocol».
- `wizard.validate { config }` corre `config validate - --json` con el config por stdin y lo parsea con `ConfigValidation`.
- Hay **un solo** proceso de validación a la vez. Una petición nueva reemplaza a la que está en cola, de modo que el último estado gana. El timeout es de 10 s.

**En Studio:**

- **Instantáneo, sin ir al puente:** formato de nombres y scope (los regex llegan como string en el catálogo y se compilan en el cliente), rango de puertos y campos obligatorios. No son copias: el valor llega en runtime desde la CLI fijada.
- **Opciones que se bloquean:** salen de los flags del catálogo (`workspaceOnly`, `tucuUi`, `ml`, `shell`, `modes[].maxApps`, `modes[].libs`), siempre con la razón visible (US-1-013/016/017/022/026/033).
- **Validación completa:** `wizard.validate` con debounce de 400 ms en cada cambio de estado desde el paso 2. Un contador de secuencia descarta las respuestas viejas. Generar se deshabilita mientras haya `error`, o un `warning` con código en el conjunto bloqueante del wizard (`port-conflict`, US-1-055/056), o una validación en vuelo.
- **Mensajes:** `lib/wizard/issues.ts` mapea `path` y `code` → paso, campo e i18n. Si un `code` no tiene traducción, se muestra el `message` de la CLI (en inglés), nunca JSON crudo (US-1-034).
- **Recomendaciones** (US-1-012/025/027): son contenido UX propio de Studio (`lib/wizard/recommendations.ts`). No validan ni bloquean, así que no duplican reglas (RN-6).

**Alternativas descartadas.**

- *Solo el JSON Schema de `config schema` (ajv en el navegador):* no trae la topología, ni los duplicados, ni la regla de una app en standalone (H-6). Habría que reimplementarlas en Studio y se desincronizarían.
- *Copia versionada en `libs/studio-protocol`:* es la duplicación que prohíbe RB-4. El protocolo lleva solo la **forma** del catálogo y del resultado de validación, que es un contrato de datos, no de reglas. Un test de contrato del puente contra la CLI real garantiza que esa forma se cumple.
- *Importar `defineConfig`/`HarnessConfigSchema` en el puente:* viola la independencia (D-02) y no da puertos resueltos ni issues por campo.
- *Validar solo al apretar Generar:* no cumple US-1-003 ni US-2-008.

### D-05. Docker, reintento de instalación y estado persistido (Q-1, Q-4, Q-7; US-1-028, US-1-031, US-3-017, US-3-031, US-3-032, US-3-034)

**Docker (Q-1).** No hay campo nuevo en la CLI.

- El bloque del paso 5 se titula «Servicios (Docker Compose)» y explica que elegir uno o más servicios genera `docker-compose.yml`, además del `.env.example` que existe siempre.
- `resolved.dockerCompose` (lo dice la CLI) decide si el árbol de vista previa muestra `docker-compose.yml`.
- **El puerto de un servicio no se edita.** Se muestra el de `resolved.services[].port`, porque los generadores ignoran `services[].port` (H-7) y ofrecerlo sería mentir. Desvío de US-1-028: se informa al funcional.
- El choque entre apps y servicios (US-1-056) se evalúa contra ese puerto resuelto (`port-conflict`).

**Reintento de instalación (Q-4): no se puede reanudar en este ciclo.**

- En modo nx `pnpm install` corre **antes** de generar SDD, libs y apps (H-4). Volver a correr `init` en el lugar falla, porque la carpeta ya tiene `package.json`, `apps/` y demás (H-3).
- US-3-031 se reduce así:
  1. **Prevenir con preflight:** antes de escribir nada, `wizard.preflight` informa la versión de Node, la presencia y versión de pnpm, git y la identidad de git (solo informativo, H-10), y si el registry responde (`pnpm config get registry` y después un `HEAD` con timeout de 3 s; cualquier respuesta HTTP = alcanzable). pnpm ausente o un registry inalcanzable deshabilitan Generar, con una causa accionable (CB-18). La versión de Node del puente (≥ 20) siempre cubre la de la CLI (≥ 18), así que CB-19 no aplica.
  2. **Después de un fallo de instalación:** la pantalla de fallo ofrece «Generar en otra carpeta» (vuelve al paso 6 con todo lo elegido) y explica que la carpeta actual quedó con contenido que la CLI no acepta para regenerar; vaciarla es decisión manual del dev (US-3-038). «Reintentar instalación» **no** se ofrece.
  3. **Seguimiento:** se propone una spec para `harness init --resume`, que es un cambio de generadores y queda fuera de este ciclo.
- Un gate en rojo no necesita reintento desde el wizard: el proyecto está completo, se puede abrir (US-4-004) y el gate se vuelve a correr con `command.run validate` como en cualquier proyecto.

**Estado de una generación (Q-7): en memoria del puente, reexpuesto al reconectar.**

- `GenerationRegistry` en el `BridgeHost` (sobrevive al cambio de runtime): guarda **una activa** (RN-12, US-3-018/019, CB-12) y la **última terminada**, con su `GenerationState` y el ring buffer de salida.
- Toda transición emite `generation.status` y toda salida emite `generation.output`, en broadcast a todos los clientes: dos pestañas ven la misma generación.
- `wizard.generation.get { generationId?, sinceSeq }` devuelve el estado y los chunks con `seq > sinceSeq` que entren en `FRAME_BUDGET_BYTES` (`hasMore` para paginar). Sin `generationId` devuelve la activa o, si no hay, la última.
- Studio guarda en `sessionStorage` `{ generationId, target, lastSeq }`. Al volver al módulo o al reconectar (US-3-017, US-3-032):
  - si el puente la conoce, se resincroniza;
  - si responde `not-found` y el último estado conocido era `running`, se muestra «Interrumpida o desconocida: el puente se reinició» (CB-13), la ruta y «Revisar carpeta».
- **Sin persistencia en disco:** un archivo de estado dentro del destino ensuciaría el proyecto y rompería la regla de carpeta vacía de la CLI, y uno en `~/.sdd-studio/` crearía un estado global nuevo para un caso raro.
- Interrupción por señal: `interrupted` (D-02). Un reintento posterior sobre esa carpeta cae en `conflicting` y no se puede generar ahí, que es una versión más estricta que US-3-034 y coherente con H-3.

### D-06. Estructura del módulo en Studio (US-1, US-2, US-3, US-4)

**Lógica pura (sin React)** en `apps/studio/src/lib/wizard/`:

| Archivo | Responsabilidad |
| ------- | --------------- |
| `state.ts` | `WizardState` (alcance, modo, identidad, apps front/back, libs, servicios, perfil, puertos editados) y reducer. `planDiscards(state, change)` devuelve exactamente qué se descarta ante un cambio de alcance o modo (US-1-036/040, CB-1/3/4/5). Los descartados por alcance quedan en `stash` mientras dure la sesión (US-1-040). |
| `to-config.ts` | `toHarnessConfig(state)`: emite solo lo decidido (US-5-004/006). `tucuUi: false` solo si se apagó; `port` solo si se editó; `ml` solo en python; `shell` solo con más de un `mfe-shell`; `sdd.profile` siempre; `author` y `modules` solo si se definieron. |
| `catalog.ts` | Selectores sobre `ConfigCatalog`: tipos por familia y modo, razones de bloqueo y descripción del stack. |
| `field-checks.ts` | Chequeos instantáneos con los patrones y el rango del catálogo. |
| `issues.ts` | Mapea `ConfigIssue` → `{ step, field, text }`. |
| `recommendations.ts` | Etiquetas «Recomendado» de US-1-012/025/027. |
| `persist.ts` | `sessionStorage`: el estado del wizard (US-1-041), el puntero a la generación (D-05) y la idea pendiente para Hermes. Nunca guarda el fingerprint de confirmación (CB-15). |
| `hermes-idea.ts` | Texto sugerido de US-4-007. |
| `use-catalog.ts`, `use-wizard-validation.ts`, `use-target-check.ts`, `use-generation.ts` | Hooks sobre `client.request`/`client.onEvent`: debounce, contador de secuencia y resincronización. |

**Componentes** en `apps/studio/src/components/modules/new-project/`, con tucu-ui, tipografía de Studio y sin `<select>` nativo (lo controla `no-native-select.spec.ts`):

| Componente | Rol |
| ---------- | --- |
| `index.ts` | `newProjectModule: ModuleSlots = { Panel, Center, Right }`. |
| `NewProjectPanel.tsx` | Stepper de los 6 pasos, con el actual, los completados y los «No aplica por el alcance» (US-1-002/011), y el botón «Empezar de nuevo» (US-1-041). |
| `NewProjectCenter.tsx` | Muestra el paso actual o, durante y después de generar, `GenerationProgress`/`GenerationResult`. Controla Siguiente y Atrás con la razón del bloqueo (US-1-003/004). |
| `NewProjectRight.tsx` | Vista previa en vivo: árbol, `harness.config.json` de solo lectura y lista de issues con enlace al campo (US-2-005/008). |
| `steps/ScopeStep.tsx`, `ShapeStep.tsx`, `FrontStep.tsx`, `BackStep.tsx`, `ExtrasStep.tsx`, `SummaryStep.tsx` | Un paso cada uno (US-1-010…031, US-2-001…007). |
| `AppRow.tsx`, `PortField.tsx`, `ServiceRow.tsx` | Filas editables con error en el campo (US-1-053…057). |
| `TargetPicker.tsx` + `DirectoryBrowserModal.tsx` | Campo de ruta más el explorador de `wizard.listDirs`, que muestra la ruta normalizada (US-3-001/008). |
| `TargetStatus.tsx` | Los estados de `TargetCheck` con su texto (US-3-002/007/009). |
| `ConfirmTargetDialog.tsx` | Confirmación con ruta, cantidad de elementos, primeros nombres y advertencia reforzada. El botón dice «Generar en esta carpeta con contenido» y no es el foco inicial (US-3-005/006). |
| `DiscardChangesDialog.tsx` | Lista de descartes (US-1-036). |
| `PreflightNotice.tsx` | Resultado de `wizard.preflight`. |
| `GenerationProgress.tsx` + `OutputLog.tsx` | Etapas, log en vivo con autoscroll salvo que el usuario haya subido (US-3-012/013), «Cancelar generación» con confirmación (US-3-016) y «Conexión perdida» (US-3-032). |
| `GenerationResult.tsx` | Las tres variantes: éxito, «Generado con errores» y fallo previo. Muestra la versión de la CLI (US-5-007) y las acciones «Abrir en Studio» (si `hasSdd`), «Mostrar en el explorador», «Copiar ruta», «Ver/Copiar log», «Editar y volver a intentar» y «Generar en otra carpeta» (US-3-037, US-4-001…004/008). |

**Shell y navegación:**

- `MODULE_IDS` suma `new-project`, con label e ícono `FolderPlus` y `hideable: true`, al final del rail.
- `components/shell/LauncherShell.tsx`: con `welcome.workspace === null`, `ConnectedShell` muestra este shell (header con «Sin proyecto abierto» y solo el módulo `new-project`) en lugar de `StudioShell`, que asume un snapshot.
- `BridgeProvider`:
  - ante `workspace.switched`, marca «Abriendo <project>…» en `ConnectionBanner` en lugar de «Reconectando»;
  - en el `Welcome` siguiente, si cambió `root`, resetea el store (`createStudioStore` o una acción `reset`) y navega a `#general`;
  - deja la idea de `persist.ts` como borrador del composer, sin enviarla (US-4-006/007).
  
  Si no se conecta en 15 s, `ConnectionBanner` muestra el error accionable con la ruta (US-4-010).
- `ConnectScreen`: suma la línea «Para crear un proyecto nuevo corré `npx @e-burgos/sdd-studio` en cualquier carpeta». El wizard necesita un puente (launcher o proyecto) porque el catálogo sale de la CLI fijada en el puente. Es la lectura de «sin proyecto abierto» de US-1-001.

**Alternativa descartada:** un catálogo estático en Studio para recorrer los pasos 1 a 5 sin puente. Duplica el contrato (RB-4) y diverge en cuanto cambia la CLI.

### D-07. Seguridad: el puente ejecuta procesos en la máquina del dev

| Amenaza | Control |
| ------- | ------- |
| Inyección de argumentos o shell | argv constante y `shell: false` (D-02). El único input del cliente que llega al fs es el config (archivo JSON con tope de 64 KiB) y la ruta destino (cwd validado). La única excepción con shell es el preflight en `win32` (`pnpm --version`, `pnpm config get registry`), con strings **constantes** de un enum y sin input del cliente. |
| Escritura fuera de lugar o pisado de contenido | Bases permitidas, `realpath`, rechazo de `..`, UNC y nombres reservados, re-chequeo con fingerprint al generar, `mkdir` segmento a segmento con `lstat`, config con `wx`, y bloqueo si el config existe y es distinto (D-03). Studio no borra ni mueve nada (RB-5). |
| Reapuntar el puente a otro repo | `workspace.open` y `wizard.reveal` aceptan solo `generationId` de este proceso, nunca rutas (D-01). |
| Fuga de credenciales a scripts de terceros (postinstall) | `buildCliEnv` quita las credenciales de Anthropic (D-02). La salida del proceso se emite tal cual: no contiene secretos del puente. |
| Enumeración del filesystem | `listDirs` devuelve solo nombres de directorios dentro de las bases, con un tope de 500 (`truncated`). Los nombres de archivos solo aparecen en `TargetCheck.entries.sample` del destino elegido (hasta 10) para la confirmación. La web no envía esos datos a ningún servidor; se mantiene la regla vigente de Studio. |
| Abuso de recursos | Una generación activa, una validación a la vez con reemplazo de la cola, timeouts en validate y preflight, ring buffer de 4 MiB y chunks de 32 KiB. |
| Procesos huérfanos | Grupo de procesos con kill al cancelar o cerrar, y `NX_DAEMON=false`. Un `SIGKILL` del puente es un riesgo aceptado (R-3). |
| Superficie del launcher | Sin motor de agentes ni SDK cargados. Mismo token y mismos orígenes que en modo proyecto. |
| Binario sustituido | La ubicación de la CLI no se toma de flags ni de env, solo de la dependencia instalada o de la opción programática de tests (D-02). |

### D-08. Estrategia de tests por capa

| Capa | Tests |
| ---- | ----- |
| **CLI** (`apps/cli`, vitest) | **Catálogo:** cubre cada `AppTypeSchema.options`, los flags coinciden con las constantes, los patrones compilan y coinciden con el schema, `tolerated` es igual a `TOLERATED_ENTRIES`. **Validate:** un caso por `code` de topología, duplicados, `standalone-app-count`, `port-conflict`, puertos resueltos iguales a `resolveAppPorts`, `portSource`, exit codes 0/1/2 y lectura por stdin. **Matriz US-5-002:** standalone con cada tipo permitido; `react`+`nestjs`; `nextjs`+`python`+`ml`; `next-bff`+`nestjs`; `mfe-shell`+2 `mfe`; dos `mfe-shell` con `shell`. **No regresión:** los mensajes de `validateAppTopology` quedan iguales (snapshot) y `init` usa las opciones movidas sin cambios. |
| **Protocolo** (`libs/studio-protocol`) | `commands.spec`/`events.spec`/`handshake.spec`: aceptan los comandos nuevos y rechazan configs de más de 64 KiB, rutas con NUL o de más de 1024, `sinceSeq` negativo, `Welcome` con `workspace: null` y `generation.*` válidos. `index.spec` exporta los tipos nuevos. |
| **Puente unit** (vitest) | `target.spec` con tmp dirs y bases inyectadas: missing, empty, tolerated, conflicting, file, not-writable (`chmod 500`; skip en win32), symlink resuelto, `..`/relativa/UNC/reservados, base-itself, outside, insideProject y fingerprint estable o cambiado. `cli-env.spec`. `init-output.spec` contra **fixtures grabados de la CLI fijada** (nx éxito, standalone éxito, fallo de red, gate rojo, pnpm ausente). `generation.spec` con `test-utils/fake-harness.mjs` (opción `harnessCli`): emite los fixtures, cada exit code y mapeo, cancel mata al nieto (`sleep` en el grupo), un segundo generate → `conflict`, ring buffer y paginación con `hasMore`, `seq` monótono. `config-cli.spec`: cola de validación y parseo fallido → `internal`. |
| **Puente integración** | `launcher.e2e.spec`: `startBridge` sin `sdd/` → `Welcome.workspace === null`; `thread.list` → `not-found`; `wizard.catalog` ok. `switch.e2e.spec`: genera con el fake, `workspace.open` → evento, cierre 4010, reconexión con el mismo token y `Welcome` del root nuevo; rechazo con sesión ocupada (fake engine) y rechazo de un id desconocido. `harness-contract.spec`, sobre la CLI real compilada en el workspace: `config catalog --json` y `config validate` parsean con los schemas del protocolo. `no-cli-import.spec`: grep de la frontera. |
| **Studio unit** (vitest + RTL) | `lib/wizard/*`: discards, omisiones de `to-config`, issues → campo y recomendaciones. Componentes con un cliente falso: visibilidad de pasos por alcance y modo, opciones bloqueadas con razón, Siguiente deshabilitado con motivo, confirmación sin foco por defecto, progreso desde eventos, resync después de reconectar, «Conexión perdida», las tres variantes del resultado, `LauncherShell` y el flujo de cambio de proyecto en `BridgeProvider`. |
| **Studio e2e** (Playwright, puerto 4417) | Puente `--local-ui` en launcher, con el fake harness inyectado por un script de arranque e2e (`startBridge` programático) y `--allow-target` a un tmp: wizard completo → Generar → progreso → éxito → «Abrir en Studio» → `#general` con la idea en borrador. También la carpeta con `.git` (confirmación) y `conflicting` (bloqueada). |
| **Real de punta a punta** (`examples/`, manual o script) | Con el puente compilado y la CLI real: monorepo `react`+`nestjs` y standalone `nextjs` desde un cliente WS scripteado → gate verde y config idéntico al de la vista previa (sha). Después, `harness init --config <mismo archivo> -y` en otra carpeta y comparación de apps, libs y servicios (US-5-005). |

## Contratos

### Protocolo — comandos nuevos (`libs/studio-protocol/src/wizard.ts`, unidos a `ClientCommand`)

```ts
const AbsPathInput = z.string().min(1).max(1024).refine((s) => !s.includes('\0'), 'NUL not allowed');
const ConfigDraft = z
  .record(z.string(), z.unknown())
  .refine((c) => JSON.stringify(c).length <= 65_536, 'config too large');
const GenerationId = z.string().min(1).max(64);

z.object({ ...cmd('wizard.catalog') }),
z.object({ ...cmd('wizard.preflight') }),
z.object({ ...cmd('wizard.validate'), config: ConfigDraft }),
z.object({ ...cmd('wizard.listDirs'), path: AbsPathInput.optional(), showHidden: z.boolean().default(false) }),
z.object({ ...cmd('wizard.checkTarget'), path: AbsPathInput }),
z.object({ ...cmd('wizard.generate'), config: ConfigDraft, path: AbsPathInput, fingerprint: z.string().regex(/^[0-9a-f]{16}$/).optional() }),
z.object({ ...cmd('wizard.generation.get'), generationId: GenerationId.optional(), sinceSeq: z.number().int().nonnegative().default(0) }),
z.object({ ...cmd('wizard.generation.cancel'), generationId: GenerationId }),
z.object({ ...cmd('wizard.reveal'), generationId: GenerationId }),
z.object({ ...cmd('workspace.open'), generationId: GenerationId }),
```

### Protocolo — tipos de resultado

```ts
export const ConfigCatalog = z.object({
  format: z.literal(1),
  cliVersion: z.string().max(40),
  modes: z.array(z.object({ mode: z.enum(['nx', 'standalone']), maxApps: z.number().int().positive().nullable(), libs: z.boolean() })).max(4),
  appTypes: z.array(z.object({
    type: z.string().max(32),
    label: z.string().max(80),
    hint: z.string().max(200),
    role: z.enum(['frontend', 'backend']),
    defaultName: z.string().max(40),
    defaultPort: z.number().int(),
    stack: z.string().max(240),
    stackPlain: z.string().max(240).nullable(),
    workspaceOnly: z.boolean(),
    tucuUi: z.boolean(),
    ml: z.boolean(),
    shell: z.boolean(),
  })).max(32),
  libTypes: z.array(z.object({ type: z.string().max(32), label: z.string().max(80) })).max(16),
  serviceTypes: z.array(z.object({ type: z.string().max(32), label: z.string().max(80), hint: z.string().max(200), defaultPort: z.number().int(), version: z.string().max(40) })).max(16),
  profiles: z.array(z.enum(['team', 'solo'])).max(4),
  patterns: z.object({ name: z.string().max(200), packageScope: z.string().max(200), author: z.string().max(200) }),
  portRange: z.object({ min: z.number().int(), max: z.number().int() }),
  targetDir: z.object({ tolerated: z.array(z.string().max(64)).max(64) }),
  jsonSchema: z.record(z.string(), z.unknown()),
});

export const WizardCatalogResult = z.object({
  catalog: ConfigCatalog,
  initArgv: z.array(z.string().max(64)).max(16),
  home: z.string().max(1024),
  suggestedParent: z.string().max(1024),
  platform: z.enum(['posix', 'win32']),
});

export const ConfigIssue = z.object({
  severity: z.enum(['error', 'warning']),
  code: z.string().max(48),
  path: z.array(z.union([z.string().max(64), z.number().int().nonnegative()])).max(8),
  message: z.string().max(500),
});

export const ResolvedConfig = z.object({
  mode: z.enum(['nx', 'standalone']),
  project: z.object({ name: z.string().max(64), packageScope: z.string().max(64) }),
  apps: z.array(z.object({
    name: z.string().max(64),
    type: z.string().max(32),
    path: z.string().max(128),
    port: z.number().int(),
    portSource: z.enum(['explicit', 'default', 'shifted']),
    tucuUi: z.boolean().nullable(),
    ml: z.boolean(),
    shell: z.string().max(64).nullable(),
    route: z.string().max(80).nullable(),
    stack: z.string().max(240),
  })).max(32),
  libs: z.array(z.object({ name: z.string().max(64), type: z.string().max(32), path: z.string().max(128) })).max(32),
  services: z.array(z.object({ type: z.string().max(32), port: z.number().int(), version: z.string().max(40) })).max(16),
  dockerCompose: z.boolean(),
  profile: z.enum(['team', 'solo']),
});

export const ConfigValidation = z.object({
  format: z.literal(1),
  cliVersion: z.string().max(40),
  ok: z.boolean(),
  issues: z.array(ConfigIssue).max(100),
  resolved: ResolvedConfig.nullable(),
});

export const Preflight = z.object({
  node: z.object({ version: z.string().max(40) }),
  pnpm: z.object({ found: z.boolean(), version: z.string().max(40).nullable() }),
  git: z.object({ found: z.boolean(), identity: z.boolean() }),
  registry: z.object({ url: z.string().max(512).nullable(), reachable: z.enum(['yes', 'no', 'unknown']) }),
  ready: z.boolean(),
});

export const DirListing = z.object({
  path: z.string().max(1024),
  parent: z.string().max(1024).nullable(),
  entries: z.array(z.object({ name: z.string().max(255), symlink: z.boolean() })).max(500),
  truncated: z.boolean(),
});

export const TargetState = z.enum(['missing', 'empty', 'tolerated', 'conflicting', 'not-directory', 'not-writable', 'outside-allowed', 'invalid']);
export const TargetCheck = z.object({
  input: z.string().max(1024),
  resolvedPath: z.string().max(1024).nullable(),
  state: TargetState,
  reason: z.string().max(40).nullable(),
  entries: z.object({
    count: z.number().int().nonnegative(),
    sample: z.array(z.string().max(255)).max(10),
    conflicting: z.array(z.string().max(255)).max(10),
    notable: z.array(z.enum(['.git', 'harness.config.json'])).max(2),
  }).nullable(),
  insideProject: z.boolean(),
  needsConfirmation: z.boolean(),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
});

export const GenerationStage = z.enum(['prepare', 'scaffold', 'install', 'generate', 'validate', 'build']);
export const GenerationStatus = z.enum(['running', 'succeeded', 'gate-failed', 'failed', 'cancelled', 'interrupted']);
export const GenerationState = z.object({
  id: z.string().max(64),
  target: z.string().max(1024),
  projectName: z.string().max(64),
  mode: z.enum(['nx', 'standalone']),
  cliVersion: z.string().max(40),
  argv: z.array(z.string().max(64)).max(16),
  status: GenerationStatus,
  stages: z.array(z.object({ stage: GenerationStage, status: z.enum(['pending', 'active', 'done', 'failed', 'skipped']) })).length(6),
  gate: z.object({ validate: z.enum(['pending', 'pass', 'fail']), build: z.enum(['pending', 'pass', 'fail']) }),
  failure: z.object({
    stage: GenerationStage,
    kind: z.enum(['prepare', 'cli-missing', 'cli', 'install', 'network', 'pnpm-missing', 'gate', 'cancelled', 'signal']),
    message: z.string().max(2000),
  }).nullable(),
  exitCode: z.number().int().nullable(),
  hasSdd: z.boolean(),
  startedAt: z.string().max(40),
  finishedAt: z.string().max(40).nullable(),
  lastSeq: z.number().int().nonnegative(),
});

export const GenerateResult = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('started'), generation: GenerationState }),
  z.object({ outcome: z.literal('needs-confirmation'), check: TargetCheck }),
  z.object({ outcome: z.literal('blocked'), check: TargetCheck, reason: z.string().max(40).nullable() }),
  z.object({ outcome: z.literal('invalid-config'), validation: ConfigValidation }),
]);

export const GenerationOutputChunk = z.object({ seq: z.number().int().positive(), stream: z.enum(['stdout', 'stderr']), chunk: z.string().max(32_768) });
export const GenerationSnapshot = z.object({
  generation: GenerationState.nullable(),
  output: z.array(GenerationOutputChunk),
  truncatedBefore: z.boolean(),
  hasMore: z.boolean(),
});
```

| Comando | `data` del resultado | Errores |
| ------- | -------------------- | ------- |
| `wizard.catalog` | `WizardCatalogResult` | `internal` (falla la CLI o el parseo) |
| `wizard.preflight` | `Preflight` | — |
| `wizard.validate` | `ConfigValidation` | `bad-request` (tamaño), `internal` |
| `wizard.listDirs` | `DirListing` | `bad-path` (forma, fuera de las bases, no es directorio) |
| `wizard.checkTarget` | `TargetCheck` (los estados son datos) | — |
| `wizard.generate` | `GenerateResult` | `conflict` (ya hay una activa; el mensaje trae la ruta), `internal` |
| `wizard.generation.get` | `GenerationSnapshot` | `not-found` (id desconocido) |
| `wizard.generation.cancel` | `GenerationState` | `not-found`, `conflict` (ya terminó) |
| `wizard.reveal` | `null` | `not-found` |
| `workspace.open` | `{ root, project }` | `not-found` (id o `sdd/` ausente), `conflict` (corriendo u ocupado) |

### Protocolo — eventos nuevos (`ServerEvent`) y handshake

```ts
z.object({ kind: z.literal('generation.status'), generation: GenerationState }),
z.object({ kind: z.literal('generation.output'), generationId: z.string().max(64), seq: z.number().int().positive(), stream: z.enum(['stdout', 'stderr']), chunk: z.string().max(32_768) }),
z.object({ kind: z.literal('workspace.switched'), root: z.string().max(1024), project: z.string().max(128) }),
```

- `Welcome.workspace` → `z.object({ root, project }).nullable()`.
- `BRIDGE_FEATURES` += `'project-wizard'`, `'workspace-switch'`.
- Código de cierre WS **4010** = cambio de proyecto: el cliente reconecta. `PROTOCOL_VERSION` sigue en 2.

### Puente — flags y opciones

- Flag nuevo: `--allow-target <dir[,dir]>`, bases extra para el destino (D-03).
- Opción programática nueva de `startBridge`: `harnessCli?: { bin: string; version: string }` (solo tests), además de `allowTargets?: string[]`.
- Cambio de comportamiento: sin `sdd/` arranca en launcher (D-01). `BridgeStartError` queda para el puerto ocupado con `--port` y la UI local ausente.

### CLI — subcomandos nuevos (dentro de `harness config`)

| Comando | Salida | Exit |
| ------- | ------ | ---- |
| `harness config catalog [--json]` | JSON `ConfigCatalog` (sin `--json`, una tabla legible) | 0 |
| `harness config validate <file\|-> [--json]` | JSON `ConfigValidation` (sin `--json`, la lista legible de issues) | 0 sin errores, 1 con errores, 2 ilegible o uso inválido |

La CLI **no** importa `@sdd-studio/protocol`: replica la forma en sus propios tipos, y el test de contrato del puente es el que garantiza la coincidencia (D-08).

## Respuestas a las preguntas del funcional

| # | Pregunta | Decisión |
| - | -------- | -------- |
| Q-1 | Docker | No hay campo propio: Docker es el efecto de `services[]` (compose si hay uno o más). Bloque «Servicios (Docker Compose)» y puerto de servicio de solo lectura, porque la CLI ignora `services[].port` (D-05, H-7). |
| Q-2 | Arranque sin `sdd/` y apertura sin otro token | Modo launcher automático del puente. `workspace.open { generationId }` cambia el runtime en el mismo proceso, emite `workspace.switched` y cierra con 4010, y la web reconecta con el mismo token (D-01). |
| Q-3 | Invocación de la CLI | Dependencia exacta `workspace:*` del puente, binario resuelto desde el paquete instalado, `node <bin> init --config harness.config.json --here -y` con cwd en el destino, sin shell, env saneado, grupo de procesos para cancelar y eventos `generation.*`. El config escrito en el destino se conserva (H-3, D-02). |
| Q-4 | Reintentar instalación | No se puede reanudar en este ciclo: la instalación ocurre antes de generar las apps y re-correr `init` en el lugar falla. Se reemplaza por un preflight bloqueante (pnpm y registry) y por «Generar en otra carpeta». `harness init --resume` queda como spec de seguimiento (D-05). |
| Q-5 | Contrato del config | En runtime desde la CLI fijada: `config catalog --json` (opciones, flags, patrones, puertos y `tolerated`) y `config validate - --json` (schema, topología estructurada, precondiciones de `init`, warnings y vista previa resuelta). El protocolo solo define la forma, y un test de contrato la ata a la CLI real (D-04). |
| Q-6 | Selección de carpeta | Explorador servido por el puente (`wizard.listDirs`) más un campo de texto, con bases permitidas (home y `--allow-target`), `realpath` y re-chequeo con fingerprint al generar (D-03). |
| Q-7 | Estado de una generación | En memoria del `BridgeHost` (la activa y la última), con `seq`, ring buffer y `wizard.generation.get` para resincronizar. Sin disco. Si el puente se reinicia, Studio la marca como interrumpida o desconocida (D-05). |
| Q-8 | «Dentro del repo conectado» e interrupción | `insideProject` solo existe en modo proyecto (comparación de `realpath` contra el root del runtime); en launcher es `false`. La interrupción se detecta por muerte con señal sin cancelación pedida (`interrupted`) o por `not-found` después de un reinicio del puente (D-03, D-05). |

## Desvíos respecto del functional (para que el funcional o el planner los acepten)

| # | Criterio | Ajuste | Motivo |
| - | -------- | ------ | ------ |
| X-1 | US-3-012 | Se suma la etapa **«Generando apps y SDD»** (`generate`) entre «Instalando dependencias» y «Validando SDD». | Orden real de la CLI (H-4). |
| X-2 | US-3-005/006, US-3-034 | Solo se confirma el contenido **tolerado** por la CLI (`.git`, README, `harness.*`, `.vscode`…). Cualquier otro contenido, incluido `sdd/`, **bloquea**. | La CLI lo rechaza (H-3). |
| X-3 | US-3-031 | No hay «Reintentar instalación». Hay preflight y «Generar en otra carpeta». | D-05. |
| X-4 | US-1-028 | El puerto de un servicio es de solo lectura. | H-7. |
| X-5 | US-1-001 | El wizard requiere un puente, que puede estar en launcher sin proyecto. Sin puente, `ConnectScreen` indica cómo lanzarlo. | D-04/D-06. |
| X-6 | US-1-034 | Los mensajes de error se traducen por `code`. Los códigos sin traducción muestran el texto de la CLI, en inglés. | La CLI es la fuente. |
| X-7 | US-3-006 | Un `harness.config.json` existente y distinto bloquea. Si es idéntico, se continúa. | RB-5. |
| X-8 | US-3-001 | El destino tiene que estar dentro del home o de una base dada con `--allow-target`. | D-07. |
| X-9 | US-4-005 | En modo proyecto, abrir el proyecto nuevo se rechaza si hay agentes trabajando en el actual. | D-01. |

## Cambios en schema (sdd/schema.json)

Ninguno: no hay tablas.

## Contratos de API (sdd/api.json)

Ninguno: no hay endpoints HTTP. Los contratos son WebSocket (sección «Contratos») y subcomandos de la CLI.

## Componentes (sdd/components.json → `apps/studio`)

Los registra el implementador front al implementarlos. Los ids siguen desde COMP-068 en el orden de D-06:

- `NewProjectPanel`, `NewProjectCenter`, `NewProjectRight`;
- `ScopeStep`, `ShapeStep`, `FrontStep`, `BackStep`, `ExtrasStep`, `SummaryStep`;
- `AppRow`, `PortField`, `ServiceRow`;
- `TargetPicker`, `DirectoryBrowserModal`, `TargetStatus`;
- `ConfirmTargetDialog`, `DiscardChangesDialog`, `PreflightNotice`;
- `GenerationProgress`, `OutputLog`, `GenerationResult`, `LauncherShell`.

Todos con `module: "studio-project-wizard"` y `spec: "sdd/specs/spec-e-burgos-013-studio-project-wizard"`. Se modifican (`updated`) `ConnectScreen`, `BridgeProvider` y `ConnectionBanner`.

## Dependencias externas

- `apps/studio-bridge`: **nueva** `@e-burgos/sdd-harness: workspace:*`, que al publicar queda en la versión exacta del monorepo. No entra en el bundle.
- `apps/cli`, `libs/studio-protocol` y `apps/studio`: sin dependencias nuevas.
- Herramientas en la máquina del dev: `pnpm` (obligatorio, lo verifica el preflight) y `git` (opcional, H-10). Para que el gate quede verde con `python` o `springboot` hacen falta sus toolchains (uv y Java/Maven). Esto no se verifica en este ciclo: un gate en rojo se informa como «Generado con errores» (R-8).

## Riesgos y verificaciones pendientes

| # | Riesgo | Mitigación |
| - | ------ | ---------- |
| R-1 | Deriva del clasificador de etapas cuando cambie el texto de la CLI. | Versión exacta fijada y fixtures grabados con esa versión. Una subida de la CLI en el puente exige regrabarlos (se anota en el fragmento de contexto). Seguimiento posible: `--progress=json` en la CLI. |
| R-2 | Latencia de `config validate`, porque cada validación arranca la CLI (~0,3–0,8 s). | Debounce de 400 ms, cola de uno con reemplazo, chequeos instantáneos en el cliente para el formato y spinner «Validando…». Si molesta: modo servidor `config validate --stdin-lines` en un ciclo futuro. |
| R-3 | `SIGKILL` al puente deja el grupo de procesos huérfano (POSIX, por `detached`). | Kill del grupo en `SIGINT`/`SIGTERM` y `NX_DAEMON=false`. Documentado. |
| R-4 | Orden de release: el puente publicado fija una versión de CLI que tiene que estar en npm. La web hosteada debe aceptar `workspace: null` antes de que llegue un puente launcher. | Release: CLI, después web, después puente. Lo verifica el reviewer. Una web vieja contra un puente launcher falla en el handshake, sin regresión, porque antes el puente ni arrancaba. |
| R-5 | El refactor host/runtime puede dejar el watcher (chokidar) o handles abiertos al cambiar de proyecto. | Test de switch repetido N veces sin crecimiento de handles (`process._getActiveHandles` o conteo de watchers del fake), y `close()` idempotente. |
| R-6 | `pnpm install` escribe en el store global (fuera del destino) y corre postinstall de terceros. | Es inherente a usar la CLI. Credenciales quitadas del env. Se documenta como excepción de US-3-042. |
| R-7 | Windows: `pnpm.cmd` en el preflight, `taskkill /T`, junctions en `realpath`, nombres reservados. | Shell solo con strings constantes y tests de `target.ts` parametrizados por plataforma. Verificación manual en Windows antes de cerrar (CI ubuntu+windows corre los unit). |
| R-8 | Gate rojo esperable sin toolchains de python o Java. | Se informa como «Generado con errores» con el log. Seguimiento: `toolchain` por tipo en el catálogo y en el preflight. |
| R-9 | El tamaño de instalación del puente crece por los templates de la CLI. | Aceptado: es el costo de la versión fija y de funcionar sin red. |
| R-10 | `cycle.json` no tiene todavía `metrics.usage.by_agent`. | Lo crea el orquestador antes de registrar el consumo de los agentes. |

## Trazabilidad criterio → decisión

| Criterios | Decisión |
| --------- | -------- |
| US-1-001 | D-01, D-06 (X-5) |
| US-1-002…005, US-1-010…031 | D-04 (catálogo y flags), D-06 |
| US-1-032…035, US-1-050…057 | D-04 (instantáneo y `config validate`) |
| US-1-036, US-1-040, US-1-041 | D-06 (`state.ts`, `persist.ts`) |
| US-2-001…009 | D-04 (`resolved`), D-06 (`NewProjectRight`, `SummaryStep`), D-02 (`initArgv`) |
| US-3-001…010 | D-03 (X-2, X-7, X-8) |
| US-3-011…019 | D-02, D-05, D-03 |
| US-3-030…038 | D-02 (mapeo), D-05 (X-3), D-06 (`GenerationResult`) |
| US-3-040…042 | D-03, H-3, R-6 |
| US-4-001…011 | D-01, D-06 (X-9) |
| US-5-001…007 | D-04, D-02 (`cliVersion`), D-08 (matriz y contrato) |

## Archivos a tocar por subproyecto

### 1. CLI — `apps/cli/src/`

- `config/app-options.ts` (nuevo): `APP_TYPE_OPTIONS`, `SERVICE_OPTIONS` y `DEFAULT_APP_NAMES`, movidos desde `commands/init.ts`, que pasa a importarlos.
- `config/schema.ts`: regex con nombre exportados (`KEBAB_NAME_PATTERN`, `PACKAGE_SCOPE_PATTERN`, `AUTHOR_PATTERN`) y `PORT_RANGE`.
- `generators/app-types.ts`: `collectAppTopologyIssues()` estructurado. `validateAppTopology` queda como envoltorio con los mismos mensajes.
- `generators/workspace.generator.ts`: `export` de `TOLERATED_ENTRIES` (sin otro cambio).
- `config/catalog.ts` y `config/validate.ts` (nuevos), y `commands/config/index.ts` con los subcomandos `catalog` y `validate`.
- Tests en `config/__tests__/` y `commands/config/__tests__/`. Docs bilingües de los subcomandos en `documentation/`, según lo que asigne el planner.

### 2. Protocolo — `libs/studio-protocol/src/`

- `wizard.ts` (nuevo): todos los tipos de «Contratos».
- `commands.ts`: los comandos nuevos.
- `events.ts`: los 3 eventos.
- `handshake.ts`: `workspace` nullable.
- `limits.ts`: features, `MAX_CONFIG_BYTES = 65_536`, `GENERATION_CHUNK_MAX = 32_768`, `GENERATION_BUFFER_BYTES = 4 MiB`, `MAX_DIR_ENTRIES = 500` y `WS_CLOSE_WORKSPACE_SWITCHED = 4010`.
- `index.ts` y specs.

### 3. Puente — `apps/studio-bridge/`

- `package.json`: la dependencia nueva.
- `src/main.ts`: `BridgeHost` y launcher.
- `src/project/runtime.ts` (nuevo, con el cableado extraído).
- `src/server/router.ts`: despacho host/runtime.
- `src/server/ws-server.ts`: `closeAll(4010)` y `welcome` con nullable.
- `src/cli.ts` y `src/cli-options.ts`: `--allow-target` y el mensaje de launcher.
- `src/wizard/`:
  - `cli-locator.ts`, `cli-env.ts`, `config-cli.ts`;
  - `target.ts`, `dirs.ts`;
  - `generation.ts`, `init-output.ts`;
  - `preflight.ts`, `reveal.ts` (reusa `openCommand` con la ruta);
  - `service.ts`.
- `src/test-utils/fake-harness.mjs` y fixtures en `src/wizard/__fixtures__/init-output/`.

### 4. Studio — `apps/studio/src/`

- `lib/wizard/*` (D-06).
- `components/modules/new-project/*` (D-06).
- `components/shell/LauncherShell.tsx`.
- `lib/nav/module-ids.ts`, `modules.ts` y `module-labels.ts`.
- `lib/i18n` (es/en).
- `components/WorkspaceApp.tsx`, `BridgeProvider.tsx`, `ConnectionBanner.tsx` y `ConnectScreen.tsx`.
- e2e en el puerto 4417.

### Orden para el planner

1. **CLI.** Primero el refactor sin cambio de comportamiento (opciones movidas, regex con nombre, topología estructurada con snapshot de mensajes), después `catalog` y `validate` con sus tests.
2. **Protocolo.** Tipos, comandos, eventos, handshake y límites.
3. **Puente, parte A.** Refactor host/runtime más launcher, sin wizard. Los tests existentes tienen que seguir verdes.
4. **Puente, parte B.** `cli-locator`, `cli-env`, `config-cli` y el test de contrato contra la CLI compilada.
5. **Puente, parte C.** `target` y `dirs`, y `preflight`.
6. **Puente, parte D.** `generation`, `init-output` con fixtures grabados, cancelación, registry y `generation.get`.
7. **Puente, parte E.** `workspace.open` (switch con 4010) y `reveal`.
8. **Studio, parte A.** `lib/wizard` puro con tests.
9. **Studio, parte B.** Pasos 1–5 y vista previa.
10. **Studio, parte C.** Paso 6, destino, confirmación, progreso y resultado.
11. **Studio, parte D.** `LauncherShell`, el cambio de proyecto en `BridgeProvider` y la idea para Hermes.
12. **Studio, parte E.** e2e en el puerto 4417.
13. Generación real en `examples/` y la equivalencia con `harness init --config` (US-5-005).
14. Docs de la CLI y de Studio, más el fragmento de contexto de cada subproyecto al cerrar.
