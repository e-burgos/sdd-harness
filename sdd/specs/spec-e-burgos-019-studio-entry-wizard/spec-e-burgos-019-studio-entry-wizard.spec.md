# SPEC-e-burgos-019: La primera pantalla de Studio es un wizard de entrada

> Estado: **in-progress** (2026-11-07). cycle-01 abierto. Sigue a spec-e-burgos-018 (primer uso
> guiado dentro de Studio): esta cubre lo que ve quien llega a la web sin puente conectado.

## Resumen ejecutivo
Quien abre https://studio.sdd.estebanburgos.com.ar sin un puente local ve «Conectá tu repo»: una
tarjeta con comandos sueltos donde el paso 1 es instalar el kit (innecesario para un proyecto nuevo)
y el camino del wizard queda en una línea gris. El dev lo vio en uso real: el usuario no entiende qué
hacer. La primera pantalla tiene que **ser un wizard**: de pantalla completa, con el diseño y el
graphic motion de Studio (spec 016, skill `crafted-motion`), que explique cómo empezar y lleve paso a
paso hasta tener Studio conectado y en «Primeros pasos».

## Historias de usuario
- US-1 — Bienvenida que se entiende. Como dev nuevo, al entrar veo de qué se trata Studio (de una idea
  a un proyecto con IA, paso a paso) y un único botón para empezar; nada de comandos todavía.
- US-2 — Elijo cómo empezar. Como dev, elijo entre **Proyecto nuevo** (recomendado), **Repo que ya
  tengo** o **Ya tengo el puente corriendo**, con una frase de qué implica cada uno.
- US-3 — Requisitos sin sorpresas. Como dev, veo qué necesito (Node 20+, Claude Code con sesión o
  `ANTHROPIC_API_KEY`) con cómo verificarlo y cómo resolverlo, y los voy confirmando.
- US-4 — Un solo comando y conecto. Como dev, veo el comando exacto de mi camino listo para copiar
  (proyecto nuevo: carpeta vacía + `npx @e-burgos/sdd-studio`; repo existente: `configure sdd` +
  `npx @e-burgos/sdd-studio`), sé que la terminal abre Studio sola y, si no, pego el enlace que imprime
  y entro. Si el navegador bloquea la conexión, el wizard me dice qué hacer (permiso de red local en
  Chrome; `--local-ui` en Safari o sin internet).
- US-5 — Sé qué viene después. Como dev, antes de ir a la terminal veo el recorrido que me espera
  dentro de Studio (conectar Claude → crear el proyecto → GitHub → primera spec).

## Decisiones (dev, 2026-11-07)
- La primera pantalla entra directo en el wizard; la tarjeta «Conectá tu repo» desaparece.
- Pantalla completa, diseño nuevo de Studio y graphic motion; «algo que destaque».

## Restricciones
- Solo `apps/studio` (se publica sola con el merge a main). Sin cambios de protocolo ni del puente.
- `prefers-reduced-motion` respetado; accesible por teclado; funciona en mobile.
- El enlace pegado solo se acepta si es de este sitio o de `127.0.0.1`/`localhost` con `bridge` y
  `token` en el hash; nada se envía a ningún servidor.

## Ciclos propuestos
- cycle-01 — Wizard de entrada completo (US-1..US-5).
