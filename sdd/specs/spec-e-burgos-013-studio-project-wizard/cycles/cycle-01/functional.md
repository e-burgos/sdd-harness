# Functional — Cycle 1: studio-project-wizard

> **Input:** sdd/specs/spec-e-burgos-013-studio-project-wizard/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-013-studio-project-wizard/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Hoy armar un proyecto nuevo con el kit exige la terminal (`harness init`) o escribir a mano un `harness.config.json`. Studio solo funciona con un bridge conectado a un repo que ya tiene `sdd/`. Este ciclo agrega el módulo «Nuevo proyecto»: un wizard de 6 pasos que filtra qué herramienta necesita el dev, arma un `harness.config.json` válido para la CLI y genera una carpeta local nueva donde el dev indique, ya armada como la arma el kit (instala dependencias, `sdd:validate`, `lint test build`), con progreso en vivo. Al terminar se abre el proyecto en Studio.

**Fuente de las opciones:** el wizard solo ofrece lo que `HarnessConfigSchema` y `validateAppTopology` de la CLI aceptan. No inventa tipos, campos ni combinaciones.

**Catálogo real que el wizard puede ofrecer**

| Dimensión | Valores aceptados por la CLI |
| --- | --- |
| Modo (`mode`) | `nx` (monorepo), `standalone` (una sola app en la raíz, sin libs) |
| Tipo de app (`apps[].type`) | `react`, `nextjs`, `next-bff`, `mfe-shell`, `mfe`, `nestjs`, `fastify`, `hono`, `python`, `springboot` |
| Solo monorepo | `next-bff`, `mfe-shell`, `mfe` |
| Con tucu-ui (`tucuUi`) | `react`, `nextjs`, `next-bff`, `mfe-shell`, `mfe` (default activo; `false` = plain) |
| Solo `python` | `ml` (TensorFlow detrás del extra) |
| Solo `mfe` | `shell` (nombre de una app `mfe-shell`) |
| Libs (`libs[].type`) | `shared-types`, `shared-utils`, `ui-kit`, `api-client`, `config` |
| Servicios (`services[].type`) | `postgres`, `redis`, `rabbitmq`, `minio` |
| Perfil SDD (`sdd.profile`) | `team`, `solo` |
| Puertos por defecto | nestjs/fastify/hono/nextjs 3000, python 8000, springboot 8080, react 4200, next-bff 3001, mfe-shell 4300, mfe 4301 (si chocan, el generador suma 1 hasta liberar) |
| Rangos y formatos | puerto entero 1000-65535; nombres de proyecto/app/lib/shell kebab-case `^[a-z][a-z0-9-]*$`; `packageScope` `^@[a-z0-9-]+$`; descripción no vacía |

**Mapeo de los 6 pasos (flujo del dev, 2026-10-26)**

1. Alcance: full stack, solo front, solo back.
2. Forma: standalone o monorepo Nx, más identidad del proyecto (nombre, descripción, scope npm).
3. Front: qué app(s) de interfaz.
4. Back: qué app(s) de servidor.
5. Extras: libs compartidas, puertos, servicios/Docker, perfil SDD.
6. Resumen y destino: árbol, comandos, carpeta destino y botón Generar.

**Restricciones de negocio que atraviesan todo el ciclo**

- Un solo contrato: el wizard produce el mismo `harness.config.json` que acepta la CLI; nunca una variante propia.
- Independencia: la CLI y el kit no dependen de Studio.
- El wizard no depende del repo conectado.
- Nunca se pisa una carpeta con contenido sin confirmación explícita.
- Tipografía y tokens de tucu-ui de Studio; sin cambios de estilo propios.

**Fuera de alcance:** crear/vincular repo remoto o push (spec-e-burgos-014); cambios en los generadores de la CLI; app de escritorio; publicar o taggear.

---

## Historias de usuario — Wizard «Nuevo proyecto»

### US-1: Wizard de arquitectura de 6 pasos con explicaciones y recomendaciones

**Como** dev
**Quiero** un módulo «Nuevo proyecto» en Studio con un wizard de 6 pasos que me explique cada opción y me recomiende según lo que ya elegí
**Para** decidir la arquitectura sin conocer de memoria los tipos de app, las topologías válidas ni los flags de la CLI

**Criterios de aceptación:**

Acceso y navegación

- [ ] US-1-001: El módulo «Nuevo proyecto» es accesible desde Studio tanto con un bridge conectado a un repo con `sdd/` como sin proyecto abierto; no exige repo conectado para mostrarse ni para recorrer los pasos 1 a 5.
- [ ] US-1-002: El wizard muestra los 6 pasos en orden fijo (Alcance, Forma, Front, Back, Extras, Resumen), con indicador del paso actual y de los completados.
- [ ] US-1-003: «Siguiente» está deshabilitado mientras el paso actual tenga un error de validación o falte una elección obligatoria; el motivo se muestra junto al control.
- [ ] US-1-004: «Atrás» conserva todo lo elegido en los pasos posteriores mientras siga siendo compatible con el cambio; si el cambio invalida una elección posterior, esa elección se descarta y el wizard lo avisa antes de confirmar el cambio (ver US-1-040).
- [ ] US-1-005: Cada opción de cada paso muestra una explicación de una o dos frases de cuándo conviene, en el idioma de la interfaz de Studio.

