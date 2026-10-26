# Functional — Cycle 1: studio-session-metadata

> **Input:** sdd/specs/spec-e-burgos-007-studio-session-metadata/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-007-studio-session-metadata/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

SDD Studio es la interfaz web donde el dev conversa con agentes. Cada conversación (hilo) corre en una sesión real del proveedor de IA, y un puente local conecta la web con esa sesión. Tres huecos de la spec anterior (spec-e-burgos-005) hacen que la web no refleje lo que de verdad pasó en la conversación:

- La web muestra el identificador de la sesión pero no su **título**, el mismo que el dev ve al retomar la sesión en el proveedor.
- Una conversación admite **una sola** asociación (a una spec, un ciclo o un fix), aunque en la práctica toca varias.
- Los **documentos** de la conversación se deducen por heurística de las herramientas de edición; lo que escribe un script lanzado por consola no aparece. Caso real: `planner.md` y `tasks.json` generados por `/tmp/gen-planner.mjs` quedaron sin autor visible.

Este ciclo hace que la web muestre el título real (o diga con honestidad que no hay), conserve todas las asociaciones de forma persistente y vea todos los documentos tocados, incluidos los escritos por scripts, sin romper los hilos existentes ni la convivencia entre versiones nuevas y viejas de web y puente.

Fuera de alcance: renombrar sesiones desde la web, otros proveedores, vigilar escrituras fuera de `sdd/` durante comandos de consola, y los FIX-e-burgos-005-001..011 (los revisa el reviewer; no se reabren).

## Historias de usuario

### US-1-001: Ver el título real de la sesión

**Como** dev
**Quiero** ver en la conversación el título que el proveedor le asignó a la sesión
**Para** reconocer la conversación sin leer su identificador

**Trazabilidad:** US-1, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-001: Si la sesión tiene título personalizado, la información de sesión de la conversación muestra ese título.
- [ ] CA-002: Si no tiene título personalizado pero sí un resumen, se muestra el resumen como título.
- [ ] CA-003: Si no hay título personalizado ni resumen, o la lectura falla, la información de sesión indica explícitamente "sin título disponible"; no se muestra ningún texto inventado (ni el primer mensaje, ni el id disfrazado de título, ni un placeholder que parezca un título).
- [ ] CA-004: Cuando el título aparece o cambia durante la vida del hilo, la web lo refleja sin recargar la página.
- [ ] CA-005: Un fallo al obtener el título nunca interrumpe ni retrasa la conversación (el hilo sigue operativo y el resto de la información de sesión se muestra igual).

### US-2-001: Asociaciones múltiples y persistentes

**Como** dev
**Quiero** que una conversación quede asociada a todas las specs, ciclos y fixes que toca, y que no se pierdan al reiniciar
**Para** encontrar la conversación desde cualquiera de los elementos con los que trabajó

**Trazabilidad:** US-2, CA-2 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-006: Un hilo puede tener varias asociaciones (specs, ciclos y fixes mezclados); la web las lista todas y la conversación aparece en las vistas relacionadas de cada una.
- [ ] CA-007: Cada asociación indica su origen: detectada automáticamente o puesta manualmente por el dev.
- [ ] CA-008: Tras reiniciar el puente, el hilo conserva exactamente las mismas asociaciones, con el mismo origen cada una.
- [ ] CA-009: El dev puede quitar una asociación detectada; tras quitarla no reaparece por la detección automática mientras el dev no la vuelva a agregar y la quitada sigue ausente tras reiniciar el puente.
- [ ] CA-010: El dev puede agregar y quitar asociaciones manuales; una manual nunca es reemplazada ni eliminada por la detección automática.
- [ ] CA-011: Una asociación que apunta a un elemento que ya no existe se muestra como no disponible (no se oculta en silencio ni rompe la vista) y el dev puede quitarla.
- [ ] CA-012: Un registro de hilos guardado antes de este ciclo (una sola asociación) se carga sin pérdida: su única asociación pasa a ser parte de la lista, conserva su origen y el hilo se comporta como antes.

### US-3-001: Ver todos los documentos que generó la conversación

**Como** dev
**Quiero** ver todos los documentos que generó la conversación, también los escritos por consola o por scripts, con su autor
**Para** saber qué produjo cada agente sin revisar el historial a mano

