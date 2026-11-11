/* Active Theory study rebuild — ambient WebGL field.
   Reverse-engineered palette (#00ffff / #1A6DEA / #9ca5ff on near-black) and
   the site's own motion primitives: domain-warped fbm "air", a curl-noise
   particle drift, the layered camera wobble, and a frame-rate-independent lerp.
   Zero textures, single full-screen triangle, reduced resolution. 2D/CSS fallback. */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;     // device px, origin bottom-left
uniform float uScroll;    // 0..1 page progress
uniform vec3  uBg;
uniform vec3  uAccent;    // cyan
uniform vec3  uAccent2;   // blue

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// 3 octaves: enough for fluid, cheap on low-end GPUs
float fbm(vec2 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; }
  return v;
}
// curl of the value-noise field -> divergence-free drift for particles/mist
vec2 curl(vec2 p) {
  float e = 0.09;
  float n1 = noise(p + vec2(0.0, e)), n2 = noise(p - vec2(0.0, e));
  float n3 = noise(p + vec2(e, 0.0)), n4 = noise(p - vec2(e, 0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // domain-warped fluid "air" (original site's slow billowing feel)
  vec2 q = vec2(
    fbm(p * 1.15 + vec2(t * 0.024, -t * 0.017)),
    fbm(p * 1.15 + vec2(5.2, 1.3) - t * 0.020)
  );
  vec2 r = vec2(
    fbm(p * 1.7 + q * 1.6 + vec2(1.7, 9.2) + t * 0.014),
    fbm(p * 1.7 + q * 1.6 + vec2(8.3, 2.8) - t * 0.011)
  );
  float f = fbm(p * 1.05 + r * 1.9 + vec2(0.0, uScroll * 0.55));
  float fog = smoothstep(0.24, 0.92, f) * 0.085;

  // curl-noise particle field: points nudged along the flow, breathing in/out
  vec2 gp = p * 13.0 + q * 1.1;          // grid density, warped by fluid
  vec2 cell = floor(gp);
  vec2 local = fract(gp) - 0.5;
  vec2 flow = curl(cell * 0.16 + vec2(t * 0.045, -t * 0.036));
  float seed = hash(cell);
  float breathe = 0.5 + 0.5 * sin(t * 0.6 + seed * 6.2831);
  vec2 center = flow * 0.16;
  float d = length(local - center);
  float radius = mix(0.018, 0.075, seed) * (0.55 + 0.45 * breathe);
  float dot_ = smoothstep(radius, radius * 0.12, d);
  float parts = dot_ * (0.20 + 0.55 * breathe);

  // pointer halo
  vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
  float md = length(p - m);
  float halo = exp(-md * md * 2.1) * 0.12;

  vec3 col = uBg;
  col += vec3(fog);
  col += uAccent * (halo + parts * 0.55);
  col += uAccent2 * (parts * 0.35 + fog * 0.4);

  // fine grain to break up banding
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.011;
  // vignette, keep the eye centered on type
  col *= 1.0 - 0.44 * smoothstep(0.34, 1.3, length(p));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[AT] shader compile failed', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function hexToRgb(hex, fallback) {
  const m = String(hex || '').trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return v.some(n => Number.isNaN(n)) ? fallback : v;
}

/**
 * Creates the ambient field on a canvas. Framerate-independent pointer lerp
 * mirrors the engine: alpha_norm = 1 - exp(log(1-alpha) * dt*60).
 */
function createShaderField(canvas, opts = {}) {
  const scale = opts.scale ?? (window.devicePixelRatio > 1.5 ? 0.55 : 0.7);
  const onFail = opts.onFail;

  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false
  });
  const noop = { ok: false, resize() {}, frame() {}, renderOnce() {}, setMouse() {}, setScroll() {}, setPalette() {}, destroy() {} };
  if (!gl) { onFail?.(); return noop; }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = vs && fs ? gl.createProgram() : null;
  if (prog) {
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[AT] shader link failed', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
    }
  }
  if (!prog) { onFail?.(); return noop; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, 'uRes'), time: gl.getUniformLocation(prog, 'uTime'),
    mouse: gl.getUniformLocation(prog, 'uMouse'), scroll: gl.getUniformLocation(prog, 'uScroll'),
    bg: gl.getUniformLocation(prog, 'uBg'), accent: gl.getUniformLocation(prog, 'uAccent'),
    accent2: gl.getUniformLocation(prog, 'uAccent2')
  };

  let w = 2, h = 2, time = 0, scroll = 0, dead = false;
  let bg = hexToRgb('#05070c', [0.02, 0.027, 0.047]);
  let ac = hexToRgb('#00e0f0', [0.0, 0.88, 0.94]);
  let ac2 = hexToRgb('#1A6DEA', [0.10, 0.43, 0.92]);
  // pointer in device px + smoothed target (framerate-independent)
  let mouse = [0, 0], target = [0, 0], cssX = null, cssY = null;

  function applyUniforms() {
    gl.uniform3f(U.bg, bg[0], bg[1], bg[2]);
    gl.uniform3f(U.accent, ac[0], ac[1], ac[2]);
    gl.uniform3f(U.accent2, ac2[0], ac2[1], ac2[2]);
  }
  function draw() { gl.uniform1f(U.time, time); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function resize() {
    if (dead) return;
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(1, rect.width || window.innerWidth);
    const ch = Math.max(1, rect.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const nw = Math.max(2, Math.round(cw * dpr * scale));
    const nh = Math.max(2, Math.round(ch * dpr * scale));
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.res, w, h);
    if (cssX == null) { cssX = cw / 2; cssY = ch / 2; target = [w / 2, h / 2]; mouse = target.slice(); }
    setMouse(cssX, cssY);
    draw();
  }

  function setMouse(x, y) {
    if (dead) return;
    cssX = x; cssY = y;
    const rect = canvas.getBoundingClientRect();
    target[0] = (x - rect.left) * (w / Math.max(1, rect.width));
    target[1] = (rect.bottom - y) * (h / Math.max(1, rect.height));
  }

  function setScroll(p) { if (dead) return; scroll = Math.min(1, Math.max(0, p)); gl.uniform1f(U.scroll, scroll); }
  function setPalette(bgHex, accentHex, accent2Hex) {
    if (dead) return;
    if (bgHex) bg = hexToRgb(bgHex, bg);
    if (accentHex) ac = hexToRgb(accentHex, ac);
    if (accent2Hex) ac2 = hexToRgb(accent2Hex, ac2);
    applyUniforms(); draw();
  }

  // dt in seconds; pointer lerp normalized so 60fps and 144fps feel identical
  function frame(dt) {
    if (dead) return;
    time += Math.min(dt, 0.05);
    const a = 1 - Math.pow(1 - 0.06, Math.max(0.1, dt * 60));
    mouse[0] += (target[0] - mouse[0]) * a;
    mouse[1] += (target[1] - mouse[1]) * a;
    gl.uniform2f(U.mouse, mouse[0], mouse[1]);
    draw();
  }
  function renderOnce() { if (!dead) draw(); }
  function destroy() {
    dead = true;
    try {
      gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch (_) {}
  }

  applyUniforms();
  gl.uniform1f(U.time, 0);
  gl.uniform1f(U.scroll, 0);
  gl.uniform2f(U.mouse, 0, 0);
  resize();

  return { ok: true, resize, frame, renderOnce, setMouse, setScroll, setPalette, destroy };
}

// Expose globally so the app can load it as a classic script (works from file:// too).
window.createShaderField = createShaderField;
