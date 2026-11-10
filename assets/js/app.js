/* Active Theory — study rebuild
   Ambient particle field + hash router + data-driven views. */
(function () {
  "use strict";

  var SITE = window.AT_SITE;
  var PROJECTS = [];
  var app = document.getElementById("app");
  var chrome = document.getElementById("chrome");
  var nav = document.getElementById("nav");
  var indexEl = document.getElementById("index");
  var foot = document.getElementById("foot");

  /* ---------- Ambient canvas: pseudo-WebGL particle / hex field ---------- */
  var Stage = (function () {
    var cv = document.getElementById("Stage");
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], hex = [], mx = 0.5, my = 0.5, t = 0, running = true;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var COL = "143,183,255";

    function resize() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function build() {
      var area = W * H;
      var n = Math.min(150, Math.max(45, Math.round(area / 12000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          z: Math.random() * 0.9 + 0.1,
          r: Math.random() * 1.5 + 0.4,
          ph: Math.random() * Math.PI * 2
        });
      }
      hex = [];
      var s = 46;
      for (var y = -s; y < H + s; y += s * 1.5) {
        for (var x = -s; x < W + s; x += s * 1.73) {
          var oy = hex.length % 2 ? s * 0.75 : 0;
          hex.push({ x: x + oy, y: y });
        }
      }
    }
    function hexPath(cx, cy, r) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 3 * i - Math.PI / 6;
        var px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
    function frame() {
      if (!running) return;
      t += 0.006;
      ctx.clearRect(0, 0, W, H);
      // subtle hex lattice
      ctx.strokeStyle = "rgba(" + COL + ",0.045)";
      ctx.lineWidth = 1;
      for (var h = 0; h < hex.length; h++) {
        var p = hex[h];
        var dx = (p.x / W - mx), dy = (p.y / H - my);
        var pulse = 0.6 + 0.4 * Math.sin(t * 2 + p.x * 0.01 + p.y * 0.01);
        ctx.globalAlpha = pulse;
        hexPath(p.x - dx * 18, p.y - dy * 18, 26);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // parallax particles
      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        q.y -= q.z * 0.18;
        if (q.y < -4) { q.y = H + 4; q.x = Math.random() * W; }
        var px = q.x + (mx - 0.5) * 60 * q.z + Math.sin(t + q.ph) * 6;
        var py = q.y + (my - 0.5) * 40 * q.z;
        var a = 0.15 + q.z * 0.5;
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + COL + "," + a + ")";
        ctx.arc(px, py, q.r * q.z + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      // corner glow
      var g = ctx.createRadialGradient(mx * W, my * H, 0, mx * W, my * H, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(" + COL + ",0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (!reduced) requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function (e) { mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight; });
    document.addEventListener("visibilitychange", function () { running = !document.hidden; if (running && reduced) frame(); else if (running) requestAnimationFrame(frame); });
    resize();
    if (reduced) frame(); else requestAnimationFrame(frame);
  })();

  /* ---------- Loader ---------- */
  (function () {
    var el = document.getElementById("loader");
    var pct = document.getElementById("loadPct");
    var v = 0;
    var iv = setInterval(function () {
      v += Math.round(Math.random() * 18) + 4;
      if (v >= 100) { v = 100; clearInterval(iv); setTimeout(function () { el.classList.add("hidden"); }, 260); }
      pct.textContent = v;
    }, 90);
  })();
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Custom cursor ---------- */
  (function () {
    var c = document.getElementById("cursor");
    if (window.matchMedia("(pointer: coarse)").matches) { c.style.display = "none"; return; }
    var x = 0, y = 0, rx = 0, ry = 0;
    document.addEventListener("mousemove", function (e) { x = e.clientX; y = e.clientY; c.style.opacity = 1; });
    (function loop() { rx += (x - rx) * 0.2; ry += (y - ry) * 0.2; c.style.transform = "translate(" + rx + "px," + ry + "px)"; requestAnimationFrame(loop); })();
    document.addEventListener("mouseover", function (e) {
      c.classList.toggle("hot", !!e.target.closest("a,button,.card"));
    });
  })();

  /* ---------- Data ---------- */
  function loadProjects(cb) {
    var x = new XMLHttpRequest();
    x.open("GET", "assets/data/projects.json", true);
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status === 200 || x.status === 0) {
          try { PROJECTS = JSON.parse(x.responseText); } catch (e) { PROJECTS = []; }
        }
        cb();
      }
    };
    x.send();
  }

  /* ---------- Views ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function homeView() {
    var feats = PROJECTS.slice(0, 6);
    return '' +
      '<section class="view" data-view="home">' +
        '<div class="hero">' +
          '<div class="hero__eyebrow">Creative Digital Experiences · Est. 2012</div>' +
          '<h1 class="hero__title">Active<span class="l2">Theory</span></h1>' +
          '<p class="hero__sub">' + esc(SITE.meta.description) + '</p>' +
          '<div class="hero__scroll">Scroll to explore</div>' +
        '</div>' +
        '<div class="section">' +
          '<div class="kicker">Selected Work</div>' +
          '<h2 class="h2">Things we<br>made</h2>' +
          '<div class="grid">' + feats.map(function (p, i) { return card(p, i, i === 0 || i === 5); }).join("") + '</div>' +
          '<div style="text-align:center;margin-top:70px"><a href="#/work" data-link class="kicker" style="display:inline-flex">View all ' + PROJECTS.length + ' projects →</a></div>' +
        '</div>' +
      '</section>';
  }

  function card(p, i, wide) {
    var tags = (p.tags || "").split(",")[0].trim();
    return '<a class="card ' + (wide ? "wide" : "") + '" href="#/work/' + esc(p.slug) + '" data-link>' +
      '<div class="card__media">' +
        '<span class="card__num">' + String(i + 1).padStart(2, "0") + ' / ' + PROJECTS.length + '</span>' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') +
        '<span class="card__tag">' + esc(tags) + '</span>' +
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
      '<h2 class="h2">Work</h2>' +
      '<div class="filters"><button class="active" data-filter="all">All (' + PROJECTS.length + ')</button>' +
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
        '<h1 class="detail__title">' + esc(p.name) + '</h1>' +
        '<div class="detail__facts">' +
          '<div class="fact"><span class="fact__k">Client</span><span class="fact__v">' + esc(p.client) + '</span></div>' +
          '<div class="fact"><span class="fact__k">Year</span><span class="fact__v">' + ((p.date || "").slice(0, 4) || "—") + '</span></div>' +
          '<div class="fact"><span class="fact__k">Discipline</span><span class="fact__v">' + esc(p.tags) + '</span></div>' +
          (p.projectURL ? '<div class="fact"><span class="fact__k">Live site</span><span class="fact__v"><a href="' + esc(p.projectURL) + '" target="_blank" rel="noopener">Visit ↗</a></span></div>' : '') +
        '</div>' +
      '</div>' +
      (p.image ? '<img class="detail__hero" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '') +
      '<div class="detail__body"><p>' + esc(p.description) + '</p></div>' +
      '<nav class="detail__nav">' +
        '<a href="#/work/' + esc(prev.slug) + '" data-link>← ' + esc(prev.name) + '</a>' +
        '<a href="#/work" data-link>All work</a>' +
        '<a href="#/work/' + esc(next.slug) + '" data-link>' + esc(next.name) + ' →</a>' +
      '</nav>' +
    '</section>';
  }

  function aboutView() {
    return '<section class="view" data-view="about"><div class="section">' +
      '<div class="kicker">About · Studio</div>' +
      '<p class="about-lead">We blend <em>story</em>, art &amp; technology as an in-house team of passionate makers — crafting custom, award-winning digital experiences since 2012.</p>' +
      '<div class="caps">' + SITE.capabilities.map(function (c) {
        return '<div class="cap"><h3>' + esc(c[0]) + '</h3><p>' + esc(c[1]) + '</p></div>';
      }).join("") + '</div>' +
      '<div class="stats">' +
        '<div class="stat"><b>126</b><span>FWA awards</span></div>' +
        '<div class="stat"><b>24</b><span>Cannes Lions</span></div>' +
        '<div class="stat"><b>69</b><span>Awwwards</span></div>' +
        '<div class="stat"><b>1</b><span>Golden Globe</span></div>' +
      '</div>' +
    '</div></section>';
  }

  function contactView() {
    return '<section class="view contact" data-view="contact">' +
      '<div class="kicker">Contact · Say hello</div>' +
      '<h2 class="contact__big">Let’s make<br>something <a href="mailto:' + esc(SITE.contact.email) + '">extraordinary.</a></h2>' +
      '<div class="contact__links">' +
        '<a href="mailto:' + esc(SITE.contact.email) + '">' + esc(SITE.contact.email) + '</a>' +
        SITE.contact.links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + ' ↗</a>'; }).join("") +
      '</div>' +
    '</section>';
  }

  function notFound() {
    return '<section class="view" data-view="404"><div class="section"><div class="kicker">404</div><h2 class="h2">Lost in<br>the void.</h2><a href="#/" data-link class="kicker" style="display:inline-flex">← Back home</a></div></section>';
  }

  /* ---------- Router ---------- */
  var ROUTES = { home: "01 / 05", work: "02 / 05", detail: "03 / 05", about: "04 / 05", contact: "05 / 05" };

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

  function render() {
    var r = parseRoute();
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
      ? PROJECTS.find(function (x) { return x.slug === r.slug; }).name + " · Active Theory"
      : SITE.meta.title;
    indexEl.textContent = ROUTES[r.name] || "— / 05";
    // nav active state
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === r.name || (r.name === "detail" && a.getAttribute("data-route") === "work"));
    });
    // reveal + observers
    var view = app.querySelector(".view");
    requestAnimationFrame(function () { view && view.classList.add("in"); });
    observeReveal();
    bindFilters();
    window.scrollTo(0, 0);
    closeMenu();
    chrome.style.mixBlendMode = r.name === "home" ? "difference" : "normal";
  }

  var io;
  function observeReveal() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(app.querySelectorAll(".card"), function (c) { c.classList.add("in"); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    Array.prototype.forEach.call(app.querySelectorAll(".card"), function (c) { io.observe(c); });
  }

  function bindFilters() {
    var grid = document.getElementById("workGrid");
    if (!grid) return;
    Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var f = b.getAttribute("data-filter");
        Array.prototype.forEach.call(grid.querySelectorAll(".card"), function (card) {
          var show = f === "all" || (card.getAttribute("href") && projectHasTag(card.getAttribute("href"), f));
          card.style.display = show ? "" : "none";
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

  window.addEventListener("hashchange", render);
  loadProjects(render);
})();
