# video-maker — videos del producto desde el repo (opcional)

> [video-maker](https://github.com/e-burgos/video-maker) es un estudio local de video: promos,
> reels, explicativos y tutoriales grabados, con voz, música, motion y render en tu máquina. Este
> interruptor vincula el repo con video-maker para que los agentes puedan producir videos del
> producto a partir del código, la marca y el material del repo. Es opcional y viene apagado.

## Qué es y quién decide

- **Claude Code:** se declara el **plugin** `video-maker@video-maker` (marketplace del repo
  `e-burgos/video-maker`) en `.claude/settings.json`. El plugin trae sus skills (`video-maker`,
  `video-maker-brand`, `video-maker-motion-brief`, `video-maker-screen-capture`,
  `video-maker-raw-material`) y su propio servidor MCP: el kit **no** agrega `video-maker` a
  `.mcp.json` para no registrarlo dos veces.
- **GitHub Copilot, Gemini CLI y Antigravity:** una entrada `video-maker` en `.vscode/mcp.json` y
  `.gemini/settings.json` con `@e-burgos/video-maker-mcp` en versión fijada (nunca `latest`).
  Estos arneses reciben las tools; las skills del plugin son solo de Claude Code.
- **Interruptor:** `video_maker` en `sdd/tools.json` (`enabled`, `plugin`, `mcp`, `version`).
  Prenderlo o apagarlo es **decisión del dev**; el agente no lo cambia por su cuenta. El
  sdd-steward lo opera a pedido.

## Comandos

```bash
pnpm sdd:video -- --status                      # solo lectura, sin red; imprime JSON
pnpm sdd:video -- --enable                      # prende o repara (plugin + MCP)
pnpm sdd:video -- --enable --parts=plugin       # solo el plugin de Claude Code
pnpm sdd:video -- --enable --parts=mcp          # solo el MCP de Copilot y Gemini
pnpm sdd:video -- --enable --force               # sube las entradas a la versión que fija el kit
pnpm sdd:video -- --disable                     # apaga y limpia solo lo que escribió el kit
```

Sin argumentos equivale a `--status`, que informa `state` (`off`, `complete` o `incomplete`), el
estado del plugin y de cada archivo MCP, el estado por arnés, `update_available` y, si falta algo,
el comando de reparación. Nada de esto usa red: el plugin lo descarga Claude Code y el MCP lo
baja `npx` la primera vez que un arnés lo lanza.

En Claude Code, después de `--enable` la próxima sesión ofrece instalar el plugin del marketplace
(o corré `/plugin install video-maker@video-maker`). `--disable` quita solo las claves y entradas
que escribió el kit; una definición propia del marketplace o una entrada MCP propia no se tocan.

## Requisitos

- **Node 22 o superior** para el MCP (`--enable` avisa si tu Node es menor).
- **El studio de video-maker corriendo** en tu máquina: el MCP habla con él por HTTP. Hoy:
  `pnpm studio` en un clon de `e-burgos/video-maker`, en una terminal propia (no desde el
  preview server de un arnés: lo termina y parece un crash), o un studio explícito con
  `VIDEO_MAKER_API_URL` + `VIDEO_MAKER_API_TOKEN`. La app de escritorio todavía no publica su
  dirección para el MCP; lo hará en su próxima versión.
- Nada más en tu repo: ni ffmpeg, ni Remotion, ni un `brand.json`. La marca vive en el studio
  (`create_brand` / `update_brand`) y el material se sube desde cualquier ruta. Solo el modo
  tutorial grabado usa Playwright con Chromium en tu repo.

## Flujo de punta a punta (lo conduce la skill `video-maker`)

1. `studio_status` y `get_capabilities`; el agente lee el repo.
2. Elige el modo: **motion** (promo, venta, explicativo, reel) o **footage** (tutorial grabado).
3. Una ronda de preguntas y tu OK.
4. Marca: `list_brands` y, si hace falta, `create_brand`, `update_brand`, `upload_brand_file`.
5. `create_project`.
6. Motion: `write_motion_brief` → job de storyboard (3–6 min) → revisión y tu OK →
   `propose_production` → **aprobás en el studio** → job de video → revisión visual.
   Footage: grabación con Playwright → `upload_asset` → guion → voz, montaje y timeline →
   `propose_production` → render → revisión.
7. Publicar y borrar publicaciones los hacés vos desde el studio: el MCP no los expone.

Trampas conocidas: sin la aprobación de `propose_production` el render falla con
`PROPOSAL_NOT_APPROVED`; revisá cada locución contra el guion (la voz parafrasea y lee URLs); las
fotos de la marca se usan como `brand:<key>` sin volver a subirlas; guardá el storyboard antes de
renderizar.

## Desde la CLI

`harness init --video-maker | --no-video-maker` y `harness configure sdd --video-maker` (repos
sin kit). Con el kit ya instalado: `pnpm sdd:video -- --enable`. `harness update sdd` no pisa
`sdd/tools.json`, así que el interruptor sobrevive a las actualizaciones; las versiones nuevas del
kit pueden subir la versión fijada del MCP y `--status` lo informa con `update_available`.

## Validación

`pnpm sdd:validate` avisa (nunca falla) si la integración está prendida e incompleta o si
`video_maker` tiene claves desconocidas.

## Windows

Las entradas MCP usan `cmd /c npx` en Windows, igual que tucu-ui.
