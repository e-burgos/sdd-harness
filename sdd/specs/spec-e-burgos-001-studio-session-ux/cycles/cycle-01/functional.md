# Functional — Cycle 1: studio-session-ux

> **Input:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional
> **Spec:** sdd/specs/spec-e-burgos-001-studio-session-ux/spec-e-burgos-001-studio-session-ux.spec.md

---

## Contexto de negocio

SDD Studio es la interfaz web, estilo Slack, con la que un desarrollador opera agentes SDD sobre su
repositorio local a través de un puente que corre en su máquina. Hoy el desarrollador:

- reaprueba una y otra vez las mismas acciones del agente en modo `ask`, porque "Always" casi no
  recuerda nada;
- no ve sus conversaciones organizadas por el trabajo SDD que las originó (spec, ciclo, fix) ni sabe
  qué hilos están corriendo o esperando su aprobación;
- no percibe con claridad que un agente está trabajando y tropieza con problemas de scroll;
- no puede escribirle al agente mientras trabaja: recibe un error de "hilo ocupado" y debe interrumpir
  para corregir el rumbo;
- (cycle-02) solo puede enviar texto plano: no puede mostrar capturas, PDF o archivos, ni apuntar al
  agente a un archivo, subagente o skill sin tipear nombres a mano.

**Corte de ciclos (decisión del dev):** esta spec se entrega en dos ciclos.

- **cycle-01 (este documento):** HU-4..HU-10, más los contratos de protocolo de toda la spec con un
  único bump de versión y el paso del puente a prompt streaming (lo exige HU-10). Las historias
  HU-1..HU-3 no se implementan aquí.
- **cycle-02:** HU-1, HU-2 y HU-3, resumidas al final de este documento como referencia.

Las decisiones del dev están cerradas (`resolved_decisions` del brief) y no se reabren aquí. Las dos
preguntas abiertas del brief (cuántos fixes cerrados son "los últimos"; cómo se sirven los adjuntos
al recargar) son del Arquitecto.

Actor único: **el desarrollador** (dev) que usa el Studio. No hay otros roles ni credenciales en la web.

## Mapa de trazabilidad

| Historia | Ciclo | RF (spec)              | CA (spec)               | RNF relacionados           |
| -------- | ----- | ---------------------- | ----------------------- | -------------------------- |
| HU-4     | 01    | RF-7, RF-8, RF-18      | CA-006, CA-016          | RNF-1                      |
| HU-5     | 01    | RF-9                   | CA-007                  | —                          |
| HU-6     | 01    | RF-10, RF-11           | CA-008, CA-009          | RNF-1                      |
| HU-7     | 01    | RF-12                  | CA-010                  | —                          |
| HU-8     | 01    | RF-13                  | CA-011                  | RNF-6                      |
| HU-9     | 01    | RF-14                  | CA-012                  | —                          |
| HU-10    | 01    | RF-15, RF-16, RF-17, RF-19 | CA-013, CA-014, CA-015, CA-016 | RNF-1, RNF-7, RNF-3 |
| HU-1     | 02    | RF-1..RF-4, RF-20      | CA-001, CA-002, CA-003, CA-016 | RNF-1, RNF-3, RNF-4, RNF-5 |
| HU-2     | 02    | RF-5                   | CA-004                  | RNF-5                      |
| HU-3     | 02    | RF-5, RF-6             | CA-005                  | RNF-5                      |

Transversal a todo el documento: RNF-8 (tests vitest en los tres subproyectos; `pnpm typecheck && pnpm test` en verde).

Convención de CA: los `CA-001..CA-016` son los criterios de la spec y las claves que usará el
Reviewer; los criterios finos de cada historia se numeran `CA-NNN.k` (sub-criterio `k` del `CA-NNN`
de la spec) y cada uno es PASS/FAIL con evidencia observable.

---

## Flujos de usuario principales

### F-C. Navegación SPECS → ciclo → hilos y FIXES → hilos (HU-4, HU-5)

1. En el Sidebar, CANALES no lista los canales `spec:*`; SPECS lista todas las specs (incluidas completadas); cada spec despliega sus ciclos;
   cada ciclo despliega sus conversaciones. FIXES lista los fixes abiertos más los últimos cerrados;
   cada fix despliega sus conversaciones.
2. Un clic en un hilo lo abre; la selección queda marcada en el Sidebar.
3. Al crear un hilo, queda asociado automáticamente (ciclo in-progress de la spec del canal, o fix
   abierto). Desde el hilo, el dev puede reasignarlo a otro ciclo o fix.
4. Los hilos anteriores a esta función quedan asociados según su canal.
5. Cada sección y subsección (CANALES, AGENTES, SPECS, FIXES y sus hijos) se colapsa y expande con un
   clic en su encabezado, sin perder el resto de la navegación.

### F-D. "Always" por alcance (HU-6)

1. El agente pide permiso; la tarjeta muestra Approve, Always y Deny, y deja explícito qué regla
   recordaría Always (p. ej. "Edit en este hilo", "mcp__srv__tool", "comandos que empiezan con `git status`").
2. El dev elige Always: se ejecuta la acción y las siguientes acciones cubiertas por esa regla, en ese
   hilo, no vuelven a preguntar.
3. Una acción fuera de la regla (otra herramienta, otra tool MCP, otro prefijo Bash) vuelve a preguntar.
4. Un `warn` del SPEC GATE siempre pregunta y un `deny` siempre bloquea, exista o no la regla.

### F-E. Hilos activos y estado de trabajo (HU-7, HU-8)

1. El Sidebar muestra una sección de hilos activos (`running`, `waiting-approval`, `queued`) que se
   actualiza en vivo; un hilo que pasa a idle/interrupted/error sale de la lista.
2. Cada hilo activo, en la lista de hilos del canal y en el avatar del agente muestra un indicador
   animado; "corriendo" y "esperando aprobación" se distinguen sin depender solo del color.
3. Con `prefers-reduced-motion` activo, los indicadores no animan y conservan la diferencia de estado.

### F-F. Scroll (HU-9)

1. Mientras llegan mensajes o texto en streaming, el hilo sigue el final si el dev está al fondo.
2. Si el dev scrolleó hacia arriba, el hilo no lo mueve; aparece una forma de volver al final.
3. Sidebar, panel derecho y lista de hilos del canal scrollean completos, sin contenido cortado.

