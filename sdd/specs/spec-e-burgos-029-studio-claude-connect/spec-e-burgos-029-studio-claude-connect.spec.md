# SPEC-e-burgos-029: Studio conecta Chrome y los MCP del dev sin salir de Studio

> Estado: **completed** (2026-11-20). cycle-01 cerrado (flow lite, 7/7 tasks). Pedido del dev: «los MCP se tienen que poder reconectar o loguear desde
> Studio» y «Chrome tiene que estar activo por defecto siempre; si no tiene el permiso, lo tiene que
> solicitar al instante».

## Resumen ejecutivo
spec-e-burgos-026 sumó el navegador (chrome-devtools-mcp con `--autoConnect`) y el inventario de MCP con su
estado, pero: (1) el navegador arranca apagado y, cuando Chrome no tiene la depuración remota habilitada o
la conexión no fue aceptada (403), el dev solo se entera cuando un agente falla; (2) los MCP que piden
autenticación o fallaron obligan a ir a la terminal (`/mcp`). El binario del motor trae `claude mcp login
<name>` (OAuth en el navegador con callback local) y el SDK `reconnectMcpServer`; Chrome expone su estado
en `DevToolsActivePort` y en la respuesta del WebSocket de depuración.

## Historias de usuario
- US-1 — Chrome por defecto. Como dev, el navegador viene prendido por defecto (producto) y Studio chequea
  Chrome al arrancar: si no está conectado, lo pide en ese momento (aviso de permiso en Chrome) y me muestra
  qué falta con una acción (abrir `chrome://inspect/#remote-debugging`, reintentar).
- US-2 — Login de MCP. Como dev, en un MCP que pide autenticación toco «Iniciar sesión»: se abre el OAuth en
  mi navegador y, al volver, el estado se actualiza.
- US-3 — Reconectar. Como dev, en un MCP que falló toco «Reconectar» y veo el estado nuevo.

## Decisiones (dev, 2026-11-20)
- Chrome prendido por defecto en el producto (cambia `DEFAULT_CLAUDE_TOOLS_CONFIG`).
- Flow `lite`.

## Restricciones
- El puente nunca guarda ni ve tokens OAuth: el login lo hace el binario del motor en su almacén de credenciales.
- Abrir Chrome o el navegador lo hace el puente en la máquina del dev, solo a pedido o al arrancar.
- Compatibilidad: web nueva con puente viejo sin la feature no muestra estas acciones.

## Ciclos propuestos
- cycle-01 — Prueba real del permiso de Chrome y del login, contrato, puente y UI.
