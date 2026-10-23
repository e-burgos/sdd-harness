# spec-e-burgos-001-studio-session-ux cycle-02 — 2026-10-23

## Estado

- Adjuntos en el Composer (elegir, pegar, arrastrar; máx. 5; preview con quitar), render en Timeline y
  PendingMessages, menú `@` (archivos + agentes) y `/` (comandos + skills/prompts), borrador por hilo con
  adjuntos y UI condicionada a `client.supports(attachments|file-search|catalog)`. resuelve: §6 Qué sigue.

## Estructura

- `lib/attachments/`: `classify.ts` (mime + magic bytes, texto UTF-8 estricto), `encode-image.ts` (re-encode
  SIEMPRE a ≤1568 px sin EXIF; PNG→webp con fallback png; GIF chico se conserva, grande se aplana; si el
  re-encode falla la imagen se rechaza, nunca se envía la original), `frame-budget.ts`
  (`commandFrameBytes` mide el JSON serializado en UTF-8; escalera de recompresión hasta `FRAME_BUDGET_BYTES`),
  `build-draft.ts`, `draft-attachment.ts`, `bytes.ts`.
- Slice `drafts`: `ComposerDraft = { text, attachments }` por `threadId` o `new:<channel>`; revoca las
  object URLs de adjuntos quitados; solo en memoria (se pierde al recargar).
- Hooks: `use-attachment-draft.ts` (COMP-012), `use-attachment-content.ts` (COMP-013: caché LRU de object
  URLs por sha256, concurrencia acotada, verificación de hash; `primeAttachmentContent` siembra la caché con
  el blob recién enviado y es best-effort), `use-mention-menu.ts` (debounce 120 ms con descarte por secuencia,
  grupos files/agents/commands/skills, `undiscovered` para mostrar «No se encontraron…»).
- `lib/mention.ts` (detección del trigger activo) y `lib/composer-refs.ts` (extrae refs `@agente`/`/skill`
  conocidos del texto; `FIXED_COMMANDS`).
- Componentes: `AttachmentTray` (COMP-007), `AttachmentView` (COMP-008, reserva caja por width/height,
  marcador «Adjunto no disponible»), `MentionMenu` (COMP-009, ARIA combobox/listbox).
- Teclado del menú: Enter/Tab eligen la opción activa (un comando escrito completo requiere un segundo Enter
  para enviar); Esc cierra sin tocar el texto. Sin `file-search` ni `catalog` no se abre ningún menú
  (comportamiento previo para puentes viejos).
- Tests: `vitest.setup.ts` reemplaza `URL.createObjectURL`/`revokeObjectURL` (jsdom no los implementa).
  E2E: `e2e/start-bridge.mjs` hace `git init` en `.e2e-workspace` y crea `.claude/skills`; correr con
  `E2E_PORT` libre (p. ej. 4415).

## Qué sigue

- Follow-ups UX de cycle-02: agentes por encima de archivos cuando el query coincide con un agente; Enter
  sobre un comando escrito completo podría enviar directo.