**Cambios de este corte en F-C:** los canales por spec (`spec:*`) no aparecen en CANALES; viven solo
bajo SPECS. Al cambiar de hilo, el Composer conserva el borrador de texto de cada hilo mientras la
página siga abierta (se pierde al recargar).

### F-G. Escribir mientras la sesión trabaja (HU-10)

1. El hilo está `running` (o `waiting-approval`). El Composer sigue habilitado: el dev escribe una
   corrección o un dato nuevo y envía, sin interrumpir.
2. El mensaje aparece al instante en el hilo marcado como **pendiente**, con controles para editarlo y
   quitarlo. El turno en curso no se detiene.
3. La sesión termina el tool en curso y lee el mensaje en el próximo punto de corte del turno, con
   urgencia, antes de seguir. En ese momento el mensaje pasa a **entregado**: ya no se edita ni se quita.
4. Mientras el mensaje está pendiente el dev puede editarlo o quitarlo; si el mensaje se entregó justo
   antes, la acción falla con un aviso claro y el mensaje queda entregado.
5. Si el turno termina o el dev interrumpe con mensajes pendientes, no se pierden: se entregan como el
   siguiente turno o quedan visibles como pendientes tras el interrupt.
6. Si el hilo espera una aprobación, el dev puede seguir encolando; los mensajes no resuelven ni
   saltean la aprobación.
7. El estado `queued` del hilo (hilo esperando turno por un recurso compartido) es otra cosa y se ve
   distinto: no se rotula como mensaje pendiente.

---


## Historias de usuario (cycle-01)

### HU-4: Navegar conversaciones por spec → ciclo y por fix

**Como** desarrollador
**Quiero** ver en el menú lateral las specs con sus ciclos y los fixes, cada uno con sus conversaciones
**Para** encontrar y retomar las conversaciones del trabajo SDD que me interesa

**Criterios de aceptación:**

- [ ] CA-006.1: El Sidebar tiene las secciones SPECS y FIXES además de CANALES y AGENTES.
- [ ] CA-006.2: SPECS lista todas las specs, incluidas las completadas; cada spec lista sus ciclos y cada ciclo lista sus conversaciones.
- [ ] CA-006.3: FIXES lista los fixes abiertos y los últimos cerrados (la cantidad la define el Arquitecto); cada fix lista sus conversaciones.
- [ ] CA-006.4: Dado un hilo creado en el canal de una spec con un ciclo in-progress, entonces el hilo queda asociado a ese ciclo y aparece bajo él; dado un hilo creado para un fix abierto, aparece bajo ese fix.
- [ ] CA-006.5: Desde el hilo, el dev puede reasignarlo a otro ciclo o fix; tras reasignar, el hilo aparece bajo el nuevo destino y deja el anterior, también en otra pestaña o tras recargar.
- [ ] CA-006.6: Los hilos previos a la función quedan visibles asociados por su canal; ninguno desaparece del menú.
- [ ] CA-006.7: Un clic en un hilo del árbol lo abre y lo marca como seleccionado.
- [ ] CA-006.8: Estados vacíos: spec sin ciclos, ciclo o fix sin conversaciones y la ausencia total de specs/fixes muestran un texto vacío explícito (no una sección en blanco).
- [ ] CA-006.9: Si el estado SDD cambia en disco mientras el Studio está abierto (nuevo ciclo, fix cerrado), el árbol se actualiza en vivo.
- [ ] CA-006.10: Cuando no hay ciclo in-progress ni fix abierto que asignar al crear un hilo, el hilo queda asociado a su canal (sin ciclo) y es visible en el árbol; no se bloquea la creación.
- [ ] CA-016.1: CANALES no muestra ningún canal `spec:*`; las conversaciones de esas specs se alcanzan solo bajo SPECS → ciclo, y ningún hilo existente deja de ser accesible por ese cambio.
- [ ] CA-006.11: Si falla la reasignación, el hilo conserva su asociación anterior y se muestra el error.

**Prioridad:** Alta
**Estimación:** XL

---

### HU-5: Colapsar y expandir secciones del menú

**Como** desarrollador
**Quiero** colapsar y expandir cada sección y subsección del menú lateral
**Para** mantener visible solo lo que estoy usando en un árbol que crece

**Criterios de aceptación:**

- [ ] CA-007.1: Cada sección (CANALES, AGENTES, SPECS, FIXES, hilos activos) y cada subsección (spec, ciclo, fix) tiene un control en su encabezado que alterna colapsado/expandido, con indicación visual del estado y operable por teclado.
- [ ] CA-007.2: Colapsar una sección oculta todo su contenido sin afectar a las demás ni al hilo abierto.
- [ ] CA-007.3: Si el hilo abierto está dentro de una sección colapsada, la sección conserva una señal visible de que contiene la selección.
- [ ] CA-007.4: El estado de colapso se conserva al navegar entre hilos y canales durante la sesión.
- [ ] CA-007.5: Un hilo que requiere atención (waiting-approval) dentro de una sección colapsada sigue siendo visible en el Sidebar (vía HU-7 o indicador en el encabezado).

**Prioridad:** Media
**Estimación:** S

---

### HU-6: "Always" por herramienta, tool MCP o prefijo de comando

**Como** desarrollador que trabaja en modo `ask`
**Quiero** que "Always" recuerde una regla útil y entendible
**Para** dejar de reaprobar lo mismo sin abrir la puerta a todo

**Criterios de aceptación:**

