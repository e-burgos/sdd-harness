# Instalación del framework SDD en un repo nuevo

Esta carpeta es una copia **limpia y portable** del sistema SDD: sin specs, fixes,
tasks ni contextos de ningún proyecto. Todos los registros están vacíos y validan
contra sus schemas.

## Pasos

1. **Copiar esta carpeta al repo destino como `sdd/`** (el nombre importa: scripts,
   prompts y agentes referencian rutas `sdd/...`):

   ```bash
   cp -R sdd-portable /path/al/repo/sdd
   ```

   Si el repo destino arranca de cero (sin workspace Nx), crear primero el workspace
   siguiendo `sdd/skills/scaffold-nx/skill.md` y los archivos de referencia de
   `sdd/templates/nx-workspace/` (`create-nx-workspace` + config raíz alineada).

2. **Registrar los scripts en el `package.json` raíz del repo destino:**

   ```json
   {
     "scripts": {
       "setup:agents": "node -e \"if(process.platform==='win32'){require('child_process').execSync('powershell -ExecutionPolicy Bypass -File sdd/scripts/setup-agents.ps1',{stdio:'inherit'})}else{require('child_process').execSync('bash sdd/scripts/setup-agents.sh',{stdio:'inherit'})}\"",
       "sdd:docs": "node sdd/docs/serve.mjs",
       "sdd:validate": "node sdd/scripts/validate-sdd.mjs",
       "sdd:rebuild-tasks-index": "node sdd/scripts/rebuild-tasks-index.mjs",
       "sdd:rebuild-catalog": "node sdd/scripts/rebuild-catalog.mjs"
     }
   }
   ```

3. **Generar los symlinks del arnés** (`.claude/`, `.github/`, `CLAUDE.md`/`AGENTS.md`
   raíz apuntando a `sdd/dual-harness/`):

   ```bash
   pnpm setup:agents
   ```

4. **Completar las plantillas** — buscar los marcadores `[...]`:
   - `sdd/global.json` → `project`, `description`, `monorepo` (apps/libs reales).
     **`project` y `description` son la única fuente de verdad del nombre y la descripción:
     ningún otro archivo de `sdd/` los hardcodea, todos apuntan acá.** Eso es lo que
     mantiene `sdd/` portable entre repos, y `pnpm sdd:validate` lo verifica.
   - `sdd/context/constitution.md` → visión, responsabilidades, principios, tablas
   - `sdd/context/context_prompt.md` → rol arquitectónico y estructura real
   - `sdd/context/[apps|libs|tools]/[nombre]/` → crear el contexto de cada subproyecto
     al generarlo con Nx (arranca vacío)

5. **Validar:**

   ```bash
   pnpm sdd:validate
   ```

6. (Opcional) **CI:** copiar el workflow de validación del repo origen
   (`.github/workflows/sdd-validate.yml`) para que todo PR que toque `sdd/**`
   corra `pnpm sdd:validate`.

## Qué incluye

| Carpeta / archivo  | Contenido                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `agents/`          | Los 7 agentes del ciclo SDD                                                                     |
| `skills/`          | 16 skills (ciclo SDD + generadores de código + scaffold-nx + setup-graphify)                    |
| `templates/`       | Scaffolding reproducible: nx-workspace, java-api, react-app, ts-lib — ver `templates/README.md` |
| `prompts/`         | Prompts de gates (SPEC GATE, FIX GATE, inicio y cierre de ciclo)                                |
| `schemas/`         | JSON Schemas estrictos de todos los registros                                                   |
| `scripts/`         | validate, rebuild-tasks-index, rebuild-catalog, setup-agents                                    |
| `docs/`            | Visor portable de documentación (JS vanilla, cero deps)                                         |
| `dual-harness/`    | CLAUDE.md / AGENTS.md para linkear en la raíz del repo                                          |
| `context/`         | Plantillas de constitución y context prompt (global + example)                                  |
| `specs/`, `fixes/` | Vacíos, listos para las primeras specs y fixes                                                  |
| `*.json`           | Registros de estado vacíos y válidos (`sdd:validate` OK)                                        |

Guía de uso completa: [HOW-TO-USE-SDD.md](HOW-TO-USE-SDD.md) · Referencia del sistema: [README.md](README.md)
