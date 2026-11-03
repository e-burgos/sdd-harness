# SPEC-e-burgos-014: Conectar el proyecto a GitHub (repo, CI y flujo de PRs del ciclo SDD)

> Estado: **draft** (2026-11-03). Sin ciclo abierto: depende de spec-e-burgos-013 y de decisiones
> del dev. Paso 4 del plan: tucu-ui en el kit → generadores → wizard → **GitHub**.

## Resumen ejecutivo
Después de generar el proyecto, el dev quiere conectarlo a GitHub sin salir del flujo: crear el
repositorio, subir el primer commit, dejar el CI del kit (`sdd-validate.yml` y build/test) y que los
ciclos SDD trabajen con ramas y PRs. Hoy el kit trae el workflow de validación, pero crear el repo,
el remoto y las ramas es manual.

## Historias de usuario
- US-1 — Como dev, quiero crear el repo en GitHub (personal u organización, público o privado) desde
  la CLI (`harness github connect`) o desde el último paso del wizard, usando mi `gh` ya autenticado.
- US-2 — Como dev, quiero que el primer push incluya el CI del kit y que la rama por defecto quede
  protegida con `sdd:validate` como check requerido (opcional).
- US-3 — Como dev, quiero que abrir un ciclo cree su rama (`feat/<spec-slug>-cycle-XX`) y que cerrarlo
  proponga el PR con el resumen del reviewer como descripción.
- US-4 — Como dev, quiero ver en Studio el estado del PR y del CI de cada ciclo.

## Restricciones
- Nunca guardar ni pedir tokens: se usa `gh` del dev (o el conector de GitHub del arnés).
- Toda acción hacia afuera (crear repo, push, PR, proteger rama) pide confirmación explícita.
- Funciona igual en los cuatro arneses (comandos del kit, no lógica de un arnés).

## Preguntas abiertas (decisión del dev)
1. ¿`gh` CLI como requisito, o también GitHub App / conector para Studio?
2. ¿Rama por ciclo obligatoria o configurable por perfil (`solo` puede trabajar en main)?
3. ¿Protección de rama por defecto o solo a pedido?

## Dependencias
- spec-e-burgos-013-studio-project-wizard.
