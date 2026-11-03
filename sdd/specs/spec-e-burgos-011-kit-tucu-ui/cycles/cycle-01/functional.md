# Functional — Cycle 1: kit-tucu-ui

> **Input:** sdd/specs/spec-e-burgos-011-kit-tucu-ui/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-011-kit-tucu-ui/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El kit SDD acompaña al dev de punta a punta. Cuando el proyecto tiene frontend, el siguiente paso natural es diseñar y construir las pantallas con `@e-burgos/tucu-ui` desde el arnés que ese dev use (Claude Code, GitHub Copilot, Gemini CLI o Antigravity). tucu-ui publica todo lo necesario en un paquete aparte: un servidor MCP (herramientas, recursos y prompts de diseño) y una skill de diseño (`tucu-ui-design`). Lo que falta es que el kit lo deje conectado, de forma opcional y reversible.

Hoy:

- El kit no tiene ningún interruptor para integraciones de UI; las herramientas auxiliares existentes (rtk, mod de Claude Code) se prenden y apagan con un comando propio sobre `sdd/tools.json`.
- El único archivo de configuración MCP que el kit escribe es `.mcp.json` (vía `harness configure mcp`) y lo reescribe entero: un servidor que el dev agregó a mano se pierde.
- Nada ofrece la integración cuando el proyecto tiene una app React o Next.

Este ciclo agrega un interruptor `tucu_ui` (apagado por defecto) con su comando `pnpm sdd:tucu`, que deja la skill visible y el servidor MCP configurado en los cuatro arneses sin pisar nada ajeno; hace que `harness init` y `harness configure sdd` lo ofrezcan solo cuando hay frontend; y lo documenta y vigila con avisos del validador.

**Restricciones de negocio que atraviesan todo el ciclo:**

- Retrocompatibilidad: nada nuevo pasa a obligatorio; un repo con `tools.json` anterior sigue funcionando sin migrar; el validador avisa, no falla.
- `sdd/tools.json` es dato del proyecto: `harness update sdd` no lo toca.
- Paridad Windows: todo comportamiento de enlazado vale igual en Windows y en macOS/Linux.
- Paridad con Studio: el bridge de Studio valida `tools.json` con el schema del kit; agregar la clave no puede romper sus escrituras.
- Sin red, el comando falla con un mensaje claro y deja el interruptor como estaba.

**Fuera de alcance:** interruptor de tucu-ui en el módulo Kit de Studio (el bridge solo escribe el archivo); generar código con tucu-ui; publicar o taggear una versión del kit.

## Mapa de lo que el kit escribe cuando tucu-ui está prendido

| Arnés                  | Skill `tucu-ui-design` visible en | Servidor MCP `tucu-ui` en         | Clave del servidor |
| ---------------------- | --------------------------------- | --------------------------------- | ------------------ |
| Claude Code            | `.claude/skills`                  | `.mcp.json`                       | `mcpServers`       |
| GitHub Copilot         | `.github/skills`                  | `.vscode/mcp.json`                | `servers`          |
| Gemini CLI             | `.agents/skills`                  | `.gemini/settings.json`           | `mcpServers`       |
| Antigravity            | `.agents/skills`                  | `.gemini/settings.json`           | `mcpServers`       |

Gemini CLI y Antigravity comparten ambos destinos: una sola escritura sirve a los dos arneses.

## Historias de usuario

### US-1-001: Consultar el estado de la integración

**Como** dev
**Quiero** ver con un comando si tucu-ui está prendido y qué partes están efectivamente instaladas
**Para** saber en qué estado está mi proyecto sin abrir archivos

**Trazabilidad:** US-1, CA-3 de la spec.
**Prioridad:** Alta · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-001: `pnpm sdd:tucu -- --status` imprime el estado en JSON, con el mismo estilo que `pnpm sdd:mod -- --status`, y no modifica ningún archivo.
- [ ] CA-002: El JSON informa, como mínimo: si el interruptor está prendido, si cada parte (skill, MCP) está habilitada, y, por cada arnés, si la skill está visible y si la entrada MCP existe.
- [ ] CA-003: Con un `sdd/tools.json` sin la clave `tucu_ui`, o sin el archivo, `--status` reporta apagado y sale con código 0.
- [ ] CA-004: Con el interruptor prendido pero con algo faltante (un enlace borrado, una entrada MCP quitada a mano), `--status` lo marca como incompleto por arnés y muestra el comando que lo repara; no falla.
- [ ] CA-005: `--status` funciona sin red: nunca consulta el registro de paquetes.

