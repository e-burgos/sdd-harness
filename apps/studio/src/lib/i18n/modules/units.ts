export const unitsEs = {
  'units.pill': '{n} en curso',
  'units.pill.hint': 'Ver todo lo que está en curso',
  'units.popover': 'En curso',
  'units.title': 'En curso',
  'units.subtitle': 'Ciclos in-progress y fixes abiertos, con la sesión que trabaja en cada uno',
  'units.none': 'No hay ciclos en curso ni fixes abiertos',
  'units.cycle': 'Ciclo',
  'units.fix': 'Fix',
  'units.progress': '{done}/{total} tasks',
  'units.noSession': 'sin sesión atada',
  'units.session': 'Sesión {harness} {id}',
  'units.sessionBy': 'Sesión: {harness} · {id}',
};

export const unitsEn = {
  'units.pill': '{n} in progress',
  'units.pill.hint': 'See everything in progress',
  'units.popover': 'In progress',
  'units.title': 'In progress',
  'units.subtitle': 'In-progress cycles and open fixes, with the session working on each one',
  'units.none': 'No cycles in progress and no open fixes',
  'units.cycle': 'Cycle',
  'units.fix': 'Fix',
  'units.progress': '{done}/{total} tasks',
  'units.noSession': 'no session bound',
  'units.session': 'Session {harness} {id}',
  'units.sessionBy': 'Session: {harness} · {id}',
} satisfies Record<keyof typeof unitsEs, string>;
