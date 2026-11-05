# SPEC-e-burgos-015: Visión — Studio como framework de trabajo sobre un kit independiente

> Estado: **draft** (2026-11-03). Spec de visión: no abre ciclo hasta que el dev decida formalizar el
> framework. Mientras tanto fija la regla de independencia que respetan las specs 012–014.

## Resumen ejecutivo
El kit (`@e-burgos/sdd-harness`: CLI, `sdd/`, arneses, generadores) es el producto base y funciona
solo, sin Studio. SDD Studio (`apps/studio`, Next) es un framework de trabajo construido encima: le da
sentido visual y operativo al kit, pero lo **consume**; nunca al revés. Hoy Studio es una web en la
nube que se conecta por el bridge (`@e-burgos/sdd-studio`) a los proyectos locales, y así sigue. Esta
spec deja anotado que el día de mañana puede formalizarse como framework (o derivar uno de lo que hay)
y qué decisiones habría que tomar entonces.

## Regla de independencia (vigente desde ya)
- Ninguna capacidad del kit o de la CLI puede requerir Studio, el bridge ni la web para funcionar.
- Studio solo usa el kit a través de sus superficies públicas: la CLI (`harness …`), los scripts del
  kit (`pnpm sdd:*`) y los registros `sdd/`, siempre vía el bridge.
- Lo que Studio necesite del kit se agrega primero al kit como capacidad propia (comando, flag,
  registro) y después Studio lo consume. Ej.: el wizard (spec-013) llama a los generadores de la
  spec-012; la conexión a GitHub (spec-014) vive en la CLI.
- La UI no asume dónde corre el bridge (local hoy; embebido o remoto mañana): solo habla el protocolo
  de `libs/studio-protocol`.

## Decisiones abiertas para cuando se formalice el framework
1. Backend propio en la nube (cuentas, varios proyectos/equipos, estado persistido) frente al export
   estático actual en Cloudflare Pages.
2. Emparejamiento seguro web pública ↔ bridge local (token de emparejamiento, validación de origen).
3. Escritorio (Electron/Tauri con el bridge embebido) como canal adicional o reemplazo.
4. Autenticación del proveedor: el login de claude.ai con el Agent SDK requiere aprobación de
   Anthropic para terceros; alternativas como clave propia del usuario.
5. Si "framework" significa además una API/SDK para extender Studio (módulos, plugins) y cómo se
   versiona respecto del kit.

## Fuera de alcance
- Implementación: esta spec no abre ciclo. Las specs 012–014 siguen su curso respetando la regla.