- [ ] CA-008.1: Dado Edit, Write, MultiEdit o NotebookEdit, cuando el dev elige Always, entonces las siguientes ejecuciones de esa misma herramienta en ese hilo no muestran tarjeta; las otras herramientas de edición siguen preguntando.
- [ ] CA-008.2: Dada una tool MCP `mcp__srv__tool`, cuando el dev elige Always, entonces solo esa tool queda permitida en el hilo; otra tool del mismo servidor sigue preguntando.
- [ ] CA-008.3: Dado un comando Bash, cuando el dev elige Always, entonces los comandos con el mismo prefijo que se le mostró quedan permitidos en el hilo; un comando con otro prefijo sigue preguntando.
- [ ] CA-008.4: La tarjeta de aprobación indica antes de elegir qué regla recordaría Always (herramienta, tool MCP o prefijo), y ese texto coincide con la regla efectivamente aplicada.
- [ ] CA-008.5: La regla vale solo para el hilo donde se concedió y mientras ese hilo viva en el puente; otro hilo sigue preguntando, y tras reiniciar el puente el hilo vuelve a preguntar.
- [ ] CA-008.6: Approve (una vez) sigue sin guardar ninguna regla; Deny sigue rechazando la acción.
- [ ] CA-009.1: Dado un hilo con Always sobre Edit, cuando el SPEC GATE devuelve `warn` para una edición, entonces se muestra la tarjeta de aprobación con el aviso del gate y la edición no se ejecuta hasta decidir.
- [ ] CA-009.2: Dado un hilo con cualquier Always, cuando el SPEC GATE devuelve `deny`, entonces la acción se bloquea sin tarjeta y sin ejecutarse.
- [ ] CA-009.3: Elegir Always sobre una tarjeta con aviso `warn` aprueba esa acción pero no guarda ninguna regla que silencie futuros `warn`.
- [ ] CA-009.4: Las reglas del gate (qué es warn y qué es deny) no cambian con este ciclo.

**Prioridad:** Alta
**Estimación:** L

---

### HU-7: Ver los hilos activos en el Sidebar

**Como** desarrollador
**Quiero** ver en el Sidebar qué hilos están corriendo, esperando mi aprobación o en cola
**Para** saber de un vistazo dónde pasa algo y saltar a ese hilo

**Criterios de aceptación:**

- [ ] CA-010.1: El Sidebar muestra una lista de hilos activos con exactamente los estados `running`, `waiting-approval` y `queued`; cada ítem muestra título, agente y estado.
- [ ] CA-010.2: Cuando un hilo cambia de estado, entra o sale de la lista en vivo, sin recargar.
- [ ] CA-010.3: Un clic en un hilo activo abre ese hilo (incluso si pertenece a otro canal).
- [ ] CA-010.4: Los hilos `waiting-approval` se distinguen y se muestran antes que los `running` y `queued`.
- [ ] CA-010.5: Estado vacío: sin hilos activos la sección muestra "Sin hilos activos".
- [ ] CA-010.6: Tras recargar la página con hilos activos en el puente, la lista se reconstruye con el estado vigente.
- [ ] CA-010.7: Si se pierde la conexión con el puente, la lista indica que el estado puede estar desactualizado en lugar de mostrar datos como vigentes.

**Prioridad:** Alta
**Estimación:** M

---

### HU-8: Indicadores animados de trabajo

**Como** desarrollador
**Quiero** ver indicadores animados cuando un agente trabaja o espera mi aprobación
**Para** saber de inmediato quién está activo y quién me necesita

**Criterios de aceptación:**

- [ ] CA-011.1: Mientras un hilo está `running`, se ve un indicador animado (typing dots, shimmer o spinner) en el propio hilo, en su fila de la lista de hilos y en el avatar del agente.
- [ ] CA-011.2: Mientras está `waiting-approval`, se ve un indicador distinto al de `running` en los tres lugares, distinguible por forma o texto y no solo por color.
- [ ] CA-011.3: Cuando el hilo pasa a idle, interrupted o error, los indicadores desaparecen en los tres lugares.
- [ ] CA-011.4: Con `prefers-reduced-motion: reduce`, ningún indicador anima; se muestran estáticos y la diferencia running / waiting-approval se mantiene.
- [ ] CA-011.5: Un hilo `queued` muestra un indicador propio (estático o animado suave) distinguible de running y waiting-approval.
- [ ] CA-011.6: Los indicadores no desplazan ni redimensionan el contenido de la fila, el hilo o el avatar al aparecer y desaparecer.

**Prioridad:** Media
**Estimación:** M

---

### HU-9: Scroll correcto en hilo, paneles y Sidebar

**Como** desarrollador
**Quiero** que el scroll funcione bien en el hilo, los paneles y el menú lateral
**Para** leer y navegar sin perder contenido ni quedar descolocado

**Criterios de aceptación:**

- [ ] CA-012.1: Dado el hilo al fondo, cuando llegan mensajes, texto en streaming o un adjunto, entonces el hilo se mantiene al fondo (incluyendo contenido que cambia de altura al cargar, como imágenes).
- [ ] CA-012.2: Dado que el dev scrolleó hacia arriba, cuando llegan mensajes, entonces la posición no se mueve y se ofrece un control para volver al final.
- [ ] CA-012.3: Al enviar un mensaje propio, el hilo va al final.
- [ ] CA-012.4: Al abrir un hilo existente, se posiciona en el final.
- [ ] CA-012.5: Con el árbol SPECS/FIXES y la lista de hilos activos desplegados, el Sidebar scrollea y todo su contenido es alcanzable; el encabezado y el pie del Sidebar no se desplazan fuera de vista.
- [ ] CA-012.6: El panel derecho y la lista de hilos del canal scrollean completos con listas largas, sin contenido cortado ni scroll doble anidado.
- [ ] CA-012.7: El implementor deja registrados los problemas de scroll reproducidos antes de corregirlos; cada uno corregido tiene una verificación.

**Prioridad:** Media
**Estimación:** M

---

### HU-10: Escribir al hilo mientras la sesión trabaja (mensajes encolados)

**Como** desarrollador que ve al agente tomar un rumbo equivocado
**Quiero** enviarle un mensaje sin interrumpirlo y que lo lea en cuanto pueda
**Para** corregir o completar la instrucción en medio del turno sin perder el trabajo en curso

**Criterios de aceptación:**

