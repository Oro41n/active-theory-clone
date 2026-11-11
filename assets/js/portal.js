/* 41n portfolio — intro energy-core + edge energy tubes.
   Reconstructed from captured frames of the real load sequence:
     a hatched disc grows from a dome to a full circle, eight cyan electric
     tendrils unfurl outward with a slow curl, two symmetric outer arcs and a
     pair of energy nodes frame it, a percentage counts in the middle, then a
     white flash reveals the scene.  After load, colored tubes trail the cursor
     from the top and bottom edges (the site's networked mouse streams). */
(function () {
  "use strict";

  const cv = document.getElementById("fx");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: -999, y: -999, active: false };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("mousemove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
  window.addEventListener("mouseleave", function () { pointer.active = false; });

  /* ---------- Intro ---------- */
  let intro = null; // { start, onDone }
  const INTRO_MS = reduced ? 300 : 2600;

  function runIntro(onDone) {
    intro = { start: performance.now(), onDone: onDone, flashed: false, ended: false };
  }

  // Deterministic pseudo-random slash field (stable per frame so glyphs don't flicker)
  var _slashSeeds = null;
  function slashSeeds() {
    if (_slashSeeds) return _slashSeeds;
    var arr = [], n = 460, seed = 1337;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < n; i++) arr.push({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()), len: 4 + rnd() * 5, ph: rnd() * 6.283 });
    _slashSeeds = arr; return arr;
  }

  // Reproduces the real loader: scattered short slash glyphs condense into a
  // dome (upper semicircle) early, then fill into a full disc at high progress.
  function hatchDome(cx, cy, R, p) {
    var seeds = slashSeeds();
    // early: a loose dome (upper half); late: full disc
    var full = Math.max(0, Math.min(1, (p - 0.35) / 0.4));
    var gather = Math.min(1, p * 2.2); // glyphs scatter wide, then gather
    var active = Math.floor(seeds.length * Math.min(1, 0.15 + p * 0.95));
    ctx.save();
    ctx.font = "300 11px nbarchitekt, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var i = 0; i < active; i++) {
      var s = seeds[i];
      // map seed to upper dome angle (-PI..0) plus full-disc coverage late
      var ang = -Math.PI + s.a * Math.PI;                 // upper semicircle
      if (full > 0 && s.a > 0.5) ang = s.a * Math.PI * 2; // lower half appears late
      var rr = R * (0.18 + s.r * 0.82) * (0.6 + gather * 0.4);
      var x = cx + Math.cos(ang) * rr;
      var y = cy + Math.sin(ang) * rr * (full > 0 ? 1 : 0.9);
      var flick = 0.35 + 0.65 * Math.abs(Math.sin(p * 22 + s.ph));
      ctx.fillStyle = "rgba(120,175,235," + (0.18 + flick * 0.42) + ")";
      ctx.fillText("/", x, y);
    }
    // faint rim arc for the dome / disc
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, Math.PI * 2);
    ctx.strokeStyle = "rgba(150,200,255," + (0.16 + full * 0.22) + ")";
    ctx.lineWidth = 1; ctx.stroke();
    if (full > 0) { ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI);
      ctx.strokeStyle = "rgba(150,200,255," + (full * 0.30) + ")"; ctx.stroke(); }
    ctx.restore();
  }

  function tendril(cx, cy, ang, R, len, curl, alpha, phase) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const px = -s, py = c; // perpendicular
    const x0 = cx + c * R * 1.04, y0 = cy + s * R * 1.04;
    const x1 = cx + c * (R + len * 0.45) + px * curl, y1 = cy + s * (R + len * 0.45) + py * curl;
    const x2 = cx + c * (R + len) + px * curl * 1.7 + Math.sin(phase) * 5, y2 = cy + s * (R + len) + py * curl * 1.7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x1, y1, x2 - px * 6, y2 - py * 6, x2, y2);
    ctx.strokeStyle = "rgba(60,150,255," + alpha + ")";
    ctx.lineWidth = 1.3;
    ctx.shadowColor = "rgba(40,130,255,0.9)"; ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function sideArc(cx, cy, dir, offset, R, alpha, phase) {
    const x = cx + dir * offset;
    const sway = Math.sin(phase + dir) * 6;
    ctx.beginPath();
    ctx.moveTo(x, cy - R * 2.2);
    ctx.bezierCurveTo(x + dir * (28 + sway), cy - R * 0.8, x + dir * (28 - sway), cy + R * 0.8, x, cy + R * 2.2);
    ctx.strokeStyle = "rgba(50,140,240," + alpha + ")";
    ctx.lineWidth = 1;
    ctx.shadowColor = "rgba(40,130,255,0.7)"; ctx.shadowBlur = 7;
    ctx.stroke(); ctx.shadowBlur = 0;
  }

  function energyNode(x, y, r, a, phase) {
    ctx.save();
    ctx.shadowColor = "rgba(60,170,255,1)"; ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(120,205,255," + a + ")";
    ctx.beginPath();
    ctx.ellipse(x, y + Math.sin(phase) * 3, r, r * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawIntro(now) {
    const p = Math.min(1, (now - intro.start) / INTRO_MS);
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.072;
    const phase = now * 0.001;

    ctx.clearRect(0, 0, W, H);

    if (p < 1) {
      // early phase: just the tiny "//N" count at dead center (matches real frame //3)
      const pct = Math.round(e * 100);
      const countText = "//" + pct;
      hatchDome(cx, cy, R, e);

      // at higher charge, the full energy core blooms: radial electric tendrils
      const bloom = Math.max(0, Math.min(1, (e - 0.35) / 0.5));
      if (bloom > 0) {
        const len = R * (0.4 + bloom * 1.35);
        for (let i = 0; i < 14; i++) {
          const ang = (Math.PI * 2 / 14) * i + Math.PI / 14 + Math.sin(phase * 0.5 + i) * 0.04;
          const curl = Math.sin(phase * 0.65 + i * 1.1) * (18 + bloom * 22) + Math.cos(i * 2.1) * 10;
          tendril(cx, cy, ang, R, len, curl, bloom * (0.20 + 0.66), phase + i);
        }
        sideArc(cx, cy, -1, R * 2.7, R, bloom * 0.34, phase);
        sideArc(cx, cy, 1, R * 2.7, R, bloom * 0.34, phase + 1.4);
        sideArc(cx, cy, -1, R * 3.5, R, bloom * 0.22, phase + 0.7);
        sideArc(cx, cy, 1, R * 3.5, R, bloom * 0.22, phase + 2.1);
        const na = bloom * 0.8;
        energyNode(cx - R * 2.05, cy, 3.2, na, phase * 2);
        energyNode(cx + R * 2.05, cy, 3.2, na, phase * 2 + 1);
      }
      // the count sits inside the dome/core, cyan-white
      ctx.fillStyle = "rgba(150,215,255,0.95)";
      ctx.font = "300 12px nbarchitekt, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(countText, cx, cy + (e > 0.4 ? 0 : R * 0.1));
      return;
    }

    // flash then hand off — a quick bright bloom from the core, not a gray wash
    const fp = Math.min(1, (now - intro.start - INTRO_MS) / 420);
    const bloom = Math.pow(Math.sin(fp * Math.PI), 2.2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(214,236,255," + (bloom * 0.95) + ")");
    g.addColorStop(0.35, "rgba(120,180,255," + (bloom * 0.55) + ")");
    g.addColorStop(1, "rgba(4,7,13," + bloom + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (fp >= 1 && !intro.ended) {
      intro.ended = true;
      const cb = intro.onDone; intro = null;
      ctx.clearRect(0, 0, W, H);
      cb && cb();
    }
  }

  /* ---------- Persistent edge energy tubes ---------- */
  function tube(y0, dir, hue, phase, alpha) {
    if (!pointer.active) return;
    const strands = 3;
    for (let s = 0; s < strands; s++) {
      const len = 46 + s * 22;
      const x0 = pointer.x + (s - 1) * 9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const segs = 10;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const xx = x0 + Math.sin(phase * 2 + s + t * 4) * 7 * t;
        const yy = y0 + dir * len * t;
        ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = "hsla(" + hue + ",95%,62%," + (alpha * (1 - s * 0.22)) + ")";
      ctx.lineWidth = 2 - s * 0.4;
      ctx.shadowColor = "hsla(" + hue + ",95%,60%,0.9)"; ctx.shadowBlur = 12;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }

  function tick(now) {
    if (intro) { drawIntro(now); return; }
    ctx.clearRect(0, 0, W, H);
    if (reduced || !pointer.active) return;
    const phase = now * 0.0015;
    tube(0, 1, 190, phase, 0.5);           // top edge, cyan
    tube(H, -1, 265, phase + 1.7, 0.42);   // bottom edge, violet
  }

  window.ATPortal = { runIntro: runIntro, tick: tick, get active() { return !!intro; } };
})();