### US-1-002: Prender la integración

**Como** dev
**Quiero** prender tucu-ui con un solo comando
**Para** que el kit deje la skill y el MCP listos sin pasos manuales

**Trazabilidad:** US-1, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-006: `pnpm sdd:tucu -- --enable` prende el interruptor en `sdd/tools.json`, instala la skill (US-2-001) y configura el MCP en los tres archivos (US-3-001), y al final informa qué hizo en cada arnés.
- [ ] CA-007: Por defecto prende skill y MCP juntos; el dev puede prender solo una de las dos partes con una opción explícita, y `--status` refleja cuál quedó activa.
- [ ] CA-008: Prender es idempotente: correrlo de nuevo sobre una integración ya prendida y completa no cambia ningún archivo y lo dice ("ya estaba prendido").
- [ ] CA-009: Prender sobre una integración incompleta (RN-8) completa lo que falta sin duplicar lo existente.
- [ ] CA-010: Si algún paso falla (sin red, archivo MCP inválido), el interruptor en `tools.json` queda como estaba antes del comando y el mensaje de error dice qué falló y cómo seguir; no queda un estado a medias que `--status` reporte como prendido.
- [ ] CA-011: Un argumento desconocido o la combinación `--enable` con `--disable` termina con código distinto de cero y un mensaje de uso, sin tocar archivos.

### US-1-003: Apagar la integración

**Como** dev
**Quiero** apagar tucu-ui con un solo comando
**Para** volver al estado anterior sin dejar rastros del kit en mis arneses

**Trazabilidad:** US-1, CA-2 de la spec.
**Prioridad:** Alta · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-012: `pnpm sdd:tucu -- --disable` apaga el interruptor, quita los enlaces de la skill en los tres lugares (US-2-003) y quita la entrada `tucu-ui` de los tres archivos MCP (US-3-002).
- [ ] CA-013: Apagar es idempotente: sobre una integración ya apagada no cambia nada y lo dice.
- [ ] CA-014: Apagar no requiere red.
- [ ] CA-015: Apagar con archivos MCP o enlaces que ya no existen (el dev los borró a mano) no falla: informa lo que no encontró y termina bien.
- [ ] CA-016: Tras apagar, `--status` reporta apagado y `pnpm sdd:validate` no avisa nada relacionado con tucu-ui.

### US-1-004: Compatibilidad con `tools.json` anterior y con ediciones manuales

**Como** dev con un repo ya instalado
**Quiero** que mi `tools.json` viejo siga funcionando y que el comando respete lo que ya tengo ahí
**Para** poder adoptar la integración sin migrar nada ni perder mi configuración de rtk o del mod

**Trazabilidad:** US-1, CA-3 de la spec.
**Prioridad:** Alta · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-017: Un `sdd/tools.json` sin la clave `tucu_ui` valida contra el schema del kit y `pnpm sdd:validate` no emite error ni aviso por su ausencia.
- [ ] CA-018: Prender o apagar solo modifica la clave `tucu_ui`; `rtk`, `claude_mod`, `$schema`, `_description` y cualquier otra clave presente se conservan tal cual.
- [ ] CA-019: Si `sdd/tools.json` no existe, `--enable` lo crea con el contenido por defecto del kit más la clave `tucu_ui`.
- [ ] CA-020: Si `sdd/tools.json` no es JSON válido, el comando se detiene con código distinto de cero, indica que el archivo está roto y no lo sobrescribe (mismo criterio que `sdd:mod`).
- [ ] CA-021: Studio (bridge) puede escribir un `tools.json` con la clave `tucu_ui` presente sin rechazarlo, y lee uno sin la clave sin error.

### US-2-001: Instalar la skill de diseño desde el paquete publicado

**Como** dev
**Quiero** que la skill `tucu-ui-design` se instale desde el paquete oficial de tucu-ui
**Para** tener siempre la skill que corresponde a la versión de tucu-ui que el kit soporta, sin que el kit la copie ni la desactualice

