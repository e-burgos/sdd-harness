# SPEC-e-burgos-006: SDD Studio — conectar suscripción de Claude o API key desde la sidebar

> Estado: **completed** (cycle-01 cerrado 2026-10-26). Flow `lite` (pedido explícito `[LITE]`). Uso local/desarrollo.

## Resumen ejecutivo

La sidebar de SDD Studio solo ofrece «Usar mi API key». Esta spec la reemplaza por un panel con
dos solapas: **Suscripción** (login de Claude vía `claude auth login`, lanzado por el puente, con
estado, email, método y plan) y **API key** (comportamiento actual intacto). El modo elegido es
efectivo: en suscripción el SDK no hereda `ANTHROPIC_API_KEY` ni `ANTHROPIC_AUTH_TOKEN`.

## Alcance

- `libs/studio-protocol`: comandos `auth.status`, `auth.login`, `auth.logout`; campo opcional `mode` en `auth.set`.
- `apps/studio-bridge`: `ClaudeLogin` (spawn de `claude auth …`), `AuthState` con preferencia de modo.
- `apps/studio`: `AuthPanel` con tablist Suscripción / API key, i18n es/en, sugerencia ante límite de uso.

## Fuera de alcance

Guardar tokens, OAuth propio, soporte de otros proveedores.

## Requisitos

- Nada pasa a `required`: clientes viejos siguen funcionando.
- El puente nunca registra ni devuelve tokens o keys.
