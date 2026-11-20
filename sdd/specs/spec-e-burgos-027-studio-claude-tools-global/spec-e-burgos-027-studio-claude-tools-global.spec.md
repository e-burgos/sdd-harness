# SPEC-e-burgos-027: La configuración de Claude de Studio es global del dev y cada proyecto la hereda

> Estado: **in-progress** (2026-11-20). cycle-01 abierto (flow lite). Pedido del dev tras cerrar spec-e-burgos-026: «todas las configuraciones
> que tenemos ahora deben ir por defecto en todos los proyectos». Decisión: global del usuario, no default
> del producto.

## Resumen ejecutivo
spec-e-burgos-026 guarda la configuración de Claude (fuentes, plugins y MCP apagados, navegador) por
proyecto en `<root>/.sdd-studio/claude-tools.json`: cada proyecto nuevo arranca todo apagado y hay que
volver a prender fuentes y navegador. El dev quiere configurarlo una vez y que todo proyecto lo herede,
pudiendo darle a un proyecto su propia configuración cuando haga falta.

## Historias de usuario
- US-1 — Global. Como dev, lo que prendo o apago en el módulo Claude vale para todos mis proyectos: se
  guarda a nivel usuario y un proyecto sin configuración propia la hereda.
- US-2 — Por proyecto. Como dev, puedo darle a un proyecto su propia configuración (parte de la global) y
  volver a la global cuando quiera; el módulo muestra cuál está en uso.
- US-3 — Promover. Como dev, si un proyecto ya tiene configuración propia (la de spec-e-burgos-026), puedo
  guardarla como global con un clic.

## Decisiones (dev, 2026-11-20)
- Global del usuario; el default del producto no cambia (todo apagado para quien no configuró nada).
- Flow `lite`.

## Restricciones
- La global vive fuera de los repos (`~/.sdd-studio/claude-tools.json`); nunca en `~/.claude*`.
- Resolución: configuración del proyecto si existe; si no, la global; si no, los defaults de hoy.
- El inventario sigue siendo por proyecto (los conteos dependen del repo).
- Compatibilidad: una web nueva contra un puente sin esta feature sigue funcionando como en 026.

## Ciclos propuestos
- cycle-01 — Contrato (alcance), puente (global + resolución) y UI (alcance, personalizar, volver, promover).
