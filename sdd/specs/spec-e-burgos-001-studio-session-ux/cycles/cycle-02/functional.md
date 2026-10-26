# Functional — Cycle 2: studio-session-ux

> **Input:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional
> **Spec:** sdd/specs/spec-e-burgos-001-studio-session-ux/spec-e-burgos-001-studio-session-ux.spec.md
> **Base:** actualiza, sin rediseñar, la sección «Alcance del siguiente ciclo (cycle-02)» de cycle-01/functional.md.

---

## Contexto de negocio

SDD Studio es la interfaz web, estilo Slack, con la que el desarrollador opera agentes SDD sobre su repo local a través de un puente en su máquina. Cycle-01 (completed) entregó HU-4..HU-10: árbol del sidebar por spec/ciclo/fix, aprobaciones, cola de mensajes pendientes, borrador de texto por hilo y los contratos de protocolo de toda la spec (PROTOCOL_VERSION = 2, congelados y testeados).

Hoy el dev solo puede enviar texto: no muestra una captura, un PDF ni un archivo, ni apunta al agente a un archivo, subagente o skill sin tipearlo. Cycle-02 es el **ciclo final**: HU-1 (adjuntos), HU-2 (`@archivo`) y HU-3 (`@agente`, `/skill|prompt`). Al cerrarlo la spec queda completa.

Actor único: **el desarrollador** (dev). Sin credenciales en la web (zero-credentials) y la web sigue siendo estática.

Las decisiones del dev están cerradas y no se reabren. Sin bump de protocolo: solo cambios aditivos y opcionales.

## Qué cambió respecto de cycle-01 (estado real que este ciclo hereda)

| Tema | Estado post cycle-01 | Efecto en este documento |
| ---- | -------------------- | ------------------------ |
| Protocolo | v2 publicado: contratos de adjuntos (`AttachmentRef`), `attachment.get`, `workspace.searchFiles`, refs de mensaje y catálogo de agentes/skills ya existen | HU-1..3 no definen contratos nuevos; solo los usan |
| `Welcome.features` | Existe; el puente de cycle-01 anuncia `pending-messages`, `thread-link`, `always-rules` y responde `unsupported` a adjuntos/búsqueda/catálogo | Este ciclo suma `attachments`, `file-search`, `catalog`; la web muestra cada capacidad solo si el puente la anuncia (RN-60) |
| Cola de pendientes (HU-10) | Un mensaje encolado puede llevar adjuntos y refs en el contrato | Los adjuntos y menciones aplican también a mensajes encolados (RN-61) |
| Borrador por hilo | Slice `drafts` solo de texto, en memoria | Se extiende a adjuntos (CA-016.5, RN-62) |
| Sidebar / árbol | Entregado | Sin cambios; solo regresión |
| `slash.ts` | Comandos existentes intactos | El menú `/` suma un grupo aparte; los comandos no cambian (RN-17) |
| Catálogo | Fuentes: `.claude/agents`, `sdd/agents`, `.claude/skills`, `sdd/skills` y, nuevo respecto del resumen de cycle-01, `sdd/prompts` | RN-16 ampliado; dedupe y precedencia en RN-63 |
| Ambigüedad 1 de cycle-01 (texto adjunto) | Confirmado el default | Adjunto de texto sin límite propio: comparte el presupuesto de 1 MiB (RN-4, RN-59) |

## Mapa de trazabilidad

| Historia | RF (spec) | CA (spec) | RNF relacionados |
| -------- | --------- | --------- | ---------------- |
| HU-1 | RF-1..RF-4, RF-20 | CA-001, CA-002, CA-003, CA-016.4, CA-016.5 | RNF-1, RNF-3, RNF-4, RNF-5 |
| HU-2 | RF-5 | CA-004 | RNF-5 |
| HU-3 | RF-5, RF-6 | CA-005 | RNF-5 |

Transversal: RNF-8 (tests vitest en los tres subproyectos; `pnpm typecheck && pnpm test` en verde). Los `CA-NNN.k` son sub-criterios PASS/FAIL del `CA-NNN` de la spec.

---

## Flujos de usuario

### F-A. Adjuntar, pegar o arrastrar (HU-1)

1. El dev pega una imagen del portapapeles, arrastra archivos sobre el Composer o usa el selector.
2. Cada archivo aceptado aparece como preview (miniatura para imágenes; ícono con nombre y tamaño para PDF y texto) con control para quitarlo; contador `n/5`.
3. Si un archivo no es válido (tipo no permitido, sexto adjunto, ilegible, no cabe en el mensaje), un error junto al Composer nombra el archivo y la causa; los demás adjuntos siguen intactos.
4. El dev envía. El mensaje aparece en la timeline con los adjuntos visibles y el agente los recibe.
5. Al recargar y reabrir el hilo, los adjuntos siguen visibles.

