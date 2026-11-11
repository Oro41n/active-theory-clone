/* Active Theory — study rebuild
   Motion system reconstructed from the shipped bundle:
     · frame-rate-independent lerp  1-(1-a)^(dt*60)  (engine: exp/log form)
     · layered camera wobble (25e-5..95e-5 * wobbleStrength)
     · per-scene lerpSpeed (Home .10 / Work .07 / Detail .07 / CleanRoom .08)
     · easings.net bezier set (easeOutExpo, easeInOutQuart, easeOutCirc…)
     · Theatre.js-style staggered sequences
     · GPU curl-noise field + pointer halo (see shaderfield.js) */
(function () {
  "use strict";

  var SITE = window.AT_SITE;
  var PROJECTS = [];
  var app = document.getElementById("app");
  var chrome = document.getElementById("chrome");
  var nav = document.getElementById("nav");
  var indexEl = document.getElementById("index");
  var wipe = document.getElementById("wipe");
  var cursor = document.getElementById("cursor");
  var cursorLabel = document.getElementById("cursorLabel");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Motion primitives (reverse-engineered) ---------- */
  // Engine formula: alpha_norm = 1 - exp(log(1-alpha) * FRAME_HZ_MULTIPLIER)
  // with FRAME_HZ_MULTIPLIER = dt*60. Same as 1-(1-alpha)^(dt*60).
  function damp(cur, target, alpha, dt) {
    var a = 1 - Math.pow(1 - alpha, Math.max(0.01, Math.min(dt, 0.05) * 60));
    return cur + (target - cur) * a;
  }
  // Layered wobble ported from the engine, scaled to CSS pixels.
  // Original: cos(a + t*75e-5)*(a + 200 sin(t*95e-5)) * 2 sin(a+t*75e-5)
  //           * 1.1 cos(a+t*75e-5); z = sin(a + .0025 x)*(100*wobbleZ); * .001*strength
  function wobble(t, strength) {
    var a = 0.7, s = strength;
    var x = Math.cos(a + t * 75e-5) * (a + 200 * Math.sin(t * 95e-5));
    var y = Math.sin(Math.asin(Math.cos(a + t * 85e-5))) * (150 * Math.sin(a + t * 75e-5));
    x *= 2 * Math.sin(a + t * 75e-5);
    y *= 1.75 * Math.cos(a + t * 65e-5);
    x *= 1.1 * Math.cos(a + t * 75e-5);
    y *= 1.15 * Math.sin(a + t * 25e-5);
    return { x: x * 0.001 * s, y: y * 0.001 * s };
  }

  /* ---------- Scene config (from uil.json camera keys) ---------- */
  var SCENE = {
    home:    { lerp: 0.10, wobble: 0.10, bg: "#05070c", ac: "#00e0f0", ac2: "#1A6DEA" },
    work:    { lerp: 0.07, wobble: 0.06, bg: "#05070a", ac: "#7fd8ff", ac2: "#1A6DEA" },
    detail:  { lerp: 0.07, wobble: 0.05, bg: "#06080d", ac: "#9ca5ff", ac2: "#1A6DEA" },
    about:   { lerp: 0.08, wobble: 0.07, bg: "#07090e", ac: "#9ca5ff", ac2: "#00e0f0" },
    contact: { lerp: 0.08, wobble: 0.06, bg: "#04060a", ac: "#00ffff", ac2: "#1A6DEA" },
    "404":   { lerp: 0.08, wobble: 0.05, bg: "#05070a", ac: "#7fd8ff", ac2: "#1A6DEA" }
  };
  var scene = SCENE.home;

  /* ---------- Ambient field: WebGL with 2D fallback ---------- */
  var Field = (function () {
    var cv = document.getElementById("Stage");
    var api = null;
    try { api = window.createShaderField ? window.createShaderField(cv, { onFail: fallback }) : null; }
    catch (e) { api = null; }
    if (!api || !api.ok) { fallback(); api = fallbackApi(); }

    function fallback() { cv.classList.add("stage--fallback"); }
    function fallbackApi() {
      return { ok: false, resize() {}, renderOnce() {}, setMouse() {}, setScroll() {},
        setPalette(bg) { if (bg) document.documentElement.style.setProperty("--stage-bg", bg); },
        frame() {} };
    }
    return api;
  })();

  /* ---------- Unified RAF: shader + parallax + wobble + cursor ---------- */
  var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, nx: 0, ny: 0 };
  var smoothed = { x: pointer.x, y: pointer.y };
  var last = performance.now(), elapsed = 0;

  window.addEventListener("mousemove", function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ny = (e.clientY / window.innerHeight - 0.5) * 2;
    Field.setMouse(e.clientX, e.clientY);
  }, { passive: true });

  function tick(now) {
    var dt = (now - last) / 1000; last = now; elapsed += dt;

    smoothed.x = damp(smoothed.x, pointer.x, scene.lerp, dt);
    smoothed.y = damp(smoothed.y, pointer.y, scene.lerp, dt);
    Field.frame(dt);

    // parallax layers: depth read from data-depth, driven by frame-rate-independent lerp
    var layers = app.querySelectorAll("[data-depth]");
    for (var i = 0; i < layers.length; i++) {
      var depth = parseFloat(layers[i].getAttribute("data-depth")) || 0;
      var tx = (smoothed.x - window.innerWidth / 2) * depth;
      var ty = (smoothed.y - window.innerHeight / 2) * depth;
      var w = wobble(elapsed, scene.wobble);
      layers[i].style.transform = "translate3d(" + (tx + w.x).toFixed(2) + "px," + (ty + w.y).toFixed(2) + "px,0)";
    }

    // cursor ring follows with its own lerp (heavier than the dot)
    if (!reduced && cursor.style.display !== "none") {
      cursor.style.transform = "translate(" + smoothed.x.toFixed(1) + "px," + smoothed.y.toFixed(1) + "px)";
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- Scroll -> shader uniform + subtle section parallax ---------- */
  var scrollRAF = false;
  window.addEventListener("scroll", function () {
    if (scrollRAF) return;
    scrollRAF = true;
    requestAnimationFrame(function () {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      Field.setScroll(window.scrollY / max);
      scrollRAF = false;
    });
  }, { passive: true });

  /* ---------- Loader: waits for data + first shader frame ---------- */
  (function () {
    var el = document.getElementById("loader");
    var pct = document.getElementById("loadPct");
    var v = 0;
    var iv = setInterval(function () {
      v += Math.round(Math.random() * 16) + 4;
      if (v >= 100) {
        v = 100; clearInterval(iv);
        setTimeout(function () { el.classList.add("hidden"); document.body.classList.add("ready"); replayIntro(); }, 240);
      }
      pct.textContent = v;
    }, 85);
  })();
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Custom cursor ---------- */
  (function () {
    if (window.matchMedia("(pointer: coarse)").matches) { cursor.style.display = "none"; return; }
    document.addEventListener("mousemove", function () { cursor.style.opacity = 1; }, { once: true });
    document.addEventListener("mouseover", function (e) {
      var hit = e.target.closest("a,button,.card");
      cursor.classList.toggle("hot", !!hit);
      if (hit) {
        var label = hit.getAttribute("data-cursor");
        if (!label) label = hit.classList.contains("card") ? "VIEW" : (hit.tagName === "A" ? "↗" : "");
        cursorLabel.textContent = label || "";
      } else cursorLabel.textContent = "";
    });
  })();

  /* ---------- Data ---------- */
  function loadProjects(cb) {
    var x = new XMLHttpRequest();
    x.open("GET", "assets/data/projects.json", true);
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status === 200 || x.status === 0) { try { PROJECTS = JSON.parse(x.responseText); } catch (e) { PROJECTS = []; } }
        cb();
      }
    };
    x.send();
  }

  /* ---------- Views ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Wrap text into word spans for staggered curtain reveal; keeps inline <em>/<a>.
  function splitWords(html) {
    return html.replace(/(<[^>]+>)|([^\s<]+)/g, function (m, tag, word) {
      if (tag) return tag;
      return '<span class="wd"><i>' + word + '</i></span>';
    });
  }

  function homeView() {
    var feats = PROJECTS.slice(0, 6);
    return '' +
      '<section class="view" data-view="home">' +
        '<div class="hero">' +
          '<div class="hero__eyebrow lines"><span>Creative Digital Experiences · Est. 2012</span></div>' +
          '<h1 class="hero__title" data-depth="0.018">' +
            '<span class="hero__row"><span class="clip"><i>Active</i></span></span>' +
            '<span class="hero__row alt"><span class="clip"><i>Theory</i></span></span>' +
          '</h1>' +
          '<p class="hero__sub words">' + splitWords(esc(SITE.meta.description)) + '</p>' +
          '<div class="hero__scroll"><span>Scroll to explore</span></div>' +
        '</div>' +
        '<div class="section">' +
          '<div class="kicker">Selected Work</div>' +
          '<h2 class="h2 words" data-depth="0.01">' + splitWords("Things we<br>made") + '</h2>' +
          '<div class="grid">' + feats.map(function (p, i) { return card(p, i, i === 0 || i === 5); }).join("") + '</div>' +
          '<div class="cta-wrap"><a href="#/work" data-link class="kicker" data-cursor="ALL">View all ' + PROJECTS.length + ' projects →</a></div>' +
        '</div>' +
      '</section>';
  }

  function card(p, i, wide) {
    var tags = (p.tags || "").split(",")[0].trim();
    return '<a class="card ' + (wide ? "wide" : "") + '" href="#/work/' + esc(p.slug) + '" data-link data-cursor="VIEW" style="--i:' + (i % 6) + '">' +
      '<div class="card__media">' +
        '<span class="card__num">' + String(i + 1).padStart(2, "0") + ' / ' + PROJECTS.length + '</span>' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') +
        '<span class="card__tag">' + esc(tags) + '</span>' +
        '<span class="card__veil"></span>' +
      '</div>' +
      '<div class="card__body"><span class="card__name">' + esc(p.name) + '</span>' +
      '<span class="card__meta">' + esc(p.client) + '<br>' + (p.date || "").slice(0, 4) + '</span></div>' +
    '</a>';
  }

  function workView() {
    var tags = {};
    PROJECTS.forEach(function (p) { (p.tags || "").split(",").forEach(function (t) { t = t.trim(); if (t) tags[t] = (tags[t] || 0) + 1; }); });
    var order = ["Website", "Multiplayer", "XR", "AI", "Game", "Installation"];
    var keys = order.filter(function (k) { return tags[k]; }).concat(Object.keys(tags).filter(function (k) { return order.indexOf(k) < 0; }));
    return '<section class="view" data-view="work"><div class="section">' +
      '<div class="kicker">Archive · ' + PROJECTS.length + ' projects</div>' +
      '<h2 class="h2 words" data-depth="0.012">' + splitWords("Work") + '</h2>' +
      '<div class="filters">' +
        '<button class="active" data-filter="all">All (' + PROJECTS.length + ')</button>' +
        keys.map(function (k) { return '<button data-filter="' + esc(k) + '">' + esc(k) + ' (' + tags[k] + ')</button>'; }).join("") +
      '</div>' +
      '<div class="grid" id="workGrid">' + PROJECTS.map(function (p, i) { return card(p, i, false); }).join("") + '</div>' +
    '</div></section>';
  }

  function detailView(slug) {
    var p = PROJECTS.find(function (x) { return x.slug === slug; });
    if (!p) return notFound();
    var idx = PROJECTS.indexOf(p);
    var prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length];
    var next = PROJECTS[(idx + 1) % PROJECTS.length];
    return '<section class="view detail" data-view="detail">' +
      '<div class="detail__head">' +
        '<div class="kicker">' + esc((p.tags || "").split(",")[0]) + ' · Project ' + String(idx + 1).padStart(2, "0") + '</div>' +
        '<h1 class="detail__title words" data-depth="0.016">' + splitWords(esc(p.name)) + '</h1>' +
        '<div class="detail__facts">' +
          '<div class="fact"><span class="fact__k">Client</span><span class="fact__v">' + esc(p.client) + '</span></div>' +
          '<div class="fact"><span class="fact__k">Year</span><span class="fact__v">' + ((p.date || "").slice(0, 4) || "—") + '</span></div>' +
          '<div class="fact"><span class="fact__k">Discipline</span><span class="fact__v">' + esc(p.tags) + '</span></div>' +
          (p.projectURL ? '<div class="fact"><span class="fact__k">Live site</span><span class="fact__v"><a href="' + esc(p.projectURL) + '" target="_blank" rel="noopener">Visit ↗</a></span></div>' : '') +
        '</div>' +
      '</div>' +
      (p.image ? '<div class="detail__media" data-depth="0.02"><img class="detail__hero" src="' + esc(p.image) + '" alt="' + esc(p.name) + '"><span class="detail__scan"></span></div>' : '') +
      '<div class="detail__body words">' + splitWords(esc(p.description)) + '</div>' +
      '<nav class="detail__nav">' +
        '<a href="#/work/' + esc(prev.slug) + '" data-link data-cursor="PREV">← ' + esc(prev.name) + '</a>' +
        '<a href="#/work" data-link data-cursor="INDEX">All work</a>' +
        '<a href="#/work/' + esc(next.slug) + '" data-link data-cursor="NEXT">' + esc(next.name) + ' →</a>' +
      '</nav>' +
    '</section>';
  }

  function aboutView() {
    return '<section class="view" data-view="about"><div class="section">' +
      '<div class="kicker">About · Studio</div>' +
      '<p class="about-lead words" data-depth="0.01">' + splitWords('We blend <em>story</em>, art &amp; technology as an in-house team of passionate makers — crafting custom, award-winning digital experiences since 2012.') + '</p>' +
      '<div class="caps">' + SITE.capabilities.map(function (c, i) {
        return '<div class="cap" style="--i:' + i + '"><h3>' + esc(c[0]) + '</h3><p>' + esc(c[1]) + '</p></div>';
      }).join("") + '</div>' +
      '<div class="stats">' +
        ['126', 'FWA awards', '24', 'Cannes Lions', '69', 'Awwwards', '1', 'Golden Globe'].reduce(function (acc, v, i) {
          if (i % 2 === 0) acc.push('<div class="stat" style="--i:' + (i / 2) + '"><b>' + v + '</b><span>');
          else acc[acc.length - 1] += v + '</span></div>';
          return acc;
        }, []).join("") +
      '</div>' +
    '</div></section>';
  }

  function contactView() {
    return '<section class="view contact" data-view="contact">' +
      '<div class="kicker">Contact · Say hello</div>' +
      '<h2 class="contact__big" data-depth="0.014">' +
        '<span class="clip"><i>Let’s make</i></span>' +
        '<span class="clip"><i>something</i></span>' +
        '<span class="clip"><i><a href="mailto:' + esc(SITE.contact.email) + '" data-cursor="MAIL">extraordinary.</a></i></span>' +
      '</h2>' +
      '<div class="contact__links">' +
        '<a href="mailto:' + esc(SITE.contact.email) + '" data-cursor="MAIL">' + esc(SITE.contact.email) + '</a>' +
        SITE.contact.links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" data-cursor="↗">' + esc(l.title) + '</a>'; }).join("") +
      '</div>' +
    '</section>';
  }

  function notFound() {
    return '<section class="view" data-view="404"><div class="section"><div class="kicker">404</div><h2 class="h2 words">' + splitWords("Lost in<br>the void.") + '</h2><a href="#/" data-link class="kicker" style="display:inline-flex">← Back home</a></div></section>';
  }

  /* ---------- Router + transition ---------- */
  var ROUTES = { home: "01 / 05", work: "02 / 05", detail: "03 / 05", about: "04 / 05", contact: "05 / 05", "404": "— / 05" };

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, "");
    var seg = h.split("/").filter(Boolean);
    if (!seg.length) return { name: "home" };
    if (seg[0] === "work" && seg[1]) return { name: "detail", slug: decodeURIComponent(seg[1]) };
    if (seg[0] === "work") return { name: "work" };
    if (seg[0] === "about") return { name: "about" };
    if (seg[0] === "contact") return { name: "contact" };
    return { name: "404" };
  }

  var currentRendered = false;
  function render(animate) {
    var r = parseRoute();
    scene = SCENE[r.name] || SCENE.home;
    // per-project accent tint on detail
    if (r.name === "detail") {
      var pr = PROJECTS.find(function (x) { return x.slug === r.slug; });
      if (pr && pr.uiColor) scene = Object.assign({}, scene, { ac: "#" + String(pr.uiColor).replace(/^#/, "") });
    }
    Field.setPalette(scene.bg, scene.ac, scene.ac2);

    function swap() {
      var html;
      switch (r.name) {
        case "home": html = homeView(); break;
        case "work": html = workView(); break;
        case "detail": html = detailView(r.slug); break;
        case "about": html = aboutView(); break;
        case "contact": html = contactView(); break;
        default: html = notFound();
      }
      app.innerHTML = html;
      document.title = r.name === "detail" && PROJECTS.find(function (x) { return x.slug === r.slug; })
        ? PROJECTS.find(function (x) { return x.slug === r.slug; }).name + " · Active Theory" : SITE.meta.title;
      indexEl.textContent = ROUTES[r.name] || "— / 05";
      Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
        a.classList.toggle("active", a.getAttribute("data-route") === r.name || (r.name === "detail" && a.getAttribute("data-route") === "work"));
      });
      chrome.style.mixBlendMode = r.name === "home" ? "difference" : "normal";
      window.scrollTo(0, 0);
      closeMenu();
      var view = app.querySelector(".view");
      requestAnimationFrame(function () { if (view) view.classList.add("in"); });
      if (!reduced) replayIntro();
      observeReveal();
      bindFilters();
      currentRendered = true;
    }

    if (!currentRendered || reduced || !animate) { swap(); return; }
    // Theatre-style wipe: cover, swap at midpoint, uncover.
    wipe.classList.remove("out"); wipe.classList.add("in");
    setTimeout(function () { swap(); }, 340);
    setTimeout(function () { wipe.classList.remove("in"); wipe.classList.add("out"); }, 400);
    setTimeout(function () { wipe.classList.remove("out"); }, 900);
  }

  // Restart CSS entry animations for a freshly swapped view.
  function replayIntro() {
    if (reduced) return;
    var view = app.querySelector(".view");
    if (!view) return;
    view.classList.remove("intro");
    void view.offsetWidth; // reflow
    view.classList.add("intro");
  }

  var io;
  function observeReveal() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(app.querySelectorAll(".card,.cap,.stat"), function (c) { c.classList.add("in"); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(app.querySelectorAll(".card,.cap,.stat"), function (c) { io.observe(c); });
  }

  function bindFilters() {
    var grid = document.getElementById("workGrid");
    if (!grid) return;
    Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var f = b.getAttribute("data-filter"), n = 0;
        Array.prototype.forEach.call(grid.querySelectorAll(".card"), function (card) {
          var show = f === "all" || (card.getAttribute("href") && projectHasTag(card.getAttribute("href"), f));
          if (show) { card.style.display = ""; card.style.setProperty("--i", n++ % 6); }
          else card.style.display = "none";
        });
      });
    });
  }
  function projectHasTag(href, tag) {
    var slug = href.replace("#/work/", "");
    var p = PROJECTS.find(function (x) { return x.slug === slug; });
    return p && (p.tags || "").toLowerCase().indexOf(tag.toLowerCase()) >= 0;
  }

  /* ---------- Menu ---------- */
  var mt = document.getElementById("menuToggle");
  function closeMenu() { nav.classList.remove("open"); mt.classList.remove("open"); mt.setAttribute("aria-expanded", "false"); }
  mt.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    mt.classList.toggle("open", open);
    mt.setAttribute("aria-expanded", open ? "true" : "false");
  });

  window.addEventListener("hashchange", function () { render(true); });
  loadProjects(function () { render(false); });
})();