Paso 1 — Alcance

- [ ] US-1-010: Ofrece exactamente tres opciones excluyentes: «Full stack», «Solo front», «Solo back». No hay valor por defecto: el usuario debe elegir una.
- [ ] US-1-011: «Solo front» oculta el paso 4 (Back) del recorrido y de los indicadores; «Solo back» oculta el paso 3 (Front); «Full stack» muestra ambos. Los pasos siguen numerados como 6 en el resumen aunque uno quede sin contenido, con la leyenda «No aplica por el alcance».

Paso 2 — Forma e identidad

- [ ] US-1-012: Ofrece «Standalone» (una app en la raíz) y «Monorepo Nx» (apps/ + libs/ + tools/). Recomendación visible: con alcance «Full stack» se recomienda Monorepo Nx; con «Solo front» o «Solo back» se recomienda Standalone.
- [ ] US-1-013: Con alcance «Full stack», «Standalone» queda bloqueado (no seleccionable) con la razón «Full stack necesita al menos dos apps; standalone admite una sola», porque el modo standalone genera una única app.
- [ ] US-1-014: Pide nombre del proyecto, descripción y scope npm (ver validaciones en US-1-050 a US-1-053). Si el usuario no toca el scope, se propone `@<nombre>` derivado del nombre del proyecto y se puede editar.

Paso 3 — Front

- [ ] US-1-015: Con modo Monorepo Nx el paso ofrece: «SPA (Vite)» → `react`; «Next.js» → `nextjs`; «Next.js como BFF» → `next-bff`; «Microfrontends por path» → `mfe-shell` + uno o más `mfe`.
- [ ] US-1-016: Con modo Standalone el paso ofrece solo «SPA (Vite)» y «Next.js»; «Next.js como BFF» y «Microfrontends por path» aparecen bloqueados con la razón «Solo disponible en monorepo Nx» (misma regla que `validateAppTopology` para `next-bff`, `mfe-shell` y `mfe`).
- [ ] US-1-017: Para cada app de front con tipo en {`react`, `nextjs`, `next-bff`, `mfe-shell`, `mfe`} se ofrece un interruptor «Usar tucu-ui» activo por defecto; desactivarlo genera `tucuUi: false`. Para ningún otro tipo de app aparece ese interruptor.
- [ ] US-1-018: «Microfrontends por path» exige un `mfe-shell` y al menos un `mfe`; no deja avanzar con un `mfe` sin shell ni con un shell sin `mfe`. Si se crea más de un `mfe-shell`, cada `mfe` debe elegir su shell en un selector que lista solo los `mfe-shell` definidos (reflejado en `apps[].shell`); con un solo shell el selector no aparece y `shell` se omite.
- [ ] US-1-019: Se puede definir más de una app de front en monorepo (por ejemplo `react` y `nextjs`); en standalone solo una (ver US-1-013 y US-1-033).
- [ ] US-1-020: Cada tipo de front muestra su descripción del stack real de la CLI (por ejemplo «React + Vite + Tailwind v4, tucuUi», «Next.js App Router BFF: app/api routes proxying an upstream service»).

Paso 4 — Back

- [ ] US-1-021: Se agrupa en dos familias con explicación: «Node (streaming, muchos dispositivos)» con `nestjs`, `fastify`, `hono`; y «Python FastAPI (CPU pesado, LangGraph/TensorFlow)» con `python`. `springboot` (Java 21, hexagonal) se ofrece como tercera opción «Java».
- [ ] US-1-022: Para `python` se ofrece el interruptor «Incluir TensorFlow (ml)», apagado por defecto, que genera `ml: true`. Para ningún otro tipo de app aparece el campo `ml`.
- [ ] US-1-023: Con alcance «Full stack» y un front `next-bff` en el paso 3, el paso 4 exige al menos una app de back y muestra la nota «El BFF necesita un upstream: elegí el back al que proxea». (El BFF no se enlaza por config; solo se informa.)
- [ ] US-1-024: En standalone, el paso 4 admite una sola app de back y solo si el alcance es «Solo back» (consistente con US-1-013).
- [ ] US-1-025: Recomendaciones del paso 4, visibles como etiqueta «Recomendado»: si el front es `next-bff` o `nextjs`, se recomienda `nestjs`; si el usuario indica carga CPU pesada/IA (opción informativa en la explicación de la familia), `python`; para streaming/dispositivos masivos, `fastify` o `hono`. La recomendación nunca preselecciona ni bloquea.

Paso 5 — Extras

