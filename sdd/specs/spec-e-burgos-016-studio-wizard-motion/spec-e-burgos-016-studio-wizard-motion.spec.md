# SPEC-e-burgos-016: Studio — wizard con graphic motion y skill crafted-motion en el kit

> Estado: **in-progress** (2026-11-05). cycle-01 abierto (flow lite).
> Sucesora de spec-e-burgos-013 (wizard de proyecto). Referencia visual: la landing pública de
> Display Ads (clientes.displayads.com.ar, código en opticagestion `apps/web/src/modules/landing/`).

## Resumen ejecutivo
El wizard de Studio funciona, pero es una lista de formularios sin dirección visual. El dev quiere
que sea lo primero que ve un usuario nuevo y que tenga el mismo nivel de graphic motion que la
landing de Display Ads: puertas con un shader que reacciona al cursor, titulares que entran palabra
por palabra, rieles con un token que viaja, estados vivos que avanzan solos. Además, ese método se
destila en un skill propio del kit (`crafted-motion`) para que cualquier proyecto generado pueda
pedir webs y prompts con estas capacidades.

## Historias de usuario
- US-1 — Como dev que usa el kit, quiero un skill `crafted-motion` que explique cómo diseñar e
  implementar graphic motion en React/Next (capas CSS, framer-motion, GSAP, WebGL), con tokens,
  runtime, recetas, transiciones de wizard, trampas y QA.
- US-2 — Como usuario de Studio, quiero que el primer paso del wizard (Alcance) sea una escena con
  dos puertas (front cálido y back frío) sobre un fondo vivo que reacciona a lo que señalo y elijo.
- US-3 — Como usuario, quiero que pasar de paso se sienta como avanzar: título que entra palabra
  por palabra, opciones escalonadas, selección con brillo, dirección según avance o retroceso.
- US-4 — Como usuario, quiero ver mi avance en un riel que se llena, con un token que viaja al paso
  actual y checks que aparecen con un pop.
- US-5 — Como usuario, quiero que la generación se vea viva: la etapa en curso late, el progreso
  avanza, cada etapa terminada confirma con un check y el éxito cierra con una celebración breve.

## Restricciones
- El HTML de cada paso es la versión final: sin JS de motion, con `prefers-reduced-motion` o en
  pantallas angostas, todo se ve y se usa igual.
- GSAP y el shader se cargan con `import()` solo en escritorio y sin reduced motion; el shader
  tiene fallback estático y no dibuja fuera de vista ni con la pestaña oculta.
- Solo se anima `transform`, `opacity`, `filter` y `clip-path`. Studio sigue sobre tucu-ui y su
  escala tipográfica.
- El skill es genérico: nada de marca, copy ni reglas propias de Display Ads.

## Dependencias
- spec-e-burgos-013-studio-project-wizard (completed).