### F-B. Menú `@` y menú `/` (HU-2, HU-3)

1. El dev escribe `@`: menú con dos grupos, Archivos del repo y Agentes, filtrable, con teclado (flechas, Enter, Esc) y mouse.
2. Elegir un archivo inserta su ruta relativa (sin `@`); elegir un agente inserta `@nombre`.
3. El dev escribe `/`: el menú lista los comandos existentes y, en grupos aparte, las skills y los prompts del kit.
4. Al enviar, el agente recibe la ruta (no el contenido), la instrucción de delegar en el subagente mencionado o la de usar la skill/prompt elegida.

---

## Historias de usuario — Studio Session UX (adjuntos y referencias)

### HU-1: Adjuntar imágenes, PDF y texto al mensaje

**Como** desarrollador que opera agentes en el Studio
**Quiero** adjuntar imágenes, PDF y archivos de texto/código/markdown a mi mensaje, pegando, arrastrando o eligiendo archivos
**Para** mostrarle al agente capturas, documentos y código sin describirlos a mano

**Criterios de aceptación:**

- [ ] CA-001.1: Dado el Composer, cuando el dev pega una imagen del portapapeles, arrastra un archivo o lo elige con el selector, entonces aparece como preview con nombre/tamaño (miniatura para imágenes) y un control para quitarlo.
- [ ] CA-001.2: Los tipos aceptados son exactamente png, jpg, webp, gif, PDF y texto/código/markdown; cualquier otro (zip, office, audio, video) se rechaza con un mensaje que nombra el archivo y el motivo, y no se agrega.
- [ ] CA-001.3: Dado un mensaje con 5 adjuntos, cuando el dev intenta agregar un sexto, se rechaza con mensaje de límite y los 5 originales permanecen.
- [ ] CA-001.4: Cuando el dev quita un adjunto, desaparece del preview, el contador se actualiza y puede agregarse otro si había 5.
- [ ] CA-002.1: Dada una imagen de 8 MB, cuando el dev envía, el agente la recibe como imagen con lado mayor ≤ 1568 px y el mensaje completo entra en 1 MiB.
- [ ] CA-002.2: Dado un PDF dentro del límite, el agente lo recibe como documento PDF; dado un archivo de texto/código/markdown, lo recibe como contenido textual del mensaje.
- [ ] CA-002.3: Dado un conjunto de adjuntos cuyo mensaje serializado (con el texto) superaría 1 MiB aun recomprimiendo las imágenes, cuando el dev intenta enviar, se muestra un error que indica qué excede y cuánto, el mensaje NO se envía (ni parcialmente), los adjuntos y el texto quedan en el Composer y la conexión con el puente no se corta.
- [ ] CA-002.4: Solo adjuntos sin texto: el envío se permite; sin texto ni adjuntos: no se permite.
- [ ] CA-003.1: Tras enviar, el mensaje muestra los adjuntos en la timeline en vivo (imagen visible; PDF/texto como tarjeta con nombre y tamaño).
- [ ] CA-003.2: Tras recargar y reabrir el hilo, los mismos adjuntos siguen visibles en el mismo mensaje.
- [ ] CA-003.3: Si un adjunto persistido ya no está disponible al recargar, el mensaje se muestra con un marcador "adjunto no disponible" y el resto del hilo carga.
- [ ] CA-003.4: Un mismo archivo enviado dos veces no ocupa espacio duplicado en el almacén (mismo hash, una copia) y ambos mensajes lo muestran.
- [ ] CA-016.4: Dada una imagen con EXIF/GPS, cuando el dev la envía, el modelo la recibe re-encodeada sin esos metadatos; si el re-encode falla, la imagen se rechaza y nunca se envía la original.
- [ ] CA-016.5: El borrador por hilo conserva también los adjuntos pendientes al cambiar de hilo y se pierde al recargar.
- [ ] CA-001.5: Adjuntos y menciones también funcionan al crear un hilo nuevo y al enviar a un hilo con turno vivo (mensaje encolado, HU-10), con las mismas reglas.
- [ ] CA-001.6: Si el puente conectado no anuncia `attachments`, el Composer no ofrece elegir/pegar/arrastrar adjuntos y no falla.

**Prioridad:** Alta
**Estimación:** XL

---

