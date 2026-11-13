# spec-e-burgos-023 cycle-01 — Nx 22/23/24 y migración

## Qué pasó
La investigación de Nx 24 (notas de release + peerDependencies de cada @nx/*) concluyó «bajo riesgo». La generación real mostró que Nx 24 eliminó casi todos los executors que el kit escribía (lint, test, build, serve) y el gate falló; y la migración real mostró que `nx migrate --run-migrations` en la rama por defecto se niega a correr saliendo con 0, con lo que el comando borraba migrations.json sin migrar.

## Lección
Una subida de mayor de una herramienta de build no se da por compatible leyendo notas y peers: se valida con una generación real y una migración real antes de publicar.

## Costo evitable
Publicar el kit con Nx 24 por defecto habría generado workspaces rotos desde el primer `nx run-many`, y el comando de migración habría dejado proyectos reales a medias.
