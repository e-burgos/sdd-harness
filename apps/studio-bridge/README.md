# @e-burgos/sdd-studio

Puente local de **SDD Studio**: conecta la web de Studio con un repo que tiene instalado el kit
SDD (`@e-burgos/sdd-harness`) y ejecuta sus agentes con Claude **en tu máquina**.

## Uso

```bash
cd mi-repo            # raíz del repo, donde está sdd/
npx @e-burgos/sdd-studio
```

Abre el navegador en la web de Studio ya emparejada con este repo.

> La web de Studio es el Plan 2 (vista previa): hasta que esté desplegada, usá `--web-url` apuntando
> a un build local de la web.

| Opción | Default | Descripción |
|---|---|---|
| `--root <dir>` | directorio actual | Raíz del repo (donde está `sdd/`) |
| `--port <n>` | `4320` (o el siguiente libre) | Puerto del WebSocket en 127.0.0.1. Un `--port` explícito es estricto: falla si está ocupado; sin `--port` se usa 4320 y, si está ocupado, el siguiente libre. Valores inválidos abortan con error en español |
| `--engine claude\|fake` | `claude` | `fake` no gasta tokens (demo y tests); valores inválidos abortan con error en español |
| `--allow-origin <a,b>` | — | Orígenes extra permitidos |
| `--web-url <url>` | `https://studio.sdd.estebanburgos.com.ar` | Web a abrir; valores inválidos abortan con error en español |
| `--no-open` | — | No abrir el navegador |
| `--local-ui` | — | Sirve la web desde el puente (`http://127.0.0.1:<puerto>/w/`). Usalo si tu navegador bloquea la conexión de la web hosteada al puerto local (p. ej. Safari) o para usar Studio sin internet. Requiere un build con la web incluida (`dist/web`) |
| `--token <t>` | generado | Token de emparejamiento fijo (≥16 caracteres `[A-Za-z0-9_-]`), sólo para tests y scripts: queda visible en la lista de procesos (`ps`) |

## Autenticación

- Sin `ANTHROPIC_API_KEY`: usa el **login local de Claude Code** (`claude login`) de tu máquina.
- Con `ANTHROPIC_API_KEY`: usa la API key.

El puente nunca lee, guarda ni transmite credenciales. Aviso: la documentación del Claude Agent
SDK indica que, sin aprobación previa de Anthropic, productos de terceros no pueden ofrecer el
login de claude.ai ni sus límites de uso. Si distribuís Studio a otras personas, usá API key o
consultá a Anthropic.

## Seguridad

- Escucha sólo en `127.0.0.1`; exige el token de emparejamiento que imprime al arrancar
  (rota en cada arranque) y valida el `Origin` del navegador.
- Sólo lee archivos bajo `sdd/` y sólo ejecuta los scripts del kit
  (`spec-gate`, `validate-sdd`, `rebuild-tasks-index`, `rebuild-catalog`).
- Las ediciones de código de los agentes pasan por el SPEC GATE del kit: un hook `PreToolUse` lo evalúa
  en cada uso de herramienta, también en modo `acceptEdits` y para herramientas permitidas por
  `permissions.allow` de `.claude/settings.json`; sin ciclo `in-progress` ni fix abierto la edición se
  deniega (en modo `warn` se te pregunta con el aviso). Las demás aprobaciones muestran el input completo
  de la herramienta (hasta 16 KB) y "siempre en este hilo" sólo aplica al comando Bash exacto o a
  herramientas no-edición y no-MCP.

## Navegador

- En Windows, el navegador se abre con `rundll32 url.dll,FileProtocolHandler`.

## Datos locales

El historial vive en `.sdd-studio/` en la raíz del repo; la carpeta se ignora sola en git.