- [ ] US-1-026: «Libs compartidas» solo aparece en modo Monorepo Nx, con los 5 tipos del catálogo (`shared-types`, `shared-utils`, `ui-kit`, `api-client`, `config`) como casillas, ninguna marcada por defecto, y un nombre editable por lib. En standalone el bloque no se muestra.
- [ ] US-1-027: Recomendaciones de libs: con alcance «Full stack» se recomienda `shared-types`; con algún front con tucu-ui y más de un front se recomienda `ui-kit`; con front y back se recomienda `api-client`. Son etiquetas, nunca preselecciones.
- [ ] US-1-028: «Servicios» ofrece `postgres`, `redis`, `rabbitmq`, `minio` como casillas, ninguna marcada por defecto, cada una con puerto editable (ver US-1-056).
- [ ] US-1-029: «Perfil SDD» ofrece `team` y `solo` con explicación («team: ciclos completos con un agente por documento; solo: ciclos livianos con un solo actor»). Default: `solo` si el proyecto es standalone, `team` si es monorepo; el usuario puede cambiarlo. El valor elegido se escribe en `sdd.profile`.
- [ ] US-1-030: «Puertos» muestra una fila por app con el puerto por defecto de su tipo, editable (ver validaciones US-1-054 a US-1-057).
- [ ] US-1-031: El paso 5 muestra la opción «Docker» como parte de los servicios (ver pregunta Q-1 para el arquitecto: el schema de la CLI no tiene un campo Docker propio).

Reglas de combinación y bloqueos (transversal a los pasos)

- [ ] US-1-032: Antes de habilitar Generar, el wizard evalúa la misma regla que `validateAppTopology(apps, mode)` de la CLI y bloquea exactamente lo que esa función rechaza: `ml` en un tipo distinto de `python`; `tucuUi` en un tipo que no es de front; `next-bff`/`mfe-shell`/`mfe` en standalone; `shell` en un tipo distinto de `mfe`; `mfe` sin `mfe-shell` o con `shell` inexistente o que no es `mfe-shell`; `mfe` sin `shell` cuando hay más de un `mfe-shell`.
- [ ] US-1-033: En modo standalone el resumen no admite más de una app en total; el wizard impide agregar una segunda app (botón «Agregar app» deshabilitado con la razón «Standalone admite una sola app»).
- [ ] US-1-034: El wizard nunca emite un `harness.config.json` que `HarnessConfigSchema` rechace: si el estado interno llegara a ser inválido, Generar queda deshabilitado y se muestra la lista de errores del schema en lenguaje legible, sin volcar JSON crudo de zod.
- [ ] US-1-035: Nombres de app repetidos están bloqueados: dos apps (o dos libs) no pueden llamarse igual dentro de su grupo; el mensaje indica cuál es el duplicado.
- [ ] US-1-036: Si el usuario completa un paso y luego vuelve a cambiar la elección del paso 1 o 2 de modo que invalida elecciones posteriores (por ejemplo pasar de monorepo a standalone con un `mfe-shell` ya definido), el wizard muestra una confirmación que lista exactamente qué se va a descartar; si el usuario cancela, el cambio no se aplica.
- [ ] US-1-040: Pasar de «Full stack» a «Solo front» descarta las apps de back definidas (con la confirmación de US-1-036); pasar a «Solo back» descarta las de front; volver a «Full stack» no las restaura salvo que sigan en memoria de la sesión del wizard.
- [ ] US-1-041: El estado del wizard sobrevive a recargar la página dentro de la misma sesión de Studio (se restaura al volver al módulo) y se descarta con «Empezar de nuevo» (que pide confirmación si hay elecciones hechas).

Validación de nombres y puertos

- [ ] US-1-050: El nombre del proyecto debe ser kebab-case minúsculas (`^[a-z][a-z0-9-]*$`); si no lo es, el campo se marca en error con ejemplo («mi-proyecto») y no se deja avanzar. Un nombre vacío tiene su propio mensaje.
- [ ] US-1-051: La descripción no puede estar vacía ni ser solo espacios.
- [ ] US-1-052: El scope npm debe cumplir `^@[a-z0-9-]+$`; si el usuario escribe sin `@`, se muestra el error con el ejemplo `@mi-proyecto` (no se corrige en silencio).
- [ ] US-1-053: Los nombres de app, lib y shell cumplen `^[a-z][a-z0-9-]*$`; se valida al escribir (con debounce corto) y se marca el campo, no solo al avanzar.
- [ ] US-1-054: Un puerto debe ser entero entre 1000 y 65535; texto no numérico, decimales, valores menores a 1000 o mayores a 65535 se rechazan con el rango en el mensaje.
- [ ] US-1-055: Dos apps no pueden tener el mismo puerto explícito; el conflicto se marca en ambas filas con el nombre de la otra app.
- [ ] US-1-056: Un servicio y una app no pueden compartir puerto explícito; el conflicto se marca igual que en US-1-055.
- [ ] US-1-057: Si el usuario deja un puerto sin editar, se omite `apps[].port` del config y el resumen muestra el puerto que va a resolver el generador (por defecto del tipo; si choca con otra app, el siguiente libre, igual que `resolveAppPorts`). Si el usuario edita y luego vacía el campo, vuelve a ese comportamiento.

**Prioridad:** Alta
**Estimación:** XL

---

### US-2: Vista previa del árbol, apps/libs y comandos antes de generar

**Como** dev
**Quiero** ver en el paso 6 qué carpetas, apps, libs y comandos voy a obtener antes de generar nada
**Para** confirmar que la arquitectura es la que quiero sin tener que generar y borrar

