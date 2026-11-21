# Prueba real — permiso de Chrome y `claude mcp login` (2026-11-20)

## Chrome (Chrome 157, macOS)
- `~/Library/Application Support/Google/Chrome/DevToolsActivePort` = puerto (`9222`) + ruta `/devtools/browser/<id>`; existe solo con la depuración remota habilitada en `chrome://inspect/#remote-debugging`.
- WebSocket a `ws://127.0.0.1:<port><path>`: con la conexión aceptada abre en ~2 s (Chrome muestra su aviso/infobar) y responde `Browser.getVersion`. Un proceso nuevo también abre: la aceptación dura más que un proceso.
- Antes de aceptar, la conexión devolvía **403** (chrome-devtools-mcp: «Unexpected server response: 403»); sin archivo, «Could not find DevToolsActivePort».
- Estados: sin proceso ⇒ `chrome-closed`; sin archivo ⇒ `debugging-disabled`; 403 o timeout ⇒ `permission-pending` (el intento dispara el aviso en Chrome); open ⇒ `connected`.

## `claude mcp login <name>` (binario del SDK 0.3.292)
- Acepta nombres de plugin (`plugin:operations:notion`): arranca el OAuth del servidor HTTP. Con `--no-browser` exige TTY para pegar la redirección ⇒ el puente lo corre **sin** `--no-browser` (abre el navegador con callback local), `stdin: 'ignore'`.
- Servidor stdio (`analytics-mcp`): «doesn't support OAuth login — only HTTP and SSE» ⇒ `not-oauth`.
- `plugin:github:github`: «authenticates with the `Authorization` header in its configuration» ⇒ `header-auth` (explica su falla).
- Nombre inexistente: «No MCP server named …» ⇒ `unknown-server`.
- Siempre advierte: «claude.ai connectors are disabled because ANTHROPIC_API_KEY … takes precedence» ⇒ los conectores de claude.ai (gmail, calendar) fallan por diseño con API key.
- Exit 1 en todos los casos de error; el éxito (exit 0) se verifica en TASK-005 con un OAuth real a pedido del dev.
