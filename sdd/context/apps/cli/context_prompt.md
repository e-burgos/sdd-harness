# Context prompt — apps/cli

> Última actualización: consolida los fragmentos de spec-e-burgos-014, 017 (cycle-02), 018, 020 y 021 | Fecha: 2026-11-13

> Entry point para agentes y desarrolladores trabajando en `@e-burgos/sdd-harness`.
> Leer este documento antes de modificar cualquier comando, generador o plantilla de la CLI.

## Qué es este subproyecto

La CLI `harness` es la herramienta central del repositorio. Permite inicializar workspaces con SDD, incorporar el arnés a repositorios existentes y actualizar el kit de forma segura.

## Mapa de navegación rápido

- **Punto de entrada de comandos:** `src/cli.ts` (definición con `citty`).
- **Lógica de comandos:** `src/commands/`
  - Creación de workspaces: `commands/init.ts`
  - Adopción de SDD: `commands/configure/sdd.ts` e introspección en `commands/configure/sdd-apps.ts`
  - Actualización segura: `commands/update/sdd.ts`
  - Ideación / Hermes: `commands/idea.ts`
  - Nuevas specs / apps: `commands/add/spec.ts`, `commands/add/app.ts`
  - Catálogo y validación de config (consumidos por Studio): `commands/config/index.ts`, `config/catalog.ts`, `config/validate.ts`
  - GitHub: `commands/github/` y `utils/github.ts`; arranque de Studio desde `init`: `utils/studio-launch.ts`
  - Integraciones opcionales: `utils/tucu-ui-run.ts`, `utils/video-maker-run.ts` (los scripts del kit viven en `templates/sdd/scripts/`)
- **Generadores del sistema:** `src/generators/`
  - Inyección de SDD y dual-harness: `generators/sdd.generator.ts`
  - Actualización segura y manifiesto de hashes: `generators/update.generator.ts`, `generators/kit-manifest.ts`
  - Generación de Nx / Standalone: `generators/workspace.generator.ts`, `generators/standalone.generator.ts`
  - Generación de aplicaciones y blueprints: `generators/app.generator.ts`, `utils/blueprint.ts`
- **Plantilla canónica del kit:** `templates/sdd/` (¡se publica verbatim a npm!).

## Flujo de trabajo y validación

Al modificar código en `apps/cli`:
1. Ejecutar typecheck: `pnpm --filter @e-burgos/sdd-harness typecheck`
2. Correr tests unitarios y de integración: `pnpm --filter @e-burgos/sdd-harness test`
3. Si se tocan generadores de workspace o SDD, correr suites de integración específicas:
   - `pnpm --filter @e-burgos/sdd-harness test src/generators/__tests__/sdd.generator.integration.spec.ts`
   - `pnpm --filter @e-burgos/sdd-harness test src/generators/__tests__/update.generator.spec.ts`
   - `pnpm --filter @e-burgos/sdd-harness test src/generators/__tests__/rule-zero.integration.spec.ts`
4. Reconstruir el bundle: `pnpm --filter @e-burgos/sdd-harness build`

## Advertencias críticas para agentes

- **NO alterar `sdd/` para solucionar bugs del producto:** `sdd/` en la raíz es la instalación local. El producto vive en `apps/cli/templates/sdd/`. Cualquier cambio al kit debe hacerse en `apps/cli/templates/sdd/`.
- **Invariante de portabilidad:** Ningún archivo dentro de `templates/sdd/` puede contener nombres fijos del proyecto o autores; todo debe abstraerse hacia `sdd/global.json`.
- **Pendientes:** Nx 24 y TypeScript 7 en una spec propia (afectan a todos los generadores); interruptor de tucu-ui en el módulo Kit de Studio; casos de Windows de tucu-ui en una máquina Windows; spawn real de `harness init --studio` y `harness github protect` contra GitHub real sin probar; la doc de video-maker puede recomendar la app de escritorio cuando publique `~/.video-maker/studio.json`. El CLI de terminal de Claude Code 2.1.123 no carga mods; el motor de escritorio 2.1.317 sí.
- **Consistencia multiplataforma:** La CLI corre en Linux, macOS y Windows. El CI de cada PR corre solo en Ubuntu (FIX-e-burgos-004): la suite de Windows se corre en local antes de un release que toque symlinks, junctions, CRLF o `setup-agents.ps1` (`docs/ci.md`). Cuida paths con barras invertidas (`\\`), permisos de symlinks vs junctions y terminaciones de línea CRLF/LF (verificado en `update.generator.crlf.spec.ts` y `sdd.generator.windows.spec.ts`).