**Criterios de aceptación:**

- [ ] US-2-001: El paso 6 muestra un árbol de carpetas que refleja el modo elegido: para Monorepo Nx, `apps/<nombre>` por app, `libs/<nombre>` por lib y `sdd/`; para Standalone, la app en la raíz más `sdd/`. Cada app indica su tipo y su stack (la misma descripción del stack que usa la CLI).
- [ ] US-2-002: Cada app del resumen muestra su puerto final (explícito o resuelto), si usa tucu-ui, y, para `mfe`, a qué shell pertenece y la ruta `/<mfe>/`.
- [ ] US-2-003: El resumen lista las libs (nombre y tipo), los servicios con su puerto, el perfil SDD y el modo.
- [ ] US-2-004: El resumen lista los comandos que va a ejecutar la generación, en este orden y con el cwd de la carpeta destino: la generación del kit (`harness init --config harness.config.json -y`), que a su vez instala dependencias, corre `sdd:validate` y corre `lint test build`. El texto aclara que la instalación necesita red.
- [ ] US-2-005: El resumen incluye una vista del `harness.config.json` resultante, de solo lectura, para que el dev vea exactamente el contrato que se va a escribir.
- [ ] US-2-006: Cada sección del resumen tiene un enlace «Editar» que lleva al paso correspondiente y vuelve al resumen al completar.
- [ ] US-2-007: El resumen se recalcula al volver de un paso editado; no muestra datos de una elección anterior.
- [ ] US-2-008: Mientras haya algún error de validación pendiente, el resumen muestra la lista de errores con enlace al campo, y el botón Generar permanece deshabilitado.
- [ ] US-2-009: Mostrar la vista previa no escribe nada en disco ni ejecuta comandos.

**Prioridad:** Alta
**Estimación:** M

---

### US-3: Generar el proyecto en la carpeta elegida con progreso y gate en vivo

**Como** dev
**Quiero** elegir una carpeta de mi computadora y que Studio genere ahí el proyecto con el progreso y el resultado del gate en vivo
**Para** terminar con un proyecto verificado sin abrir la terminal

**Criterios de aceptación:**

Carpeta destino

- [ ] US-3-001: El paso 6 pide una ruta destino absoluta de la computadora del dev (campo de texto y, si el entorno lo permite, selector de carpeta). Si no hay ruta, Generar está deshabilitado. La carpeta final del proyecto es la ruta elegida (la CLI genera en el cwd, ver Q-3).
- [ ] US-3-002: Antes de generar, Studio comprueba el destino y muestra uno de cuatro estados: «No existe (se creará)», «Existe y está vacía», «Existe y tiene contenido», «No se puede escribir» (sin permisos o no es una carpeta).
- [ ] US-3-003: Si la ruta no existe, se crea (incluidos los directorios intermedios) al iniciar la generación; no se crea nada al solo escribir o validar la ruta.
- [ ] US-3-004: Si existe y está vacía, se genera sin confirmación adicional. Un directorio que solo contiene `.git` se considera «con contenido» (ver US-3-006).
- [ ] US-3-005: Si existe y tiene contenido (cualquier archivo o carpeta), Studio exige una confirmación explícita antes de generar, que muestra la ruta, cuántos elementos tiene y los primeros nombres; el botón de confirmación tiene un texto distinto de «Generar» (por ejemplo «Generar en esta carpeta con contenido») y no es el foco por defecto.
- [ ] US-3-006: Aun con confirmación, si el destino contiene un `harness.config.json`, un `sdd/` o un `.git`, la confirmación lo menciona por nombre como advertencia reforzada antes de continuar.
- [ ] US-3-007: Si la carpeta no se puede escribir o la ruta apunta a un archivo, no hay forma de confirmar: Generar permanece deshabilitado y el mensaje explica la causa («Sin permiso de escritura», «La ruta es un archivo»).
- [ ] US-3-008: Rutas con `..`, vacías, relativas o con caracteres inválidos para el sistema operativo se rechazan con mensaje claro; la ruta se muestra normalizada antes de generar.
- [ ] US-3-009: Una ruta que es la carpeta del repo conectado, o está dentro de él, muestra la advertencia «Esta carpeta está dentro del proyecto conectado» y exige la misma confirmación explícita que una carpeta con contenido.
- [ ] US-3-010: La confirmación se pide por generación: cancelar y reintentar vuelve a pedirla; la confirmación de un intento no vale para otro.

Generación y progreso