- [ ] CA-013.1: Dado un hilo `running`, cuando el dev envía un mensaje, entonces el envío se acepta (no hay error de "hilo ocupado"), el turno en curso no se interrumpe y el mensaje aparece en el hilo como pendiente.
- [ ] CA-013.2: Dado un mensaje pendiente, cuando termina el tool en curso, entonces el modelo recibe el mensaje en ese punto de corte, antes del fin del turno, y el mensaje pasa a entregado en la UI.
- [ ] CA-013.3: Dado un mensaje enviado con el hilo `waiting-approval`, entonces se acepta y queda pendiente sin resolver ni saltear la aprobación; se entrega en el primer punto de corte posterior a esa decisión.
- [ ] CA-013.4: Dados varios mensajes pendientes, se entregan en el orden en que se enviaron y cada uno se muestra pendiente o entregado de forma independiente.
- [ ] CA-013.5: Sin mensajes pendientes el comportamiento de envío sobre un hilo ocioso no cambia (inicia un turno normal).
- [ ] CA-013.6: El estado de cada mensaje (pendiente/entregado) sigue correcto tras recargar la página y desde otra pestaña, porque la fuente de verdad es el puente.
- [ ] CA-014.1: Un mensaje pendiente se puede editar: el texto nuevo reemplaza al anterior y es el que recibe el modelo.
- [ ] CA-014.2: Un mensaje pendiente se puede quitar: desaparece del hilo y el modelo nunca lo recibe.
- [ ] CA-014.3: Un mensaje entregado no ofrece editar ni quitar; si el dev intenta hacerlo justo después de la entrega (carrera), la acción falla con un mensaje claro y el mensaje permanece como entregado sin cambios.
- [ ] CA-014.4: Editar un mensaje pendiente a texto vacío no está permitido (se puede quitar en su lugar).
- [ ] CA-015.1: Dado un turno que termina con mensajes pendientes, entonces esos mensajes se entregan como el siguiente turno, en orden, sin duplicarse y sin perderse.
- [ ] CA-015.2: Dado que el dev interrumpe con mensajes pendientes, entonces los mensajes no se pierden: quedan visibles como pendientes (o se entregan como siguiente turno) y siguen pudiendo editarse o quitarse mientras estén pendientes.
- [ ] CA-015.3: Dado un error del turno con mensajes pendientes, los mensajes no se pierden ni se duplican.
- [ ] CA-015.4: Si la conexión con el puente se pierde mientras hay pendientes, al reconectar la UI muestra el estado real de cada mensaje (ninguno se entrega dos veces).
- [ ] CA-015.5: El estado `queued` del hilo (en espera de turno) no se usa para describir mensajes pendientes: la UI usa rótulos distintos para uno y otro, y un hilo `queued` sigue apareciendo en hilos activos por HU-7.
- [ ] CA-016.2: Dado un texto escrito sin enviar en un hilo, cuando el dev cambia a otro hilo y vuelve, entonces el borrador previo está intacto; cada hilo conserva su propio borrador.
- [ ] CA-016.3: El borrador se pierde al recargar la página y se descarta al enviarse el mensaje.

**Prioridad:** Alta
**Estimación:** XL

---

## Requisitos funcionales — studio-session-ux (cycle-01)

### RF-7: Árbol SPECS y FIXES en el Sidebar
**Descripción:** Specs → ciclos → conversaciones; fixes → conversaciones. (Spec: RF-7; HU-4)
**Reglas de negocio:**
- RN-19: SPECS incluye todas las specs, también las completadas.
- RN-20: FIXES incluye los abiertos y los últimos cerrados.
- RN-21: El árbol refleja el estado SDD de disco y se actualiza en vivo.

**Casos de error:**
- CE-13: No se pudo leer el estado SDD → el árbol muestra el error y conserva el último estado conocido.

### RF-8: Asociación hilo ↔ ciclo / fix
**Descripción:** Cada hilo se asocia automáticamente al crearse y puede reasignarse. (Spec: RF-8; HU-4)
**Reglas de negocio:**
- RN-22: Asociación automática: spec del canal + ciclo in-progress, o fix abierto.
- RN-23: El dev puede reasignar desde el hilo; la reasignación se conserva tras recargar y entre pestañas.
- RN-24: Los hilos previos se asocian por su canal; ninguno queda fuera del menú.
- RN-25: Un hilo pertenece a un solo destino a la vez.

**Casos de error:**
- CE-14: Sin ciclo in-progress ni fix abierto → el hilo queda asociado a su canal y la creación no falla.
- CE-15: Reasignación fallida → se mantiene la asociación previa y se informa el error.
- CE-16: Destino de reasignación eliminado o cerrado entre tanto → se informa y se mantiene la asociación previa.

### RF-9: Secciones colapsables
**Descripción:** Todas las secciones y subsecciones del menú se colapsan y expanden. (Spec: RF-9; HU-5)
**Reglas de negocio:**
- RN-26: El estado de colapso es una preferencia de la interfaz del dev, no afecta datos ni hilos.
- RN-27: Una sección colapsada conserva señal de selección o atención contenida.

**Casos de error:**
- CE-17: Estado de colapso guardado inválido o inexistente → se aplica un estado por defecto sin error visible.

### RF-10: "Always" por alcance
**Descripción:** Always recuerda una regla por herramienta, tool MCP o prefijo Bash, visible en la tarjeta. (Spec: RF-10; HU-6)
**Reglas de negocio:**
- RN-28: Edit/Write/MultiEdit/NotebookEdit → regla por herramienta; MCP → por tool puntual; Bash → por prefijo de comando.
- RN-29: La regla vive en memoria mientras exista el hilo en el puente; no se persiste ni se extiende al proyecto.
- RN-30: La tarjeta muestra la regla que se recordaría antes de decidir.
- RN-31: Approve sin Always no guarda reglas.

**Casos de error:**
- CE-18: Acción sin regla calculable (p. ej. Bash sin prefijo identificable) → Always no guarda regla y la tarjeta lo indica en vez de prometer algo que no ocurre.
- CE-19: Hilo reiniciado o puente reiniciado → la regla se pierde y vuelve a preguntar.

### RF-11: Gate inviolable frente a "Always"
**Descripción:** `warn` del SPEC GATE siempre pregunta; `deny` siempre bloquea. (Spec: RF-11; HU-6)
**Reglas de negocio:**
- RN-32: Ninguna regla Always omite una tarjeta por `warn`.
- RN-33: Ninguna regla Always permite una acción en `deny`.
- RN-34: Las reglas del SPEC GATE no se modifican en este ciclo.

**Casos de error:**
- CE-20: Falla el cálculo del gate → comportamiento previo al ciclo (preguntar), nunca permitir por regla.

### RF-12: Hilos activos en el Sidebar
**Descripción:** Lista en vivo de hilos `running`, `waiting-approval` y `queued` con navegación. (Spec: RF-12; HU-7)
**Reglas de negocio:**
- RN-35: Solo esos tres estados se consideran activos.
- RN-36: Orden: `waiting-approval` primero, luego `running`, luego `queued`.

**Casos de error:**
- CE-21: Conexión perdida → la lista se marca como posiblemente desactualizada.

