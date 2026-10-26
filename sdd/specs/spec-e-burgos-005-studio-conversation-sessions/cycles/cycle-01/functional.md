# Functional — Cycle 1: studio-conversation-sessions

> **Input:** sdd/specs/spec-e-burgos-005-studio-conversation-sessions/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-005-studio-conversation-sessions/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

SDD Studio es la interfaz web donde el dev conversa con agentes. Cada conversación (hilo) corre en una sesión del proveedor de IA. Hoy el sistema ya abre una sesión por hilo, pero la web no la ve, y Mission Control muestra conversaciones, proveedores y sesiones que nunca existieron (guiones fijos, cifras de telemetría inventadas). Este ciclo hace que:

- cada conversación nueva sea una sesión nueva y propia, visible junto con su proveedor;
- el contexto estable del proyecto se envíe como prefijo cacheable para abaratar cada sesión;
- Mission Control muestre solo lo que ocurrió de verdad en la conversación elegida;
- desaparezca todo dato ficticio, con estados vacíos honestos.

Decisiones del dev ya tomadas: prefijo de sistema estable sin resumen por sesión; solo el proveedor Claude se implementa, con la arquitectura preparada para otros (campo `provider`); la limpieza de falsedades incluye la telemetría de respaldo, el inspector de agentes y el default fijo del mapa.

## Historias de usuario

### HU-01: Cada conversación nueva es una sesión nueva

**Como** dev
**Quiero** que cada conversación que abro arranque una sesión nueva del proveedor
**Para** que el contexto de una conversación nunca contamine a otra

**Criterios de aceptación:**

- [ ] CA-001: Crear un hilo desde el compositor, desde el feed de chat de Mission Control o con el botón "Nueva conversación" produce un hilo cuyo id de sesión es nulo antes del primer turno.
- [ ] CA-002: Tras el primer turno de dos hilos distintos, sus ids de sesión son distintos entre sí y ninguno coincide con el de otro hilo existente (test).
- [ ] CA-003: Existe un botón visible "Nueva conversación" que crea un hilo vacío y lo deja seleccionado.
- [ ] CA-004: Los turnos posteriores de un mismo hilo retoman la sesión de ese hilo; ningún hilo retoma la sesión de otro (test).
- [ ] CA-005: Queda documentada la auditoría de las dos entradas de creación de hilos (resultado: ambas cumplen CA-001, o fueron corregidas).

**Prioridad:** Alta
**Estimación:** M

---

### HU-02: La web ve la sesión real y el proveedor

**Como** dev
**Quiero** ver la sesión real del proveedor y qué proveedor atiende cada conversación
**Para** saber con qué conversación estoy trabajando

**Criterios de aceptación:**

- [ ] CA-006: La información de cada hilo que recibe la web incluye el id de sesión (nulo hasta el primer turno) y el proveedor (test del contrato y del puente; se elimina el test que exigía ocultar el id).
- [ ] CA-007: Los hilos existentes previos a este ciclo se leen con proveedor `claude` y conservan su id de sesión.
- [ ] CA-008: La web muestra el id de sesión y el proveedor reales del hilo seleccionado; si no hay sesión muestra el texto "Sin sesión todavía" y no un id.
- [ ] CA-009: Una búsqueda en el código de la web no encuentra ids de sesión fabricados (patrón `session-` literal) fuera de tests de fixtures explícitos.
- [ ] CA-010: El campo proveedor es extensible: agregar un proveedor nuevo no requiere cambiar la forma de los hilos (solo ampliar el conjunto de valores permitidos).

**Prioridad:** Alta
**Estimación:** M

---

### HU-03: Contexto estable cacheable

**Como** dev
**Quiero** que cada sesión arranque con un prefijo de sistema estable del proyecto
**Para** aprovechar el prompt caching de Claude y no pagar ese contexto completo en cada sesión

**Criterios de aceptación:**

- [ ] CA-011: El prefijo se arma con `sdd/context/context_prompt.md`, `sdd/context/constitution.md` y `sdd/memory/lessons.md`, siempre en ese orden.
- [ ] CA-012: Dos sesiones consecutivas sin cambios en esos tres archivos reciben un prefijo byte a byte idéntico (test).
- [ ] CA-013: Cambiar el contenido de cualquiera de los tres archivos cambia el prefijo de la sesión siguiente (test).
- [ ] CA-014: Si uno de los archivos no existe, la sesión arranca igual con los restantes y el prefijo sigue siendo determinista (test).
- [ ] CA-015: No existe resumen ni compactación por sesión en este ciclo.
- [ ] CA-016: El prefijo no contiene datos variables (fechas, ids de sesión, nombre de hilo).