- [ ] US-3-011: Al confirmar, Studio escribe el `harness.config.json` del wizard en la carpeta destino y ejecuta la generación del kit con ese config en esa carpeta, de modo que la carpeta resultante es equivalente a la de `harness init --config harness.config.json -y`.
- [ ] US-3-012: La vista de progreso muestra las etapas en orden: «Preparando carpeta», «Generando estructura», «Instalando dependencias», «Validando SDD», «Lint, test y build», «Listo». La etapa activa está resaltada, las completadas con marca y las pendientes atenuadas.
- [ ] US-3-013: La salida de los comandos (stdout/stderr) se muestra en vivo en un panel desplazable; se mantiene el desplazamiento al final salvo que el usuario haya subido para leer.
- [ ] US-3-014: Las etapas «Validando SDD» y «Lint, test y build» se marcan como superadas cuando la CLI imprime `[x] sdd:validate` y `[x] nx run-many -t lint test build`; si no imprime la marca de una etapa y el proceso termina, esa etapa se marca como fallida.
- [ ] US-3-015: Mientras se genera, el wizard queda de solo lectura: los pasos no se pueden editar y Generar no se puede pulsar de nuevo.
- [ ] US-3-016: Hay un botón «Cancelar generación» que pide confirmación, detiene el proceso en curso y lleva al estado de fallo parcial (US-3-030 en adelante). Cancelar nunca borra lo ya escrito.
- [ ] US-3-017: Si el usuario cierra la pestaña o navega fuera mientras se genera, la generación continúa en el bridge; al volver al módulo, Studio muestra el progreso actual de esa generación (o su resultado) si el bridge sigue vivo. Si el bridge ya no responde, se muestra «Sin conexión con el bridge» (ver US-3-032).
- [ ] US-3-018: Solo puede haber una generación en curso por bridge; un segundo intento mientras hay una activa se rechaza con el mensaje «Ya hay una generación en curso» y la ruta de la que corre.
- [ ] US-3-019: Dos generaciones consecutivas a la misma carpeta no corren a la vez; la segunda espera o se rechaza según US-3-018.

Fallos a mitad

- [ ] US-3-030: Si falla cualquier etapa, el progreso se detiene, la etapa fallida se marca en rojo, el panel de salida conserva todo el log y se muestra un resumen con: etapa que falló, código de salida y la ruta de la carpeta.
- [ ] US-3-031: Instalación sin red o registro inaccesible: la etapa «Instalando dependencias» falla con el mensaje «No se pudieron instalar las dependencias (¿sin conexión?)». En disco queda la estructura ya generada y el `harness.config.json`; no se borra nada. Se ofrece «Reintentar instalación», que reanuda desde esa etapa sin regenerar la estructura (ver Q-4).
- [ ] US-3-032: Si se pierde la conexión con el bridge a mitad (bridge detenido, pestaña de otro origen, token vencido), Studio muestra el último progreso conocido con la marca «Conexión perdida» y no declara éxito ni fallo; al reconectar, intenta recuperar el estado real (US-3-017). Si no puede, informa que el estado en disco es desconocido y ofrece abrir el destino para revisarlo.
- [ ] US-3-033: Gate en rojo (`sdd:validate` o `lint test build` falla): la generación termina como «Generado con errores», nunca como éxito. En disco queda el proyecto completo con dependencias instaladas; se muestran los errores del gate y la carpeta se puede abrir en Studio igual (US-4-006) o revisar a mano.
- [ ] US-3-034: Proceso cortado de forma externa (el proceso hijo muere por señal, el equipo se apaga, el usuario mata la terminal del bridge): la generación se considera fallida por interrupción. En disco queda lo que alcanzó a escribirse. Al volver a abrir Studio, el wizard detecta la carpeta destino como «con contenido» y exige la confirmación de US-3-005 antes de reintentar.
- [ ] US-3-035: Error al crear la carpeta o escribir `harness.config.json` (disco lleno, permisos que cambian): la generación falla en «Preparando carpeta» con la causa legible; no se ejecuta ningún otro comando.
- [ ] US-3-036: Un fallo en la generación de la estructura (el CLI termina con código distinto de cero antes de instalar) muestra el log de la CLI y no avanza a las etapas siguientes.
- [ ] US-3-037: Todo fallo ofrece: «Ver log completo», «Copiar log», «Abrir carpeta» (si existe), «Editar el wizard y volver a intentar» (conserva todo lo elegido) y «Reintentar». Ninguna acción de fallo borra la carpeta.
- [ ] US-3-038: Studio nunca borra, mueve ni limpia la carpeta destino por su cuenta, ni siquiera tras un fallo; la limpieza es decisión manual del dev. El mensaje de fallo lo dice.

Contrato en disco

- [ ] US-3-040: Al terminar (éxito o fallo posterior a la preparación), el `harness.config.json` existe en la raíz del proyecto nuevo y es idéntico al que se mostró en la vista previa (US-2-005).
- [ ] US-3-041: El `harness.config.json` del proyecto nuevo se conserva tal cual al regenerar o al correr comandos posteriores de la CLI en esa carpeta (la CLI ya lo preserva al generar en el lugar).
- [ ] US-3-042: Studio no escribe fuera de la carpeta destino durante la generación (ni en el repo conectado, si lo hay).

**Prioridad:** Alta
**Estimación:** XL

---

### US-4: Abrir el proyecto nuevo en Studio con `#general` y una idea inicial para Hermes

**Como** dev
**Quiero** abrir el proyecto recién generado en Studio con un solo paso
**Para** seguir trabajando (primera spec, conversación con Hermes) sin reconectar a mano

**Criterios de aceptación:**

Pantalla final

