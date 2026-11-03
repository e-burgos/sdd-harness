# SPEC-e-burgos-013: Studio — wizard de arquitectura que genera el proyecto

> Estado: **draft** (2026-11-03). Sin ciclo abierto: depende de spec-e-burgos-012 y de decisiones
> del dev. Paso 3 del plan: tucu-ui en el kit → generadores → **wizard** → GitHub.

## Resumen ejecutivo
El dev quiere que el kit sea un arranque punta a punta: abrir Studio, responder un wizard de
arquitectura y obtener la carpeta del proyecto ya generada, con el kit SDD instalado y la primera
spec lista. Hoy eso existe solo como `harness init` en la terminal (o `init --config` con un JSON).
El wizard es la misma decisión, con explicaciones y una vista previa, y termina corriendo el
generador real a través del puente.

## Flujo (visión del dev, 2026-10-26)
1. Alcance: full stack · solo front · solo back.
2. Forma: standalone o monorepo Nx.
3. Front: SPA simple (Vite), Next, Next como BFF o microfrontends por path — con tucu-ui.
4. Back: Node (streaming, muchos dispositivos: nest/fastify/hono) o Python FastAPI (CPU pesado,
   LangGraph/TensorFlow).
5. Libs compartidas, puertos, Docker, perfil SDD (`team`/`solo`).
6. Resumen con el árbol que se va a generar → **Generar**.

## Historias de usuario
- US-1 — Como dev, quiero un módulo «Nuevo proyecto» en Studio con el wizard de 6 pasos, con
  explicación de cada opción y recomendaciones según lo elegido.
- US-2 — Como dev, quiero ver antes de generar el árbol de carpetas, las apps/libs y los comandos.
- US-3 — Como dev, quiero que el puente genere el proyecto con `harness init --config` en la carpeta
  que elija y que Studio muestre el progreso y el gate de cierre en vivo.
- US-4 — Como dev, al terminar quiero abrir el proyecto nuevo en Studio con su `#general` y una idea
  inicial para Hermes.
- US-5 — El wizard produce el mismo `harness.config.json` que la CLI acepta (un solo contrato).

## Restricciones
- Cambia `libs/studio-protocol` (comando de generación, progreso, selección de carpeta): flow `full`.
- El puente corre comandos en la máquina del dev: carpeta destino explícita, nunca pisa una carpeta
  con contenido sin confirmación.
- Studio sobre tucu-ui; mismos tokens y escala tipográfica.

## Preguntas abiertas (decisión del dev)
1. ¿El wizard vive en Studio con un puente ya conectado a otro repo, o Studio necesita un modo «sin
   proyecto» para arrancar de cero?
2. ¿Generar también instala dependencias y corre el gate, o deja eso para después?
3. ¿Se guarda el `harness.config.json` en el repo nuevo como registro de la decisión?

## Dependencias
- spec-e-burgos-012-generators-tucu-ui.
