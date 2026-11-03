# SPEC-e-burgos-011: Kit — integración opcional de tucu-ui (skill de diseño + MCP) en los cuatro arneses

> Estado: **in-progress** (cycle-01 abierto 2026-11-02). Flow `full`: cambia `apps/cli/templates/sdd/`
> (se publica en npm y se copia verbatim a los repos de los usuarios), el schema de `sdd/tools.json`
> que también valida `apps/studio-bridge`, y los prompts de `harness init` / `configure sdd`.
> Sucesora de spec-e-burgos-009/010 (Studio sobre tucu-ui). Pedido del dev (2026-11-02): «hacé todo
> lo que puedas en ese orden» sobre el plan tucu-ui en el kit → generadores → wizard → GitHub.

## Resumen ejecutivo

El kit es una solución punta a punta para un dev: el próximo paso es que un proyecto con frontend
pueda diseñar y construir sus pantallas con `@e-burgos/tucu-ui` desde el arnés que use. tucu-ui
publica todo lo necesario en `@e-burgos/tucu-ui-mcp` 0.16.0: un servidor MCP stdio
(`npx @e-burgos/tucu-ui-mcp`, 11 tools, 16 recursos `tucu://…`, 9 prompts incluido `design-review`)
y la skill `tucu-ui-design` (instalable con `tucu-ui-skill install --dir <dir>`, default
`.claude/skills`). El kit hoy no escribe configuración MCP en ningún arnés salvo `.mcp.json` vía
`harness configure mcp` (que además pisa el archivo entero), y no tiene ningún interruptor para
integraciones de UI.

## Historias de usuario

### US-1 — Interruptor `tucu_ui` en `sdd/tools.json`
Como dev, quiero prender y apagar la integración de tucu-ui con un comando del kit, como rtk y el mod.
- `sdd/tools.json` admite `tucu_ui: { enabled, mcp, skill }` opcional; apagado por defecto.
- `pnpm sdd:tucu -- --status | --enable | --disable` (JSON en `--status`), idempotente.
- Repos con un `tools.json` previo sin la clave siguen validando (backward-compat: nada nuevo a `required`).

### US-2 — Skill `tucu-ui-design` en los cuatro arneses
Como dev, al prender tucu-ui quiero que Claude Code, Copilot, Gemini CLI y Antigravity vean la skill.
- La skill se instala desde el paquete publicado (sin copiarla al kit) en un lugar **del proyecto**,
  fuera de lo que `harness update sdd` reemplaza, y `setup:agents` la enlaza en `.claude/skills`,
  `.github/skills` y `.agents/skills`.
- No ensucia el catálogo del kit ni hace fallar `sdd:validate`.
- Al apagar se quitan los enlaces; la carpeta instalada queda (o se borra con flag explícito).

### US-3 — Servidor MCP `tucu-ui` en los cuatro arneses
Como dev, quiero que el MCP de tucu-ui quede configurado en cada arnés sin pisar mis otros servidores.
- Claude Code: `.mcp.json` (`mcpServers`); Copilot: `.vscode/mcp.json` (`servers`); Gemini CLI y
  Antigravity: `.gemini/settings.json` (`mcpServers`). Merge que preserva claves y servidores ajenos.
- Al apagar se quita solo la entrada `tucu-ui`.
- `harness configure mcp` deja de pisar servidores que no conoce (merge, como `configure memory`) y
  suma `tucu-ui` a su catálogo.

### US-4 — Ofrecerlo donde hay frontend
Como dev, quiero que el kit me lo ofrezca cuando el proyecto tiene una app React (Vite) o Next.
- `harness init`: si alguna app elegida es `react` o `nextjs`, una confirmación (default sí) prende tucu-ui.
- `harness configure sdd`: si `detectAppType` encuentra `react`/`nextjs`, la misma confirmación.
- Flags no interactivos para CI (`--tucu-ui` / `--no-tucu-ui`).
- Sin frontend no se pregunta nada.

### US-5 — Documentación y validación
- Docs bilingües del kit (`documentation/{es,en}`), README de la CLI y la sección de herramientas de
  `AGENTS.md`/arneses explican el interruptor, qué escribe y cómo apagarlo.
- `validate-sdd` avisa (no falla) si `tucu_ui.enabled` está prendido y falta la skill enlazada o la
  entrada MCP en algún arnés, con el comando para repararlo.
- El sdd-steward conoce el interruptor (playbook de herramientas).

## Restricciones
- Backward-compat del kit: claves nuevas opcionales, el validador avisa; `tools.json` es dato del
  proyecto y `update sdd` no lo toca (defaults con `??` en los scripts).
- Paridad Windows: todo cambio a `setup-agents.sh` se replica en `setup-agents.ps1`.
- Paridad con el bridge de Studio: `apps/studio-bridge` valida `tools.json` con el schema del kit
  (test de paridad); agregar la clave no puede romper sus escrituras.
- Red: la instalación de la skill usa `npx -p @e-burgos/tucu-ui-mcp@<versión pinneada>`; sin red el
  comando falla con un mensaje claro y deja el switch como estaba.
- Sin comentarios en el código; sin publicar ni taggear (el release lo decide el dev).

## Criterios de aceptación
- CA-1: en un ejemplo generado en `examples/` con una app Next, `harness init` con `--tucu-ui` deja la
  skill visible en los cuatro arneses y el MCP en los tres archivos; `sdd:validate` verde.
- CA-2: `pnpm sdd:tucu -- --disable` quita enlaces y entradas MCP sin tocar otros servidores ni claves.
- CA-3: un `tools.json` sin `tucu_ui` valida, y `--status` reporta apagado.
- CA-4: `harness update sdd` sobre un repo con tucu-ui prendido conserva la skill, los enlaces y el MCP.
- CA-5: `pnpm build && pnpm typecheck && pnpm test` verdes (cli, bridge, studio).

## Fuera de alcance
- Interruptor de tucu-ui en el módulo Kit de Studio (follow-up; el bridge solo escribe el archivo).
- Generar código con tucu-ui (eso es la spec de generadores).
- Publicar una versión del kit.
