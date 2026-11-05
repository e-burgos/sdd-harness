# Trampas reales, QA y checklist

## Trampas (cada una costó tiempo en producción)

1. **`framer-motion` con SSR oculta el contenido.** `initial={{ opacity: 0 }}` sale en el HTML como
   `style="opacity:0"`: invisible hasta hidratar todo. La home pública va con CSS + GSAP lazy.
2. **GSAP + `transition` CSS o `.fade-up` en el mismo nodo** → en StrictMode el segundo build toma
   `opacity: 0` como estado final y queda trabado. Animá un wrapper.
3. **`autoAlpha` sobre links** → `visibility: hidden`, el link pierde el nombre accesible.
4. **Dos árboles montados** (`sm:hidden` / `hidden sm:block`) → DOM, hrefs y testids duplicados. Gate
   con un solo árbol.
5. **SVG**: `viewBox` en px reales; `non-scaling-stroke` + `pathLength` rompe los dashes.
6. **bfcache** restaura overlays de transición encima de la página: limpiarlos en `pageshow`.
7. **Medir en el build** (`offsetWidth`, `getBoundingClientRect`), no al renderizar; entradas que
   miden DOM en `useLayoutEffect`.
8. **Glows grandes** generan overflow horizontal en 390px: `overflow-x: clip` en la raíz,
   `overflow-hidden` en la sección.
9. **Lazy sin placeholder** → CLS. Placeholder con el mismo alto.
10. **Meta OG por JS** no la ven los crawlers: estática en el HTML / metadata de Next.
11. **Flash antes de la entrada**: si el contenido se pinta y recién después GSAP aplica el `from`,
    se ve aparecer, desaparecer y volver. `data-intro="pending"` + build en `useLayoutEffect`.
12. **Contenedor de paso con `min-h-0` dentro de un scroll** → el contenido desborda y se pisa con
    el footer. El wrapper animado de un paso crece con su contenido (`flex-1` sin `min-h-0`).
13. **Cambio de paso**: volver el scroll del contenedor a 0 y mover el foco al título; no hacerlo
    en el primer render ni cuando el estado se restaura de storage.
14. **Estado restaurado después del primer render** (posición del wizard, sesión) → se ve el paso
    inicial y salta al guardado con transición. No pintar el contenido hasta estar posicionado.
15. **Verificar en un navegador en segundo plano** (pestaña oculta, panel embebido oculto): el
    navegador frena `requestAnimationFrame` a pocos frames por segundo y las entradas parecen
    trabadas. Medir con la pestaña visible antes de diagnosticar.

## QA

- Viewports: 1440 (dark y light) y 390, con la pestaña visible (ver trampa 15).
- `document.documentElement.scrollWidth <= innerWidth`.
- Consola sin errores ni warnings con StrictMode; recargar y scrollear arriba/abajo: ninguna
  sección queda en blanco.
- Entradas disparan una vez; loops se frenan fuera de vista.
- DevTools → Rendering → Emulate `prefers-reduced-motion`: todo visible, nada se mueve.
- Throttling CPU 4× + red lenta en mobile: el titular se ve antes de hidratar (LCP).
- Teclado: foco visible, orden lógico, clones sin foco, autoplay pausable.

## Checklist de cierre

- [ ] Primer paint legible sin JS; reduced motion y mobile sin animación pesada
- [ ] Una entrada fuerte por sección; loops pausables
- [ ] Solo `transform`/`opacity`/`filter`/`clip-path`
- [ ] Tokens de `motion-tokens.ts`, sin números sueltos
- [ ] `data-*` animados sin `transition` propia; sin `autoAlpha` en links
- [ ] GSAP/WebGL fuera del bundle inicial y del árbol mobile
- [ ] QA 1440 dark/light + 390, consola limpia, sin overflow horizontal
- [ ] Tests: render, reduced motion, autoplay pausable, clones `aria-hidden`
