# Trampas de tucu-ui y checklist de cierre

## Props que rompen en runtime (crash, no warning)

| Mal | Bien |
| --- | --- |
| `<Button variant="primary">`, `variant="destructive"`, `variant="brand"` (3.0) | `variant="solid"` (color `primary` por defecto = marca); destructivo: `color="danger"` |
| `<Button size="lg" / "md" / "sm">` | `large`, `medium`, `small`, `mini`, `tiny`, `xs` |
| `<Badge variant="secondary" / "flat">` | `solid`, `ghost`, `outline`, `soft`, `ink`, `line` |
| `<Alert variant="destructive">` | `variant="error"` |
| `<Tabs>` | no existe: `TabGroup` + `TabList`/`TabItem`/`TabPanels`/`TabPanel`, `AnimatedTabs` o `ParamTab` |

## Comportamientos que sorprenden

- **Form**: no hay prop `defaultValues` → `useFormProps={{ defaultValues }}`. Los inputs **no** se
  registran solos: cada uno va dentro de `FormField name="…"`.
- **Select**: dos APIs (`selectedOption` + `onChange(option)` o `value` + `onSelect`), no las
  mezcles. `onChange` no dispara al re-elegir la misma opción. Dentro de un `Modal`, Escape cierra
  primero el listbox y recién el segundo Escape cierra el modal. Tamaños: confirmalos con
  `get_props` (no siguen los nombres de `Button`).
- **Input**: `suffix` es el adorno del **inicio**; el del final es `endAdornment`. `type="date"` es
  un picker propio y `onChange` recibe ISO.
- **Modal**: `isOpen` y `setIsOpen` obligatorios. Escape cierra solo el de arriba.
- **Drawer**: `type` y `setIsOpen` obligatorios; `onClose` solo dispara desde el botón de cerrar
  (no con Escape ni backdrop). El blur del backdrop no se cambia: usá `DrawerContainer`, cuyo
  contenido necesita `pointer-events-auto`.
- **Toast** no recibe props y ya lo monta el layout del provider: no lo montes otra vez.
- **DataTable**: `id` explícito en cada columna. En Next, las funciones `cell` van en un
  componente cliente.
- **AdminLayout**: `isOpen`/`setIsOpen` obligatorios; los ítems usan `name`, no `label`.
- **SplitAuthLayout**: su `title` ya es el `<h1>`; no agregues otro.
- **ThemeScope**: overlays en su propio portal; un solo nivel de modo opuesto anidado.
- **`--color-accent`** es amarillo por defecto (ver `02-theming.md`).
- **Clases inexistentes** que no pintan nada: `text-muted-foreground`, `text-brand-foreground`,
  `text-accent-foreground`, `text-destructive`, `bg-card`, `bg-popover`. Equivalentes:
  `text-muted`, `text-foreground`, `text-error`, `bg-light-dark`.
- **Doble Tailwind** (`styles` + tu `@import 'tailwindcss'`) o `@source` mal apuntado: estilos que
  faltan sin ningún error. Ver `01-montaje.md`.
- **Herencia de color**: `text-white` en el contenedor raíz deja invisibles títulos en light.

## Checklist antes de cerrar la task

- [ ] Cada componente nuevo para vos en esta task fue verificado (`get_props` o tipos).
- [ ] Ningún hex suelto ni color de acción fuera de la marca; tokens o tonos semánticos.
- [ ] Mismo dato → mismo tono de badge en todas las pantallas.
- [ ] Números en mono tabular; dinero con `MoneyText`.
- [ ] Light y dark revisados; foco visible; navegación por teclado; contraste AA en texto sobre
  superficies translúcidas.
- [ ] 375 px sin scroll horizontal; tablas pasan a cards (`mobileCards`) o se adaptan.
- [ ] `prefers-reduced-motion` respetado (y `prefers-reduced-transparency` si hay vidrio).
- [ ] Estados vacíos, de carga (`Skeleton`) y de error presentes, con una acción.
- [ ] Consola limpia (sin errores ni warnings de React/hydration).
- [ ] Con MCP: prompt `design-review` sobre la pantalla terminada.
