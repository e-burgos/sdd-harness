# Constitución — apps/cli

> Versión 1.0 | Última actualización: 2026-11-06 (consolidación de fragmentos 011, 012, 013, 016, 017)

## 1. Propósito y Alcance

- **Tipo:** app (CLI empaquetada como binario global/npx)
- **Paquete:** `@e-burgos/sdd-harness` (binario: `harness`)
- **Rol en el sistema:** Generador y gestor del ciclo de vida de repositorios preparados para agentes de IA con metodología Spec-Driven Development (SDD). Soporta inicialización desde cero (`init`), adopción en repos existentes (`configure sdd`), actualización no destructiva del kit (`update sdd`), ideación asistida (`idea`) y ampliación modular (`add`).
- **Público:** Desarrolladores y agentes autónomos (Claude Code, GitHub Copilot, Gemini CLI, Antigravity).

## 2. Stack Tecnológico

- **Runtime:** Node.js >=18 (ESM nativo, `"type": "module"`)
- **CLI Framework:** `citty` para definición y parseo de comandos/subcomandos; `@clack/prompts` para la experiencia interactiva por terminal.
- **Validación y Esquemas:** `zod` y `zod-to-json-schema` para validar `harness.config.json` y emitir esquemas JSON.
- **Herramientas de Sistema:** `fs-extra` (I/O asíncrono y operaciones de árbol), `picocolors` (formateo ANSI).
- **Compilación / Bundling:** `esbuild` (`build.js`) empaquetando `src/cli.ts` y `src/index.ts` en `dist/` (formato ESM, target node18) con generación paralela de tipos `.d.ts` vía `tsc -p tsconfig.lib.json`.
- **Testing:** `vitest` con suites unitarias, de integración (`__tests__`) y e2e (`__e2e__`).

## 3. Arquitectura y Módulos Clave

### 3.1 Comandos (`src/commands/`)
- `init.ts`: Orquesta la creación de workspaces completos.
  - Modos: `nx` (monorepo con apps/libs/tools) o `standalone` (aplicación única en la raíz sin Nx).
  - Vías: Asistente interactivo con prompts o desatendido mediante `--config <archivo>` / `--yes`.
  - Opciones clave: `--profile team|solo` (fija el flujo por defecto de SDD), `--here`, `--dir`.
- `idea.ts`: Entrada del protocolo Hermes (Fase 1). Registra la idea en lenguaje natural en `harness.idea.md` y siembra el stub `harness.config.json` para ejecución autónoma por agentes.
- `configure/`:
  - `sdd.ts`: Instala el kit SDD en un repositorio preexistente preservando instrucciones previas (`teamContribution`) y creando symlinks de arnés dual.
  - `sdd-apps.ts`: Detección e introspección de apps existentes para poblar `sdd/global.json`.
  - `docker.ts`, `mcp.ts`, `memory.ts`: Configuración opcional de servicios, MCP servers y grafos de conocimiento.
- `update/sdd.ts`: Actualiza la instalación local de `sdd/` hacia la versión del kit empaquetada en la CLI sin sobrescribir specs, ciclos, fixes, contexto ni memoria.
- `add/`: Scaffolding aditivo para `app`, `service` (Docker compose), `skill`, `spec` (`spec-[gh-user]-[NNN]-[slug]`) y `tool`.
- `config/index.ts`: Inspección y exportación del JSON Schema del archivo de configuración (`harness.config.schema.json`), más dos subcomandos de solo lectura consumidos por el puente de Studio:
  - `config catalog [--json]`: tipos de app/lib, servicios, perfiles, patrones, rango de puertos, entradas toleradas del destino, límites (`CONFIG_LIMITS`, `configBytes`) y el JSON Schema.
  - `config validate <archivo|-> [--json]`: no genera nada; chequea schema, topología de apps y precondiciones de `init`; devuelve `{ format, cliVersion, ok, issues[], resolved }`. Exit 0 válida, 1 con errores, 2 ilegible (`.json`, `.mjs`, `.js` o stdin, máx. 64 KiB; con `--json` el exit 2 escribe `{ ok: false, error: { code, message } }`).
  - Código en `src/config/{catalog,validate,app-options}.ts`; `init.ts` reutiliza `app-options.ts`.
- `info.ts`: Diagnóstico de salud y metadatos del workspace.

