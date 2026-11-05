export const gsapEase = {
  out: 'expo.out',
  inOut: 'expo.inOut',
  pop: 'back.out(2.2)',
  popStrong: 'back.out(2.6)',
  rail: 'power3.inOut',
  exit: 'power2.in',
  float: 'sine.inOut',
  follow: 'power3',
} as const;

export const bezier = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.87, 0, 0.13, 1],
  exit: [0.55, 0, 1, 0.45],
} as const;

export const duration = {
  exit: 0.2,
  fadeUp: 0.4,
  step: 0.45,
  pop: 0.5,
  rail: 0.6,
  word: 0.7,
  entrance: 1,
  split: 1.1,
  follow: 1.2,
  hero: 1.4,
} as const;

export const distance = {
  step: 24,
  word: 70,
  option: 14,
  door: 140,
} as const;

export const stagger = {
  word: 0.06,
  option: 0.05,
  tree: 0.03,
  piece: 0.08,
} as const;

export const MOTION_MIN_WIDTH = 1024;
