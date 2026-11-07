# spec-e-burgos-014 cycle-01 — GitHub desde la CLI

## Qué pasó
El workflow del kit usaba el id de job `sdd:validate` para que coincidiera con el check requerido; los tests pasaban (nadie valida el YAML), pero la primera corrida real en GitHub falló como «workflow file issue»: los ids de job no admiten `:`.

## Lección
Un template de GitHub Actions se verifica corriéndolo en un repo real (o con un test de ids/estructura); el nombre del check requerido sale de `name:` del job, no de su id.

## Costo evitable
Una corrida de CI fallida en el repo de prueba y un push extra.