### 3.2 Generadores (`src/generators/`)
- `sdd.generator.ts`: Copia el kit canónico desde `templates/sdd/` a `sdd/` del destino, genera `global.json`, enlaza symlinks del dual-harness (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/`, `.github/`, `.agents/`, `.agent/`, `.gemini/`) y rescata instrucciones previas del usuario.
- `update.generator.ts` & `kit-manifest.ts`: Motor de actualización segura basado en hashes (`kit.json`). Clasifica archivos en: kit-owned (inmutables), generated (generados inicialmente), hybrid (plantillas editables) y placeholders (.gitkeep). Detecta colisiones dejando archivos `*.new`.
- `kit-migrations.ts`: Detecta y alerta sobre breaking changes o vocabulario obsoleto entre versiones del kit.
- `workspace.generator.ts`: Construye la raíz de un monorepo Nx a partir de `templates/sdd/templates/nx-workspace/`, ajustando package.json, gitignore, npmrc y corriendo `runVerificationGate`.
- `standalone.generator.ts`: Construye repositorios standalone con la app en la raíz pero gobernados íntegramente por el sistema SDD.
- `app.generator.ts`: Genera aplicaciones de 10 tipos: `nestjs` (con soporte para webpack/jest plugin en workspace), `react`, `python` (FastAPI + LangGraph con uv; `apps[].ml` suma TensorFlow), `nextjs`, `fastify`, `springboot` (Maven), `hono`, `next-bff` (Next con rutas API frente a `<APP>_UPSTREAM_URL`, puerto 3001), `mfe-shell` (4300) y `mfe` (4301+, `base: '/<mfe>/'`). Los tres últimos y `next-bff` son solo monorepo.
  - Los frontend (`react`, `nextjs`, `next-bff`, `mfe-shell`, `mfe`) nacen con tucu-ui por defecto; `--no-tucu-ui` genera apps planas. Prioridad: flag > `apps[].tucuUi` > `sdd.tucu_ui` > encendido.
  - Módulos de apoyo: `versions.ts` (única fuente de versiones, igualada por test con `templates/sdd/templates/nx-workspace/package.json`), `tucu-ui-app.ts`, `app-types.ts` (topología, puertos con `resolveAppPorts`, stack, `collectAppTopologyIssues`), `frontend-apps.ts`, `mfe-sync.ts`, `python-app.ts`, `utils/workspace-apps.ts`. `harness add app` mantiene la topología shell/mfe y `configure sdd` detecta los tipos nuevos.
- `spec.generator.ts`: Generación determinista de especificaciones (`spec-[gh-user]-[NNN]-[slug]`), registro en `sdd/specs/index.json` y siembra de módulos en `pending_modules`.
- `root-package.ts`, `docker.generator.ts`, `lib.generator.ts`.

### 3.3 Plantillas (`templates/`)
- `templates/sdd/`: El kit SDD canónico completo que se distribuye a los repositorios de los usuarios.
- `templates/sdd/templates/`: Blueprints portables de apps (`java-api`, `react-app`), libs (`ts-lib`) y workspace base (`nx-workspace`).
- Integraciones opcionales del kit (apagadas por defecto):
  - tucu-ui: `tucu_ui` en `sdd/tools.json`, `pnpm sdd:tucu -- --status | --enable [--parts=skill,mcp] [--force] | --disable [--purge]`. Instala la skill `tucu-ui-design` (`@e-burgos/tucu-ui-mcp@0.16.0`) en `sdd/integrations/skills/`, la enlaza en `.claude/skills`, `.github/skills` y `.agents/skills`, y suma el servidor `tucu-ui` a `.mcp.json`, `.vscode/mcp.json` y `.gemini/settings.json` sin pisar claves ajenas (`scripts/{sdd-tucu,tucu-ui-common,mcp-config}.mjs`). `integrations/` es prefijo de datos en `kit-manifest.ts`; `configure mcp` y `configure memory` usan el mismo merge. `harness init` y `configure sdd` lo ofrecen con `--tucu-ui` / `--no-tucu-ui`.
  - Sesiones paralelas: cada sesión queda atada a un ciclo o fix en `sdd/.sessions/` (`scripts/lib/session-registry.mjs`, `scripts/sdd-use.mjs`, `schemas/session-binding.schema.json`); GATE B ata la sesión sola (línea `SDD-BIND` de `spec-gate.mjs`) y `pnpm sdd:use` la ata a mano. El mod `sdd-mod` (`skills/sdd-mod/hooks/.src/`, con copia de `session-registry.mjs` protegida por test de bytes) muestra todas las unidades abiertas y aplica el gate por sesión; con el mod apagado nada cambia.
  - Skill `crafted-motion` (`skills/crafted-motion/`): método y recetas de graphic motion para frontends React/Next.
- `templates/workspace/`: Archivos auxiliares (como `eslint.config.mjs` para workspaces Nx).

## 4. Comandos de Trabajo

- **Compilar paquete:** `pnpm --filter @e-burgos/sdd-harness build` (ejecuta `node build.js`).
- **Tests unitarios e integración:** `pnpm --filter @e-burgos/sdd-harness test` (vitest run).
- **Tests en modo watch:** `pnpm --filter @e-burgos/sdd-harness test:watch`.
- **Verificación de tipos:** `pnpm --filter @e-burgos/sdd-harness typecheck` (`tsc -p tsconfig.lib.json && tsc -p tsconfig.spec.json`).
- **Pruebas E2E:** `pnpm --filter @e-burgos/sdd-harness test src/__e2e__/init.e2e.spec.ts`.

## 5. Reglas Inviolables y Gotchas

1. **`templates/sdd/` se publica verbatim:** No se procesa con motores de plantillas de texto (sin EJS). Cualquier nombre de proyecto o dato particular vive únicamente en `sdd/global.json`. `pnpm sdd:validate` falla si el nombre se filtra a archivos del kit.
2. **Doble copia del kit en este monorepo:** La carpeta `sdd/` en la raíz de este monorepo es la instalación local activa (dogfooding). La carpeta `apps/cli/templates/sdd/` es el producto que se publica en npm. Si se arregla o mejora el kit, debe hacerse en `apps/cli/templates/sdd/` y luego correr `harness update sdd` o `pnpm setup:agents`.
3. **Preservación en actualizaciones:** Toda adición al kit debe registrarse en `templates/sdd/catalog.json` y respetar la clasificación de pertenencia de `kit-manifest.ts` para no pisar trabajo del usuario en futuros updates.
4. **Sincronización con documentación:** Cualquier comando, flag o cambio de comportamiento en la CLI debe reflejarse en los archivos bilingües de `apps/documentation/src/data/content.ts` y `content.en.ts`.
5. **Contrato con el puente de Studio:** `@e-burgos/sdd-studio` depende de `@e-burgos/sdd-harness` (`workspace:*`) y fija su versión porque consume `config catalog`/`validate`. Una subida de la CLI que cambie el texto de salida de `init` obliga a regrabar los fixtures `apps/studio-bridge/src/wizard/__fixtures__/init-output/`. Orden de release: CLI, luego la web, luego el puente.