**Trazabilidad:** US-2, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-022: Al prender, la skill se obtiene del paquete `@e-burgos/tucu-ui-mcp` en una versión fija (la que el kit declara) y queda instalada con su `SKILL.md` y sus referencias (`checklist` y `design-guide`).
- [ ] CA-023: La skill se instala en un lugar del proyecto que `harness update sdd` no reemplaza ni borra, distinto de las carpetas que el kit entrega (`sdd/skills` incluida).
- [ ] CA-024: Si la skill ya está instalada, volver a prender no la reinstala (no consume red) salvo que el dev lo pida explícitamente (reinstalación forzada), y una instalación forzada reemplaza el contenido por el de la versión fija.
- [ ] CA-025: La instalación no agrega la skill al catálogo del kit ni a `sdd/skills`, y `pnpm sdd:validate` no falla por su presencia.
- [ ] CA-026: El mensaje final indica la versión instalada y la carpeta donde quedó.

### US-2-002: La skill es visible en los cuatro arneses

**Como** dev
**Quiero** que Claude Code, Copilot, Gemini CLI y Antigravity vean la skill sin configurar nada a mano
**Para** diseñar con tucu-ui desde el arnés que prefiera en cada momento

**Trazabilidad:** US-2, CA-1 y CA-4 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-027: Tras prender, la skill `tucu-ui-design` aparece en `.claude/skills`, en `.github/skills` y en `.agents/skills` (esta última cubre Gemini CLI y Antigravity).
- [ ] CA-028: Los enlaces conviven con los que ya crea el kit: las skills del kit (`sdd-*`, etc.) siguen visibles en los tres lugares, sin duplicados ni reemplazos.
- [ ] CA-029: El enlazado funciona igual en macOS, Linux y Windows: en Windows se usa el mismo mecanismo de fallback que el kit ya usa para sus skills.
- [ ] CA-030: Correr `pnpm setup:agents` con la integración prendida mantiene o recrea los enlaces de la skill (no los pierde); con la integración apagada no los crea.
- [ ] CA-031: Correr `pnpm setup:agents` dos veces seguidas no cambia nada la segunda vez.
- [ ] CA-032: Si en alguno de los tres lugares ya existe algo con el nombre `tucu-ui-design` que no es un enlace del kit (el dev lo puso a mano), el kit no lo pisa: avisa y deja ese lugar como estaba.

### US-2-003: Apagar quita la skill de los arneses sin borrar lo instalado

**Como** dev
**Quiero** que apagar deje de exponer la skill pero no destruya mi copia instalada
**Para** poder volver a prender sin esperar otra descarga

**Trazabilidad:** US-2, CA-2 de la spec.
**Prioridad:** Media · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-033: `--disable` quita los enlaces de la skill de los tres lugares y deja intacta la carpeta instalada.
- [ ] CA-034: `--disable` con la opción explícita de borrado también elimina la carpeta instalada.
- [ ] CA-035: `--disable` solo quita enlaces que apuntan a la skill instalada por el kit; un `tucu-ui-design` puesto a mano (CA-032) no se toca.
- [ ] CA-036: Después de apagar y volver a prender, la skill vuelve a estar visible sin descargar de nuevo (si la carpeta instalada se conservó).

### US-2-004: Sin red

**Como** dev sin conexión
**Quiero** que el comando me diga con claridad qué no pudo hacer y no me deje el proyecto roto
**Para** reintentar cuando vuelva la red sin tener que deshacer nada

**Trazabilidad:** US-2, restricción de red de la spec.
**Prioridad:** Alta · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-037: `--enable` sin red y sin la skill ya instalada falla con código distinto de cero y un mensaje que dice que no se pudo descargar el paquete, la versión que intentó y que puede reintentar con red; el interruptor queda como estaba (CA-010).
- [ ] CA-038: `--enable` sin red pero con la skill ya instalada (CA-024) funciona: solo enlaza la skill y configura el MCP, sin intentar descargar.
- [ ] CA-039: `--disable`, `--status`, `pnpm setup:agents` y `pnpm sdd:validate` nunca necesitan red.
- [ ] CA-040: Un fallo de red durante la instalación no deja una carpeta de skill a medias que luego se confunda con una instalación completa (si queda algo, `--status` la reporta como incompleta).

### US-3-001: Configurar el servidor MCP en los tres archivos

**Como** dev
**Quiero** que el MCP de tucu-ui quede configurado en el archivo que lee cada arnés
**Para** que el agente pueda consultar los componentes, recursos y prompts de diseño de tucu-ui

