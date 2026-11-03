# spec-e-burgos-012-generators-tucu-ui · cycle-01

## Qué pasó
Los implementadores tomaron la API de tucu-ui del repo local (`~/github/personal-projects/tucu-ui`), que va por delante del paquete publicado: `layout="minimal"` no existe en 3.10.0. Los tests unitarios de los generadores pasaron igual; lo detectó recién la generación real en `examples/` (junto con una página de Next que usaba componentes con estado como server component y `uv build` roto con un uv viejo).

## Lección
Al generar código contra una librería, verificar props y tipos contra el paquete publicado instalado (`node_modules`), no contra su fuente local; y no cerrar un generador sin una generación real con `lint test build`.

## Costo evitable
Una ronda de regeneración completa de tres workspaces (~10 min) y un commit de corrección.