**Trazabilidad:** US-3, CA-3, CA-4 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-013: Cuando un agente crea, modifica o elimina un documento con las herramientas de edición, la conversación registra ese documento tocado con ruta, tipo de operación y autor.
- [ ] CA-014: Cuando un comando de consola (p. ej. un script) crea o modifica un archivo dentro de `sdd/`, la conversación registra ese documento tocado con el agente que ejecutó el comando como autor.
- [ ] CA-015: Caso real: tras un script que genera `planner.md` y `tasks.json` de un ciclo, ambos aparecen en los documentos de la conversación con su autor.
- [ ] CA-016: Un comando de consola que no cambia nada dentro de `sdd/` no produce ningún documento tocado.
- [ ] CA-017: Un archivo tocado varias veces aparece una sola vez en la lista de documentos, con su última operación; el orden de la actividad se conserva.
- [ ] CA-018 (enmendado 2026-10-26): Para un hilo con al menos un documento tocado estructurado, la web usa esos registros como fuente de la actividad posterior al primero de ellos y el criterio actual para la anterior; los documentos previos a la actualización no desaparecen y ninguno aparece duplicado.
- [ ] CA-019: Para un hilo anterior al ciclo (sin ningún documento tocado estructurado), la web sigue deduciendo los documentos con el criterio actual y la lista es la misma que antes de este ciclo.
- [ ] CA-020: Un documento nunca aparece duplicado por provenir a la vez del registro estructurado y del criterio actual.
- [ ] CA-021: El resumen de un comando de consola se recorta con un criterio que no corta información identificatoria (rutas de documentos) a la mitad y respeta el límite de tamaño de mensaje del canal; el recorte es visible como tal (indicador de truncado).

### US-4-001: Convivencia de versiones web y puente

**Como** dev
**Quiero** poder actualizar la web y el puente por separado
**Para** no quedar bloqueado si una de las dos partes está en una versión anterior

**Trazabilidad:** CA-5, CA-6 de la spec (tratada como parte de US-1..US-3: sin esto ninguna historia es entregable).
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-022: Web nueva con puente viejo: la conversación funciona; sin título la información de sesión muestra "sin título disponible", las asociaciones se muestran con la única que el puente conoce y los documentos se obtienen por el criterio actual. No hay errores visibles.
- [ ] CA-023: Web vieja con puente nuevo: la conversación funciona; la web ignora lo que no conoce y puede seguir usando la asociación única de siempre sin errores ni pérdida de datos en el puente.
- [ ] CA-024: La web nueva informa al dev, sin bloquear, qué capacidades no están disponibles cuando el puente es viejo (título, documentos de consola, asociaciones múltiples), en lugar de mostrar datos vacíos como si fueran verdad.
- [ ] CA-025: Una web vieja que edita la asociación única de un hilo con varias no destruye las demás asociaciones guardadas por el puente nuevo.
- [ ] CA-026: Las pruebas y la verificación de tipos pasan en los tres subproyectos afectados (protocolo, puente, web).

## Requisitos funcionales

### RF-01: Título de sesión

**Origen:** spec § US-1; CA-1.
**Descripción:** El sistema obtiene el título de la sesión del proveedor y lo muestra en la información de sesión de la conversación.
**Reglas de negocio:**

- RN-01: Fuente del título, en orden: título personalizado de la sesión; si no existe, resumen de la sesión; si tampoco existe, no hay título.
- RN-02: El título se consulta cuando la sesión se conoce y se vuelve a consultar cuando puede haber cambiado (p. ej. al terminar un turno), publicándose solo si el valor cambió.
- RN-03: "Sin título" es un estado explícito y honesto; nunca se sustituye por el primer mensaje, el id ni texto generado por el sistema.
- RN-04: Un título vacío o solo espacios cuenta como ausente.
- RN-05: Un título excesivamente largo se muestra acotado, sin alterar el valor almacenado.
- RN-06: Solo lectura: renombrar la sesión desde la web queda fuera de alcance.

**Casos de error:**

- CE-01: Si el archivo de la sesión aún no existe (sesión recién creada, sin turnos) o no se puede leer, el hilo queda sin título, sin error visible, y se reintenta en la siguiente consulta.
- CE-02: Si la consulta del título tarda o falla, la conversación no se bloquea; se registra el fallo y se mantiene el último título conocido, si lo hubiera.
- CE-03: Si el proveedor no soporta títulos (otro motor en el futuro), el hilo queda sin título.

### RF-02: Asociaciones múltiples con origen

**Origen:** spec § US-2; CA-2.
**Descripción:** Un hilo mantiene una lista de asociaciones a specs, ciclos y fixes, cada una marcada como detectada o manual.
**Reglas de negocio:**

