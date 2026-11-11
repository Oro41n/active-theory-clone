/* Active Theory study rebuild — intro energy-core + edge energy tubes.
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

  function hatchDisc(cx, cy, R, fill) {
    // circular clip, hatch fills from the top down (dome -> full circle)
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const top = cy - R, bottom = cy + R;
    const level = top + fill * (2 * R);
    ctx.strokeStyle = "rgba(120,170,235,0.55)";
    ctx.lineWidth = 1;
    const gap = 6, span = Math.ceil(R * 2.4);
    for (let x = -span; x <= span; x += gap) {
      ctx.beginPath();
      ctx.moveTo(cx + x, top - 2);
      ctx.lineTo(cx + x - (bottom - top), top - 2 + (bottom - top));
      ctx.stroke();
    }
    // mask out everything below the fill level
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - R - 2, level, 2 * R + 4, 2 * R + 4);
    ctx.restore();
    // faint disc rim
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(150,200,255,0.42)"; ctx.lineWidth = 1;
    ctx.shadowColor = "rgba(60,150,255,0.6)"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
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
      const fill = Math.min(1, e * 1.3);
      hatchDisc(cx, cy, R, fill);
      // twelve curling electric tendrils unfurl as charge rises (real core is dense & organic)
      const len = R * (0.4 + e * 1.35);
      for (let i = 0; i < 12; i++) {
        const ang = (Math.PI * 2 / 12) * i + Math.PI / 12 + Math.sin(phase * 0.5 + i) * 0.05;
        const curl = Math.sin(phase * 0.65 + i * 1.1) * (18 + e * 22) + Math.cos(i * 2.1) * 10;
        tendril(cx, cy, ang, R, len, curl, 0.20 + e * 0.66, phase + i);
      }
      // symmetric outer arcs
      sideArc(cx, cy, -1, R * 2.7, R, 0.10 + e * 0.30, phase);
      sideArc(cx, cy, 1, R * 2.7, R, 0.10 + e * 0.30, phase + 1.4);
      sideArc(cx, cy, -1, R * 3.5, R, 0.06 + e * 0.20, phase + 0.7);
      sideArc(cx, cy, 1, R * 3.5, R, 0.06 + e * 0.20, phase + 2.1);
      // energy nodes left / right
      const na = 0.25 + e * 0.6;
      energyNode(cx - R * 2.05, cy, 3.2, na, phase * 2);
      energyNode(cx + R * 2.05, cy, 3.2, na, phase * 2 + 1);
      // percentage
      const pct = Math.round(e * 100);
      ctx.fillStyle = "rgba(220,238,255,0.92)";
      ctx.font = "300 12px nbarchitekt, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("/" + pct, cx, cy);
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
