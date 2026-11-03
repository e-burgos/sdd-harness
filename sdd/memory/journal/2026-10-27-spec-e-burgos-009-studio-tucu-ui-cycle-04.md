# spec-e-burgos-009-studio-tucu-ui · cycle-04

## Qué pasó
El nombre del proyecto en el sidebar nuevo quedó invisible en modo oscuro: usaba `text-body`, el paso de 14px de la escala tipográfica de Studio, pero tucu-ui define `--color-body` (el fondo de la página) y Tailwind generó las dos utilidades, tamaño y color. Los tests y el typecheck pasaban; solo se vio midiendo el color en el navegador. En el mismo ciclo, un chip de estado dentro de una fila-botón cambió su nombre accesible y rompió 6 de 8 e2e en cascada.

## Lección
Un token propio de Tailwind (`--text-*`, `--color-*`) no puede llamarse igual que un token de color de la librería de UI: antes de nombrarlo, buscar `--color-<nombre>` en su CSS; y todo cambio de contenido dentro de un elemento interactivo se valida con el e2e, no solo con vitest.

## Costo evitable
Dos vueltas de build, bridge y navegador para encontrar el color heredado, y una corrida extra de e2e por el nombre accesible.