- RN-07: Detectada = deducida por el sistema a partir de lo que la conversación toca. Manual = elegida por el dev. El origen se guarda por asociación, no por hilo.
- RN-08: Si el dev agrega manualmente algo que ya estaba detectado, pasa a ser manual y deja de ser removible por la detección.
- RN-09: El dev puede quitar cualquier asociación, detectada o manual. Quitar una detectada la marca como descartada: la detección no la vuelve a agregar, y el descarte persiste.
- RN-10: No hay asociaciones repetidas: la misma spec, ciclo o fix aparece una sola vez por hilo.
- RN-11: Una asociación a un ciclo o fix implica su spec de origen; mostrar la spec no cuenta como asociación adicional.
- RN-12: Cuando la lista múltiple existe, es la fuente de verdad; la asociación única de versiones anteriores se mantiene como compatibilidad y refleja una de las asociaciones de la lista (la más reciente agregada) o ninguna si la lista está vacía.
- RN-13: Las asociaciones persisten entre reinicios del puente.

**Casos de error:**

- CE-04: Si se intenta asociar un elemento inexistente, se rechaza con un mensaje claro y la lista no cambia.
- CE-05: Si el registro persistido está corrupto o ilegible, el sistema no descarta los hilos válidos y avisa al dev; no pierde asociaciones de otros hilos.
- CE-06: Si el dev quita una asociación que ya no está (carrera entre pestañas), la operación es idempotente: sin error y con el estado final correcto.
- CE-07: Si dos pestañas modifican las asociaciones a la vez, ambas terminan viendo el mismo estado final persistido.

### RF-03: Migración de hilos existentes

**Origen:** spec § US-2; CA-2.
**Descripción:** Los hilos guardados antes del ciclo pasan al modelo de asociaciones múltiples sin intervención del dev.
**Reglas de negocio:**

- RN-14: Un hilo con una única asociación pasa a tener una lista de un elemento, con el mismo origen que tenía.
- RN-15: Un hilo sin asociación pasa a lista vacía.
- RN-16: La migración es idempotente y no requiere acción manual.
- RN-17: Ningún campo previo se pierde.

**Casos de error:**

- CE-08: Si una asociación vieja apunta a algo que ya no existe, se migra igualmente y se muestra como no disponible (ver CA-011); la migración no falla.

### RF-04: Documentos tocados como registro estructurado

**Origen:** spec § US-3; CA-3.
**Descripción:** Cada vez que un agente de la conversación crea, modifica o elimina un documento, el sistema registra un hecho estructurado en el hilo con ruta, operación, autor y orden.
**Reglas de negocio:**

- RN-18: Cuenta como documento tocado: un archivo cuya creación, modificación o eliminación realizó el agente mediante las herramientas de edición, o un archivo dentro de `sdd/` que cambió durante la ejecución de un comando de consola de ese agente.
- RN-19: El autor es el agente que ejecutó la herramienta o el comando.
- RN-20: Operación posible: creado, modificado o eliminado.
- RN-21: Cada registro lleva un número de orden creciente dentro del hilo; el orden resultante coincide con el orden real de ocurrencia.
- RN-22: Las escrituras fuera de `sdd/` durante comandos de consola no se detectan (fuera de alcance); las hechas con herramientas de edición sí se registran en cualquier ruta.
- RN-23: Un cambio hecho por otra persona o proceso mientras el agente no ejecuta nada no se atribuye al agente.
- RN-24: Con agentes concurrentes en el mismo hilo, un cambio se atribuye al agente cuyo comando estaba en ejecución; si no puede determinarse con certeza, se atribuye al hilo sin autor específico, nunca a un agente al azar.

**Casos de error:**

- CE-09: Si la detección de cambios de un comando falla (p. ej. permisos), el comando sigue su curso normal; el sistema pierde ese registro pero no interrumpe al agente ni inventa documentos.
- CE-10: Si el repositorio tiene muchísimos archivos en `sdd/`, la detección no debe volver perceptiblemente lento un comando; si no puede completarse en tiempo razonable, se omite y se registra.
- CE-11: Comandos de larga duración o cancelados: lo ya cambiado hasta ese momento se registra; no quedan registros a medias.

### RF-05: Resumen de comandos de consola

**Origen:** spec § US-3, "revisar el recorte de 160 caracteres".
**Descripción:** El resumen que se muestra de un comando de consola no pierde información relevante para entender qué hizo.
**Reglas de negocio:**