- [ ] US-4-001: Al terminar con éxito (todas las etapas superadas), Studio muestra una pantalla de resultado con: ruta del proyecto, lista de apps/libs generadas, resultado del gate («sdd:validate» y «lint test build» en verde) y los próximos pasos sugeridos.
- [ ] US-4-002: La pantalla de resultado ofrece las acciones «Abrir en Studio», «Mostrar en el explorador de archivos» (revelar la carpeta en el sistema) y «Copiar ruta».
- [ ] US-4-003: Los próximos pasos sugeridos incluyen, al menos, abrir el proyecto en Studio, abrir la carpeta en el editor del dev y la nota «Vincular a un repositorio remoto llega en una próxima versión» (sin enlace funcional; es spec-e-burgos-014).
- [ ] US-4-004: Si la generación termina «Generado con errores» (US-3-033), la pantalla final lo dice en el título, muestra el gate en rojo y ofrece las mismas acciones; «Abrir en Studio» sigue disponible pero la advertencia de gate rojo se mantiene visible en el proyecto abierto.

Abrir en Studio

- [ ] US-4-005: «Abrir en Studio» conecta Studio al proyecto nuevo (sin que el dev tenga que lanzar otro bridge a mano ni copiar un token, ver Q-2) y lo muestra como proyecto activo, con su módulo de ciclos, su `#general` y el resto de módulos que Studio ofrece para un repo con `sdd/`.
- [ ] US-4-006: El proyecto abierto aparece con su `#general` existente (creado vacío o con el mensaje de bienvenida del kit) y es el canal seleccionado al llegar.
- [ ] US-4-007: Al abrir, Studio deja en `#general` una idea inicial sugerida para Hermes, derivada de lo elegido (por ejemplo, «Armá la primera spec del módulo <primer módulo> para <apps>»), editable antes de enviarla y no enviada automáticamente. Si el wizard no definió módulos, la sugerencia es «¿Por dónde empezamos? Describí la primera funcionalidad».
- [ ] US-4-008: Si el proyecto abierto no tiene `sdd/` (porque la generación falló antes de crearlo), «Abrir en Studio» no se ofrece y se explica la causa.
- [ ] US-4-009: Abrir el proyecto no reinicia ni reinstala nada ni modifica archivos en disco.
- [ ] US-4-010: Si falla la conexión al abrir (bridge no disponible, puerto ocupado), se muestra un error accionable con «Reintentar» y la ruta del proyecto para abrirlo a mano; la generación ya hecha no se ve afectada.
- [ ] US-4-011: El wizard queda disponible de nuevo desde «Nuevo proyecto» sin necesidad de recargar; el estado del wizard anterior se descarta tras un éxito (se pregunta antes de reusarlo si el usuario vuelve atrás).

**Prioridad:** Alta
**Estimación:** L

---

### US-5: Un solo contrato entre el wizard y la CLI

**Como** dev
**Quiero** que el wizard escriba exactamente el `harness.config.json` que acepta la CLI
**Para** poder repetir, versionar o editar a mano la misma decisión de arquitectura sin sorpresas

**Criterios de aceptación:**

- [ ] US-5-001: El contrato del config que usa el wizard proviene de la CLI (su JSON Schema y/o las reglas de topología), no de una copia propia que pueda divergir; ante un cambio de la CLI el wizard deja de ofrecer lo que la CLI dejó de aceptar sin cambios manuales (ver Q-5).
- [ ] US-5-002: Para toda combinación que el wizard permite generar, `HarnessConfigSchema.parse` de la CLI acepta el config; hay una prueba que recorre al menos: standalone con cada tipo de app permitido, monorepo con `react`+`nestjs`, `nextjs`+`python` con `ml`, `next-bff`+`nestjs`, `mfe-shell`+2 `mfe` y dos `mfe-shell` con `shell` explícito.
- [ ] US-5-003: Para toda combinación que `validateAppTopology` rechaza, el wizard la bloquea antes de llegar a Generar; hay una prueba por cada regla de US-1-032.
- [ ] US-5-004: El wizard solo escribe en el config los campos que el usuario decidió o que tienen valor por defecto explícito del wizard: no agrega `tucuUi: true` por omisión salvo que el resumen lo muestre (el default de la CLI es activo), no agrega `port` si el usuario no lo tocó, y no agrega `ml` ni `shell` fuera de sus tipos.
- [ ] US-5-005: Un config generado por el wizard, copiado a mano a otra carpeta y ejecutado con `harness init --config <archivo> -y` produce una estructura equivalente a la de Studio (misma lista de apps, libs y servicios).
- [ ] US-5-006: El `sdd.author` y los `sdd.modules` solo se escriben si el usuario los definió en el wizard; si no, se omiten y la CLI aplica sus defaults.
- [ ] US-5-007: La versión de la CLI usada para generar queda registrada de forma visible en la pantalla de resultado y en el log (para que el dev sepa con qué versión del kit se generó).

**Prioridad:** Alta
**Estimación:** M

---

## Requisitos funcionales — Wizard «Nuevo proyecto»

### RF-1-WZ: Árbol de decisiones del wizard

**Descripción:** El wizard es una máquina de pasos donde cada paso solo ofrece opciones compatibles con lo elegido antes. Las opciones salen del catálogo de la CLI.
**Reglas de negocio:**

