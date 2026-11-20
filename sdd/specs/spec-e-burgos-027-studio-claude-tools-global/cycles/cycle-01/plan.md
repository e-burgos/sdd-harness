# spec-e-burgos-027-studio-claude-tools-global — cycle-01 · plan (lite)

> Módulo: studio-claude-tools-global | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: la configuración de Claude de Studio se guarda a nivel usuario y todo proyecto la hereda, con override
> por proyecto. Fuera de alcance: cambiar el default del producto, inventario global, sincronizar entre procesos del puente en vivo.

## Historias
- US-1 — Global por defecto. CA: con `~/.sdd-studio/claude-tools.json` y sin archivo en el proyecto, el motor y el módulo usan la global; un `set` sin override escribe la global.
- US-2 — Override por proyecto. CA: «Personalizar este proyecto» crea `<root>/.sdd-studio/claude-tools.json`; «Volver a la global» lo borra; el módulo muestra el alcance en uso.
- US-3 — Promover. CA: con override en uso, «Guardar como global» escribe la global con esa config (el override queda hasta que el dev vuelva a la global).

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `ClaudeToolsScope` (`global` | `project`); `scope` en `ClaudeToolsGetResult`/`ClaudeToolsSetResult` (opcional con `.catch` para puentes viejos); `scope?` en `claude.tools.set`; comando `claude.tools.useGlobal {expectedRevision}`; specs.
- TASK-002 — Puente: archivo global (`~/.sdd-studio/claude-tools.json`, raíz inyectable para tests), resolución proyecto → global → defaults, revisión que incluye el alcance, `set` por alcance, `useGlobal` borra el override, caché del motor coherente (un cambio global refresca la de cada runtime abierto); router y specs.
- TASK-003 — Studio: indicador de alcance en Fuentes, «Personalizar este proyecto», «Volver a la global», «Guardar como global»; sin `scope` (puente viejo) la UI se ve como en 026; i18n es/en; specs.
- TASK-004 — Verificación real: promover la configuración de este repo a global, volver a la global, y comprobar en otro proyecto que hereda; cierre.

## Decisiones técnicas
- **D-01 Ubicación.** Global en `~/.sdd-studio/claude-tools.json` (`os.homedir()`; `SDD_STUDIO_HOME` la reemplaza en tests). Nunca en `~/.claude*`.
- **D-02 Resolución y escritura.** Efectiva = proyecto si existe el archivo, si no global, si no defaults. `set` sin `scope` escribe en el alcance efectivo (global cuando no hay override). `set {scope:'project'}` crea/actualiza el override; `set {scope:'global'}` escribe la global sin tocar el override. `useGlobal` borra el override (con `expectedRevision`).
- **D-03 Revisión.** Hash de `scope + bytes` del archivo efectivo: cambiar de alcance cambia la revisión, así un cliente con la vista vieja recibe `conflict`.
- **D-04 Caché.** La caché por root de spec-e-burgos-026 pasa a resolver contra la global; un cambio global invalida las cachés de todos los runtimes del proceso. Otro proceso del puente lo ve en su próximo `get`/`set` (anotado, fuera de alcance).
- **D-05 Contrato aditivo.** Campos nuevos opcionales y un comando nuevo bajo la feature existente `claude-tools` más la feature `claude-tools-scope` para que la web sepa si el puente soporta alcance. `PROTOCOL_VERSION` sigue en 2.