- RN-25: El recorte conserva el inicio del comando y las rutas de documentos referenciadas cuando entran en el límite; se indica visiblemente que hubo recorte.
- RN-26: El límite total respeta el máximo de tamaño de un mensaje del canal.
- RN-27: El resumen nunca reemplaza al registro estructurado: el documento tocado se determina por RF-04, no por interpretar el texto del comando.

**Casos de error:**

- CE-12: Un comando con texto muy largo o multilínea produce un resumen válido y acotado, sin romper el mensaje.

### RF-06: Precedencia entre registro estructurado y criterio actual

**Origen:** spec § US-3; CA-4.
**Descripción:** La web decide de qué fuente obtiene los documentos de cada hilo.
**Reglas de negocio:**

- RN-28 (enmendado 2026-10-26): En un hilo con documentos tocados estructurados, la lista se parte por orden de actividad en el corte del primer documento tocado estructurado: la actividad anterior al corte usa el criterio actual (RN-29) y la posterior usa solo los registros estructurados. Nunca se mezclan fuentes para un mismo tramo; un documento no se duplica ni se pierde por el cambio de fuente.
- RN-29: Si el hilo no tiene ninguno (hilos anteriores al ciclo o puente viejo), se usa el criterio actual (deducción desde las herramientas de edición de FIX-e-burgos-005-006).
- RN-30: Un hilo nuevo que aún no produjo documentos muestra una lista vacía honesta, no una deducción inventada.
- RN-31: No se mezclan ambas fuentes en una misma lista, para evitar duplicados y autores contradictorios.
- RN-32: El autor mostrado es el del registro estructurado; el criterio actual conserva el suyo.

**Casos de error:**

- CE-13: Si el historial de un hilo se recorta o se reconecta a mitad de conversación, los registros ya recibidos no se duplican al reaparecer y el orden se mantiene.

### RF-07: Compatibilidad entre versiones

**Origen:** spec CA-5, CA-6.
**Descripción:** Web y puente de versiones distintas siguen funcionando.
**Reglas de negocio:**

- RN-33: Todo dato nuevo es opcional para quien no lo conoce; quien no lo conoce lo ignora sin fallar.
- RN-34: La web detecta qué capacidades ofrece el puente y degrada de forma explícita (CA-024).
- RN-35: Un puente nuevo que recibe pedidos de una web vieja (asociación única) los interpreta sin perder las demás asociaciones (CA-025).
- RN-36: Si se decide cambiar la versión del protocolo, el comportamiento ante un par incompatible sigue siendo el mensaje de incompatibilidad ya existente, nunca un fallo silencioso (decisión del architect; este requisito solo exige que no sea silencioso).

**Casos de error:**

- CE-14: Si la web recibe un dato con forma inesperada (campo nuevo mal formado), ignora ese dato y mantiene el resto de la conversación operativa.

## Reglas de negocio transversales

1. Honestidad de estado: lo que no se sabe se muestra como no disponible; el sistema nunca inventa títulos, autores, asociaciones ni documentos.
2. Persistencia: las decisiones del dev (asociar, quitar) sobreviven a reinicios y no son pisadas por la detección automática.
3. Compatibilidad hacia atrás: ningún hilo, registro ni versión anterior queda inutilizable por este ciclo.
4. Un documento, una entrada: sin duplicados entre fuentes ni entre toques repetidos.
5. Alcance acotado: solo `sdd/` para detección por consola; solo el proveedor actual.

## Trazabilidad CA de la spec

| CA spec | CA funcionales |
| ------- | -------------- |
| CA-1 | CA-001..CA-005 |
| CA-2 | CA-006..CA-012 |
| CA-3 | CA-013..CA-017, CA-021 |
| CA-4 | CA-018..CA-020 |
| CA-5 | CA-022..CA-025 |
| CA-6 | CA-026 |

## Glosario del dominio

| Término | Definición |
| ------- | ---------- |
| Hilo | Conversación del dev con agentes en Studio; tiene una sesión del proveedor. |
| Título de sesión | Nombre que el proveedor asigna a la sesión (el que se ve al retomarla). |
| Asociación | Vínculo de un hilo con una spec, un ciclo o un fix. |
| Detectada / manual | Asociación deducida por el sistema / elegida por el dev. |
| Descartada | Asociación detectada que el dev quitó; no se vuelve a detectar. |
| Documento tocado | Registro estructurado de un archivo creado, modificado o eliminado, con ruta, operación, autor y orden. |
| Criterio actual | Deducción de documentos desde las herramientas de edición (FIX-e-burgos-005-006), usada en hilos sin registros estructurados. |
| Puente | Proceso local que conecta la web con las sesiones del proveedor. |