- RN-1: Alcance «Solo front» → apps de back no se piden; «Solo back» → apps de front no se piden; «Full stack» → se piden ambas (mínimo una de cada una).
- RN-2: Modo standalone → una sola app en total, sin libs, sin `next-bff`/`mfe-shell`/`mfe`, y bloqueado si el alcance es «Full stack».
- RN-3: Modo nx → admite varias apps, libs y los tipos de solo monorepo.
- RN-4: `tucuUi` solo en {react, nextjs, next-bff, mfe-shell, mfe}; `ml` solo en `python`; `shell` solo en `mfe`.
- RN-5: Un `mfe` necesita un `mfe-shell`; si hay más de un shell cada `mfe` declara el suyo.
- RN-6: Las recomendaciones son informativas: nunca preseleccionan, nunca bloquean.

**Casos de error:**

- CE-1: Elección que invalida pasos posteriores → confirmación con la lista de descartes (US-1-036); cancelar deja todo intacto.
- CE-2: Estado interno inválido → Generar deshabilitado con errores legibles (US-1-034).

### RF-2-DEST: Carpeta destino y confirmación

**Descripción:** El destino es una ruta absoluta local elegida por el dev. La generación nunca pisa nada sin confirmación explícita.
**Reglas de negocio:**

- RN-7: Inexistente → se crea al generar. Vacía → se genera. Con contenido → confirmación explícita por generación. Sin permiso o archivo → bloqueado.
- RN-8: Rutas relativas, con `..` o vacías se rechazan.
- RN-9: Destino dentro del repo conectado → advertencia y confirmación como carpeta con contenido.
- RN-10: Studio nunca borra ni mueve contenido del destino.

**Casos de error:**

- CE-3: Permiso denegado / ruta es archivo → mensaje con causa, Generar deshabilitado.
- CE-4: Destino cambia entre la comprobación y la generación (alguien crea contenido en medio) → se vuelve a comprobar al iniciar y, si ahora tiene contenido, se pide la confirmación antes de escribir.

### RF-3-GEN: Generación con progreso y gate

**Descripción:** Studio escribe el config en el destino y ejecuta la generación del kit con instalación, `sdd:validate` y `lint test build`, con salida en vivo.
**Reglas de negocio:**

- RN-11: Etapas y orden fijos (US-3-012); el éxito exige las dos marcas del gate.
- RN-12: Una sola generación activa por bridge.
- RN-13: Un fallo en cualquier etapa corta las siguientes y conserva lo escrito.
- RN-14: «Generado con errores» (gate rojo) no es éxito.
- RN-15: El `harness.config.json` queda en el proyecto nuevo.

**Casos de error:**

- CE-5: Sin red en la instalación → fallo en esa etapa; estructura y config en disco; reintento de instalación.
- CE-6: Gate rojo → «Generado con errores», proyecto abrible, errores visibles.
- CE-7: Proceso cortado o equipo apagado → fallo por interrupción; al volver, destino «con contenido» y confirmación para reintentar.
- CE-8: Conexión con el bridge perdida → «Conexión perdida», sin declarar resultado.

### RF-4-OPEN: Resultado y apertura del proyecto

**Descripción:** Al terminar, Studio informa el resultado y permite abrir el proyecto nuevo con su `#general` y una idea para Hermes.
**Reglas de negocio:**

- RN-16: La pantalla final es distinta para éxito, «Generado con errores» y fallo previo a la estructura.
- RN-17: «Abrir en Studio» solo se ofrece si el destino tiene `sdd/`.
- RN-18: La idea inicial para Hermes se sugiere, no se envía sola.
- RN-19: Vincular a un repo remoto no existe en esta versión.

**Casos de error:**

- CE-9: Falla al conectar al proyecto nuevo → error accionable con ruta y «Reintentar»; lo generado no se toca.

---

## Reglas de negocio (consolidadas)

- RB-1: El wizard no depende del repo conectado (decisión del dev, 2026-11-04). Todo lo que necesita se resuelve con el catálogo de la CLI y la ruta destino.
- RB-2: Generar instala dependencias y corre el gate; sin esas etapas el proyecto no se considera terminado (decisión del dev, 2026-11-04).
- RB-3: El `harness.config.json` es registro de la decisión de arquitectura y queda en el proyecto nuevo (decisión del dev, 2026-11-04).
- RB-4: Un solo contrato de config entre wizard y CLI; Studio no define reglas propias de topología.
- RB-5: Seguridad de carpeta: destino explícito; sin confirmación no se pisa contenido; Studio no escribe fuera del destino; Studio no borra.
- RB-6: Independencia: la CLI y el kit no dependen de Studio.
- RB-7: Las recomendaciones guían, no imponen.
- RB-8: Los nombres cumplen kebab-case; los puertos están entre 1000 y 65535 y no se repiten entre apps ni entre apps y servicios.
- RB-9: Standalone = una sola app en la raíz y sin libs; `next-bff`, `mfe-shell` y `mfe` exigen monorepo.
- RB-10: Con perfil `solo` los ciclos futuros son livianos; con `team`, completos. El wizard solo escribe el valor.

