# SPEC-e-burgos-014: Conectar el proyecto a GitHub (repo, CI y flujo de PRs del ciclo SDD)

> Estado: **in-progress** (2026-11-07). Decisiones del dev tomadas el 2026-11-07; cycle-01 cerrado, queda cycle-02.
> Paso 4 del plan: tucu-ui en el kit → generadores → wizard → **GitHub**. La consume
> spec-e-burgos-018 (onboarding guiado), que usa la conexión como paso del primer uso.

## Resumen ejecutivo
Después de generar el proyecto, el dev quiere conectarlo a GitHub sin salir del flujo: crear el
repositorio, subir el primer commit con el CI del kit y que los ciclos SDD trabajen con ramas y PRs.
Hoy el kit no escribe ningún workflow (la documentación promete `.github/workflows/sdd-validate.yml`
pero nada lo crea), y crear el repo, el remoto, las ramas y los PRs es manual.

## Historias de usuario
- US-1 — Como dev, quiero crear el repo en GitHub (personal u organización, público o privado) con
  `harness github connect`, usando mi `gh` ya autenticado, y que el primer push incluya el CI del kit.
- US-2 — Como dev, quiero proteger la rama por defecto con `sdd:validate` como check requerido, solo
  si lo pido (al conectar o con un comando aparte).
- US-3 — Como dev, quiero que abrir un ciclo cree su rama (`feat/<spec-slug>-cycle-XX`) y que
  cerrarlo proponga el PR con el resumen del reviewer como descripción, según el perfil del repo.
- US-4 — Como dev, quiero ver en Studio si el proyecto está conectado a GitHub, conectarlo desde ahí
  y ver el estado del PR y del CI de cada ciclo en curso.

## Decisiones del dev (2026-11-07)
1. **Solo `gh` CLI.** Sin GitHub App ni tokens guardados: la CLI del kit y el puente de Studio usan el
   `gh` autenticado del dev. Sin `gh` o sin login, todo explica cómo instalarlo/autenticarse y no falla
   el resto del kit.
2. **Rama y PR por ciclo según perfil.** `team`: el orquestador crea la rama al abrir el ciclo y el
   reviewer propone el PR al cerrarlo. `solo`: opcional (se informa el comando). Override en
   `sdd/global.json → github.branch_per_cycle` (`"on"` | `"off"`; ausente = según perfil).
3. **Protección de rama solo a pedido**: casilla apagada al conectar y `harness github protect`.

## Restricciones
- Toda acción hacia afuera (crear repo, push, PR, proteger rama) pide confirmación explícita: los
  comandos muestran el plan y solo ejecutan con `--yes` (o la confirmación de la UI).
- Funciona igual en los cuatro arneses (comandos y scripts del kit, no lógica de un arnés).
- Compatibilidad: el bloque `github` de `global.json` es opcional; sin `gh` nada cambia.

## Ciclos propuestos
- **cycle-01 — Kit y CLI (US-1..US-3).** Workflow de CI del kit; `harness github connect | status |
  protect`; scripts `pnpm sdd:branch` y `pnpm sdd:pr` con la librería `github.mjs`; bloque `github`
  opcional en `global.schema.json`; orquestador, reviewer y docs.
- **cycle-02 — Studio (US-4).** Comandos del puente `github.status` / `github.connect`; estado de PR
  y CI por ciclo en el snapshot; Studio lo muestra y ofrece conectar.

## Fuera de alcance
- GitHub App, OAuth web o tokens propios; GitLab/Bitbucket; merge automático de PRs.

## Dependencias
- spec-e-burgos-013-studio-project-wizard (completada).
