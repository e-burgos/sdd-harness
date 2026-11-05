# Recetas

Todas parten del markup final con `data-*` y viven en un `build<Seccion>Motion`. Valores de
`01-tokens.md`.

## A. Entrada de sección

Copy `y: 26–28, opacity: 0, stagger: 0.08` → pieza grande (mockup) en perspectiva
`rotateX: 24, rotateY: -14, y: 90, scale: .88, filter: 'blur(10px)', transformPerspective: 1200,
duration: 1.5` en `0.1` → riel `scaleY: 0` (`origin-top`, `power3.inOut`) en `.35` → items
`x: 36` en `.45` → íconos `scale: 0, rotate: -40, back.out(2.2)` en `.55`.

## B. Titular palabra por palabra

Cada palabra en un `<span data-word>` con `display:inline-block` dentro de un wrapper con
`perspective`. `from(words, { yPercent: 70, opacity: 0, filter: 'blur(14px)', rotateX: -40,
stagger: 0.07, duration: 1.1 })`. Eyebrow: `from(eyebrow, { letterSpacing: '0.5em', opacity: 0 })`.
El titular SSR se ve sin JS; GSAP solo lo re-anima al entrar.

## C. Flotación

`to(piece, { y: -12, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: entrada })`.
En CSS: `@keyframes float { 50% { transform: translateY(-7px) } }` 4 s.

## D. Señales cíclicas

Tarjetas `data-signal` absolutas sobre la pieza, estado inicial `opacity 0, y 14, scale .9`.
`timeline({ repeat: -1 })`; cada una entra en `i * (HOLD + GAP) * .5` con `back.out(1.8)` y sale en
`+HOLD` con `power2.in, y: -12`. `HOLD 2.6`, `GAP 1.3`. En mobile quedan dentro del contenedor.

## E. Token viajero entre pasos

Riel `data-rail-fill` `scaleX 0→1` mientras cada paso entra en `.3 + i * .55`. Loop: un punto con
glow viaja `x = travel * i / (n - 1)` (`travel = rail.offsetWidth`, medido en el build), y en cada
parada `call(() => box.setAttribute('data-lit', 'true'))`, dwell 0.9 s. El estilo encendido lo
resuelve CSS: `data-[lit=true]:border-accent data-[lit=true]:shadow-[…]`. Solo `md:` y arriba.

## F. Foco que recorre una lista

```ts
function cycleFocus(gsap: Gsap, nodes: Element[], hold: number, delay: number): MotionLoop {
  const tl = gsap.timeline({ repeat: -1, delay });
  nodes.forEach((_, i) => {
    tl.call(() => nodes.forEach((n, j) => n.setAttribute('data-lit', String(i === j)))).to({}, { duration: hold });
  });
  return tl;
}
```

## G. Count-up

Tween de un objeto `{ v: 0 }` a `total` en 1.4 s `power2.out`, `onUpdate` escribe
`Intl.NumberFormat(locale).format(Math.round(o.v))` en el nodo `data-count`.

## H. Typing

Tween de `{ n: 0 }` a `text.length` con `ease: \`steps(${text.length})\`` y
`onUpdate: () => (el.textContent = text.slice(0, Math.round(o.n)))`. Cursor con
`@keyframes blink { 50% { opacity: 0 } }` `step-end`.

## I. Dibujar SVG

`pathLength={100}`, `stroke-dasharray: 100`, `fromTo(path, { strokeDashoffset: 100 }, {
strokeDashoffset: 0 })`. Pulso viajando: `stroke-dasharray: 8 92` + keyframe del offset.
`viewBox` en px reales medidos con `ResizeObserver`; nunca `vector-effect: non-scaling-stroke`
junto a `pathLength`.

## J. Reveal con clip-path

Cambiar el contenido de una pantalla/tarjeta: la nueva capa encima con
`clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)'` → `polygon(0 0, 140% 0, 140% 100%, 0 100%)`,
`expo.inOut 0.8`; al terminar `clipPath: 'none'` y se retira la anterior.

## K. Wipe entre páginas

