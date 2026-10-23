# Context prompt — apps/documentation

> Entry point para agentes y desarrolladores trabajando en `sdd-harness-documentation`.
> Leer este documento antes de editar páginas, contenido o widgets interactivos del sitio de documentación.

## Qué es este subproyecto

Es el portal web de documentación pública del proyecto SDD, desplegado en Cloudflare Pages (`sdd.estebanburgos.com.ar`). Contiene las explicaciones de la metodología, demostraciones interactivas de costos, guías de comandos y páginas informativas de SDD Studio.

## Mapa de navegación rápido

- **Estructura principal:** `src/App.tsx` y `src/main.tsx`.
- **Páginas del sitio:** `src/pages/`
  - `GuiaSddPage.tsx`: Fundamentos y gates de la metodología SDD.
  - `ComoUsarloPage.tsx`: Guía rápida de comandos de la CLI.
  - `SddDocsPage.tsx`: Documentación completa por capítulos.
  - `StudioPage.tsx`: Presentación de SDD Studio.
- **Componentes y Demos:** `src/components/`
  - `LiveCostsDemo.tsx`: Simulador interactivo de consumo y costos de modelos.
  - `Terminal.tsx`: Terminal interactiva simulada.
  - `FileTree.tsx`: Árbol de directorios interactivo.
- **Contenido y Traducciones:** `src/data/`
  - Español: `src/data/content.ts`
  - Inglés: `src/data/content.en.ts`
  - Sincronización desde el kit: `scripts/sync-sdd-content.mjs`

## Comandos de desarrollo y verificación

1. Levantar servidor local: `pnpm dev:docs`
2. Verificar compilación y tipos:
   `pnpm --filter sdd-harness-documentation build`
3. Si se actualizaron los manuales de `templates/sdd/documentation/`:
   `pnpm --filter sdd-harness-documentation sync:sdd-content`

## Cuidados especiales

- **Mantener sincronía ES/EN:** Si se añade una nueva clave o texto explicativo a `content.ts`, añadirla inmediatamente a `content.en.ts`.
- **Compatibilidad con Tailwind v4:** La configuración de estilos se basa en `@tailwindcss/vite` y Tailwind v4; respetar variables y tokens CSS en `index.css`.
