# spec-e-burgos-018 cycle-01 — primer uso guiado

## Qué pasó
«Ocultar guía» pasaba sus tests pero no sobrevivía a recargar Studio: la tarjeta leía localStorage en el inicializador de useState con la raíz del proyecto, que en el primer render todavía es vacía (la conexión abre después). Los tests montaban con la conexión ya abierta.

## Lección
Un valor persistido que depende de un dato que llega async (raíz, usuario, conexión) se lee en cada render con el dato vigente, no en el inicializador de useState; y el test monta primero sin ese dato y después con él.

## Costo evitable
Una vuelta de verificación en el navegador y un rebuild.
