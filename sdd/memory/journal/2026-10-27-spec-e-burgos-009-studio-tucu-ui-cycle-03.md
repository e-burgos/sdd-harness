# spec-e-burgos-009-studio-tucu-ui · cycle-03

## Qué pasó
Al sacar los `!` de los modales, el panel del `Modal` tomó bien `bg-ink-950/95` en los dos modos, pero el `Tooltip` de tucu trae variantes `dark:bg-*`: tailwind-merge solo resuelve conflictos con el mismo modificador, así que un `bg-*` sin `dark:` no las pisa en oscuro. Se dejó el color por defecto del Tooltip, como en el resto de la app.

## Lección
Sobre componentes de tucu-ui con variantes `dark:`, verificar el override en los dos modos: o se usa el color por defecto del componente, o el override lleva su propia variante `dark:`; revisar solo en un modo esconde la regresión.

## Costo evitable
Una recorrida en un solo modo habría dado por bueno el override; probar el modo oscuro a mano costó una vuelta de navegador.