### HU-2: Referenciar archivos del repo con `@`

**Como** desarrollador
**Quiero** escribir `@` y buscar un archivo del repositorio que estoy trabajando
**Para** apuntar al agente a un archivo exacto sin tipear la ruta

**Criterios de aceptación:**

- [ ] CA-004.1: Cuando el dev escribe `@`, se abre un menú con archivos del repo que se filtra mientras escribe; Esc lo cierra sin modificar el texto.
- [ ] CA-004.2: Al elegir un archivo (Enter o clic), su ruta relativa al repo se inserta en la posición del cursor (sin el `@`) y el menú se cierra.
- [ ] CA-004.3: El agente recibe la ruta y no el contenido del archivo.
- [ ] CA-004.4: El menú no ofrece archivos fuera del repo ni archivos de secretos (p. ej. `.env`), ni carpetas de dependencias, control de versiones o el almacén propio del Studio.
- [ ] CA-004.5: Sin coincidencias: "Sin resultados para «x»"; mientras busca: indicador de carga; si el puente no responde o rechaza: el menú muestra el error y el Composer sigue utilizable.
- [ ] CA-004.6: Con muchos resultados, el menú muestra una cantidad acotada e indica que hay más (afinar la búsqueda).
- [ ] CA-004.7: Si el puente no anuncia `file-search`, el grupo Archivos no se ofrece.

**Prioridad:** Alta
**Estimación:** M

---

### HU-3: Delegar en agentes con `@` y usar skills y prompts con `/`

**Como** desarrollador
**Quiero** mencionar un agente con `@` y elegir una skill o prompt del kit con `/`
**Para** delegar trabajo en un subagente o pedir el uso de una skill sin recordar sus nombres

**Criterios de aceptación:**

- [ ] CA-005.1: El menú `@` incluye un grupo Agentes con los agentes descubiertos del repo (`.claude/agents`, `sdd/agents`), sin duplicados por nombre.
- [ ] CA-005.2: Al elegir un agente y enviar, el prompt que recibe el agente contiene la instrucción de delegar en ese subagente.
- [ ] CA-005.3: El menú `/` lista los comandos existentes y, en grupos aparte, las skills (`.claude/skills`, `sdd/skills`) y los prompts (`sdd/prompts`) descubiertos del repo.
- [ ] CA-005.4: Al elegir una skill o prompt y enviar, el prompt contiene la instrucción de usarla; los comandos existentes se comportan exactamente como antes.
- [ ] CA-005.5: Si el dev crea, borra o edita una skill o agente en el repo con el Studio abierto, el menú refleja el cambio sin recargar la página.
- [ ] CA-005.6: Sin descubrimientos: el grupo indica "No se encontraron skills/agentes" en lugar de desaparecer; si el descubrimiento falla, los comandos existentes siguen disponibles.
- [ ] CA-005.7: Si el dev menciona un agente o skill que ya no existe al enviar, el mensaje se envía como texto normal sin instrucción.
- [ ] CA-005.8: Si el puente no anuncia `catalog`, solo se ofrecen los comandos existentes.

**Prioridad:** Media
**Estimación:** M

---

## Requisitos funcionales — Studio Session UX (adjuntos y referencias)

### RF-1: Adjuntos en el Composer
**Descripción:** El Composer permite adjuntar archivos por pegado, arrastre y selector, con vista previa y quitar. (Spec: RF-1; HU-1)
**Reglas de negocio:**
- RN-1: Tipos permitidos: png, jpg, webp, gif, PDF y texto/código/markdown (extensiones de texto de la lista del protocolo, con contenido UTF-8 válido); nada más.
- RN-2: Máximo 5 adjuntos por mensaje.
- RN-3: Un mensaje se envía completo o no se envía; nunca con un subconjunto de adjuntos.

**Casos de error:**
- CE-1: Tipo no permitido → rechazo con mensaje que nombra archivo y motivo; no se agrega.
- CE-2: Sexto adjunto → rechazo con mensaje de límite.
- CE-3: Archivo ilegible, vacío o texto que no es UTF-8 → rechazo con mensaje; el resto no se afecta.

