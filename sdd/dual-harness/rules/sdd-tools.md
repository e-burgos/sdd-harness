---
trigger: model_decision
description: Herramientas opcionales del kit - graphify, rtk, sdd-mod (y qué hacer ante un rechazo SPEC GATE, varias unidades abiertas o SDD reserva), tucu-ui y video-maker. Leelo al tocarlas o cuando una edición vuelva rechazada.
---

# 🔎 graphify — búsqueda y exploración del repo (OPCIONAL)

> [!NOTE]
> graphify indexa el repo como grafo de conocimiento en `graphify-out/` (código vía AST +
> capa semántica de docs). Es **opt-in por dev**: gitignoreado, no viaja con el repo y
> **nada del workflow depende de él**.

**Si `graphify-out/graph.json` existe**, consultalo antes de `grep`/`Read` a ciegas o de
lanzar un agente de exploración — es la opción más barata en tokens: `graphify query
"<pregunta>"` (`--budget N` acota), `graphify explain "<nodo>"` **antes de tocarlo**,
`graphify path "<A>" "<B>"`, `graphify affected "<nodo>"`; `graphify-out/GRAPH_REPORT.md`
tiene God Nodes y comunidades.

**Si no existe**, no lo menciones ni intentes construirlo por tu cuenta (consume cupo de API
del dev). Instalación, backend gratuito, mantenimiento al cerrar cada unidad de trabajo y sus
dos trampas silenciosas (`set -a && source .env && set +a`; modelos "lite" que devuelven un
grafo con 0 edges): `sdd/skills/setup-graphify/SKILL.md`. Si el modelo gratuito falla o se
agotó el cupo: avisá al dev y dejá la actualización para después — nunca escales a un modelo
pago sin autorización explícita.

# 🪶 rtk — salida de comandos comprimida (ACTIVO POR DEFECTO)

[rtk](https://github.com/rtk-ai/rtk) comprime la salida de los comandos de shell (`git`,
`pnpm`, `vitest`, `tsc`, `ls`, `grep`…) **antes de que la leas**: 60–90% menos texto; tus
herramientas de lectura de archivos quedan intactas. Activo desde el kit v0.12.0 y
transparente: pedís `git status` y se ejecuta `rtk git status`.

- **Nunca prefijes comandos con `rtk` a mano** — el puente ya lo hace.
- Si la salida comprimida te esconde algo que necesitás: `rtk proxy <cmd>` da la salida cruda.
- **Nunca apagues rtk por tu cuenta**: el interruptor es del dev (`sdd/tools.json`;
  `pnpm sdd:rtk -- --status | --enable | --disable`; el sdd-steward lo opera a pedido).
- `rtk gain --project` imprime el ahorro acumulado (estimación, no facturación). Es best
  effort y por máquina: sin binario o con hook roto el comando pasa **sin comprimir** y nunca
  se bloquea.

# 🧩 sdd-mod — el SDD dentro de Claude Code (OPCIONAL, apagado por defecto)

`sdd/skills/sdd-mod/` es un mod de Claude Code que se carga solo desde `.claude/skills/`. Con
`claude_mod.enabled: true` en `sdd/tools.json` muestra el ciclo en curso sobre el prompt, suma
`/sdd` y aplica el SPEC GATE a `Edit`/`Write`/`NotebookEdit` sobre código.

- **Si una edición vuelve rechazada con `SPEC GATE: …`**, no la reintentes ni la rodees con
  comandos de shell: no hay ciclo `in-progress` ni fix abierto. Seguí el camino que indica el
  mensaje (abrir el ciclo vía `sdd-orchestrator`, o el FIX GATE).
- **Si el rechazo dice que hay varias unidades abiertas** (o que tu atadura apunta a una cerrada),
  elegí la tuya con `pnpm sdd:use <spec> <cycle-XX>` (o `pnpm sdd:use <FIX-id>`); no lo rodees.
  Correr el GATE B en esta sesión también la ata.
- **Si una edición vuelve con `SDD reserva: …`**, otra sesión tiene ese archivo: no lo rodees con
  shell; esperá, seguí con otra task o coordiná con el dev. Si recibís un pedido de otra sesión por
  un archivo tuyo que ya no vas a tocar, liberalo con `pnpm sdd:release <archivo>`.
- **Nunca lo prendas, apagues ni cambies su modo por tu cuenta**: es decisión del dev
  (`pnpm sdd:mod -- --status | --enable | --disable | --gate=warn|block`; el sdd-steward lo
  opera a pedido).

# 🎨 tucu-ui — skill de diseño y MCP para frontends (OPCIONAL, apagado por defecto)

[`@e-burgos/tucu-ui`](https://github.com/e-burgos/tucu-ui) es la librería de UI para React y
Next. Con la integración prendida, el repo trae la skill `tucu-ui-design`
(`sdd/integrations/skills/tucu-ui-design/`, enlazada en `.claude/skills`, `.github/skills` y
`.agents/skills`) y el MCP `tucu-ui` en `.mcp.json`, `.vscode/mcp.json` y
`.gemini/settings.json`.

- **Si la skill está enlazada, usala** al construir o tocar UI de un frontend React/Next; si no
  está, no la busques ni intentes instalarla.
- **Nunca prendas ni apagues tucu-ui por tu cuenta**: el interruptor es del dev (`sdd/tools.json`;
  `pnpm sdd:tucu -- --status | --enable | --disable`; el sdd-steward lo opera a pedido).
- No edites a mano la entrada `tucu-ui` de los archivos MCP ni `sdd/integrations/`: los gestiona
  `pnpm sdd:tucu`. `--status` funciona sin red; solo `--enable` sin la skill instalada la necesita.
- Si `pnpm sdd:validate` avisa de enlaces o entradas faltantes, informá al dev: reparar es
  `pnpm sdd:tucu -- --enable`, decisión suya.

# 🎬 video-maker — videos del producto (OPCIONAL, apagado por defecto)

Con la integración prendida, el repo queda vinculado al estudio local de
[video-maker](https://github.com/e-burgos/video-maker): en Claude Code, el plugin
`video-maker@video-maker` (declarado en `.claude/settings.json`) trae las skills de producción de
video y su MCP; Copilot y Gemini reciben el MCP `video-maker` fijado en `.vscode/mcp.json` y
`.gemini/settings.json`.

- **Para producir un video** (promo, reel, explicativo, tutorial), seguí la skill `video-maker` del
  plugin; requiere el studio corriendo. Publicar y borrar los hace el dev desde el studio.
- **Nunca prendas ni apagues video-maker por tu cuenta**: el interruptor es del dev
  (`sdd/tools.json`; `pnpm sdd:video -- --status | --enable | --disable`; el sdd-steward lo opera a
  pedido). No edites a mano sus entradas en los archivos MCP ni en `.claude/settings.json`.
