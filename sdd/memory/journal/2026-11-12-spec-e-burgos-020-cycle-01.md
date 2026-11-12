# spec-e-burgos-020 cycle-01 — skills de diseño del kit

## Qué pasó
Para escribir recetas de diseño replicables se relevó el código de dos productos y de tucu-ui. Las skills de diseño propias de los repos divergían de su código (otra landing, clases muertas en uso) y los productos estaban en versiones distintas de tucu-ui (3.0 vs 3.10): un prop de 3.0 (`Button variant="brand"`) ya no existe y el `GlassPanel` de 3.10 no replica el vidrio del producto.

## Lección
Una receta de diseño se extrae del código real y se verifica prop por prop contra la fuente de la versión de la librería que el kit fija, nunca contra la skill o la doc del proyecto de origen.

## Costo evitable
Copiar la skill del repo de origen habría publicado en el kit props que crashean en runtime y un vidrio sin saturate ni fallback.
