# SPEC-e-burgos-028: Pulido visual de Studio — markdown único, ciclos colapsables, modal de documentos y controles del Mapa

> Estado: **completed** (2026-11-20). cycle-01 cerrado (flow lite, 4/4 tasks). Pedido del dev con capturas tras probar spec-e-burgos-026/027.

## Resumen ejecutivo
Cuatro defectos visuales: (1) en Métricas › Planificación solo colapsan las specs, no los ciclos; (2) el
modal de documentos encima la etiqueta «Ruta» con la ruta y deja un hueco abajo; (3) los documentos del
módulo Kit se ven casi sin formato (títulos, tablas y frontmatter YAML como texto plano) porque Studio
tiene tres renderizadores de markdown distintos y el de Kit no tiene estilos; (4) los controles
segmentados del Mapa son grandes frente al resto. Diseño con tucu-ui (`Collapse`, `SegmentedControl`,
`SplitModal`), verificado contra la versión fijada en Studio.

## Historias de usuario
- US-1 — Como dev, colapso y expando cada ciclo en Planificación; el ciclo en curso arranca abierto y la elección persiste.
- US-2 — Como dev, el modal de documentos muestra la ruta sin encimarse y sin hueco vacío abajo.
- US-3 — Como dev, todo markdown de Studio (Kit, modal, chat) se ve con formato: títulos, listas, tablas con bordes, citas, código y el frontmatter como ficha.
- US-4 — Como dev, los controles segmentados del Mapa tienen el tamaño compacto del resto de la UI.

## Decisiones (dev, 2026-11-20)
- Usar los componentes de tucu-ui; flow `lite`.

## Restricciones
- Un solo componente de markdown; sin dependencias nuevas salvo que sea imprescindible.
- Revisar modo claro y oscuro de cada cambio.

## Ciclos propuestos
- cycle-01 — Las cuatro mejoras y verificación en el navegador.