### RF-2: Presupuesto del mensaje y recompresión de imágenes
**Descripción:** Las imágenes se reducen (lado mayor ≤ 1568 px) y recomprimen en el navegador; el mensaje serializado debe entrar en 1 MiB. (Spec: RF-2, RNF-3; HU-1)
**Reglas de negocio:**
- RN-4: El tamaño se mide sobre el mensaje completo ya serializado (JSON del comando, base64 incluido), no sobre los archivos originales; el adjunto de texto no tiene límite propio y comparte este presupuesto.
- RN-5: Un mensaje que no entra nunca se envía; el dev recibe el motivo (qué excede y cuánto, con los adjuntos más pesados) y conserva texto y adjuntos.
- RN-6: Superar el límite nunca corta la conexión con el puente sin feedback.
- RN-55: Solo las imágenes se recomprimen (escalera de calidad/lado decreciente hasta entrar); PDF y texto no se recomprimen.
- RN-56: Un GIF con lado ≤ 1568 px se envía tal cual; uno mayor se envía como primer cuadro estático.

**Casos de error:**
- CE-4: Mensaje excede 1 MiB tras recomprimir → error claro con el exceso; no se envía.
- CE-5: Imagen que no puede decodificarse → rechazo de ese adjunto con mensaje.

### RF-3: Entrega de adjuntos al agente
**Descripción:** El agente recibe imágenes como imágenes, PDF como documentos y texto como contenido textual. (Spec: RF-3; HU-1)
**Reglas de negocio:**
- RN-7: La creación de hilo, los mensajes siguientes y los mensajes encolados admiten adjuntos con las mismas reglas.
- RN-8: Si el modelo o el proveedor rechaza un adjunto, el dev ve el error en el hilo y el hilo no queda colgado.
- RN-57: El puente revalida cada adjunto recibido (tipo real por contenido, no solo por declaración) antes de entregarlo; un adjunto inválido hace fallar el mensaje completo con error claro.

**Casos de error:**
- CE-6: El agente no puede procesar un adjunto → el error aparece en el hilo y el turno termina de forma limpia.
- CE-13: El tipo real no coincide con el declarado → el mensaje no se envía y el dev ve el motivo.

### RF-4: Persistencia y render de adjuntos
**Descripción:** Los adjuntos se guardan por hash y se muestran en vivo y al recargar. (Spec: RF-4, RNF-4, RNF-5; HU-1)
**Reglas de negocio:**
- RN-9: El historial del hilo guarda solo una referencia al adjunto, no el binario.
- RN-10: Archivos idénticos comparten una sola copia.
- RN-11: Solo se sirven adjuntos del almacén propio del Studio, identificados por su hash; nunca archivos arbitrarios del disco.
- RN-12: Este ciclo no borra adjuntos persistidos; si el almacén supera 1 GiB al iniciar el puente solo avisa en el log (la limpieza es trabajo posterior).

**Casos de error:**
- CE-7: Adjunto faltante o ilegible al recargar → marcador "adjunto no disponible"; el hilo carga.
- CE-8: Error al guardar el adjunto al enviar → el mensaje no se envía y el dev ve el error.
- CE-14: Pedido de un adjunto con hash inválido o fuera del almacén → "no encontrado", sin revelar rutas.

### RF-5: Menú `@` con archivos y agentes
**Descripción:** `@` abre un menú con búsqueda de archivos del repo y agentes. (Spec: RF-5; HU-2, HU-3)
**Reglas de negocio:**
- RN-13: Elegir un archivo inserta su ruta; el contenido no se inyecta en el prompt y el puente no lo lee al buscar.
- RN-14: Solo archivos dentro del repo; se excluyen secretos (p. ej. `.env`), dependencias, control de versiones y el almacén del Studio.
- RN-15: Resultados acotados (máx. 50) y búsqueda por coincidencia parcial, ordenados por relevancia.
- RN-58: Se ofrecen solo los archivos del repo versionado más los no ignorados; los ignorados por git no aparecen.

**Casos de error:**
- CE-9: Búsqueda sin resultados → mensaje vacío explícito.
- CE-10: Falla o timeout de la búsqueda → mensaje de error en el menú; el Composer sigue funcionando.

### RF-6: Agentes, skills y prompts descubiertos del repo
**Descripción:** `@agente` instruye delegar; `/skill` o `/prompt` instruye usarla; `/` mantiene los comandos existentes. (Spec: RF-6; HU-3)
**Reglas de negocio:**
- RN-16: Se descubren de `.claude/agents`, `sdd/agents` (agentes), `.claude/skills`, `sdd/skills` (skills) y `sdd/prompts` (prompts).
- RN-63: Duplicados por nombre → una sola entrada; gana la fuente propia de `.claude` sobre `sdd`. Entradas que apuntan al mismo archivo real no se duplican.
- RN-17: Los comandos existentes conservan su comportamiento.
- RN-18: La instrucción de delegación/uso se agrega solo si el agente o skill sigue existiendo al enviar.
- RN-64: Máximo 5 menciones/referencias estructuradas por mensaje; la instrucción la compone el puente, no la web.
- RN-65: El catálogo se actualiza solo ante cambios en agentes y skills de `.claude`, sin vigilar copias de worktrees.

