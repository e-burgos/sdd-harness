# `@e-burgos/sdd-harness` — Guía Completa de Uso y Arquitectura

`@e-burgos/sdd-harness` es una interfaz de línea de comandos (CLI) diseñada para estructurar, configurar y arrancar monorepos de Nx que estén listos para ser operados de forma autónoma por agentes de Inteligencia Artificial (AI Agents). El proyecto está integrado con la metodología **SDD (Spec-Driven Development)**, permitiendo que agentes de codificación autónomos implementen características ciclo a ciclo siguiendo una especificación rigurosa.

---

## 🎯 ¿Para qué es útil?

Configurar un monorepo robusto, definir contratos de API, bases de datos y orquestar flujos de trabajo para que IAs cooperen en la codificación es una tarea compleja que requiere mucho boilerplate. Esta librería automatiza todo el proceso al:

1. **Estructurar un Workspace Nx Moderno**: Configura `pnpm workspaces`, TypeScript, ESLint, Nx y Vitest con mejores prácticas de desacoplamiento.
2. **Catalogar Aplicaciones y Librerías**: Permite añadir servicios backend y clientes frontend rápidamente mediante generadores internos limpios.
3. **Integrar Contenedores Docker con Healthchecks**: Genera configuraciones de Docker Compose listas para producción con bases de datos y colas de mensajes que no inician hasta que sus servicios dependientes estén listos.
4. **Instanciar la Metodología SDD**: Genera prompts de contexto, constituciones de proyecto, esquemas JSON y agentes Markdown para que IAs (como Claude, Gemini, Copilot o Cursor) trabajen en un pipeline estructurado.
5. **Configurar Servidores MCP (Model Context Protocol)**: Define accesos estandarizados para que las IAs interactúen con herramientas del sistema de archivos, Figma, GitHub, Notion, Playwright y comandos Nx.

---

## 🚀 Instalación y Requisitos

### Requisitos del Sistema
- **Node.js**: Versión `≥ 18` (LTS recomendado).
- **pnpm**: Versión `≥ 9` (es el gestor de paquetes por defecto del monorepo generado).

### Formas de Ejecución
Puedes ejecutar el CLI directamente sin instalarlo, o instalarlo globalmente en tu sistema.

```bash
# Opción 1: Ejecutar directamente con npx (Recomendado)
npx @e-burgos/sdd-harness init

# Opción 2: Ejecutar directamente con pnpm
pnpm dlx @e-burgos/sdd-harness init

# Opción 3: Instalación global
npm install -g @e-burgos/sdd-harness
harness init
```

---

## 🛠️ Comandos y Funcionalidades

El CLI utiliza una arquitectura de subcomandos interactivos construida sobre `citty` y `@clack/prompts`.

### 1. `harness init`
Inicializa un nuevo monorepo Nx desde cero. Te guiará a través de preguntas interactivas para definir:
- El nombre del espacio de trabajo y su scope de npm (ej. `@mi-proyecto`).
- Qué aplicaciones crear de inicio (NestJS, React, Next.js, Fastify, Python).
- Qué librerías compartidas acoplar (Tipos compartidos, Utilidades, UI Kit, Cliente API, Configuración).
- Qué infraestructura levantar con Docker (Postgres, Redis, RabbitMQ, MinIO).
- Activación de SDD.

```bash
harness init [--name <kebab-case-name>] [--config <path-to-config-file>] [-y|--yes]
```

### 2. `harness add app`
Añade una nueva aplicación al monorepo existente respetando la arquitectura de Nx.
```bash
harness add app [nestjs|react|nextjs|fastify|python] [--name <app-name>]
```

### 3. `harness add service`
Añade un servicio de infraestructura Docker al archivo `docker-compose.yml` y actualiza automáticamente el archivo `.env.example` con las credenciales requeridas.
```bash
harness add service [postgres|redis|rabbitmq|minio]
```

### 4. `harness add skill`
Genera una nueva "habilidad" (skill) bajo `sdd/skills/`. Los skills son guías en formato Markdown que los agentes de IA leen para saber cómo realizar tareas específicas en el monorepo (por ejemplo, cómo estructurar una migración de base de datos o cómo crear un módulo específico).
```bash
harness add skill [nombre-del-skill]
```