**Trazabilidad:** US-3, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-041: Tras prender, existe una entrada `tucu-ui` en `.mcp.json` (clave `mcpServers`), en `.vscode/mcp.json` (clave `servers`) y en `.gemini/settings.json` (clave `mcpServers`).
- [ ] CA-042: La entrada lanza el servidor por stdio con el paquete `@e-burgos/tucu-ui-mcp` en la versión fija que el kit declara, igual en los tres archivos salvo por la forma que cada arnés exige.
- [ ] CA-043: La entrada es válida en Windows, es decir, el arnés puede ejecutarla ahí sin que el dev edite nada.
- [ ] CA-044: Si el archivo no existe, se crea con la estructura mínima válida para ese arnés (y la carpeta `.vscode` o `.gemini` si falta).
- [ ] CA-045: Si ya existe una entrada `tucu-ui`, se actualiza a la forma vigente (versión fija); volver a prender no la duplica.
- [ ] CA-046: El archivo queda como JSON válido, con el mismo formato de indentación que usa el kit para sus JSON.

### US-3-002: El merge respeta lo que el dev ya tiene

**Como** dev con otros servidores MCP configurados
**Quiero** que el kit agregue solo la entrada de tucu-ui
**Para** no perder servidores ni ajustes que armé a mano

**Trazabilidad:** US-3, CA-2 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-047: Si el archivo ya tiene otros servidores en `mcpServers`/`servers`, tras prender siguen ahí con su contenido exacto (comandos, args, variables de entorno, orden relativo).
- [ ] CA-048: Cualquier otra clave de primer nivel del archivo (por ejemplo `inputs` en `.vscode/mcp.json`, o `theme`, `selectedAuthType`, `hooks` en `.gemini/settings.json`) se conserva sin cambios.
- [ ] CA-049: Si el archivo existe pero no es JSON válido, el kit no lo modifica, indica qué archivo está roto, y el resto de los archivos y la skill se procesan igual o el comando se detiene según RN-9; en ningún caso se pierde el contenido del archivo roto.
- [ ] CA-050: Si el archivo existe pero la clave contenedora (`mcpServers`/`servers`) falta o no es un objeto, se crea o se avisa sin borrar el resto del archivo.
- [ ] CA-051: `--disable` quita únicamente la entrada `tucu-ui`; si queda vacío el contenedor de servidores, el archivo se conserva (no se borra) con el contenedor vacío.
- [ ] CA-052: `--disable` no toca una entrada `tucu-ui` cuyo comando no corresponde al paquete oficial (el dev la personalizó): avisa que la dejó como estaba.

### US-3-003: `harness configure mcp` deja de pisar servidores ajenos

**Como** dev
**Quiero** que reconfigurar los MCP del catálogo del kit no borre los servidores que agregué yo
**Para** poder usar `configure mcp` sin miedo a perder configuración

**Trazabilidad:** US-3 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-053: `harness configure mcp` sobre un `.mcp.json` existente conserva los servidores que no pertenecen al catálogo del kit y las claves de primer nivel ajenas, igual que hoy lo hace `configure memory`.
- [ ] CA-054: Los servidores del catálogo del kit que el dev deselecciona en el prompt se quitan; los que selecciona se agregan o actualizan; los ajenos no se tocan.
- [ ] CA-055: `tucu-ui` aparece en el catálogo de `configure mcp` como una opción más, con una descripción que dice que requiere un proyecto con frontend tucu-ui; prenderlo desde ahí equivale a la parte MCP de `--enable` en el archivo de Claude Code.
- [ ] CA-056: Elegir o quitar `tucu-ui` desde `configure mcp` no cambia el interruptor `tucu_ui` en `tools.json`; si el interruptor está prendido y el dev lo quita por esta vía, `pnpm sdd:validate` avisa la inconsistencia (US-5-002).

### US-4-001: `harness init` lo ofrece cuando hay frontend

**Como** dev que crea un proyecto con una app React o Next
**Quiero** que `harness init` me ofrezca prender tucu-ui
**Para** salir del init con el arnés ya listo para diseñar pantallas

**Trazabilidad:** US-4, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-057: En `harness init`, si alguna de las apps elegidas es de tipo `react` o `nextjs`, se muestra una confirmación para prender tucu-ui, con respuesta por defecto sí.
- [ ] CA-058: Si el dev acepta, el proyecto generado queda con el interruptor prendido y skill y MCP instalados como en US-1-002; el resumen final de init lo menciona.
- [ ] CA-059: Si el dev rechaza, el proyecto queda con tucu-ui apagado (sin la clave o con `enabled: false`) y el resumen indica cómo prenderlo después (`pnpm sdd:tucu -- --enable`).
- [ ] CA-060: Si ninguna app elegida es `react` ni `nextjs`, no se muestra ninguna pregunta ni mención de tucu-ui.
- [ ] CA-061: Si la instalación falla durante init (sin red), init no aborta: termina el resto de la generación, deja tucu-ui apagado y muestra el comando para reintentar.

