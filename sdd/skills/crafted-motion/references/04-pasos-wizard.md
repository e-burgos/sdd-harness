# Wizards, pasos y onboarding

Un wizard es UI de estado, no una landing: va detrás de la hidratación y nunca en el primer paint.
Si el proyecto ya tiene `framer-motion` (tucu-ui lo trae), es la herramienta por defecto; GSAP
solo para una escena de bienvenida o el cierre con coreografía.

## Transición entre pasos

Dirección según avance o retroceso; salida corta, entrada larga.

```tsx
'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function StepTransition({ stepKey, direction, children }: {
  stepKey: string;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const offset = reduced ? 0 : 24 * direction;
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } }}
        exit={{ opacity: 0, x: -offset, transition: { duration: 0.2, ease: 'easeIn' } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- `initial={false}`: el primer paso aparece ya visible (sin flash ni contenido oculto en SSR).
- Contenido del paso con stagger corto (`0.04–0.06`) en las opciones, nunca en el título.
- Con reduced motion: solo opacity.

## Progreso

- Barra o riel con `scaleX` (`origin-left`) animado entre pasos (`expo.out 0.6`), no `width`.
- Pasos completados: check con pop (`back.out(2.2)`, 0.5 s) y el número se reemplaza.
- El paso actual puede llevar el "token viajero" (receta E de `03-recetas.md`) sobre el riel.

## Opciones (tarjetas elegibles)

- Hover: elevación sutil (`y: -2`, sombra con el acento a baja opacidad) en el hijo, no en el
  nodo que anima la entrada.
- Selección: borde y glow por `data-selected="true"` resuelto en CSS; `layoutId` compartido para
  un indicador que se desliza entre opciones.
- Recomendada: badge con un brillo que barre una vez (`beam-sweep`), no en loop.

## Vista previa (árbol, resumen)

Las líneas del árbol aparecen con stagger de 0.03 y `x: -8`; los cambios por una opción nueva
hacen `layout` en vez de re-montar. Nada de typing para contenido largo.

## Ejecución larga (generar, instalar)

- Etapas como pasos con estado (`pending → running → done | failed`): el ícono de la etapa en curso
  late con un `scale` 1→1.06 en loop suave; al terminar, pop del check.
- La salida en vivo no se anima línea por línea: scroll al final, sin motion.
- Éxito: una sola celebración breve (glow del acento que se expande y se apaga, 1.2 s) y foco en
  el CTA siguiente. Fallo: sin shake largo; resaltar la etapa y el mensaje.

## Foco y accesibilidad

- Al cambiar de paso, mover el foco al título del paso (`tabIndex={-1}` + `focus()` tras la
  entrada) y anunciar "Paso N de M" en una región `aria-live="polite"`.
- Los botones Atrás/Siguiente no se animan al entrar: siempre clickeables.
- Escape no cierra un wizard con datos sin confirmar.
