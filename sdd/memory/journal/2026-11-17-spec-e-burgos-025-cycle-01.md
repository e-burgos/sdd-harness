# spec-e-burgos-025 cycle-01 — contexto por agente, ejecución

## Qué pasó
Los cuatro implementadores dejaron todo en verde con sus tests, y dos auditorías adversariales posteriores encontraron 22 defectos reales: un chequeo de «ya presente» por substring que borraba instrucciones del dev, `--init` que pisaba un `verify.json` con BOM, `sdd:task` que perdía escrituras concurrentes, un lease que se liberaba con el build vivo, y `fs.copy` que rompía los hardlinks de Windows al reemplazar un archivo del kit.

## Lección
En código del kit que reescribe archivos del usuario o coordina procesos, una auditoría adversarial que reproduce sus hallazgos es parte de la task, no un extra: los tests del implementador solo cubren lo que el implementador imaginó.

## Costo evitable
Publicar 0.23.0 con esos defectos habría borrado instrucciones de repos reales en la primera migración.
