# spec-e-burgos-008 cycle-01 — 2026-10-26

## Qué pasó
Al cerrar el ciclo se vio que un evento nuevo del protocolo (`question.requested`) también viajaba dentro del resultado de `thread.history`. Una web anterior descarta en silencio un frame suelto que no parsea, pero un resultado de comando con un evento desconocido no se puede parsear entero: el hilo no habría cargado. Spec-007 ya lo había resuelto para `document.touched` con un opt-in en `thread.history`, y se aplicó el mismo patrón (`includeQuestions`) antes de cerrar.

## Lección
Todo evento nuevo de `libs/studio-protocol` que se persista en el historial necesita su opt-in en `thread.history` y una prueba de que sin él no sale; revisarlo al diseñar el evento, no al cerrar.

## Costo evitable
Una vuelta de rediseño y de pruebas al final del ciclo en lugar de decidirlo junto con el contrato.
