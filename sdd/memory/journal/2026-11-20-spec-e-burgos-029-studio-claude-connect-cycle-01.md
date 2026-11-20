# spec-e-burgos-029 + fixes 012–014 — 2026-11-20

- No conectar agentes al Chrome de todos los días con `--autoConnect`: Chrome pide «Allow remote debugging?» en cada conexión nueva y no tiene «permitir siempre». Usar un Chrome propio con perfil persistente y puerto de depuración fijo.
- `claude mcp login` exige TTY aun abriendo el navegador: lanzarlo bajo pty (`python3 -c 'import pty,sys; …'`); `script` de macOS no sirve sin TTY en stdin.
- Resolver un paquete de plataforma (binario nativo) desde el paquete que lo declara, no desde el consumidor: con pnpm no se ve desde afuera; cubrirlo con un test que resuelva el archivo real.
- Cuando dos capas juzgan reservas o ataduras (mod de Claude Code y puente de Studio), ambas tienen que reconocer la misma sesión y la atadura explícita (`SDD-BIND`) tiene que ganarle a la heurística; si no, la sesión se bloquea a sí misma.
