# spec-e-burgos-001-studio-session-ux cycle-02 — 2026-10-23

## Estado

- El puente anuncia `attachments`, `file-search` y `catalog` en `Welcome.features` y los tres están
  implementados. resuelve: §3.5 «los de cycle-02 responden `unsupported` hasta implementarse» y §6 Qué sigue.
- `workspace.snapshot` hace `await watcher.refresh()` antes de responder (FIX-e-burgos-001-001): recargar
  la web recupera eventos fs perdidos.

## Estructura

- `sessions/attachment-store.ts`: `createAttachmentStore(root)` → `.sdd-studio/attachments/<sha256>.<ext>`;
  `put` valida magic bytes contra el mime, deduplica por hash y escribe atómico (tmp + rename); `read`
  valida realpath dentro de `.sdd-studio`, `O_NOFOLLOW`, tamaño ≤ `MAX_FRAME_BYTES` y re-hash; todo fallo →
  `AttachmentError('not-found', 'attachment not available')` genérico. Aviso si el almacén supera 1 GiB.
- `workspace/file-index.ts`: `createFileIndex(root)` — `git ls-files --cached --others --exclude-standard`
  con fallback a walk acotado (profundidad 12, 50 000 entradas); excluye secretos (`.env*` salvo
  example/sample/template, `.pem`, `.key`, `id_rsa*`, `.npmrc`, `.netrc`…), `node_modules`, `.git`,
  `.sdd-studio`, `.nx`, `.next`, `dist`, `coverage`, `.claude/worktrees/`; cada resultado se re-verifica
  con realpath dentro del root. Ranking por tiers (prefijo de basename, substring de basename, substring de
  ruta, subsecuencia). Caché TTL 15 s; `listGit` inyectable para tests.
- `workspace/catalog.ts`: `loadCatalog` (reemplaza `loadAgents`) — agentes de `.claude/agents` y
  `sdd/agents`, skills de `.claude/skills` y `sdd/skills`, prompts de `sdd/prompts`; dedupe por realpath
  canónico (symlinks `.claude` → `sdd/`), tope 200 por tipo, descripciones a 300 caracteres.
- `workspace/watcher.ts`: segundo `chokidar.watch` sobre `.claude` solo si existe al arrancar, filtrado por
  `isClaudeCatalogPath` (agents/skills, profundidad 3, nunca worktrees).
- `engine/prompt-content.ts`: `buildTurnPrompt` async (resuelve adjuntos del almacén; texto vacío con
  adjuntos → bloque `Attachments: …`) y preámbulo de refs (`Delegate this task to the subagent "…"`,
  `Use the skill "…"`, `Follow the instructions in ….prompt.md.`).
- `sessions/session-manager.ts`: `send(threadId, MessageInput)` con `attachments`/`refs` opcionales (el
  router los completa con defaults de zod); `Live.acceptTail` serializa la aceptación por hilo (FIFO);
  refs filtradas y deduplicadas contra el snapshot (un ref inexistente viaja como texto plano).
- `engine/fake-engine.ts`: ecos ` [attachments: …]`, ` [refs: …]` y marcador `#bad-attachment`.

## Qué sigue

- FSEvents en macOS no garantiza entrega bajo carga: toda vista derivada del fs debe poder re-escanearse a
  pedido (patrón de `workspace.snapshot`). El test de `.claude/skills` del watcher corre con `retry: 2`.
- Ranking del menú `@`: el índice de archivos puntúa subsecuencias (tier 3) y la web pone Archivos antes que
  Agentes; ver follow-ups de cycle-02.