Al click en un `<a>` real: un círculo fijo en la posición del puntero crece (`scale` hasta cubrir
la diagonal, `expo.inOut`) y recién entonces `router.push`. Quitarlo en `pageshow` (el bfcache lo
restaura encima al volver). Sin JS, el link navega igual.

## L. Cursor y parallax

`const x = gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3' })` y lo mismo para `y` y
`rotateY`, alimentados desde `pointermove` normalizado a −1..1. Spotlight de tarjeta: setear
`--mx/--my` en la tarjeta y consumirlos en un `radial-gradient`.

## M. Fondo WebGL

Fragment shader propio (fbm + viñeta + grano), uniforms de resolución, tiempo, mouse y hover.
Render con `requestAnimationFrame` que no dibuja fuera de vista ni con `document.hidden`; con
reduced motion un solo frame fijo; si `getContext('webgl')` es `null`, la sección sigue sin fondo.
Solo desktop, en un chunk `next/dynamic`.

## N. Loops "vivos" encadenados

Para estados que avanzan (rotación de promos, "publicando → en línea"): `gsap.delayedCall(t, step)`
encadenado en vez de `setInterval`; se mata en el `revert()` del context.

## O. Dos puertas con costura (elegir un camino)

Dos `<a>` o radios reales lado a lado sobre un canvas de fondo. El estado compartido
`{ split, hover, mouseX, mouseY }` lo leen el shader (uniforms) y el CSS (`--split` en el stage).

- Hover/foco de una puerta: `gsap.to(state, { split: 0.6 | 0.4, duration: 1.1, ease: 'expo.out',
  onUpdate: () => stage.style.setProperty('--split', String(state.split)) })` y `hover → 1` en
  0.8 s `power2.out`. Al salir vuelve a `0.5`.
- El layout usa `--split` (`grid-template-columns: calc(var(--split) * 100%) 1fr`) para que la
  puerta elegida crezca junto con la costura.
- Cada puerta tiene su "clima" (cálido / frío) en el shader y su acento en el copy.
- Intro: costura `scaleY 0→1` (`expo.inOut 1.2`), eyebrow con `letterSpacing`, titular palabra por
  palabra (receta B), piezas de cada lado entrando desde su borde (`x: ∓140, rotate: ∓18`), chips
  con `back.out(2)` y el copy de cada puerta desde su lado (`x: ∓50`).
- Shader completo y loop de render: `06-shader-costura.md`.

## P. Botón magnético

Dentro de la puerta, `quickTo(button, 'x'|'y', { duration: 0.5, ease: 'power3' })`. En
`pointermove` sobre la puerta: si el puntero está a < 160 px del centro del botón, mover
`d * 0.25`; si no, volver a 0. Al salir de la puerta, a 0.

## Q. Constelación (hub + nodos)

Hub central con nodos en elipse (`angle = i / n * 360 - 90`, radios en % del contenedor) y enlaces
SVG hub → nodo. Entrada: hub `scale .86`, enlaces dibujándose (receta I) con stagger 0.05, y cada
nodo **sale del centro del hub** (`x/y = centro hub − centro nodo`, `scale .2`, escalonado
`0.25 + i * .045`). Spotlight autoplay cada ~3.6 s que se frena con hover/foco y fuera de vista;
al cambiar de nodo, el contenido del hub sale con `opacity 0, y 8, blur(4px)` y entra el nuevo.
Borde del hub vivo con `conic-gradient` rotando en un `::before`. En < 1024 px, grilla simple.

## R. Escena que se arma sola (estado que avanza)

Un mockup con bloques `data-block` y un selector que los recorre: por cada bloque, el selector
(`top`/`height` del bloque, `expo.out 0.45`) lo marca, se cambia su etiqueta y el bloque pasa de
`opacity .12` a `1`. Después: estado "Publicando" con una barra que se llena y estado "En línea"
con un pulso de `box-shadow` del acento y un pop del chip. Se repite con `delayedCall(7.5)`. Es el
mismo patrón para cualquier proceso por etapas (generar, instalar, desplegar).
