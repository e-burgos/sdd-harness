# TypeScript 7 — bloqueado hoy

Mantené `typescript` en `~6.0.3`. TypeScript 7 (compilador nativo) no se puede adoptar todavía:

- `typescript-eslint` declara peer `<6.1.0`.
- `@nestjs/cli` pide `~6.0.2`.
- `ts-jest` declara peer `<7`.
- Nx 24 depende de `typescript ~6.0.3` (`@nx/eslint`).
- No hay API programática de TypeScript 7 hasta TS 7.1, de la que dependen estas herramientas.

## Qué cambia cuando se destrabe

- Quitar `baseUrl` y `ignoreDeprecations` de los `tsconfig`.
- `paths` pasa a rutas relativas (`./libs/foo/src/index.ts`) sin `baseUrl`.
- No usar `moduleResolution: node` (usar `bundler` o `nodenext`).
- Revisar las demás opciones que TS 6 marca como deprecadas: son las que 7 elimina.
- Subir juntos typescript-eslint, ts-jest, `@nestjs/cli` y Nx a versiones que declaren soporte, y recién
  ahí pasar `typescript` a 7 en un fix propio, con este mismo método y checklist.