**Prioridad:** Alta
**Estimación:** M

---

### HU-04: Mission Control centrado en una conversación

**Como** dev
**Quiero** elegir una conversación y ver los agentes que participaron, sus diálogos reales y las specs y fixes que tocó
**Para** entender qué pasó de verdad en esa conversación

**Criterios de aceptación:**

- [ ] CA-017: Mission Control tiene un selector que lista las conversaciones existentes.
- [ ] CA-018: Al abrir Mission Control queda seleccionada la conversación con la actividad más reciente; el mapa no tiene ninguna spec ni conversación fija por defecto (se elimina el default fijo a spec-004).
- [ ] CA-019: Cambiar de conversación cambia los agentes del mapa, los diálogos y las specs/fixes relacionados, todo derivado de los eventos de esa conversación (test con dos conversaciones de eventos distintos).
- [ ] CA-020: Las specs y fixes relacionados se derivan de las rutas de spec y los ids de fix que aparecen en los eventos de la conversación, no solo del destino con que se creó el hilo.
- [ ] CA-021: Una conversación sin eventos muestra estado vacío ("Sin actividad todavía") y no agentes ni diálogos.
- [ ] CA-022: Sin ninguna conversación existente, Mission Control muestra estado vacío con acceso a "Nueva conversación".
- [ ] CA-023: El visor de documentos sigue funcionando y se alimenta de las specs/fixes de la conversación seleccionada.

**Prioridad:** Alta
**Estimación:** L

---

### HU-05: Cero información ficticia

**Como** dev
**Quiero** que Studio deje de mostrar conversaciones, proveedores, sesiones y cifras inventados
**Para** confiar en lo que veo

**Criterios de aceptación:**

- [ ] CA-024: Los guiones fijos de diálogo por spec/fix y sus ids de sesión inventados no existen en el código (búsqueda sin resultados de los guiones y del mapa de guiones por spec).
- [ ] CA-025: Los selectores de spec y fix y el filtro de fixes del inspector no existen en la web.
- [ ] CA-026: La telemetría en vivo, sin datos reales, muestra un estado vacío honesto ("Sin telemetría todavía"); no aparecen la cifra de 6.6M tokens ni filas de proveedores Gemini (búsqueda sin resultados).
- [ ] CA-027: El inspector de agentes no contiene los textos "Google Gemini" ni "GitHub Copilot" ni ids `session-*` fabricados; muestra proveedor y sesión reales (HU-02) o el estado vacío.
- [ ] CA-028: El test del inspector que exigía esos textos o ids fabricados se elimina o se reescribe para exigir datos reales / estado vacío.
- [ ] CA-029: Se conservan el visor de documentos y su utilidad de documentos de agentes, con sus tests en verde.

**Prioridad:** Alta
**Estimación:** M

---

### HU-06: Compatibilidad y calidad del ciclo

**Como** dev
**Quiero** que el cambio de contrato no rompa a quienes lo consumen
**Para** poder desplegar protocolo, puente y web sin fallas

**Criterios de aceptación:**

- [ ] CA-030: `pnpm test` y `pnpm typecheck` pasan en `libs/studio-protocol`, `apps/studio-bridge` y `apps/studio`.
- [ ] CA-031: La compatibilidad del protocolo queda resuelta y documentada (campos opcionales o nueva versión de protocolo, decisión del arquitecto) y una web antigua o un puente antiguo no fallan al conectarse.

**Prioridad:** Alta
**Estimación:** S

## Requisitos funcionales

### RF-01: Aislamiento de sesión por conversación
**Descripción:** Cada conversación tiene su propia sesión del proveedor, creada en su primer turno y retomada solo por esa conversación.
**Origen:** spec § US-1, Diagnóstico.
**Reglas de negocio:**
- RN-01: Una conversación nace sin sesión; la sesión nace en el primer turno.
- RN-02: Una sesión pertenece a una sola conversación, de por vida.
- RN-03: Toda vía de creación de conversación (compositor, feed de Mission Control, botón "Nueva conversación") aplica RN-01.