### RF-13: Indicadores de trabajo
**Descripción:** Indicadores animados en hilo, lista de hilos y avatar, distinguiendo running y waiting-approval. (Spec: RF-13, RNF-6; HU-8)
**Reglas de negocio:**
- RN-37: running, waiting-approval y queued son visualmente distintos y no dependen solo del color.
- RN-38: Con `prefers-reduced-motion` no hay animación; la distinción se conserva.

**Casos de error:**
- CE-22: Estado desconocido o ausente → no se muestra indicador.

### RF-14: Scroll
**Descripción:** Autoscroll respetuoso del hilo y scroll completo de paneles y Sidebar. (Spec: RF-14; HU-9)
**Reglas de negocio:**
- RN-39: El autoscroll se suspende si el dev scrolleó hacia arriba y se reanuda al volver al fondo o al enviar un mensaje.
- RN-40: Ningún panel corta contenido alcanzable.

**Casos de error:**
- CE-23: Contenido que cambia de altura después de renderizar (imagen que carga) no debe sacar al hilo del fondo si el dev estaba al fondo.

### RF-15: Enviar sin interrumpir
**Descripción:** Un hilo `running` o `waiting-approval` acepta mensajes del dev sin interrumpir el turno; quedan encolados en el puente. (Spec: RF-15; HU-10)
**Reglas de negocio:**
- RN-41: Enviar a un hilo con turno vivo ya no es un error de "ocupado"; el mensaje se encola.
- RN-42: El puente es la fuente de verdad de la cola y del estado de cada mensaje.
- RN-43: Encolar no resuelve ni saltea una aprobación pendiente.
- RN-44: Los mensajes encolados no son el estado `queued` del hilo.

**Casos de error:**
- CE-24: El puente rechaza o no puede encolar (hilo inexistente o cerrado) → el dev ve el error y el texto no se pierde del Composer.

### RF-16: Entrega en el próximo punto de corte
**Descripción:** La sesión entrega los mensajes encolados al modelo en el próximo punto de corte del turno (tras el tool en curso), no al final del turno completo, mediante prompt streaming. (Spec: RF-16; HU-10)
**Reglas de negocio:**
- RN-45: Entrega en orden de envío y una sola vez por mensaje.
- RN-46: El modelo los lee con urgencia, antes de continuar su trabajo.
- RN-47: Si no hay otro punto de corte, la entrega ocurre como siguiente turno.

**Casos de error:**
- CE-25: Falla la entrega al modelo → el mensaje no se marca entregado y el dev ve el error; no se pierde.

### RF-17: Estado visible y edición de pendientes
**Descripción:** La UI muestra cada mensaje encolado como pendiente o entregado y permite editarlo o quitarlo mientras esté pendiente. (Spec: RF-17; HU-10)
**Reglas de negocio:**
- RN-48: Solo los pendientes se editan o quitan; un entregado es inmutable.
- RN-49: Editar o quitar se resuelve en el puente; si el mensaje ya se entregó, gana la entrega y el dev es avisado.
- RN-50: El texto vacío no es una edición válida.

**Casos de error:**
- CE-26: Editar/quitar un mensaje ya entregado → error claro, estado sin cambios.
- CE-27: Interrupt, fin de turno o error con pendientes → los pendientes no se pierden ni se duplican (RNF-7).

### RF-18: CANALES sin canales de spec
**Descripción:** CANALES no lista los canales `spec:*`; solo aparecen bajo SPECS. (Spec: RF-18; HU-4)
**Reglas de negocio:**
- RN-51: Ningún hilo queda inaccesible por esta exclusión.

**Casos de error:**
- CE-28: Spec cuyo canal tiene hilos pero ya no figura en SPECS → sus hilos siguen accesibles (no desaparecen del menú).

### RF-19: Borrador por hilo
**Descripción:** El Composer conserva el borrador de cada hilo en memoria al cambiar de hilo. (Spec: RF-19; HU-10)
**Reglas de negocio:**
- RN-52: El borrador vive mientras la página esté abierta; se pierde al recargar.
- RN-53: En cycle-01 el borrador es de texto; los adjuntos se suman en cycle-02.

**Casos de error:**
- CE-29: Borrador de un hilo que ya no existe → se descarta sin error visible.

### RF-20: Re-encode de imágenes (cycle-02)
**Descripción:** Toda imagen adjunta se re-encodea en el cliente, eliminando EXIF/GPS. (Spec: RF-20; HU-1, cycle-02)
**Reglas de negocio:**
- RN-54: Ninguna imagen llega al modelo con metadatos EXIF/GPS originales.

**Casos de error:**
- CE-30: Si el re-encode falla, la imagen se rechaza; nunca se envía el original.

---

## Reglas de negocio

1. El SPEC GATE es inviolable: `deny` siempre bloquea y `warn` siempre pregunta, haya o no "Always". Sus reglas no cambian en este ciclo.
2. Las reglas "Always" viven en memoria mientras exista el hilo en el puente; no sobreviven reinicios ni se comparten entre hilos ni proyectos.
3. Asociación hilo ↔ ciclo/fix: automática al crear, editable desde el hilo, y los hilos previos se asocian por canal; ningún hilo queda fuera del menú.
4. SPECS muestra todas las specs (también completadas); FIXES muestra abiertos más los últimos cerrados. Los canales `spec:*` no se listan en CANALES.
5. Un mensaje enviado a un hilo con turno vivo se encola sin interrumpir y se entrega en el próximo punto de corte; el puente es la fuente de verdad del estado pendiente/entregado.
6. Solo un mensaje pendiente se edita o quita; si ya se entregó, gana la entrega y se avisa al dev.
7. Los mensajes encolados nunca se pierden ni se duplican ante interrupt, error o fin de turno; los pendientes al terminar el turno se entregan como el siguiente turno.
8. Un mensaje encolado no es el estado `queued` del hilo; protocolo y UI los distinguen.
9. El borrador del Composer es por hilo, en memoria, y se pierde al recargar.
10. El Studio sigue sin manejar credenciales (zero-credentials) y sigue siendo una web estática; nada de lo anterior introduce secretos en la web.
11. Las animaciones respetan `prefers-reduced-motion` y nunca son la única señal de estado.
12. El modo `bypassPermissions` (FIX-e-burgos-002) queda fuera de este ciclo; no se modifica y las historias lo asumen disponible.
13. Los contratos de protocolo de HU-1..HU-3 se publican en este ciclo con un único bump de `PROTOCOL_VERSION`, sin comportamiento visible para el dev hasta cycle-02.

