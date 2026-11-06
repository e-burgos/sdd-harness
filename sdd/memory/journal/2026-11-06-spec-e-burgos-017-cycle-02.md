# spec-e-burgos-017 cycle-02 — reservas de archivo y buzón

## Qué pasó
El buzón entre sesiones se inyectaba con `prompt.compose`; los tests pasaban, pero en la prueba real con dos sesiones el pedido nunca llegó: el motor arma el system prompt (y el contexto inicial, `prompt.context`) una vez por sesión y no vuelve a preguntar. Se movió al `context` del resultado de la próxima herramienta, que sí llega a mitad de sesión.

## Lección
Para que un mod le haga llegar al modelo algo que aparece a mitad de sesión, usar el `context` del resultado de un `tool.call` (o `$.session.send`); `prompt.compose`, `prompt.context` y `prompt.section` están cacheados y solo sirven para lo que existe al arrancar.

## Costo evitable
Una vuelta extra de prueba real con dos sesiones; los tests unitarios no podían detectarlo porque mockean el motor.