### US-4-002: `harness configure sdd` lo ofrece sobre proyectos existentes

**Como** dev con un proyecto que ya tiene una app React o Next
**Quiero** que `harness configure sdd` me ofrezca prender tucu-ui
**Para** adoptarlo sin volver a correr init

**Trazabilidad:** US-4 de la spec.
**Prioridad:** Media · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-062: En `harness configure sdd`, si la detección de tipo de app encuentra `react` (Vite) o `nextjs` en el proyecto, se muestra la misma confirmación (default sí).
- [ ] CA-063: Si el proyecto ya tiene tucu-ui prendido y completo, no se pregunta de nuevo; si está prendido pero incompleto, se ofrece repararlo.
- [ ] CA-064: Si no se detecta frontend, no se pregunta nada.
- [ ] CA-065: Las respuestas de `configure sdd` sobre otras herramientas (rtk, mod, modo del gate) no cambian por esta incorporación.

### US-4-003: Modo no interactivo para CI

**Como** dev que automatiza la creación de proyectos
**Quiero** decidir con flags si prender tucu-ui
**Para** que la generación sea reproducible sin prompts

**Trazabilidad:** US-4 de la spec.
**Prioridad:** Media · **Estimación:** S

**Criterios de aceptación:**

- [ ] CA-066: `--tucu-ui` en `harness init` y en `harness configure sdd` prende tucu-ui sin preguntar, aunque no haya frontend detectado (el dev lo pidió explícitamente).
- [ ] CA-067: `--no-tucu-ui` lo deja apagado sin preguntar, aunque haya frontend.
- [ ] CA-068: Pasar `--tucu-ui` y `--no-tucu-ui` juntos termina con error de uso.
- [ ] CA-069: En una ejecución sin terminal interactiva y sin ninguno de los dos flags, no se pregunta y tucu-ui queda apagado.
- [ ] CA-070: Los flags aparecen en la ayuda de ambos comandos con una línea que explica su efecto.

### US-5-001: Documentación y arneses

**Como** dev
**Quiero** encontrar documentado qué hace el interruptor, qué escribe y cómo apagarlo
**Para** adoptarlo con confianza y poder revertirlo

**Trazabilidad:** US-5 de la spec.
**Prioridad:** Media · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-071: La documentación del kit existe en español e inglés (`documentation/es` y `documentation/en`) y cubre: qué es, cómo prender/apagar/consultar, qué archivos escribe por arnés (el mapa de este documento), qué pasa sin red, cómo se actualiza con `update sdd`, y la nota de Windows.
- [ ] CA-072: El README de la CLI menciona los flags `--tucu-ui` / `--no-tucu-ui` y el comando `sdd:tucu`.
- [ ] CA-073: La sección de herramientas auxiliares de `AGENTS.md` y de los archivos de cada arnés incluye una entrada de tucu-ui con la misma estructura que rtk y el mod: qué es, quién decide, qué no hacer por cuenta propia.
- [ ] CA-074: El texto de los arneses dice que prender o apagar tucu-ui es decisión del dev (el agente no lo cambia por su cuenta), igual que rtk y el mod.
- [ ] CA-075: El sdd-steward tiene en su playbook de herramientas el interruptor: puede reportar su estado y operarlo a pedido del dev.

### US-5-002: Avisos del validador

**Como** dev
**Quiero** que `pnpm sdd:validate` me avise si la integración prendida quedó rota
**Para** enterarme del problema antes de que el agente falle al usar la skill o el MCP

