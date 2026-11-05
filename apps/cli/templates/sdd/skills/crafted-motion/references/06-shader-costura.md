# Shader de costura (dos climas)

Fondo WebGL sin librerías: ruido fbm, una costura ondulada entre dos "climas" de color, brillo en
la costura, luz que sigue al cursor, viñeta y grano. Uniforms: `r` resolución, `t` tiempo, `s`
posición de la costura (0–1), `m` mouse (0–1), `h` hover (0–1).

```ts
const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAGMENT = `precision mediump float;
uniform vec2 r;uniform float t;uniform float s;uniform vec2 m;uniform float h;
uniform vec3 a0;uniform vec3 a1;uniform vec3 b0;uniform vec3 b1;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/r; float ar=r.x/r.y; vec2 q=vec2(uv.x*ar,uv.y);
 float seam=s+.025*sin(uv.y*7.+t*.7)+.015*sin(uv.y*17.-t*1.1);
 float f=fbm(q*2.2+vec2(t*.05,-t*.08)); float g=fbm(q*4.+f*1.6-vec2(t*.09,0.));
 float side=smoothstep(seam-.18,seam+.18,uv.x+(g-.5)*.12);
 vec3 tone=mix(mix(a0,a1,g),mix(b0,b1,g),side);
 vec3 col=vec3(.012,.012,.018)+tone*pow(f,2.2)*.75*(.55+.25*h);
 float d=abs(uv.x-seam); col+=vec3(.75,.88,1.)*exp(-d*85.)*(.35+.4*g)*smoothstep(1.,.15,abs(uv.y-.55)*1.6);
 vec2 mm=vec2(m.x*ar,m.y); col+=tone*exp(-length(q-mm)*3.2)*.22;
 col*=smoothstep(1.25,.35,length((uv-vec2(.5,.48))*vec2(1.05,1.25)));
 col+=(hash(gl_FragCoord.xy+t)-.5)*.015;
 gl_FragColor=vec4(col,1.);}`;
```

Climas de referencia: cálido `a0 (.55,.16,.02)` → `a1 (.98,.55,.18)`; frío `b0 (.02,.22,.42)` →
`b1 (.18,.78,.95)`. Pasalos como uniforms para que cada proyecto use sus colores.

## Ciclo de vida

- `getContext('webgl', { antialias: false, premultipliedAlpha: false })`; si devuelve `null` o el
  programa no compila/linkea, devolver `null` y la sección sigue con su fondo CSS.
- Resolución al 60 % con DPR acotado: `canvas.width = clientWidth * min(dpr, 1.5) * 0.6`. El canvas
  se estira por CSS; con el ruido no se nota y el costo baja más de la mitad.
- Loop con `requestAnimationFrame` que solo dibuja si la sección está en vista y
  `!document.hidden`. Con reduced motion: un solo `draw(4.2)` y nada más.
- `ResizeObserver` sobre el canvas → `resize()`.
- `dispose()` borra buffer, programa y shaders al desmontar.
- El mouse se normaliza al stage (`(clientX - left) / width`) e invierte Y para GL (`1 - y`).
