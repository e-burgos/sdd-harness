# Tokens de motion

Una sola fuente, con espejo en CSS. Los números salen de producción; ajustalos por marca, pero
mantené las proporciones (entrada larga, salida corta, pop con rebote).

```ts
export const ease = {
  out: 'expo.out',
  inOut: 'expo.inOut',
  pop: 'back.out(2.2)',
  popStrong: 'back.out(2.6)',
  rail: 'power3.inOut',
  exit: 'power2.in',
  float: 'sine.inOut',
} as const;

export const cssEase = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
} as const;

export const duration = {
  menu: 0.15,
  fadeUp: 0.4,
  exit: 0.5,
  pop: 0.7,
  entrance: 1,
  hero: 1.4,
  float: 4,
  marquee: 32,
} as const;

export const distance = {
  fadeUp: 12,
  text: 26,
  piece: 120,
} as const;

export const stagger = {
  text: 0.08,
  items: 0.12,
  grid: { each: 0.06, from: 'center' },
} as const;
```

```css
@theme {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
  --dur-menu: 150ms;
  --dur-fade-up: 400ms;
  --dist-fade-up: 12px;
}
```

Para `framer-motion`, los mismos valores en segundos y el bezier como array:
`transition={{ duration: duration.fadeUp, ease: [0.16, 1, 0.3, 1] }}`.

## Cheat sheet

| Intención             | Ease                     | Duración  |
| --------------------- | ------------------------ | --------- |
| Entrada de copy       | `expo.out`               | 0.8–1.0   |
| Pieza grande / mockup | `expo.out`               | 1.4–1.5   |
| Pop de ícono o chip   | `back.out(2–2.6)`        | 0.6–0.9   |
| Riel, línea, wipe     | `power3.inOut`/`expo.inOut` | 0.8–1.4 |
| Salida                | `power2.in`              | 0.3–0.5   |
| Flotación (loop)      | `sine.inOut` yoyo        | 3.2–4     |
| Count-up              | `power2.out`             | 1.1–1.4   |
| Cursor (`quickTo`)    | `power3`                 | 1.2       |

## Tema light sin tocar componentes

Invertí la escala neutral bajo la clase del tema (`.light { --color-zinc-50: …; … }`): todo
`zinc-*` de Tailwind se invierte solo. Los glows y acentos van en variables propias.
