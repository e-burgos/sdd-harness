# Spike TASK-007 — entrega en punto de corte con PostToolBatch

> SDK `@anthropic-ai/claude-agent-sdk` 0.3.292 contra el CLI real · modelo `claude-haiku-4-5-20251001` · effort `low` · 2026-10-23

## Resultado

**Inyección directa por el stream de entrada funciona.** Modo de entrega elegido: `deliveryMode = 'stream'` (default). El fallback `hook-context` (`additionalContext`) queda implementado como alternativa interna pero no es el default.

## Montaje

- `prompt: AsyncIterable<SDKUserMessage>` con un canal de entrada vivo (`pushAndFlush` resuelve cuando el SDK pide el siguiente elemento, es decir, tras `transport.write`).
- Mensaje inicial (uuid `1111…`): "run `echo one` with Bash, then `echo two` with Bash, then reply DONE-TWO".
- Hook `PostToolBatch` (hilo principal): `await channel.pushAndFlush(user("Change of plan: do NOT run more commands. Reply only PINEAPPLE", uuid 2222…))` y recién después devuelve `{}`.
- `bypassPermissions`, `tools: ['Bash']`, `settingSources: []`, cwd temporal.

## Evidencia (orden de eventos)

```
+385ms   system init
+2754ms  assistant tool_use({"command":"echo one"})
+5318ms  user tool_result "one"
+5321ms  hook PostToolBatch agent_id=main calls=1
+5321ms  hook: pushAndFlush resolved
+6595ms  assistant text(PINEAPPLE)            <- no hubo segundo tool_use
+6611ms  result success
         user_message_uuids = ["1111…", "2222…"]   <- ambos uuids en el MISMO result
         queued_turn_count  = 0
```

- El segundo mensaje se incorporó antes del siguiente request al modelo: el modelo contestó `PINEAPPLE` sin ejecutar `echo two`.
- Un solo `result` cubre el prompt inicial y el mensaje inyectado (`user_message_uuids` con los dos uuids, en orden).
- Costo del spike: `total_cost_usd` 0.0036 (in 18 / out 253 tokens sin caché en el `result`).

## Verificación adicional: siguiente turno en la misma query

Canal sin cierre: tras el primer `result` se empuja un segundo mensaje (uuid `bbbb…`) y luego se cierra.

```
+1416ms  result#1 uuids=["aaaa…"] text=ONE
+2353ms  result#2 uuids=["bbbb…"] text=TWO
+3383ms  done
```

Confirma D-06: los pendientes entregados al `result` corren como siguiente turno de la misma query, sin resume, y el SDK termina al `end()`.

## Notas de implementación

- `pushAndFlush` debe resolver los waiters cuando el consumidor vuelve a pedir el siguiente elemento **después** de haber consumido lo encolado; resolverlos antes deja el hook colgado (bug hallado en la primera versión del script).
- El protocolo no cambia (R11): `delivery: 'cut-point'` en el `user.message` en ambos modos.
