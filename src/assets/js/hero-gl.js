// Fond animé du hero : fumée dorée calculée en WebGL (shader), qui suit
// la souris. Rendu en demi-résolution, en pause hors écran ; repli CSS sinon.
import { reducedMotion, lerp, onVisible } from "./utils.js";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_d;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 m = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.05;
  vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t + 3.1));
  vec2 r = vec2(fbm(p * 1.1 + 2.2 * q + vec2(1.7, 9.2) + 0.15 * t + m * 0.25),
                fbm(p * 1.1 + 2.2 * q + vec2(8.3, 2.8) - 0.12 * t));
  float f = fbm(p + 2.4 * r);

  vec3 col = vec3(0.024, 0.024, 0.024);
  col = mix(col, u_d, smoothstep(0.25, 0.85, f) * 0.8);
  col = mix(col, u_a, smoothstep(0.55, 1.05, f * 1.15 + length(q) * 0.25) * 0.55);
  col = mix(col, u_b, smoothstep(0.62, 1.0, r.x) * 0.42);

  vec2 c = vec2(0.45 + m.x * 0.12, 0.05 + m.y * 0.12);
  col += u_a * smoothstep(0.9, 0.0, length(p - c)) * 0.16;

  // Assombrit le côté du texte et les bords pour la lisibilité.
  col *= mix(0.42, 1.0, smoothstep(-0.95, 0.25, p.x));
  col *= smoothstep(1.55, 0.35, length(p * vec2(0.85, 1.25)));
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export function heroGL(canvas, { colorA = "#e0b05a", colorB = "#8a5a20", colorDeep = "#2b1c0a" } = {}) {
  const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return false;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn("WebGL indisponible, fond statique utilisé.", err);
    return false;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");
  gl.uniform3fv(gl.getUniformLocation(prog, "u_a"), hex(colorA));
  gl.uniform3fv(gl.getUniformLocation(prog, "u_b"), hex(colorB));
  gl.uniform3fv(gl.getUniformLocation(prog, "u_d"), hex(colorDeep));

  const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener(
    "pointermove",
    (e) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    },
    { passive: true },
  );

  const t0 = performance.now() - 20000;
  const draw = (now) => {
    mouse.x = lerp(mouse.x, mouse.tx, 0.04);
    mouse.y = lerp(mouse.y, mouse.ty, 0.04);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (reducedMotion()) {
    draw(performance.now());
    return true;
  }
  let raf = 0;
  let visible = true;
  const loop = (now) => {
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  const sync = () => {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  onVisible(canvas, (v) => {
    visible = v;
    sync();
  }, { threshold: 0 });
  document.addEventListener("visibilitychange", sync);
  sync();
  return true;
}
