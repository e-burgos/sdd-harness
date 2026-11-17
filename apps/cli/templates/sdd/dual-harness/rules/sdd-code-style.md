---
trigger: always_on
description: Código sin comentarios - la documentación vive en los documentos SDD, no en el código
---

# ✍️ Código sin comentarios (OBLIGATORIO)

No escribir comentarios en el código de implementación. La documentación vive en los
documentos SDD (spec, functional, planner, architect, constitutions) y, si está
disponible, en el grafo de graphify, no en comentarios: son gasto doble (tokens al
escribirlos y en cada lectura) y repetir lo que el SDD ya documenta se desactualiza.

Cómo lograrlo sin perder claridad:

- **Nombres declarativos**: cada función/método/variable dice exactamente qué hace, sin
  margen a segunda interpretación: `propagateAccountStatusToTradingApi()` en vez de
  `process()` + comentario.
- **Modularizar**: funciones cortas, de una sola responsabilidad. Una función larga con bloques comentados (`// paso 1`) son N
  funciones con nombre propio.
- **El impulso de comentar es señal de refactor**: si una línea necesita explicación,
  extraer una función cuyo nombre sea esa explicación.
- Prohibido: comentarios narrativos, «qué hace la línea siguiente», código muerto comentado, `// TODO` (un TODO real
  es una task o un fix registrado en SDD).

Únicas excepciones (una línea, en inglés): restricción que el código no puede expresar
(workaround con link al issue, regla de negocio contra-intuitiva con referencia a su
spec, ej. `// ack 200 only after confirmed propagation so the provider retries (spec-jdoe-001)`) y anotaciones exigidas por framework/tooling (Swagger, Lombok, decorators;
JSDoc/Javadoc solo si el linter del subproyecto lo exige).

Regla espejo en review: un PR con comentarios fuera de estas excepciones recibe
request de cambios; el sdd-reviewer lo chequea al cerrar el ciclo.