## Estados transversales (vacío / carga / error)

| Superficie              | Vacío                                    | Carga                          | Error                                          |
| ----------------------- | ---------------------------------------- | ------------------------------ | ---------------------------------------------- |
| Árbol SPECS / FIXES     | "Sin specs" / "Sin fixes" / "Sin conversaciones" | Estado de conexión     | Error de lectura + último estado conocido      |
| Hilos activos           | "Sin hilos activos"                      | —                              | "Estado posiblemente desactualizado"           |
| Tarjeta de aprobación   | —                                        | —                              | "Always" sin regla calculable lo indica        |
| Mensajes encolados      | Sin pendientes: sin indicador            | Enviando (antes del acuse del puente) | Error al encolar/editar/quitar; texto conservado |
| Borrador por hilo       | Hilo sin borrador: Composer vacío        | —                              | —                                              |

## Glosario del dominio

| Término             | Definición                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Studio              | Interfaz web estilo Slack para operar agentes SDD.                                                      |
| Puente (bridge)     | Proceso local que ejecuta al agente y sirve al Studio; guarda hilos y adjuntos en el repo del dev.      |
| Hilo                | Conversación con un agente; tiene estado, canal y (desde este ciclo) una asociación a ciclo o fix.      |
| Canal               | Agrupador de conversaciones (del sistema, por spec o mensajes directos a un agente).                    |
| Hilo activo         | Hilo en estado `running`, `waiting-approval` o `queued`.                                                |
| `waiting-approval`  | El agente espera una decisión del dev sobre una acción.                                                 |
| Always              | Decisión de aprobación que recuerda una regla para el resto de la vida del hilo en el puente.           |
| Regla Always        | Herramienta (Edit/Write/MultiEdit/NotebookEdit), tool MCP puntual o prefijo de comando Bash.            |
| SPEC GATE           | Control que bloquea (`deny`) o advierte (`warn`) ediciones de código sin ciclo SDD abierto.             |
| Adjunto             | Imagen, PDF o texto/código/markdown enviado junto al mensaje.                                           |
| Frame / 1 MiB       | Tamaño máximo de un mensaje entre Studio y puente, medido sobre el mensaje serializado completo.        |
| `@archivo`          | Mención que inserta la ruta de un archivo del repo en el mensaje.                                       |
| `@agente`           | Mención que instruye al agente a delegar en ese subagente.                                              |
| `/skill`            | Comando que instruye al agente a usar esa skill o prompt del kit.                                       |
| Spec / Ciclo / Fix  | Especificación SDD, iteración de implementación de una spec, y corrección fuera de ciclo registrada.    |
| Mensaje encolado    | Mensaje enviado a un hilo con turno vivo; queda pendiente hasta que la sesión lo lee y pasa a entregado. |
| Punto de corte      | Momento del turno, tras terminar el tool en curso, en que la sesión puede leer mensajes nuevos.         |
| Pendiente / Entregado | Estados de un mensaje encolado: aún no leído por el modelo / ya leído (inmutable).                    |
| `queued` (hilo)     | Estado de un hilo que espera turno por un recurso compartido; no es un mensaje encolado.                |
| Borrador            | Texto escrito en el Composer y no enviado, conservado por hilo en memoria.                              |

## Ambigüedades

Resueltas con las decisiones del dev (`resolved_decisions`): corte de ciclos, canales `spec:*`, borrador por hilo, re-encode EXIF/GPS, semántica imperativa de HU-10. Quedan abiertas:

1. **Texto adjunto sin límite propio (cycle-02):** la spec limita imágenes y el frame (1 MiB), pero no el tamaño de un adjunto de texto ni el tratamiento de binarios con extensión de texto. Asumido: mismo presupuesto de 1 MiB.
2. **Reasignar a una spec completada:** no se define el destino de ciclo. Asumido: cualquier ciclo o fix listado (CA-006.5); el Arquitecto confirma.
3. **Canales del sistema y DMs sin spec:** no definen en qué rama del árbol caen sus hilos viejos. Asumido: visibles bajo su canal, que sigue en CANALES (CA-006.6, CA-006.10).
4. **"Always" sobre tarjeta con `warn`:** asumido que aprueba esa acción sin guardar regla (CA-009.3).
5. **Entrega de pendientes tras `waiting-approval` y tras interrupt:** CA-013.3 y CA-015.2 aceptan dos comportamientos válidos tras el interrupt (entrega como siguiente turno o quedan pendientes); el Arquitecto fija uno.
6. **Edición de un mensaje pendiente durante `waiting-approval`:** se asume permitida (sigue pendiente).
7. **Prefijo Bash y cantidad de "últimos cerrados":** del Arquitecto (brief); los CA no fijan el valor.

---

## Alcance del siguiente ciclo (cycle-02)

> Referencia. No se implementa en cycle-01; en este ciclo solo se publican sus contratos de protocolo
> (un único bump de `PROTOCOL_VERSION`). cycle-02 se abre tras cerrar cycle-01, sin otro bump.

Resumen:

- **HU-1 Adjuntos:** pegar/arrastrar/elegir imágenes (png/jpg/webp/gif), PDF y texto/código/markdown; preview con quitar; máximo 5; imágenes ≤ 1568 px re-encodeadas siempre en el cliente (quita EXIF/GPS, RF-20); mensaje completo ≤ 1 MiB medido sobre el JSON serializado; entrega como imagen/documento/texto; persistencia por hash y render en vivo y al recargar; el borrador por hilo se extiende a adjuntos.
- **HU-2 `@archivo`:** menú `@` con búsqueda de archivos del repo; se inserta la ruta, no el contenido.
- **HU-3 `@agente` y `/skill`:** descubrimiento desde `.claude/skills`, `.claude/agents`, `sdd/skills`, `sdd/agents`; delegación en subagente y uso de skill.

### Flujos de usuario de cycle-02

#### F-A. Adjuntar, pegar o arrastrar (HU-1)

1. El dev pega una imagen del portapapeles, arrastra archivos sobre el Composer o usa el selector.
2. Cada archivo aceptado aparece como preview (miniatura para imágenes; ícono con nombre y tamaño para
   PDF y texto) con un control para quitarlo; se muestra el contador `n/5`.
3. Si un archivo no es válido (tipo no permitido, sexto adjunto, no cabe en el mensaje), se muestra un
   error junto al Composer que nombra el archivo y la causa; los demás adjuntos siguen intactos.