**Casos de error:**
- CE-01: Si el proveedor falla al abrir la sesión, la conversación queda sin sesión (nula), se muestra el error y el siguiente turno reintenta con sesión nueva, nunca con la de otra conversación.

### RF-02: Visibilidad de sesión y proveedor
**Descripción:** La web recibe y muestra el id de sesión y el proveedor de cada conversación.
**Origen:** spec § US-2, Decisiones del dev (proveedores).
**Reglas de negocio:**
- RN-04: El proveedor de toda conversación es un valor del conjunto permitido; hoy solo `claude` está implementado.
- RN-05: Las conversaciones previas al ciclo se tratan como `claude`.
- RN-06: La web nunca fabrica un id de sesión ni un proveedor; sin dato, lo dice.

**Casos de error:**
- CE-02: Si llega una conversación con proveedor desconocido, la web la muestra con el valor recibido sin romperse.
- CE-03: Si el puente no informa proveedor (versión antigua), la web muestra "proveedor no informado".

### RF-03: Prefijo de sistema estable
**Descripción:** Toda sesión nueva incluye un prefijo de sistema formado por los tres documentos de contexto del proyecto, determinista, para maximizar el cache del proveedor.
**Origen:** spec § US-3.
**Reglas de negocio:**
- RN-07: Orden fijo: contexto general, constitución, lecciones.
- RN-08: El contenido del prefijo depende solo de esos archivos.
- RN-09: Sin resumen por sesión.

**Casos de error:**
- CE-04: Archivo faltante o ilegible: se omite sin abortar la sesión y se registra el aviso.

### RF-04: Enjambre por conversación
**Descripción:** Mission Control muestra agentes, diálogos y specs/fixes de la conversación seleccionada, derivados de sus eventos.
**Origen:** spec § US-4.
**Reglas de negocio:**
- RN-10: Default = conversación con actividad más reciente.
- RN-11: Un agente aparece solo si hay eventos que lo respaldan.
- RN-12: Una spec o fix es "relacionado" si sus rutas o ids aparecen en los eventos.

**Casos de error:**
- CE-05: Conversación sin eventos: estado vacío.
- CE-06: Sin conversaciones: estado vacío con acceso a crear una.
- CE-07: Eventos con referencias a specs/fixes inexistentes: se muestran sin enlace al documento, sin romper el visor.

### RF-05: Eliminación de datos ficticios
**Descripción:** Se retiran guiones, selectores, cifras y textos inventados; los reemplaza el estado vacío honesto.
**Origen:** spec § US-5, Hallazgos relacionados, FIX-e-burgos-004-001.
**Reglas de negocio:**
- RN-13: Ninguna cifra, proveedor, sesión ni diálogo se muestra si no proviene de datos reales.
- RN-14: El visor de documentos y su utilidad se conservan.
- RN-15: El mapa no trae spec ni conversación por defecto.

**Casos de error:**
- CE-08: Telemetría sin datos: "Sin telemetría todavía", nunca cifras de relleno.

## Reglas de negocio

1. Conversación = hilo = una sesión del proveedor (RN-01, RN-02).
2. Solo el proveedor Claude está implementado; la arquitectura admite otros (RN-04).
3. Prefijo estable y sin resumen (RN-07 a RN-09).
4. Mission Control refleja eventos reales o estado vacío (RN-11, RN-13).

## Trazabilidad con la spec

| Spec | Historias | Criterios |
| ---- | --------- | --------- |
| CA-1 | HU-01 | CA-001 a CA-005 |
| CA-2 | HU-02 | CA-006 a CA-010 |
| CA-3 | HU-03 | CA-011 a CA-016 |
| CA-4 | HU-04 | CA-017 a CA-023 |
| CA-5 | HU-05 | CA-024 a CA-029 |
| CA-6 | HU-06 | CA-030, CA-031 |

## Glosario del dominio

| Término | Definición |
| ------- | ---------- |
| Conversación / hilo | Intercambio del dev con agentes en Studio |
| Sesión | Sesión real del proveedor de IA asociada a un hilo |
| Proveedor | Servicio de IA que atiende el hilo (hoy solo Claude) |
| Prefijo de sistema estable | Contexto fijo del proyecto enviado al inicio de cada sesión para cache |
| Mission Control | Vista con mapa de agentes, inspector y telemetría |
| Estado vacío honesto | Mensaje que indica ausencia de datos en lugar de mostrar valores inventados |
