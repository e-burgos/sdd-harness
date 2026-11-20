# SPEC-e-burgos-026: Studio usa las herramientas de Claude Code del dev — skills, plugins, MCP y navegador

> Estado: **completed** (2026-11-20). cycle-01 cerrado (flow lite, 6/6 tasks). Pedido del dev: en Studio los agentes no tienen las herramientas que
> sí tiene en Claude Code (skills propias, plugins, conectores MCP) ni la extensión de Chrome.

## Resumen ejecutivo
El puente arranca el motor de Claude Code (Agent SDK) con `settingSources: ['project']`, así que
ignora todo lo que el dev configuró a nivel usuario y local: `~/.claude/skills`, plugins instalados,
servidores MCP de `~/.claude.json`, `CLAUDE.md` global, hooks y permisos. Una sonda real con la API
key del dev (2026-11-20) midió la diferencia: con `['user','project','local']` el motor pasa de 41 a
492 skills, de 4 a 21 plugins, de 13 a 47 agentes y de 0 a 60 servidores MCP (118 herramientas);
6 conectan al arrancar, 6 quedan arrancando, 38 piden autenticación y 10 fallan (los conectores de
claude.ai: gmail y google calendar, más `github:github`).

Claude in Chrome **no** funciona con API key: la doc oficial (code.claude.com/docs/en/chrome) dice
que con API key o token largo Claude Code deja la integración apagada aun con `--chrome`, y la sonda
lo confirmó (cero servidores `claude-in-chrome`). El navegador entra por `chrome-devtools-mcp`
(oficial de Google), que funciona con API key y se conecta al Chrome real del dev.

## Historias de usuario
- US-1 — Ver qué hay. Como dev, en un módulo «Claude» de Studio veo las fuentes de configuración,
  los plugins, los servidores MCP con su estado (conectado, pide autenticación, falló, arrancando) y
  cuántas skills y agentes suma cada fuente, leídos del motor real.
- US-2 — Fuentes. Como dev, prendo o apago las fuentes «usuario» y «local» (la del proyecto siempre
  está); el cambio vale desde el próximo turno de cada conversación.
- US-3 — Elegir. Como dev, apago plugins o servidores MCP puntuales sin tocar mi configuración de
  Claude Code: la selección vive en Studio y solo afecta a Studio.
- US-4 — Navegador. Como dev, prendo «Chrome (DevTools)» para que los agentes naveguen, lean consola
  y red y saquen capturas sobre mi Chrome; veo si conectó y qué hacer si no.
- US-5 — Costo. Como dev, veo un aviso cuando lo que prendí suma mucho contexto por turno.
- US-6 — Claude in Chrome. Como dev, veo por qué la extensión no está disponible (requiere login de
  claude.ai; el puente usa API key) en vez de un interruptor que no hace nada.

## Decisiones (dev, 2026-11-20)
- Navegador por `chrome-devtools-mcp` con API key (opción B); no se ofrece login de suscripción.
- Flow `lite`.

## Restricciones
- La configuración de Studio no escribe en `~/.claude`, `~/.claude.json` ni `.claude/` del proyecto:
  vive en `<root>/.sdd-studio/` (ya git-ignorado) y se aplica con opciones del SDK.
- La web nunca ve credenciales: el inventario lleva nombres, fuentes y estados, nada más.
- El SPEC GATE del puente (hook `PreToolUse` programático) sigue firme con cualquier fuente prendida.
- Feature nueva en `BRIDGE_FEATURES`, sin bump de `PROTOCOL_VERSION`. Sin la feature, no hay módulo.
- Versión de `chrome-devtools-mcp` fijada en el puente (última estable al implementar).

## Ciclos propuestos
- cycle-01 — Contrato, puente (config, opciones del motor, inventario) y módulo Claude (US-1..US-6).