### 5. `harness configure`
Permite reconfigurar módulos específicos del espacio de trabajo:
- `harness configure sdd`: Reinicia o actualiza la infraestructura de agentes y esquemas de SDD.
- `harness configure docker`: Regenera completamente el `docker-compose.yml` basándose en una selección interactiva.
- `harness configure mcp`: Genera un archivo `.mcp.json` para dar superpoderes de contexto a las IAs conectándose a servicios externos.

### 6. `harness info`
Muestra un reporte resumido del estado del monorepo, incluyendo aplicaciones detectadas, librerías compartidas, servicios de Docker activos y el ciclo actual de desarrollo SDD.
```bash
harness info
```

---

## 🗂️ Estructura de un Monorepo Setup por Harness

Una vez inicializado, la estructura típica generada luce así:

```
mi-proyecto/
├── apps/
│   ├── api/                    # Servidor NestJS o Fastify
│   └── webapp/                 # Aplicación React + Vite o Next.js
├── libs/
│   ├── shared-types/           # DTOs e interfaces TS compartidas
│   └── shared-utils/           # Validadores y funciones helpers comunes
├── sdd/                        # Infraestructura para Agentes IA
│   ├── context/
│   │   ├── constitution.md     # Reglas y estándares del código del proyecto
│   │   └── context_prompt.md   # Prompt de sistema para los agentes
│   ├── agents/                 # Markdown explicativo de los roles de IA
│   ├── skills/                 # Instrucciones paso a paso para tareas complejas
│   ├── specs/                  # Especificaciones de negocio / requerimientos
│   ├── global.json             # Estado de los ciclos de desarrollo
│   ├── schema.json             # Modelado de base de datos acumulativo
│   ├── api.json                # Endpoints HTTP creados
│   └── components.json         # Componentes frontend registrados
├── docker-compose.yml          # Infraestructura local orquestada
├── nx.json                     # Configuración del monorepo de Nx
├── package.json                # Scripts globales y dependencias compartidas
└── pnpm-workspace.yaml         # Configuración del espacio de trabajo
```

---

## 🤖 ¿Qué es la metodología SDD?

La **Metodología SDD (Spec-Driven Development)** de Harness organiza el ciclo de vida del software en base a una especificación de producto (`SPEC.md`). En lugar de escribir código inmediatamente, los cambios de funcionalidad pasan por una serie de fases lógicas representadas por agentes de IA:

```
1. Orchestrator  ➔ Lee SPEC.md, organiza el ciclo actual y las tareas técnicas.
2. Functional    ➔ Define historias de usuario y criterios de aceptación detallados.
3. Planner       ➔ Divide las historias en tareas técnicas estimadas en horas.
4. Architect     ➔ Diseña los contratos de API y esquemas de Base de Datos.
5. Back Implementor ➔ Genera el código backend (NestJS/Prisma/Endpoints).
6. Front Implementor ➔ Diseña y conecta la interfaz frontend (React/Queries).
7. Reviewer      ➔ Ejecuta linters, valida pruebas y cierra el ciclo.
```

Harness genera todo este ecosistema (prompts, archivos de control de estado en JSON y Markdown explicativos) para que puedas conectar tu cliente de IA (como Claude Desktop con MCP) y permitirle trabajar de manera automatizada y predecible.

---

## ⚙️ Configuración Programática (`harness.config.ts`)

Harness permite crear un archivo `harness.config.ts` en el directorio raíz para inicializaciones rápidas y repetibles. Este archivo se valida internamente con `zod`:

```typescript
import { defineConfig } from '@e-burgos/sdd-harness';

export default defineConfig({
  project: {
    name: 'mi-saas',
    description: 'Plataforma SaaS multi-tenant',
    packageScope: '@mi-saas',
  },
  apps: [
    { name: 'api', type: 'nestjs', port: 3000 },
    { name: 'webapp', type: 'react', port: 4200 }
  ],
  services: [
    { type: 'postgres', port: 5432 },
    { type: 'redis', port: 6379 }
  ],
  sdd: {
    enabled: true,
    modules: ['auth', 'users', 'billing']
  }
});
```
Una vez creado el archivo, puedes levantar la estructura ejecutando:
```bash
npx @e-burgos/sdd-harness init --config harness.config.ts --yes
```
