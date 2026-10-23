# Constitución — apps/cli

> Versión 1.0 | Última actualización: 2026-10-23 (profundización de contexto)

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
- `config/index.ts`: Inspección y exportación del JSON Schema del archivo de configuración (`harness.config.schema.json`).
- `info.ts`: Diagnóstico de salud y metadatos del workspace.

### 3.2 Generadores (`src/generators/`)
- `sdd.generator.ts`: Copia el kit canónico desde `templates/sdd/` a `sdd/` del destino, genera `global.json`, enlaza symlinks del dual-harness (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/`, `.github/`, `.agents/`, `.agent/`, `.gemini/`) y rescata instrucciones previas del usuario.
- `update.generator.ts` & `kit-manifest.ts`: Motor de actualización segura basado en hashes (`kit.json`). Clasifica archivos en: kit-owned (inmutables), generated (generados inicialmente), hybrid (plantillas editables) y placeholders (.gitkeep). Detecta colisiones dejando archivos `*.new`.
- `kit-migrations.ts`: Detecta y alerta sobre breaking changes o vocabulario obsoleto entre versiones del kit.
- `workspace.generator.ts`: Construye la raíz de un monorepo Nx a partir de `templates/sdd/templates/nx-workspace/`, ajustando package.json, gitignore, npmrc y corriendo `runVerificationGate`.
- `standalone.generator.ts`: Construye repositorios standalone con la app en la raíz pero gobernados íntegramente por el sistema SDD.
- `app.generator.ts`: Genera aplicaciones de 7 tipos: `nestjs` (con soporte para webpack/jest plugin en workspace), `react`, `python`, `nextjs`, `fastify`, `springboot` (Maven) y `hono`.
- `spec.generator.ts`: Generación determinista de especificaciones (`spec-[gh-user]-[NNN]-[slug]`), registro en `sdd/specs/index.json` y siembra de módulos en `pending_modules`.
- `root-package.ts`, `docker.generator.ts`, `lib.generator.ts`.

### 3.3 Plantillas (`templates/`)
- `templates/sdd/`: El kit SDD canónico completo que se distribuye a los repositorios de los usuarios.
- `templates/sdd/templates/`: Blueprints portables de apps (`java-api`, `react-app`), libs (`ts-lib`) y workspace base (`nx-workspace`).
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