4. El dev envía. El mensaje aparece en la timeline con los adjuntos visibles; el agente los recibe.
5. Al recargar la página y reabrir el hilo, los adjuntos siguen visibles.

#### F-B. Menú `@` y menú `/` (HU-2, HU-3)

1. El dev escribe `@` en el Composer: se abre un menú con dos grupos, Archivos del repo y Agentes,
   filtrables escribiendo; navegación con teclado (flechas, Enter, Esc) y con mouse.
2. Elegir un archivo inserta su ruta relativa en el texto; elegir un agente inserta la mención del
   agente (`@nombre`).
3. El dev escribe `/`: el menú lista los comandos existentes (`/gate`, `/validate`, `/open-cycle`,
   `/review`, `/hotfix`, `/check`, `/resume`, `/steward`…) y, aparte, las skills y prompts del kit.
4. Al enviar, el agente recibe la ruta (no el contenido), la instrucción de delegar en el subagente
   mencionado o la de usar la skill elegida.

### Historias de cycle-02 (criterios completos, a revisar al abrir el ciclo)

#### HU-1: Adjuntar imágenes, PDF y texto al mensaje

**Como** desarrollador que opera agentes en el Studio
**Quiero** adjuntar imágenes, PDF y archivos de texto/código/markdown a mi mensaje, pegando, arrastrando o eligiendo archivos
**Para** mostrarle al agente capturas, documentos y código sin describirlos a mano

**Criterios de aceptación:**

- [ ] CA-001.1: Dado el Composer, cuando el dev pega una imagen del portapapeles, arrastra un archivo o lo elige con el selector, entonces el archivo aparece como preview con nombre/tamaño (miniatura para imágenes) y un control para quitarlo.
- [ ] CA-001.2: Los tipos aceptados son exactamente png, jpg, webp, gif, PDF y texto/código/markdown; cualquier otro tipo (zip, office, audio, video) se rechaza con un mensaje que nombra el archivo y el motivo, y no se agrega.
- [ ] CA-001.3: Dado un mensaje con 5 adjuntos, cuando el dev intenta agregar un sexto, entonces se rechaza con un mensaje de límite y los 5 originales permanecen.
- [ ] CA-001.4: Cuando el dev quita un adjunto, desaparece del preview, el contador se actualiza y puede agregarse otro si había 5.
- [ ] CA-002.1: Dada una imagen de 8 MB, cuando el dev envía, entonces el agente la recibe como imagen con lado mayor ≤ 1568 px y el mensaje completo entra en el límite de 1 MiB por mensaje.
- [ ] CA-002.2: Dado un PDF dentro del límite, cuando el dev envía, entonces el agente lo recibe como documento PDF; dado un archivo de texto/código/markdown, lo recibe como contenido textual del mensaje.
- [ ] CA-002.3: Dado un conjunto de adjuntos cuyo mensaje serializado (con el texto) superaría 1 MiB aun recomprimiendo las imágenes, cuando el dev intenta enviar, entonces se muestra un error que indica qué excede y cuánto, el mensaje NO se envía (ni parcialmente), los adjuntos y el texto quedan en el Composer y la conexión con el puente no se corta.
- [ ] CA-002.4: Si el dev envía solo adjuntos sin texto, el envío se permite; si no hay texto ni adjuntos, no se permite.
- [ ] CA-003.1: Tras enviar, el mensaje del dev muestra los adjuntos en la timeline en vivo (imagen visible, PDF/texto como tarjeta con nombre y tamaño).
- [ ] CA-003.2: Tras recargar la página y reabrir el hilo, los mismos adjuntos siguen visibles en el mismo mensaje.
- [ ] CA-003.3: Si un adjunto persistido ya no está disponible al recargar, el mensaje se muestra igual con un marcador "adjunto no disponible" y el resto del hilo carga.
- [ ] CA-003.4: Un mismo archivo enviado dos veces no ocupa espacio duplicado en el almacén de adjuntos (mismo hash, una sola copia) y ambos mensajes lo muestran.

**Prioridad:** Alta
**Estimación:** XL

---

#### HU-2: Referenciar archivos del repo con `@`

**Como** desarrollador
**Quiero** escribir `@` y buscar un archivo del repositorio que estoy trabajando
**Para** apuntar al agente a un archivo exacto sin tipear la ruta

**Criterios de aceptación:**

- [ ] CA-004.1: Dado el Composer, cuando el dev escribe `@`, entonces se abre un menú con archivos del repo y se filtra mientras escribe; Esc lo cierra sin modificar el texto.
- [ ] CA-004.2: Cuando el dev elige un archivo (Enter o clic), entonces su ruta relativa al repo se inserta en la posición del cursor y el menú se cierra.
- [ ] CA-004.3: Dado un mensaje con una ruta insertada por `@`, el agente recibe la ruta y no el contenido del archivo (el texto enviado contiene la ruta y no el contenido).
- [ ] CA-004.4: El menú no ofrece archivos fuera del repo trabajado ni archivos de secretos (p. ej. `.env`), ni carpetas de dependencias, control de versiones o almacén propio del Studio.
- [ ] CA-004.5: Estado vacío: si la búsqueda no encuentra coincidencias, el menú muestra "Sin resultados para «x»"; estado de carga: mientras busca muestra un indicador; error: si el puente no responde o rechaza la búsqueda, el menú muestra el error y el Composer sigue utilizable.
- [ ] CA-004.6: Si hay muchos resultados, el menú muestra una cantidad acotada e indica que hay más (afinar la búsqueda).

**Prioridad:** Alta
**Estimación:** M

---

#### HU-3: Delegar en agentes con `@` y usar skills con `/`

**Como** desarrollador
**Quiero** mencionar un agente con `@` y elegir una skill o prompt del kit con `/`
**Para** delegar trabajo en un subagente o pedir el uso de una skill sin recordar sus nombres

**Criterios de aceptación:**