---

## Casos borde

- CB-1: Cambiar el alcance o la forma después de definir apps → confirmación con descartes (US-1-036); cancelar conserva todo.
- CB-2: Dos `mfe-shell` y un `mfe` sin `shell` → bloqueado hasta elegir shell.
- CB-3: Eliminar el único `mfe-shell` teniendo `mfe` → los `mfe` quedan sin shell; bloqueo con mensaje.
- CB-4: Cambiar el tipo de una app de `python` a `nestjs` con `ml` activo → `ml` se descarta y se avisa.
- CB-5: Cambiar el tipo de una app de `react` a `nestjs` con `tucuUi: false` → `tucuUi` se descarta y se avisa.
- CB-6: Puerto por defecto ocupado por otra app o servicio → el resumen muestra el puerto resuelto (suma 1); si el usuario fijó un puerto manual que choca, es error (US-1-055).
- CB-7: Nombre de proyecto que coincide con el nombre de la carpeta destino o no coincide → no es requisito que coincidan; el árbol del resumen muestra el nombre del proyecto y la ruta por separado.
- CB-8: Carpeta destino con espacios, acentos o enlaces simbólicos → se aceptan si el sistema operativo las admite; la ruta mostrada es la resuelta.
- CB-9: Destino en una unidad o red sin permiso de escritura → «No se puede escribir» (US-3-007).
- CB-10: Gate en rojo por un test del proyecto generado → «Generado con errores»; Studio no intenta arreglar nada.
- CB-11: Generación cancelada por el usuario durante la instalación → fallo parcial con estructura y config en disco; mismo tratamiento que US-3-031.
- CB-12: Dos pestañas de Studio con el wizard abierto contra el mismo bridge → la segunda ve la generación activa en vez de iniciar otra (US-3-018).
- CB-13: Bridge detenido y reiniciado durante la generación → la generación en curso se considera interrumpida (US-3-034).
- CB-14: Cierre del navegador durante la generación → continúa en el bridge (US-3-017).
- CB-15: Recargar la página en el paso 6 con la confirmación pendiente → la confirmación no se recuerda; se vuelve a pedir.
- CB-16: Proyecto con alcance «Solo back» y modo standalone → válido; Front y su paso no aplican (US-1-011).
- CB-17: Descripción con comillas, saltos de línea o caracteres no ASCII → se escribe de forma segura en el JSON del config sin romperlo.
- CB-18: Pnpm no está instalado en la máquina del dev → falla en «Instalando dependencias» con la causa «pnpm no encontrado» y la sugerencia de instalarlo; el resto igual que US-3-031.
- CB-19: Versión de Node insuficiente para la CLI → falla temprana antes de generar, con la versión requerida.
- CB-20: Dos instancias de Studio generan a la misma carpeta desde bridges distintos → no hay coordinación entre bridges; el chequeo de CE-4 al iniciar reduce el riesgo pero no lo elimina (se documenta).

---

## Preguntas para el arquitecto

- Q-1: El schema de la CLI no tiene un campo «Docker» propio: ¿cómo se expresa en el config la opción Docker del paso 5 (¿solo vía `services[]`, otro campo nuevo en la CLI, o se omite del wizard)? Los criterios US-1-031 y US-2-003 asumen servicios + Docker como parte de ellos.
- Q-2: Cómo arranca el wizard sin un repo con `sdd/` (el bridge hoy exige `sdd/` en `--root` y falla con `BridgeStartError`), y cómo «Abrir en Studio» conecta al proyecto nuevo sin que el dev lance otro bridge y copie otro token (US-1-001, US-4-005, US-4-010).
- Q-3: Cómo invoca el bridge la CLI (versión fijada, `npx` vs. dependencia, cwd = destino), con qué garantía de no acoplar el kit a Studio, y cómo se resuelve que la CLI genera en el cwd y conserva `harness.*` (US-3-001, US-3-011, US-5-007).
- Q-4: «Reintentar instalación» desde la etapa fallida: ¿la CLI puede reanudar sin regenerar, o el reintento corre `pnpm install` y el gate por separado? Define si US-3-031 es reanudable o se reduce a «volver a generar con confirmación».
- Q-5: Cómo obtiene Studio el contrato del config (JSON Schema de `harness config schema` en runtime vs. copia versionada en `libs/studio-protocol`) y cómo se garantiza que las reglas de `validateAppTopology` (que no están en el JSON Schema) se evalúan igual en el wizard (US-5-001 a US-5-003).
- Q-6: Selección de carpeta segura: ¿el selector es del navegador (que no entrega rutas absolutas) o lo resuelve el bridge listando el sistema de archivos? Define US-3-001 y US-3-008, y qué límites tiene el bridge para listar o escribir fuera de un root (US-3-042).
- Q-7: Visibilidad del estado de una generación para US-3-017 y US-3-032: ¿el bridge guarda el estado de la generación y lo reexpone al reconectar, o solo emite eventos efímeros?
- Q-8: Cómo se determina «destino dentro del repo conectado» (US-3-009) cuando no hay repo conectado, y cómo detectar interrupción por proceso cortado (US-3-034).