**Trazabilidad:** US-5, CA-3 de la spec.
**Prioridad:** Media · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-076: Con `tucu_ui.enabled` prendido, `validate-sdd` emite un aviso (no un error) por cada arnés al que le falte la skill enlazada, indicando cuál arnés y cuál lugar.
- [ ] CA-077: Con `tucu_ui.enabled` prendido, emite un aviso por cada archivo MCP que no tenga la entrada `tucu-ui` (o no exista).
- [ ] CA-078: Cada aviso incluye el comando que lo repara (`pnpm sdd:tucu -- --enable`).
- [ ] CA-079: Con el interruptor apagado, ausente o con `tools.json` anterior, el validador no emite ningún aviso de tucu-ui.
- [ ] CA-080: Si la parte MCP o la parte skill están deshabilitadas explícitamente (CA-007), el validador solo vigila la parte habilitada.
- [ ] CA-081: Si un archivo MCP no es JSON válido, el aviso lo dice sin hacer fallar el validador; el código de salida del validador no cambia por ninguno de estos avisos.
- [ ] CA-082: Una clave desconocida dentro de `tucu_ui` es un aviso del validador y no un error de schema que rompa el bridge (RN-13).

### US-5-003: `harness update sdd` conserva la integración

**Como** dev que actualiza el kit
**Quiero** que `harness update sdd` no me rompa una integración de tucu-ui ya prendida
**Para** actualizar sin repetir la configuración

**Trazabilidad:** US-2, US-3, CA-4 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-083: Tras `harness update sdd` sobre un repo con tucu-ui prendido, la skill instalada, los enlaces en los tres lugares y las entradas MCP siguen presentes y `--status` reporta completo.
- [ ] CA-084: `update sdd` no modifica `sdd/tools.json` ni las entradas de los tres archivos MCP, ni crea una copia `.new` por su causa.
- [ ] CA-085: Si la nueva versión del kit declara una versión fija del paquete distinta de la que quedó instalada, `update sdd` no la cambia por su cuenta; `--status` y el validador informan que hay una versión más nueva disponible y `--enable` con reinstalación forzada la aplica.
- [ ] CA-086: Si `update sdd` trae el schema de `tools.json` con la clave `tucu_ui` a un repo cuyo `tools.json` no la tiene, el repo sigue validando (CA-017).
- [ ] CA-087: Si el update vuelve a correr el enlazado de arneses, no pierde los enlaces de tucu-ui (CA-030).

## Reglas de negocio

### Interruptor y estados

1. **Apagado por defecto.** Un repo sin la clave `tucu_ui` o con `enabled: false` es un repo sin tucu-ui; el kit no escribe nada de tucu-ui en ningún arnés en ese estado.
2. **Un solo comando, tres operaciones.** `pnpm sdd:tucu -- --status | --enable | --disable`; sin argumentos muestra el estado (igual que `sdd:mod`).
3. **Decide el dev.** Ni el agente ni `update sdd` prenden o apagan el interruptor. Los agentes solo lo operan si el dev lo pide (vía sdd-steward).
4. **Interruptor y realidad deben coincidir.** "Prendido" significa: `enabled: true` en `tools.json` y las partes habilitadas efectivamente instaladas. `--enable` es la forma de reconciliar.
5. **Todo o nada al prender.** Si un paso falla, `tools.json` queda como estaba (CA-010); lo ya escrito en disco es seguro de dejar porque `--enable` es idempotente y `--disable` lo limpia.
6. **Partes.** `skill` y `mcp` son dos partes que por defecto se prenden juntas; deshabilitar una no afecta a la otra. Ambas apagadas equivale a apagar la integración.
7. **Idempotencia.** Cualquier operación repetida sobre el mismo estado no cambia archivos y lo informa.
8. **Estado incompleto.** Prendido con piezas faltantes se reporta como incompleto, no como apagado ni como error; se repara con `--enable`.

### Archivos MCP

9. **Merge, nunca reemplazo.** El kit solo agrega, actualiza o quita la entrada `tucu-ui`; todo lo demás del archivo se conserva. Si un archivo MCP está roto, el kit no lo reescribe: avisa y, al prender, deja el interruptor sin prender salvo que el dev pida continuar con los demás (decisión del arquitecto; el criterio funcional es que nunca se pierde contenido).
10. **El kit solo toca lo suyo.** Una entrada `tucu-ui` personalizada por el dev (comando distinto del oficial) no se borra al apagar; al prender se avisa antes de reemplazarla.
11. **Claves por arnés.** `.vscode/mcp.json` usa `servers`; `.mcp.json` y `.gemini/settings.json` usan `mcpServers`. El kit no mezcla las dos formas.
12. **Versión fija.** La entrada MCP y la instalación de la skill usan la versión del paquete que el kit declara; el kit no usa "última" para no cambiar de comportamiento sin que el dev lo note.
13. **Retrocompatibilidad del schema.** `tucu_ui` es opcional con todos sus campos opcionales; lo desconocido avisa, no rompe; el bridge y la CLI aceptan archivos con y sin la clave.

