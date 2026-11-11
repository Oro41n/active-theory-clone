/* Active Theory — study rebuild · scene engine
   The real site has NO native scrollbar (documentElement.scrollHeight === vh).
   Wheel / touch / keys feed a virtual `progress` damped with the engine's
   frame-rate-independent lerp, then drive: the shader camera push + palette,
   crossfade + dolly of DOM scene layers, and the pill nav velocity reaction.
   Scene 0 is the floating glass slab; scrolling pushes the camera through
   full-bleed work scenes, then About and Contact. */
(function () {
  "use strict";

  var SITE = window.AT_SITE;
  var PROJECTS = [];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var Stage, scenesEl = document.getElementById("scenes");
  var pill = document.getElementById("pill"), fill = document.getElementById("trackFill"), knob = document.getElementById("trackKnob");
  var pauseBtn = document.getElementById("pause"), menuBtn = document.getElementById("menuBtn"), menu = document.getElementById("menu");
  var audioBtn = document.getElementById("audio");
  var hudIndex = document.getElementById("hudIndex"), hudHint = document.getElementById("hudHint");
  var loader = document.getElementById("loader"), loadPct = document.getElementById("loadPct");
  var cursor = document.getElementById("cursor");

  var SCENES = [];
  var progress = 0, target = 0, velocity = 0, maxProgress = 3;
  var paused = false, started = false, menuOpen = false;
  var curX = innerWidth / 2, curY = innerHeight / 2;

  function damp(cur, to, alpha, dt) {
    var a = 1 - Math.pow(1 - alpha, Math.max(0.01, Math.min(dt, 0.05) * 60));
    return cur + (to - cur) * a;
  }

  /* ---------- Stage ---------- */
  (function initStage() {
    var cv = document.getElementById("Stage");
    try { Stage = window.createShaderField ? window.createShaderField(cv, { onFail: fallback }) : null; } catch (e) { Stage = null; }
    if (!Stage || !Stage.ok) { fallback(); Stage = noopStage(); }
    function fallback() { cv.classList.add("stage--fallback"); }
  })();
  function noopStage() {
    return { ok: false, frame: function () {}, setMouse: function () {}, setProgress: function () {},
      setPalette: function (b) { if (b) document.documentElement.style.setProperty("--bg", b); } };
  }

  /* ---------- Build scene layers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function buildScenes() {
    var picks = [PROJECTS[0], PROJECTS[4], PROJECTS[9], PROJECTS[13]].filter(Boolean);
    SCENES = [];
    SCENES.push({
      kind: "home", palette: ["#05070c", "#3aa0ff", "#1A6DEA"],
      html: '<section class="scene scene--home" data-i="0">' +
        '<div class="kicker">Creative Digital Experiences · Est. 2012</div>' +
        '<p class="tagline">We blend story, art &amp; technology as an in-house team of passionate makers.</p></section>'
    });
    picks.forEach(function (p, i) {
      var tags = (p.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean).join(" · ");
      SCENES.push({
        kind: "work", slug: p.slug,
        palette: ["#05070c", "#" + String(p.uiColor || "3aa0ff").replace(/^#/, ""), "#1A6DEA"],
        html: '<section class="scene scene--work" data-i="' + (i + 1) + '">' +
          (p.image ? '<img class="scene__img" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '') +
          '<div class="scene__info">' +
            '<div class="scene__num">Project ' + String(i + 1).padStart(2, "0") + ' / ' + String(picks.length).padStart(2, "0") + '</div>' +
            '<h2 class="scene__title">' + esc(p.name) + '</h2>' +
            '<div class="scene__meta"><span>' + esc(p.client) + '</span><span>' + ((p.date || "").slice(0, 4) || "") + '</span><span>' + esc(tags) + '</span></div>' +
            '<p class="scene__desc">' + esc(p.description || "") + '</p>' +
            (p.projectURL ? '<a class="scene__cta" href="' + esc(p.projectURL) + '" target="_blank" rel="noopener">Visit project ↗</a>' : '') +
          '</div></section>'
      });
    });
    SCENES.push({
      kind: "about", palette: ["#06080e", "#9ca5ff", "#3aa0ff"],
      html: '<section class="scene scene--text" data-i="' + SCENES.length + '">' +
        '<div class="kicker">About · Studio</div>' +
        '<h2 class="h2">We blend <em>story</em>, art &amp; technology into experiences that feel impossible — until you try them.</h2>' +
        '<p class="lede">' + esc(SITE.about) + '</p>' +
        '<div class="stats"><div class="stat"><b>126</b><span>FWA awards</span></div><div class="stat"><b>24</b><span>Cannes Lions</span></div><div class="stat"><b>69</b><span>Awwwards</span></div><div class="stat"><b>1</b><span>Golden Globe</span></div></div></section>'
    });
    SCENES.push({
      kind: "contact", palette: ["#04060a", "#00d8ff", "#1A6DEA"],
      html: '<section class="scene scene--text" data-i="' + SCENES.length + '">' +
        '<div class="kicker">Contact · Say hello</div>' +
        '<h2 class="contact__big">Let’s make<br>something<br><a href="mailto:' + esc(SITE.contact.email) + '">extraordinary.</a></h2>' +
        '<div class="contact__links"><a href="mailto:' + esc(SITE.contact.email) + '">' + esc(SITE.contact.email) + '</a>' +
        SITE.contact.links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + ' ↗</a>'; }).join("") + '</div></section>'
    });

    maxProgress = SCENES.length - 1;
    scenesEl.innerHTML = SCENES.map(function (s) { return s.html; }).join("");
    SCENES.forEach(function (s, i) { s.el = scenesEl.querySelector('[data-i="' + i + '"]'); });
    applyScene(0, true);
  }

  function indexLabel(i) { return String(i + 1).padStart(2, "0") + ' <i>/</i> ' + String(SCENES.length).padStart(2, "0"); }

  var lastPalette = -1;
  function applyScene(p, force) {
    var lo = Math.max(0, Math.min(SCENES.length - 1, Math.floor(p)));
    var hi = Math.min(SCENES.length - 1, lo + 1);
    var f = p - lo;
    var a = SCENES[lo].palette, b = SCENES[hi].palette;
    Stage.setPalette(mixHex(a[0], b[0], f), mixHex(a[1], b[1], f), mixHex(a[2], b[2], f));
    Stage.setProgress(p);

    for (var i = 0; i < SCENES.length; i++) {
      var el = SCENES[i].el; if (!el) continue;
      var d = p - i;
      var kind = SCENES[i].kind;
      // work scenes: image crossfades gently, but text fades FAST so two titles
      // never stack at the same spot mid-transition (camera-push handoff)
      var layerK = (kind === "work") ? 0.9 : 1.3;
      var op = Math.max(0, 1 - Math.abs(d) * layerK);
      op = op * op * (3 - 2 * op);
      if (op < 0.001) { el.style.opacity = 0; el.classList.remove("is-active"); continue; }
      var scale = 1 + d * 0.16;
      if (kind === "work") scale = Math.max(1, scale); // never shrink below full-bleed
      var ty = d * -3.2;
      el.style.opacity = op.toFixed(3);
      el.style.transform = "translate3d(0," + ty.toFixed(1) + "%,0) scale(" + scale.toFixed(3) + ")";
      var img = el.querySelector(".scene__img");
      if (img) img.style.transform = "scale(" + (1.1 + d * 0.05).toFixed(3) + ")";
      var info = el.querySelector(".scene__info");
      if (info) {
        var io = Math.max(0, 1 - Math.abs(d) * 2.3);
        io = io * io * (3 - 2 * io);
        info.style.opacity = io.toFixed(3);
        info.style.transform = "translate3d(0," + (d * -5).toFixed(1) + "%,0)";
      }
      if (op > 0.6) el.classList.add("is-active"); else el.classList.remove("is-active");
    }
    if (p > 0.08) hudHint.classList.add("gone");

    var active = Math.round(p);
    hudIndex.innerHTML = indexLabel(Math.max(0, Math.min(SCENES.length - 1, active)));
    var pct = maxProgress > 0 ? (p / maxProgress) * 100 : 0;
    fill.style.width = pct.toFixed(1) + "%";
    knob.style.left = pct.toFixed(1) + "%";
    pill.classList.toggle("hot", Math.abs(velocity) > 0.02);
    pill.style.transform = "rotate(" + (velocity * 16).toFixed(2) + "deg) scale(" + (1 + Math.min(Math.abs(velocity), 1) * 0.05).toFixed(3) + ")";
  }

  function mixHex(h1, h2, t) {
    function rgb(h) { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    var a = rgb(h1), b = rgb(h2);
    var r = Math.round(a[0] + (b[0] - a[0]) * t), g = Math.round(a[1] + (b[1] - a[1]) * t), bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return "#" + [r, g, bl].map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
  }

  /* ---------- Input ---------- */
  function nudge(delta) {
    if (menuOpen || !started) return;
    target = Math.max(0, Math.min(maxProgress, target + delta));
    hudHint.classList.add("gone");
  }
  var wheelLock = 0;
  window.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (paused) return;
    var now = performance.now();
    if (now < wheelLock) return;
    wheelLock = now + 60;
    nudge(Math.sign(e.deltaY) * Math.min(0.5, Math.abs(e.deltaY) / 900 + 0.14));
  }, { passive: false });

  var touchY = null;
  window.addEventListener("touchstart", function (e) { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (touchY == null || paused) return;
    var y = e.touches[0].clientY, dy = touchY - y;
    if (Math.abs(dy) > 30) { nudge(Math.sign(dy) * 0.32); touchY = y; }
  }, { passive: false });
  window.addEventListener("touchend", function () { touchY = null; }, { passive: true });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); nudge(0.5); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); nudge(-0.5); }
    if (e.key === "Escape" && menuOpen) toggleMenu(false);
  });
  function goTo(i, instant) { target = Math.max(0, Math.min(maxProgress, i)); if (instant) progress = target; }

  /* ---------- Chrome ---------- */
  menuBtn.addEventListener("click", function () { toggleMenu(true); });
  // click anywhere in the menu except a nav link closes it
  menu.addEventListener("click", function (e) { if (!e.target.closest("a")) toggleMenu(false); });
  function toggleMenu(open) {
    menuOpen = open;
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  }
  Array.prototype.forEach.call(menu.querySelectorAll("[data-link]"), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault(); var r = a.getAttribute("href"); toggleMenu(false);
      if (r === "#/work") goTo(1);
      else if (r === "#/about") goTo(SCENES.length - 2);
      else if (r === "#/contact") goTo(SCENES.length - 1);
    });
  });
  pauseBtn.addEventListener("click", function () {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    pauseBtn.setAttribute("aria-label", paused ? "Resume motion" : "Pause motion");
  });
  audioBtn.addEventListener("click", function () {
    var on = audioBtn.getAttribute("aria-pressed") === "true";
    audioBtn.setAttribute("aria-pressed", on ? "false" : "true");
  });

  /* ---------- Pointer ---------- */
  window.addEventListener("mousemove", function (e) {
    curX = e.clientX; curY = e.clientY;
    Stage.setMouse(e.clientX, e.clientY);
    if (cursor.style.display !== "none") cursor.style.opacity = 1;
  }, { passive: true });
  document.addEventListener("mouseover", function (e) { cursor.classList.toggle("hot", !!e.target.closest("a,button,.scene.is-active")); });
  if (window.matchMedia("(pointer: coarse)").matches || reduced) cursor.style.display = "none";

  /* ---------- Loop ---------- */
  var last = performance.now();
  function tick(now) {
    var dt = (now - last) / 1000; last = now;
    if (!paused) {
      var prev = progress;
      progress = damp(progress, target, 0.075, dt);
      velocity = velocity * 0.82 + (progress - prev) * 0.18;
      applyScene(progress);
    }
    Stage.frame(dt);
    window.ATPortal && window.ATPortal.tick(now);
    if (cursor.style.display !== "none") cursor.style.transform = "translate(" + curX.toFixed(1) + "px," + curY.toFixed(1) + "px)";
    requestAnimationFrame(tick);
  }

  /* ---------- Boot ---------- */
  function loadProjects(cb) {
    var x = new XMLHttpRequest(); x.open("GET", "assets/data/projects.json", true);
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status === 200 || x.status === 0) { try { PROJECTS = JSON.parse(x.responseText); } catch (e) { PROJECTS = []; } }
        cb();
      }
    };
    x.send();
  }

  document.body.classList.add("intro");

  loadProjects(function () {
    buildScenes();
    requestAnimationFrame(tick);
    window.ATPortal.runIntro(function () {
      loader.classList.add("hidden");
      document.body.classList.remove("intro");
      started = true;
    });
    var t0 = performance.now(), dur = reduced ? 300 : 2600;
    (function pctLoop() {
      if (performance.now() - t0 > dur) return;
      loadPct.textContent = "Loading " + Math.min(99, Math.round((performance.now() - t0) / (dur / 99))) + "%";
      requestAnimationFrame(pctLoop);
    })();
  });
})();