**Casos de error:**
- CE-11: Falla el descubrimiento → solo los comandos existentes y aviso.
- CE-12: Skill o agente inexistente al enviar → texto simple.

### RF-20: Re-encode de imágenes
**Descripción:** Toda imagen adjunta se re-encodea en el cliente, eliminando EXIF/GPS. (Spec: RF-20; HU-1)
**Reglas de negocio:**
- RN-54: Ninguna imagen llega al modelo con metadatos EXIF/GPS originales, tampoco si ya cabía en 1568 px y 1 MiB (el re-encode es siempre).
- RN-66: El puente no decodifica imágenes: el re-encode es responsabilidad del cliente.

**Casos de error:**
- CE-30: Si el re-encode falla, la imagen se rechaza; nunca se envía el original.

### RF-21: Disponibilidad por capacidad anunciada
**Descripción:** La web muestra adjuntos, búsqueda de archivos y catálogo solo si el puente los anuncia en el handshake. (Spec: Corte de ciclos; HU-1..3)
**Reglas de negocio:**
- RN-60: Cada capacidad se habilita independientemente; la ausencia de un feature oculta solo esa UI.
- RN-61: Mensajes encolados y creación de hilo respetan las mismas capacidades.
- RN-62: El borrador por hilo (texto y adjuntos) vive en memoria mientras la página esté abierta; borrador de un hilo inexistente se descarta sin error visible.

**Casos de error:**
- CE-15: Puente de versión anterior sin features nuevos → el Studio funciona como en cycle-01, sin errores.

---

## Reglas de negocio transversales

1. Zero-credentials y web estática: nada de este ciclo agrega secretos a la web.
2. Sin cambios no aditivos de protocolo ni bump de versión.
3. Los adjuntos solo se sirven desde el almacén propio por hash; la búsqueda nunca lee contenido ni sale del repo.
4. Un mensaje se envía completo o no se envía; ante error el dev no pierde texto ni adjuntos.
5. Las animaciones respetan `prefers-reduced-motion`; ningún estado depende solo de animación.

## Estados transversales (vacío / carga / error)

| Superficie | Vacío | Carga | Error |
| ---------- | ----- | ----- | ----- |
| Preview de adjuntos | Sin adjuntos: contador `0/5` oculto | Procesando imagen (re-encode) con indicador | Rechazo nombrando archivo y causa; el resto intacto |
| Envío con adjuntos | — | Enviando | Exceso de tamaño con detalle; texto y adjuntos conservados |
| Adjunto en timeline | — | Cargando miniatura | Marcador "adjunto no disponible" |
| Menú `@` archivos | "Sin resultados para «x»" | Indicador de búsqueda | Mensaje de error; Composer utilizable |
| Menú `@` agentes / `/` skills y prompts | "No se encontraron skills/agentes" | — | Solo comandos existentes + aviso |

## Glosario del dominio

| Término | Definición |
| ------- | ---------- |
| Adjunto | Imagen, PDF o texto/código/markdown enviado junto al mensaje. |
| Frame / 1 MiB | Tamaño máximo de un mensaje entre Studio y puente, medido sobre el mensaje serializado completo. |
| Almacén de adjuntos | Carpeta propia del Studio en el repo donde cada adjunto se guarda por su hash. |
| `@archivo` | Mención que inserta la ruta de un archivo del repo en el mensaje. |
| `@agente` | Mención que instruye al agente a delegar en ese subagente. |
| `/skill`, `/prompt` | Comando que instruye al agente a usar esa skill o prompt del kit. |
| Capacidad anunciada (feature) | Funcionalidad que el puente declara soportar en el handshake. |
| Borrador | Texto y adjuntos escritos en el Composer y no enviados, conservados por hilo en memoria. |

## Ambigüedades

Sin preguntas abiertas para el dev; defaults aplicados (los detalles técnicos son del Arquitecto):

1. Texto adjunto sin límite propio: comparte 1 MiB (confirmado).
2. Binario con extensión de texto: se rechaza por no ser UTF-8 válido (CE-3).
3. `@agente` inserta `@nombre`; `@archivo` inserta la ruta sin `@`.
4. Prompts de `sdd/prompts` se tratan como skills en el menú `/`, en grupo propio.
5. Archivos ignorados por git no se ofrecen en `@`.