### Skill

14. **La skill es dato del proyecto.** No se copia al kit, no entra al catálogo y no la reemplaza `update sdd`; el kit solo crea y quita los enlaces hacia ella.
15. **Cuatro arneses, tres lugares.** Los enlaces se crean en `.claude/skills`, `.github/skills` y `.agents/skills`; un `tucu-ui-design` ajeno nunca se pisa.
16. **Apagar no borra datos del dev.** La carpeta instalada se conserva salvo borrado explícito.

### Red y plataformas

17. **Red solo para instalar.** Solo `--enable` sin skill instalada necesita red; todo lo demás funciona offline.
18. **Mensajes accionables.** Los errores dicen qué falló, qué quedó como estaba y qué comando reintentar.
19. **Paridad de plataformas.** Cualquier comportamiento de enlazado o de escritura de archivos vale igual en Windows; no se aceptan diferencias funcionales entre macOS/Linux y Windows.

### Oferta en init y configure sdd

20. **Solo si hay frontend.** Se ofrece únicamente cuando alguna app es `react` o `nextjs`; sin frontend no hay pregunta ni mención.
21. **Default sí en interactivo, no en no-interactivo.** Con terminal interactiva la confirmación sugiere sí; sin terminal y sin flag queda apagado.
22. **Los flags mandan.** `--tucu-ui` y `--no-tucu-ui` son excluyentes y anulan la detección y la pregunta.
23. **Un fallo de red no aborta init.** Init termina, deja tucu-ui apagado y explica cómo reintentar.

### Documentación y validación

24. **El validador avisa, nunca falla.** Todos los avisos de tucu-ui son advertencias con el comando que las repara; no alteran el código de salida.
25. **Documentación bilingüe.** Todo texto de usuario del kit sobre tucu-ui existe en español e inglés.

## Preguntas abiertas para planner y architect

1. ¿Dónde vive la carpeta instalada de la skill (lugar del proyecto fuera de lo kit-owned)? Impacta CA-023, CA-030, CA-084.
2. Forma exacta de la entrada MCP en Windows (CA-043): si `npx` directo basta o hace falta un envoltorio por shell.
3. Qué hace `--enable` cuando un archivo MCP está roto: ¿seguir con los demás y avisar, o abortar completo? (RN-9; el criterio funcional exige solo que no se pierda contenido y que `tools.json` refleje la realidad).
4. Si `configure mcp` debe poder quitar `tucu-ui` de `.mcp.json` sin apagar el interruptor, o si ambos deben quedar sincronizados (CA-056 asume que se avisa la inconsistencia, no se sincroniza).
5. Si los flags de parte (solo skill / solo MCP) entran en este ciclo o quedan como deshabilitados por clave de `tools.json` únicamente (CA-007).
6. Cómo se informa que hay una versión del paquete más nueva que la instalada (CA-085) sin consultar la red en `--status`.

## Glosario del dominio

| Término              | Definición                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| tucu-ui              | Librería de componentes React `@e-burgos/tucu-ui` con la que el dev construye pantallas.                            |
| `@e-burgos/tucu-ui-mcp` | Paquete que publica el servidor MCP y el instalador de la skill de tucu-ui; el kit lo consume, no lo copia.      |
| Skill `tucu-ui-design` | Guía de diseño para agentes (SKILL.md más checklist y design-guide) que los arneses cargan como skill.            |
| Servidor MCP `tucu-ui` | Proceso stdio que expone a los agentes herramientas, recursos y prompts de diseño de tucu-ui.                      |
| Interruptor          | Clave de `sdd/tools.json` que se opera con un comando propio; hay uno por herramienta auxiliar (rtk, mod, tucu_ui).|
| Arnés                | Cada herramienta de agente que lee el kit: Claude Code, GitHub Copilot, Gemini CLI, Antigravity.                    |
| Merge de config MCP  | Escribir solo la entrada `tucu-ui` en un archivo MCP conservando servidores y claves ajenas.                        |
| Integración incompleta | `enabled: true` con alguna skill enlazada o entrada MCP ausente; se repara con `--enable`.                        |
| DATA_FILE            | Archivo del proyecto que `harness update sdd` no reemplaza (p. ej. `sdd/tools.json`).                              |
