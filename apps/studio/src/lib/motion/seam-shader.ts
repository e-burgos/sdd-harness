export type Rgb = readonly [number, number, number];

export interface SeamPalette {
  warmFrom: Rgb;
  warmTo: Rgb;
  coolFrom: Rgb;
  coolTo: Rgb;
}

export interface SeamState {
  split: number;
  mouseX: number;
  mouseY: number;
  hover: number;
}

export interface SeamShader {
  draw(seconds: number): void;
  resize(): void;
  dispose(): void;
}

export const DEFAULT_SEAM_PALETTE: SeamPalette = {
  warmFrom: [0.55, 0.16, 0.02],
  warmTo: [0.98, 0.55, 0.18],
  coolFrom: [0.02, 0.22, 0.42],
  coolTo: [0.18, 0.78, 0.95],
};

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

const MAX_PIXEL_RATIO = 1.5;
const RESOLUTION_SCALE = 0.6;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

export function createSeamShader(canvas: HTMLCanvasElement, state: SeamState, palette: SeamPalette = DEFAULT_SEAM_PALETTE): SeamShader | null {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const [uResolution, uTime, uSplit, uMouse, uHover] = ['r', 't', 's', 'm', 'h'].map(uniform);
  gl.uniform3fv(uniform('a0'), palette.warmFrom);
  gl.uniform3fv(uniform('a1'), palette.warmTo);
  gl.uniform3fv(uniform('b0'), palette.coolFrom);
  gl.uniform3fv(uniform('b1'), palette.coolTo);

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO) * RESOLUTION_SCALE;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  return {
    resize,
    draw(seconds) {
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      gl.uniform1f(uSplit, state.split);
      gl.uniform2f(uMouse, state.mouseX, 1 - state.mouseY);
      gl.uniform1f(uHover, state.hover);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
