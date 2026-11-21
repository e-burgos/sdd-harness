# FIX-e-burgos-010 — «Asociado a» se puede compactar en el encabezado de la conversación

## Problema
En el encabezado de una conversación, la fila «Asociado a» muestra todos los chips de specs, ciclos y fixes asociados; con varias asociaciones ocupa varias líneas y empuja el contenido, aunque tenga scroll.

## Solución aplicada
- La fila «Asociado a» arranca compacta (primer chip + «+N») y se expande o pliega con un botón; la elección persiste (`use-collapsed-state`, id `thread-links`). «Agregar asociación…» queda siempre visible.

### Archivos modificados
- `apps/studio/src/components/workspace/ThreadLinkPicker.tsx`
- `apps/studio/src/components/workspace/threadlink.spec.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`