- [ ] CA-005.1: El menú `@` incluye un grupo Agentes con los agentes descubiertos del repo (`.claude/agents`, `sdd/agents`), sin duplicados por nombre.
- [ ] CA-005.2: Cuando el dev elige un agente y envía, el prompt que recibe el agente contiene la instrucción de delegar en ese subagente.
- [ ] CA-005.3: El menú `/` lista los comandos existentes (gate, validate, open-cycle y los demás ya disponibles) y, en un grupo aparte, las skills y prompts del kit descubiertos del repo (`.claude/skills`, `sdd/skills`).
- [ ] CA-005.4: Cuando el dev elige una skill y envía, el prompt que recibe el agente contiene la instrucción de usar esa skill; los comandos existentes siguen comportándose exactamente como antes.
- [ ] CA-005.5: Si el dev crea, borra o edita una skill o agente en el repo mientras el Studio está abierto, el menú refleja el cambio sin recargar la página.
- [ ] CA-005.6: Estado vacío: si no se descubre ninguna skill o agente, el grupo correspondiente indica "No se encontraron skills/agentes" en lugar de desaparecer; si el descubrimiento falla, los comandos existentes siguen disponibles.
- [ ] CA-005.7: Si el dev menciona un agente o skill que ya no existe al enviar, el mensaje se envía como texto normal y no se inyecta ninguna instrucción.

**Prioridad:** Media
**Estimación:** M

**Criterio añadido por decisión del dev (EXIF/GPS):**

- [ ] CA-016.4: Dada una imagen con metadatos EXIF/GPS, cuando el dev la envía, entonces el modelo la recibe re-encodeada sin esos metadatos; si el re-encode falla, la imagen se rechaza y nunca se envía la original.
- [ ] CA-016.5: El borrador por hilo conserva también los adjuntos pendientes al cambiar de hilo, y se pierde al recargar.

### Requisitos funcionales de cycle-02

#### RF-1: Adjuntos en el Composer
**Descripción:** El Composer permite adjuntar archivos por pegado, arrastre y selector, con vista previa y quitar. (Spec: Requisitos Funcionales RF-1; HU-1)
**Reglas de negocio:**
- RN-1: Tipos permitidos: png, jpg, webp, gif, PDF y texto/código/markdown; nada más.
- RN-2: Máximo 5 adjuntos por mensaje.
- RN-3: Un mensaje se envía completo o no se envía; nunca con un subconjunto de adjuntos.

**Casos de error:**
- CE-1: Tipo no permitido → rechazo con mensaje que nombra archivo y motivo; no se agrega.
- CE-2: Sexto adjunto → rechazo con mensaje de límite.
- CE-3: Archivo ilegible o vacío → rechazo con mensaje; el resto no se afecta.

#### RF-2: Presupuesto del mensaje y recompresión de imágenes
**Descripción:** Las imágenes se reducen (lado mayor ≤ 1568 px) y recomprimen en el navegador; el mensaje serializado debe entrar en 1 MiB. (Spec: RF-2, RNF-3; HU-1)
**Reglas de negocio:**
- RN-4: El tamaño se mide sobre el mensaje completo ya serializado, no sobre los archivos originales.
- RN-5: Un mensaje que no entra nunca se envía; el dev recibe el motivo y conserva su texto y adjuntos.
- RN-6: Superar el límite nunca corta la conexión con el puente sin feedback.

**Casos de error:**
- CE-4: Mensaje excede 1 MiB tras recomprimir → error claro con el exceso; no se envía.
- CE-5: Imagen que no puede decodificarse → rechazo de ese adjunto con mensaje.

#### RF-3: Entrega de adjuntos al agente
**Descripción:** El agente recibe imágenes como imágenes, PDF como documentos y texto como contenido textual. (Spec: RF-3; HU-1)
**Reglas de negocio:**
- RN-7: La primera conversación (creación de hilo) y los mensajes siguientes admiten adjuntos con las mismas reglas.
- RN-8: Si el modelo o el proveedor rechaza un adjunto, el dev ve el error en el hilo y el hilo no queda colgado.

**Casos de error:**
- CE-6: El agente no puede procesar un adjunto → el error aparece en el hilo y el turno termina de forma limpia.

#### RF-4: Persistencia y render de adjuntos
**Descripción:** Los adjuntos se guardan por hash y se muestran en vivo y al recargar. (Spec: RF-4, RNF-4, RNF-5; HU-1)
**Reglas de negocio:**
- RN-9: El historial del hilo guarda solo una referencia al adjunto, no el binario.
- RN-10: Archivos idénticos comparten una sola copia.
- RN-11: Solo se sirven adjuntos del almacén propio del Studio; nunca archivos arbitrarios del disco.
- RN-12: Este ciclo no borra adjuntos persistidos.

**Casos de error:**
- CE-7: Adjunto faltante o ilegible al recargar → marcador "adjunto no disponible"; el hilo carga.
- CE-8: Error al guardar el adjunto al enviar → el mensaje no se envía y el dev ve el error.

#### RF-5: Menú `@` con archivos y agentes
**Descripción:** `@` abre un menú con búsqueda de archivos del repo y agentes. (Spec: RF-5; HU-2, HU-3)
**Reglas de negocio:**
- RN-13: Elegir un archivo inserta su ruta; el contenido no se inyecta en el prompt.
- RN-14: Solo se ofrecen archivos dentro del repo trabajado; se excluyen secretos, dependencias, control de versiones y el almacén propio del Studio.
- RN-15: Los resultados son acotados y la búsqueda es por coincidencia parcial.

**Casos de error:**
- CE-9: Búsqueda sin resultados → mensaje vacío explícito.
- CE-10: Falla o timeout de la búsqueda → mensaje de error en el menú; el Composer sigue funcionando.

#### RF-6: Agentes y skills descubiertos del repo
**Descripción:** `@agente` instruye delegar; `/skill` instruye usar la skill; `/` mantiene los comandos existentes. (Spec: RF-6; HU-3)
**Reglas de negocio:**
- RN-16: Agentes y skills se descubren de `.claude/agents`, `sdd/agents`, `.claude/skills` y `sdd/skills`; si hay duplicados por nombre, se muestra una sola entrada.
- RN-17: Los comandos existentes del Composer conservan su comportamiento.
- RN-18: La instrucción de delegación/uso de skill se agrega al prompt solo si el agente o skill sigue existiendo al enviar.

**Casos de error:**
- CE-11: Falla el descubrimiento → solo se ofrecen los comandos existentes y se muestra aviso.
- CE-12: Skill o agente inexistente al enviar → se envía como texto simple.

Casos de error y estados vacíos de cycle-02 (adjuntos al recargar, menú `@`/`/`) se detallan en los RF anteriores; se re-validan al abrir el ciclo.
