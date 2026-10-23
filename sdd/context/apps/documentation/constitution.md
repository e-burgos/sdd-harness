# Constitución — apps/documentation

> Versión 1.0 | Última actualización: 2026-10-23 (profundización de contexto)

## 1. Propósito y Alcance

- **Tipo:** react (Sitio web estático generado con Vite)
- **Paquete:** `sdd-harness-documentation`
- **Rol en el sistema:** Portal de documentación interactivo para el ecosistema SDD. Publicado en `sdd.estebanburgos.com.ar` (Cloudflare Pages). Presenta de manera bilingüe (`es` / `en`) los conceptos metodológicos de Spec-Driven Development, los roles de agentes, guías paso a paso de comandos de la CLI, calculadoras interactivas de consumo de tokens y costos, y la presentación de SDD Studio.
- **Público:** Desarrolladores, evaluadores de la metodología y usuarios de la CLI.

## 2. Stack Tecnológico

- **Framework:** React 18 con Vite como bundler.
- **Tipado:** TypeScript estricto.
- **Estilos:** Tailwind CSS v4, fuentes `@fontsource-variable/space-grotesk` y `@fontsource-variable/jetbrains-mono`.
- **Iconografía e interactividad:** `@phosphor-icons/react`, `framer-motion` para animaciones y transiciones suaves de pestañas y cards.
- **Renderizado de Markdown:** `react-markdown` con `remark-gfm` para tablas y bloques de código.
- **Despliegue:** Cloudflare Pages vía `.github/workflows/deploy-docs.yml` (direct upload de `dist/`, sin compilación remota en Cloudflare).

## 3. Estructura y Módulos Clave

### 3.1 Páginas Principales (`src/pages/`)
- `GuiaSddPage.tsx`: Explicación conceptual profunda de SDD, gates (`SPEC GATE`, `FIX GATE`, `CONTEXTO GATE`, `MEMORIA GATE`) y el ciclo de vida de especificaciones.
- `ComoUsarloPage.tsx`: Guía práctica con comandos de instalación (`harness init`, `configure sdd`, `update sdd`), flujos con Hermes (`harness idea`) y roles de agentes.
- `SddDocsPage.tsx`: Documentación exhaustiva estructurada por secciones con árbol de navegación lateral.
- `StudioPage.tsx`: Presentación de SDD Studio (arquitectura bridge + web, instalación y uso).

### 3.2 Componentes Interactivos (`src/components/`)
- `LiveCostsDemo.tsx`: Calculadora en vivo interactiva que simula el consumo de tokens y gasto en dólares por ciclo según el proveedor y tier de modelo (Claude, Gemini, Copilot).
- `Terminal.tsx`: Visualizador de terminal con comandos interactivos que muestran salidas simuladas de la CLI.
- `FileTree.tsx`: Explorador de árbol de directorios que ilustra la anatomía canónica de un proyecto con SDD.
- `CopyCommand.tsx`: Botón de copiado con feedback visual para snippets de terminal.
- `Markdown.tsx`: Parser enriquecido con estilizado consistente de tablas, alertas y bloques de código.

### 3.3 Contenido Bilingüe y Sincronización (`src/data/` y `src/content/`)
- `src/i18n.tsx`: Contexto de internacionalización que gestiona el idioma activo (`es` | `en`) y almacenamiento en localStorage.
- `src/data/content.ts` y `content.en.ts`: La fuente centralizada de textos, guías, preguntas frecuentes, comparativas y estructura de navegación para español e inglés.
- `src/data/usage.ts` y `usage.en.ts`: Datos históricos de telemetría y tarifas de modelos.
- `src/content/`: Archivos Markdown de referencia (`sdd-readme.*`, `sdd-how-to.*`, `sdd-install.*`).
- `scripts/sync-sdd-content.mjs`: Script de utilidad que copia y sincroniza los manuales desde `apps/cli/templates/sdd/documentation/` hacia `src/content/`.

## 4. Comandos de Trabajo

- **Servidor de desarrollo:** `pnpm dev:docs` (o `pnpm --filter sdd-harness-documentation dev`, Vite en local).
- **Compilar para producción:** `pnpm --filter sdd-harness-documentation build` (`tsc --noEmit && vite build`, genera `dist/`).
- **Previsualizar bundle generado:** `pnpm --filter sdd-harness-documentation preview`.
- **Sincronizar contenido del kit:** `pnpm --filter sdd-harness-documentation sync:sdd-content`.

## 5. Reglas Inviolables y Restricciones

1. **Simetría bilingüe estricta:** Toda modificación, agregado de sección o corrección realizada en `src/data/content.ts` debe reflejarse simultáneamente en `src/data/content.en.ts`.
2. **Sin scripts de testing dedicados:** La verificación de calidad se apoya en el paso de typecheck del build (`tsc --noEmit`). No debe romper `tsc`.
3. **Deploy por Direct Upload:** El proyecto en Cloudflare Pages (`sdd-docs`) no ejecuta build en la nube. Todo el proceso de construcción corre en GitHub Actions (`deploy-docs.yml`) y se sube el directorio `dist/`.
