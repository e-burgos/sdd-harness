# FIX-e-burgos-025-001 — `--split-project` reconoce el separador real de una absorción

| Campo         | Valor                            |
| ------------- | -------------------------------- |
| **ID**        | FIX-e-burgos-025-001             |
| **Tipo**      | BUGFIX                           |
| **Severidad** | high                             |
| **Keyword**   | [BUGFIX]                         |
| **Fecha**     | 2026-11-18                       |
| **Autor**     | e-burgos                         |
| **Spec**      | spec-e-burgos-025-agent-context  |

## Problema

En 0.23.0, `splitAbsorbed` solo quitaba el separador exacto `\n\n---\n\n` antes de
«Instrucciones previas del proyecto» y hasheaba la cabeza sin normalizar el final. Las absorciones
reales dejan `-->\n---\n\n` o solo líneas en blanco, así que una cabeza igual al núcleo publicado
no se reconocía: `harness update sdd --split-project` dejaba `.new` en los tres arneses en vez de
adoptar el núcleo nuevo (visto al actualizar este repo).

## Solución aplicada

`headWithoutSeparator` (en `project-md.ts`) quita espacios finales y una regla horizontal final y
deja un único fin de línea con el EOL del archivo.

## Validación

Tres casos nuevos en `update.split-project.spec.ts` con los separadores reales. Corrida real
sobre una copia de `main`: los tres arneses pasan a núcleo (5,2–5,4 KB), 20,6 KB a `project.md`,
sin `.new` de arnés.
