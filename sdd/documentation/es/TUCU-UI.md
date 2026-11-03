# tucu-ui — skill de diseño y MCP (opcional)

> `@e-burgos/tucu-ui` es una librería de UI para React y Next. Este interruptor le da a los
> agentes su **skill de diseño** (`tucu-ui-design`) y su **servidor MCP** (`tucu-ui`) en los cuatro
> arneses: Claude Code, GitHub Copilot, Gemini CLI y Antigravity. Es opcional y está pensado para
> repos con un frontend React o Next.

## Qué es y quién decide

- **Skill:** se instala una sola vez en `sdd/integrations/skills/tucu-ui-design/` y se enlaza en
  `.claude/skills`, `.github/skills` y `.agents/skills`.
- **MCP:** una entrada `tucu-ui` en `.mcp.json`, `.vscode/mcp.json` y `.gemini/settings.json`,
  con la versión de `@e-burgos/tucu-ui-mcp` fijada (nunca `latest`).
- **Interruptor:** `tucu_ui` en `sdd/tools.json`. Prenderlo o apagarlo es **decisión del dev**; el
  agente no lo cambia por su cuenta. El sdd-steward lo opera a pedido.

## Comandos

```bash
pnpm sdd:tucu -- --status                       # solo lectura, sin red; imprime JSON
pnpm sdd:tucu -- --enable                       # prende o repara (skill + MCP)
pnpm sdd:tucu -- --enable --parts=skill         # solo la skill (conjunto exacto de partes)
pnpm sdd:tucu -- --enable --parts=mcp           # solo el MCP
pnpm sdd:tucu -- --enable --force               # reinstala la skill con la versión que fija el kit
pnpm sdd:tucu -- --disable                      # apaga y limpia solo lo que escribió el kit
pnpm sdd:tucu -- --disable --purge              # además borra sdd/integrations/skills/tucu-ui-design
```

Sin argumentos equivale a `--status`. Una combinación inválida (`--enable` con `--disable`,
`--parts` desconocido, `--purge` sin `--disable`, `--force` sin `--enable`) sale con código 2 y
muestra el uso.

`--status` informa `state` (`off`, `complete` o `incomplete`), el estado de cada enlace y de cada
archivo MCP, el estado por arnés, `update_available` y, si el estado es `incomplete`, el comando de
reparación.

`--enable` es todo o nada sobre `tools.json`: si un paso falla (sin red, archivo MCP inválido,
Node menor que 20), el interruptor queda como estaba y el mensaje dice cómo seguir. Lo que ya se
escribió en disco es seguro: otro `--enable` lo completa y `--disable` lo limpia.

## Apps de frontend generadas: tucu-ui por defecto

La CLI genera las apps `react`, `nextjs`, `next-bff`, `mfe-shell` y `mfe` **con tucu-ui** ya
cableado: la dependencia fijada, Tailwind v4 importando sus estilos, `ThemeProvider` (apps Vite) o
`NextThemeProvider` de `@e-burgos/tucu-ui/next` (apps Next) y una pantalla de ejemplo. Generar una
también prende esta integración. `--no-tucu-ui` (o `apps[].tucuUi: false` en `init --config`)
genera una app plana y deja la integración apagada.

| Tipo de app | Qué es                                                                                       | Campos del config              |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `react`     | SPA Vite + React                                                                             | `tucuUi`                       |
| `nextjs`    | Next 16 App Router                                                                           | `tucuUi`                       |
| `next-bff`  | Next App Router cuyas rutas `app/api/*` llaman a un servicio en `<APP>_UPSTREAM_URL` (solo monorepo) | `tucuUi`               |
| `mfe-shell` | Shell Vite: proxy de dev, menú, `nginx.conf` y un `Dockerfile` combinado de sus mfes (solo monorepo) | `tucuUi`               |
| `mfe`       | App Vite con `base: '/<nombre>/'` servida detrás de un shell (solo monorepo)                 | `tucuUi`, `shell`              |
| `python`    | FastAPI + LangGraph gestionado con uv; TensorFlow detrás de `ml` (no es frontend)            | `ml`                           |

- `next-bff`, `mfe-shell` y `mfe` existen solo en modo monorepo Nx; en standalone fallan con un
  mensaje claro. Un `mfe` necesita `shell` cuando el workspace tiene más de un `mfe-shell`.
- Puertos por defecto: `next-bff` 3001, `mfe-shell` 4200, `mfe` 4201 (+1 por cada mfe extra),
  `python` 8000; `apps[].port` los pisa y cada app lee `<APP>_PORT`.
- `harness add app mfe --name <mfe> --shell <shell>` agrega un mfe a un shell existente y actualiza
  el proxy, el menú, el `nginx.conf` y el `Dockerfile` del shell de forma idempotente;
  `harness add app python --ml` agrega TensorFlow.

## Desde la CLI

```bash
harness init --tucu-ui            # prende tucu-ui al generar el proyecto
harness init --no-tucu-ui         # lo deja apagado, sin preguntar
harness configure sdd --tucu-ui   # agrega el kit SDD a un repo que todavía no lo tiene
pnpm sdd:tucu -- --enable         # repo que ya tiene el kit: este es el camino
```

`configure sdd` es para instalar el kit en un repo que aún no lo tiene: si `sdd/` ya existe, pide
**reiniciar todo el directorio** (specs, ciclos y fixes incluidos) y con `-y` lo reinicia sin
preguntar. Para prender tucu-ui en un repo con el kit instalado usá `pnpm sdd:tucu -- --enable`.

