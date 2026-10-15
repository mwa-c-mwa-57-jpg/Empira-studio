/* Neon Tulp — WebGL smoke that drifts over the hero video and bends around the cursor.
   Domain-warped fBm noise, rendered at reduced resolution and blended in CSS. */
window.NTSmoke = (function () {
  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec3 uC1; uniform vec3 uC2; uniform float uAmt;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }",
    "float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;",
    "  vec2 p = uv * vec2(asp, 1.0) * 2.4; vec2 m = uMouse * vec2(asp, 1.0) * 2.4;",
    "  float t = uTime * 0.05; float md = length(p - m);",
    "  vec2 push = (p - m) * 0.9 * exp(-md * 1.6);",
    "  vec2 q = vec2(fbm(p + vec2(0.0, t * 2.0)), fbm(p + vec2(5.2, 1.3) - t));",
    "  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.4 + push), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));",
    "  float f = fbm(p + 3.2 * r - vec2(0.0, t * 3.0));",
    "  float low = smoothstep(1.05, 0.05, uv.y);",
    "  float d = smoothstep(0.5, 1.0, f) * (0.15 + 0.85 * low);",
    "  d += exp(-md * 2.4) * 0.22 * f;",
    "  vec3 col = mix(uC1, uC2, clamp(r.x * 1.35 - 0.15, 0.0, 1.0));",
    "  float a = clamp(d * uAmt, 0.0, 1.0);",
    "  gl_FragColor = vec4(col * a, a);",
    "}"
  ].join("\n");

  function hex(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }

  function create(canvas) {
    var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ["uRes", "uTime", "uMouse", "uC1", "uC2", "uAmt"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var scale = 0.45, running = false, raf = 0, t0 = performance.now();
    var mouse = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3 };
    var palette = { c1: hex("#ff4f8b"), c2: hex("#ffb547"), amt: 0.85 };

    function resize() {
      var w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, (now - t0) / 1000);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform3fv(U.uC1, palette.c1); gl.uniform3fv(U.uC2, palette.c2); gl.uniform1f(U.uAmt, palette.amt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return {
      start: function () { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      pointer: function (x, y) { mouse.tx = x; mouse.ty = y; },
      setPalette: function (c1, c2, amt) { palette.c1 = hex(c1); palette.c2 = hex(c2); palette.amt = amt; }
    };
  }
  return { create: create };
})();