- `harness init` sin flag prende tucu-ui **por defecto** cuando hay una app de frontend (`react`,
  `nextjs`, `next-bff`, `mfe-shell`, `mfe`): las apps se generan con tucu-ui y se prende la
  integración del kit. `--no-tucu-ui`, `sdd.tucu_ui: false` en `--config` o `tucuUi: false` en todas
  las apps de frontend lo dejan apagado. `configure sdd` sin flag **pregunta solo si hay una app
  `react` o `nextjs`** y la terminal es interactiva; con `--yes` o sin TTY queda apagado, y conserva
  un `tucu_ui` prendido cuando resetea el kit.
- `--tucu-ui` junto con `--no-tucu-ui` falla antes de generar nada.
- En `init --config`, `sdd.tucu_ui: true | false` hace de valor por defecto; el flag gana.
- Si la instalación falla durante `init` (por ejemplo sin red), `init` no aborta: termina la
  generación, deja tucu-ui apagado y muestra el comando para reintentar.
- `harness configure mcp` tiene `tucu-ui` en su catálogo y **mergea**: los servidores fuera del
  catálogo se conservan; uno con nombre de catálogo (`github`, `figma`…) se escribe desde el
  catálogo al elegirlo y se quita al desmarcarlo. Única excepción: una entrada `tucu-ui` que el
  kit no escribió se conserva. No toca el interruptor; si quitás `tucu-ui` por
  esa vía con el interruptor prendido, `pnpm sdd:validate` lo avisa.

## Qué escribe en cada arnés

| Arnés | Skill (enlace) | MCP |
| ----- | -------------- | --- |
| Claude Code | `.claude/skills/tucu-ui-design` | `.mcp.json` → `mcpServers.tucu-ui` |
| GitHub Copilot | `.github/skills/tucu-ui-design` | `.vscode/mcp.json` → `servers.tucu-ui` (con `"type": "stdio"`) |
| Gemini CLI | `.agents/skills/tucu-ui-design` | `.gemini/settings.json` → `mcpServers.tucu-ui` |
| Antigravity | `.agents/skills/tucu-ui-design` | `.gemini/settings.json` → `mcpServers.tucu-ui` |

La entrada MCP canónica es la misma en los tres archivos:

```json
{ "command": "npx", "args": ["-y", "@e-burgos/tucu-ui-mcp@0.16.0"] }
```

- **No pisa archivos ajenos.** Se hace merge: se conservan los demás servidores y el resto de las
  claves. Una entrada `tucu-ui` que no escribió el kit se considera personalizada: se respeta y
  `--status` la informa como `custom`. Un archivo MCP roto (JSON inválido) aborta `--enable` antes
  de escribir nada; `--disable` lo deja como está.
- **Enlaces ajenos.** Un `tucu-ui-design` que no apunta a la carpeta del kit se informa como
  `foreign` y no se toca.
- **`.claude/skills` pasa a directorio real.** Por defecto `setup-agents` hace de `.claude/skills`
  un symlink a `sdd/skills`. Para no escribir dentro de `sdd/skills/` (que es del kit), la primera
  vez que se enlaza tucu-ui se convierte en un directorio real con un enlace por cada skill. En git
  se ve como un cambio de tipo de `.claude/skills`. La conversión es permanente y `setup-agents` la
  soporta.
- **`setup-agents`** corre `sdd-tucu.mjs --sync` al final: sin red y sin instalar nada, crea los
  enlaces que falten si la integración está prendida y quita los del kit si está apagada. Así un
  compañero que hace `git pull` queda alineado.

## Qué pasa sin red

Solo `--enable` **sin la skill ya instalada** necesita red (descarga `@e-burgos/tucu-ui-mcp` con
`npx`). Todo lo demás funciona offline: `--status`, `--disable`, `--sync`, `pnpm sdd:validate` y
`--enable` cuando la skill ya está en `sdd/integrations/skills/tucu-ui-design/`. Sin red,
`--enable` falla con un mensaje claro y `tools.json` queda sin cambios.

## Actualizaciones

- `harness update sdd` **no toca** `sdd/tools.json` ni `sdd/integrations/`: son datos del proyecto.
  Tu interruptor y la skill instalada sobreviven a cualquier update.
- `tucu_ui.version` es la versión que usa el proyecto. Cuando el kit fija una más nueva,
  `--status` informa `update_available: true` y `pnpm sdd:validate` avisa (sin red). Se aplica con
  `pnpm sdd:tucu -- --enable --force`.
- Los archivos `dual-harness/*.md` son híbridos: un repo con cambios locales los recibe como
  `.new` junto al original. Es el comportamiento esperado del kit.

## Validación

`pnpm sdd:validate` **avisa, nunca falla** por tucu-ui: claves desconocidas en `tucu_ui`, carpeta de
skill incompleta, enlaces faltantes o ajenos, archivos MCP sin la entrada o rotos y versión
desactualizada. Con el interruptor apagado solo se avisan las claves desconocidas.

## Windows

- Los enlaces se crean como junctions, igual que los del resto de las skills del kit.
- Los archivos MCP commiteados llevan siempre la forma `npx` canónica, para que sirvan en todas las
  plataformas. Claude Code nativo en Windows exige el envoltorio `cmd /c` para `npx`: en `win32`,
  `--enable` intenta además un override de alcance local (`claude mcp add --scope local …`), que no
  se commitea. Si `claude` no está en el PATH o falla, imprime el comando exacto como aviso y
  sigue. `--disable` lo quita con `claude mcp remove --scope local tucu-ui`.
- El kit reconoce como propias las dos formas de la entrada (`npx` y `cmd /c npx`).

## Requisitos

- Node 20 o superior para `--enable` (lo exige `@e-burgos/tucu-ui-mcp`). El resto del kit sigue
  pidiendo Node 18.
