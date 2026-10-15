/* Neon Tulp — page behaviour.
   Loader → age gate → intro; Amsterdam clock & live open/closed status; day/night mode with a
   circular view transition; NL/EN/FR; smooth scroll + scroll-driven scenes; menu, chart, agenda, map. */
(function () {
  "use strict";

  var I18N = window.NT_I18N, D = window.NT_DATA;
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var G = !!(window.gsap && window.ScrollTrigger);
  if (G) gsap.registerPlugin(ScrollTrigger);

  var store = {
    get: function (k, session) { try { return (session ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, session) { try { (session ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };
  var state = {
    lang: I18N[root.getAttribute("lang")] ? root.getAttribute("lang") : "en",
    mode: root.getAttribute("data-mode") === "dag" ? "dag" : "nacht",
    tab: null, item: null, chartDrawn: false,
    modeAuto: root.getAttribute("data-mode-src") !== "user"
  };
  state.tab = state.mode === "dag" ? "koffie" : "wiet";
  state.item = D.MENU[state.tab][0].id;

  function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = "0" + n; return n; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------- i18n ---------------- */
  function t(key, vars) {
    var v = I18N[state.lang] && I18N[state.lang][key];
    if (v == null) v = I18N.en[key];
    if (v == null) return key;
    if (vars && typeof v === "string") v = v.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return v;
  }
  function local(obj) { return obj && typeof obj === "object" ? (obj[state.lang] || obj.en) : obj; }
  var LOCALE = { nl: "nl-NL", en: "en-IE", fr: "fr-FR" };
  function euro(v) {
    var whole = Math.round(v) === v;
    return new Intl.NumberFormat(LOCALE[state.lang], { style: "currency", currency: "EUR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  }

  function applyLang(lang) {
    state.lang = I18N[lang] ? lang : "en";
    root.setAttribute("lang", state.lang);
    store.set("nt-lang", state.lang);
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $$("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    $$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    $$(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lang") === state.lang ? "true" : "false"); });
    $("#badgeText").textContent = t("hero.badge");
    splitManifesto();
    updateModeUI();
    renderTabs();
    renderMenu(false);
    renderProfile(true);
    renderChart();
    renderAgenda();
    renderHours();
    updateClock();
    updateFilmButton();
    if (G) requestAnimationFrame(function () { ScrollTrigger.refresh(); });
  }

  /* ---------------- Amsterdam time ---------------- */
  var amsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hourCycle: "h23"
  });
  var DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  function ams() {
    var o = {};
    amsFmt.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, dow: DOW[o.weekday] };
  }
  function hm(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function openState(now) {
    var mins = now.h * 60 + now.mi, today = now.dow, yest = (today + 6) % 7, H = D.HOURS;
    if (H[yest].close > 1440 && mins < H[yest].close - 1440) return { open: true, at: H[yest].close - 1440 };
    if (mins >= H[today].open && mins < H[today].close) return { open: true, at: H[today].close };
    if (mins < H[today].open) return { open: false, at: H[today].open };
    return { open: false, at: H[(today + 1) % 7].open };
  }
  function updateClock() {
    var now = ams();
    var time = pad(now.h) + ":" + pad(now.mi) + ":" + pad(now.s);
    $$("[data-clock-time]").forEach(function (el) { el.textContent = time; });
    $$("[data-clock]").forEach(function (el) { el.textContent = "Amsterdam " + time.slice(0, 5); });
    var st = openState(now), status = $("#status");
    status.classList.toggle("is-open", st.open);
    $("#statusText").textContent = t(st.open ? "status.open" : "status.closed", { t: hm(st.at) });
    if (now.s === 0) { renderChartNow(); }
  }

  /* ---------------- Mode (dag / nacht) ---------------- */
  var smoke = null;
  function smokePalette() {
    if (!smoke) return;
    if (state.mode === "dag") smoke.setPalette("#f6f3ff", "#9fb3ff", 0.55);
    else smoke.setPalette("#ff4f8b", "#ffb547", 0.62);
  }
  function updateModeUI() {
    $$("[data-mode-label]").forEach(function (el) {
      var m = el.getAttribute("data-mode-label");
      el.textContent = m === state.mode ? t("dn.active") : t("dn.switch", { mode: t("mode." + m) });
    });
    $$(".dn-panel").forEach(function (p) { p.classList.toggle("is-current", p.getAttribute("data-panel") === state.mode); });
    var tog = $("#modeToggle");
    tog.setAttribute("title", t("mode." + (state.mode === "dag" ? "nacht" : "dag")));
  }
  function applyMode(mode) {
    state.mode = mode;
    root.setAttribute("data-mode", mode);
    store.set("nt-mode", mode, true);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dag" ? "#eef0f5" : "#0d1230");
    updateModeUI();
    smokePalette();
    renderChart();
  }
  function setMode(mode, origin) {
    state.modeAuto = false;
    if (mode === state.mode) return;
    var x = window.innerWidth - 90, y = 36;
    if (origin) { var r = origin.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    if (document.startViewTransition && !reduce) {
      var vt;
      try { vt = document.startViewTransition(function () { applyMode(mode); }); } catch (e) { applyMode(mode); return; }
      vt.ready.then(function () {
        var rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + rad + "px at " + x + "px " + y + "px)"] },
          { duration: 1000, easing: "cubic-bezier(.7,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(function () {});
    } else {
      applyMode(mode);
    }
  }

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (window.Lenis && G && !reduce) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function lockScroll(on) {
    if (lenis) { on ? lenis.stop() : lenis.start(); }
    document.body.style.overflow = on ? "hidden" : "";
  }
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; } });
    else if (typeof target === "number") window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id === "#") return;
    var el = id === "#top" ? 0 : $(id);
    if (el === null) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(el);
  });

  /* ---------------- Navigation ---------------- */
  var nav = $("#nav"), lastY = 0;
  function onScroll(y) {
    var heroH = $(".hero").offsetHeight;
    nav.classList.toggle("is-solid", y > heroH * 0.75);
    var menuOpen = $("#burger").getAttribute("aria-expanded") === "true";
    nav.classList.toggle("is-hidden", !menuOpen && y > heroH && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove("is-hidden");
    lastY = y;
  }
  if (lenis) lenis.on("scroll", function (l) { onScroll(l.scroll); });
  else window.addEventListener("scroll", function () { onScroll(window.scrollY); }, { passive: true });

  var burger = $("#burger"), menu = $("#mobileMenu");
  function openMenu() {
    menu.hidden = false; burger.setAttribute("aria-expanded", "true"); burger.querySelector(".burger__txt").textContent = t("nav.close");
    nav.classList.add("is-solid"); lockScroll(true);
    if (G) gsap.fromTo(menu.querySelectorAll("nav a"), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: "expo.out" });
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true; burger.setAttribute("aria-expanded", "false"); burger.querySelector(".burger__txt").textContent = t("nav.menu");
    lockScroll(false); onScroll(lenis ? lenis.scroll : window.scrollY);
  }
  burger.addEventListener("click", function () { menu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  $$(".lang button").forEach(function (b) { b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); }); });
  $("#modeToggle").addEventListener("click", function (e) { setMode(state.mode === "dag" ? "nacht" : "dag", e.currentTarget); });
  $$("[data-set-mode]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-set-mode"), b); }); });

  /* ---------------- Cursor, magnetic buttons, hover image ---------------- */
  var cursor = $(".cursor"), ring = $(".cursor__ring"), dot = $(".cursor__dot"), cLabel = $(".cursor__label");
  var hov = { el: $("#hoverImg"), img: $("#hoverImg img"), on: false };
  var P = { x: window.innerWidth / 2, y: window.innerHeight / 2, rx: 0, ry: 0, hx: 0, hy: 0 };
  if (fine && !reduce) {
    root.classList.add("has-cursor");
    document.addEventListener("pointermove", function (e) { P.x = e.clientX; P.y = e.clientY; }, { passive: true });
    document.addEventListener("pointerover", function (e) {
      var lab = e.target.closest("[data-cursor]");
      var link = e.target.closest("a, button, .item, .ev, summary, input");
      cursor.classList.toggle("is-label", !!lab);
      cursor.classList.toggle("is-link", !lab && !!link);
      if (lab) cLabel.textContent = lab.getAttribute("data-cursor") === "play" ? ($("#filmFrame").classList.contains("is-playing") && lab.id === "filmFrame" ? t("film.pause") : t("film.play")) : "";
    });
    document.addEventListener("pointerleave", function () { cursor.classList.add("is-hidden"); });
    document.addEventListener("pointerenter", function () { cursor.classList.remove("is-hidden"); });
    $$(".magnetic").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.5, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", function () { gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, .4)" }); });
    });
  }
  function hoverShow(src) { if (!fine || reduce) return; if (hov.img.getAttribute("src") !== src) hov.img.src = src; hov.el.classList.add("is-on"); hov.on = true; }
  function hoverHide() { hov.el.classList.remove("is-on"); hov.on = false; }
  function pointerLoop() {
    P.rx += (P.x - P.rx) * 0.18; P.ry += (P.y - P.ry) * 0.18;
    var hx = P.hx, hy = P.hy;
    P.hx += (P.x - P.hx) * 0.12; P.hy += (P.y - P.hy) * 0.12;
    if (root.classList.contains("has-cursor")) {
      dot.style.transform = "translate(" + P.x + "px," + P.y + "px)";
      ring.style.transform = "translate(" + P.rx + "px," + P.ry + "px)";
    }
    if (hov.on || hov.el.classList.contains("is-on")) {
      var rot = clamp((P.hx - hx) * 0.6, -12, 12);
      hov.el.style.transform = "translate(" + P.hx + "px," + P.hy + "px) translate(-50%,-50%) rotate(" + rot + "deg) scale(" + (hov.on ? 1 : 0.85) + ")";
    }
  }
  if (G) gsap.ticker.add(pointerLoop);

  /* ---------------- Hero: breathing letters + smoke ---------------- */
  var hero = $(".hero"), chars = $$("#heroNeon .ch"), heroVisible = true;
  var charState = chars.map(function () { return { w: 125, g: 900 }; });
  var HP = { x: -9999, y: -9999, active: false };
  hero.addEventListener("pointermove", function (e) {
    HP.x = e.clientX; HP.y = e.clientY; HP.active = true;
    if (smoke) smoke.pointer(e.clientX / window.innerWidth, 1 - (e.clientY - hero.getBoundingClientRect().top) / hero.offsetHeight);
  });
  hero.addEventListener("pointerleave", function () { HP.active = false; });
  function heroLoop(time) {
    if (!heroVisible || reduce) return;
    var span = Math.max(260, window.innerWidth * 0.26);
    chars.forEach(function (c, i) {
      var k;
      if (HP.active && fine) {
        var r = c.getBoundingClientRect();
        var d = Math.hypot(HP.x - (r.left + r.width / 2), (HP.y - (r.top + r.height / 2)) * 0.7);
        k = clamp(1 - d / span, 0, 1);
        k = k * k * (3 - 2 * k);
      } else {
        k = (Math.sin(time * 0.9 + i * 1.3) + 1) * 0.5 * 0.55;
      }
      var s = charState[i];
      s.w += (125 - k * 63 - s.w) * 0.12;
      s.g += (900 - k * 620 - s.g) * 0.12;
      c.style.fontVariationSettings = '"wdth" ' + s.w.toFixed(1) + ', "wght" ' + Math.round(s.g);
    });
  }
  if (G) gsap.ticker.add(function (time) { heroLoop(time); });

  var smokeCanvas = $("#smoke");
  if (!reduce && window.NTSmoke) { smoke = window.NTSmoke.create(smokeCanvas); smokePalette(); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      if (smoke) heroVisible ? smoke.start() : smoke.stop();
      var v = $("#heroVideo");
      if (heroVisible) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
    }, { threshold: 0 }).observe(hero);
  } else if (smoke) smoke.start();

  /* ---------------- Marquee ---------------- */
  var marquees = [];
  function buildMarquees() {
    $$(".marquee__track:not(.is-clone)").forEach(function (track) {
      var row = track.parentElement;
      if (!track.dataset.base) track.dataset.base = track.innerHTML;
      track.innerHTML = track.dataset.base;
      var guard = 0;
      while (track.scrollWidth < row.clientWidth + 40 && guard++ < 12) track.innerHTML += track.dataset.base;
      $$(".marquee__track.is-clone", row).forEach(function (c) { c.remove(); });
      var clone = track.cloneNode(true); clone.classList.add("is-clone"); row.appendChild(clone);
    });
    marquees = $$(".marquee__row").map(function (row) {
      var tracks = $$(".marquee__track", row);
      return { row: row, tracks: tracks, dir: +tracks[0].getAttribute("data-marquee"), w: tracks[0].scrollWidth, x: 0 };
    });
  }
  buildMarquees();
  if (G && !reduce) {
    var skew = 0;
    gsap.ticker.add(function (time, dt) {
      var v = lenis ? lenis.velocity : 0;
      var boost = 1 + Math.min(Math.abs(v) * 0.08, 6);
      skew += (clamp(v * 0.25, -8, 8) - skew) * 0.1;
      marquees.forEach(function (m) {
        var dir = v < -0.5 ? -m.dir : m.dir;
        m.x += dir * 0.055 * dt * boost;
        if (m.x <= -m.w) m.x += m.w;
        if (m.x > 0) m.x -= m.w;
        m.tracks.forEach(function (tr) { tr.style.transform = "translate3d(" + m.x + "px,0,0) skewX(" + (-skew).toFixed(2) + "deg)"; });
      });
    });
  }

  /* ---------------- Manifesto ---------------- */
  var KEYWORDS = { nl: ["tijd", "single-origin", "vinyl", "eerlijke"], en: ["time", "single-origin", "record", "honest"], fr: ["temps", "unique", "vinyle", "honnête"] };
  var manifestoWords = [];
  function splitManifesto() {
    var el = $("#manifesto"), keys = KEYWORDS[state.lang] || [];
    var words = t("concept.manifesto").split(/\s+/);
    el.innerHTML = words.map(function (w) {
      var bare = w.toLowerCase().replace(/[.,;:!?]/g, "");
      return '<span class="w' + (keys.indexOf(bare) > -1 ? " is-key" : "") + '">' + esc(w) + "</span>";
    }).join(" ");
    manifestoWords = $$(".w", el);
    if (G && !reduce) el.classList.add("is-split");
  }

  /* ---------------- Menu (De Kaart) ---------------- */
  function typeLabel(it) { return t("type." + it.type); }
  function renderTabs() {
    $$("#kaartTabs [role=tab]").forEach(function (b) {
      var on = b.getAttribute("data-tab") === state.tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    moveInk();
  }
  function moveInk() {
    var b = $('#kaartTabs [aria-selected="true"]'), ink = $(".tabs__ink");
    if (!b) return;
    ink.style.width = b.offsetWidth + "px";
    ink.style.transform = "translateX(" + b.offsetLeft + "px)";
  }
  function itemMeta(it) {
    var chip = it.type === "coffee" || it.type === "bakery" ? "" : '<span class="chip chip--' + it.type + '">' + esc(typeLabel(it)) + "</span>";
    var bits = [];
    if (it.thc != null) bits.push("THC " + it.thc + "%" + (it.cbd >= 1 ? " · CBD " + it.cbd + "%" : ""));
    var origin = local(it.origin);
    if (typeof origin === "string" && origin.indexOf("type.") !== 0 && origin.indexOf("kaart.") !== 0) bits.push(origin);
    bits.push(local(it.desc));
    return chip + bits.map(function (b) { return "<span>" + esc(b) + "</span>"; }).join("");
  }
  function itemPrice(it) {
    if (it.price == null) return '<span class="item__price">' + esc(t("kaart.counter")) + "</span>";
    var perGram = it.thc != null;
    return '<span class="item__price">' + esc(euro(it.price)) + (perGram ? "<small>" + esc(t("kaart.perGram")) + "</small>" : "") + "</span>";
  }
  function renderMenu(animate) {
    var list = $("#kaartList"), items = D.MENU[state.tab];
    $("#kaartPanel").setAttribute("aria-labelledby", "tab-" + state.tab);
    list.innerHTML = items.map(function (it) {
      return '<li><button type="button" class="item" data-id="' + it.id + '" aria-pressed="' + (it.id === state.item) + '">' +
        '<span class="item__name">' + esc(it.name) + '<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>' +
        itemPrice(it) + '<span class="item__meta">' + itemMeta(it) + "</span></button></li>";
    }).join("");
    if (animate && G && !reduce) gsap.from(list.children, { y: 26, opacity: 0, stagger: 0.05, duration: 0.8, ease: "expo.out" });
  }
  function currentItem() {
    var items = D.MENU[state.tab];
    for (var i = 0; i < items.length; i++) if (items[i].id === state.item) return items[i];
    return items[0];
  }
  var profileTimer = 0;
  function renderProfile(instant) {
    var it = currentItem(), prof = $("#profile"), img = $("#profileImg");
    var src = D.IMG + it.img;
    function swap() { img.src = src; img.alt = it.name; prof.classList.remove("is-swapping"); }
    clearTimeout(profileTimer);
    if (instant || img.getAttribute("src") === src) swap();
    else { prof.classList.add("is-swapping"); profileTimer = setTimeout(swap, 260); }

    $("#profileType").textContent = typeLabel(it) + (it.type === "coffee" || it.type === "bakery" ? " · " + local(it.origin) : "");
    $("#profileName").textContent = it.name;
    $("#profileDesc").textContent = local(it.desc);

    var meters = $("#profileMeters"), html = "";
    if (it.thc != null) {
      html += meterRow("THC", it.thc, 30, "");
      html += meterRow("CBD", it.cbd, 30, "meter--cbd");
    } else if (it.strength != null) {
      html += '<div class="meter"><span class="meter__label">' + esc(t("kaart.strength")) + '</span><span class="pips">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<i class="' + (n <= it.strength ? "on" : "") + '"></i>'; }).join("") +
        '</span><span class="meter__val">' + it.strength + "/5</span></div>";
    }
    meters.innerHTML = html;
    requestAnimationFrame(function () {
      $$(".meter__track i", meters).forEach(function (i) { i.style.transform = "scaleX(" + i.getAttribute("data-v") + ")"; });
    });

    var axes = D.AXES[state.tab], fl = $("#profileFlavour");
    var key = state.tab + state.lang;
    if (fl.getAttribute("data-key") !== key) {
      fl.setAttribute("data-key", key);
      fl.innerHTML = axes.map(function (a) {
        return '<li><span>' + esc(t("ax." + a)) + '</span><span class="seg" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><b></b></li>';
      }).join("");
    }
    $$("li", fl).forEach(function (li, i) {
      var v = it.profile[i];
      $$(".seg i", li).forEach(function (seg, n) { seg.classList.toggle("on", n < v); });
      li.querySelector("b").textContent = v;
      li.setAttribute("aria-label", t("ax." + axes[i]) + " " + v + "/5");
    });
  }
  function meterRow(label, v, max, cls) {
    return '<div class="meter ' + cls + '"><span class="meter__label">' + label + '</span><span class="meter__track"><i data-v="' + clamp(v / max, 0, 1).toFixed(3) + '" style="transform:scaleX(0)"></i></span><span class="meter__val">' + v + "%</span></div>";
  }
  $("#kaartTabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b || b.getAttribute("data-tab") === state.tab) return;
    state.tab = b.getAttribute("data-tab");
    state.item = D.MENU[state.tab][0].id;
    renderTabs(); renderMenu(true); renderProfile(false);
  });
  $("#kaartTabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var tabs = $$("#kaartTabs [role=tab]"), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); next.click();
  });
  $("#kaartList").addEventListener("click", function (e) {
    var b = e.target.closest(".item");
    if (!b) return;
    state.item = b.getAttribute("data-id");
    $$("#kaartList .item").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    renderProfile(false);
    if (window.innerWidth <= 960) scrollToTarget($("#profile"));
  });
  $("#kaartList").addEventListener("pointerover", function (e) {
    var b = e.target.closest(".item");
    if (!b) return;
    var items = D.MENU[state.tab];
    for (var i = 0; i < items.length; i++) if (items[i].id === b.getAttribute("data-id")) hoverShow(D.IMG + items[i].img);
  });
  $("#kaartList").addEventListener("pointerleave", hoverHide);
  window.addEventListener("resize", moveInk);

  /* ---------------- Rhythm chart ---------------- */
  function monotonePath(pts) {
    var n = pts.length; if (n < 2) return "";
    var dx = [], dy = [], m = [], tg = [];
    for (var i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    tg[0] = m[0]; tg[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { tg[i] = tg[i + 1] = 0; continue; }
      var a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
    }
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i] / 3;
      d += "C" + (pts[i][0] + h).toFixed(1) + "," + (pts[i][1] + h * tg[i]).toFixed(1) + " " +
        (pts[i + 1][0] - h).toFixed(1) + "," + (pts[i + 1][1] - h * tg[i + 1]).toFixed(1) + " " +
        pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
    }
    return d;
  }
  var chartGeo = null;
  function renderChart() {
    var host = $("#crowdChart");
    if (!host) return;
    var W = Math.max(300, Math.round(host.clientWidth || 600));
    var H = Math.round(clamp(W * 0.52, 250, 400));
    var narrow = W < 520;
    var m = { l: 30, r: 14, t: 40, b: 30 };
    var C = D.CROWD, yMax = 40;
    var x = function (h) { return m.l + (h - 8) / 16 * (W - m.l - m.r); };
    var y = function (v) { return m.t + (1 - v / yMax) * (H - m.t - m.b); };
    var s1 = C.hours.map(function (h, i) { return [x(h), y(C.koffie[i])]; });
    var s2 = C.hours.map(function (h, i) { return [x(h), y(C.lounge[i])]; });
    var base = y(0);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(t("ritme.s1") + " / " + t("ritme.s2")) + '">';
    svg += '<g class="grid axis">';
    [0, 10, 20, 30, 40].forEach(function (v) {
      svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      svg += '<text x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    });
    var step = narrow ? 4 : 2;
    for (var h = 8; h <= 24; h += step) svg += '<text x="' + x(h) + '" y="' + (H - 8) + '" text-anchor="middle">' + pad(h % 24) + ":00</text>";
    svg += "</g>";
    var p1 = monotonePath(s1), p2 = monotonePath(s2);
    svg += '<path class="area s1" d="' + p1 + "L" + x(24) + "," + base + "L" + x(8) + "," + base + 'Z"/>';
    svg += '<path class="area s2" d="' + p2 + "L" + x(24) + "," + base + "L" + x(8) + "," + base + 'Z"/>';
    svg += '<path class="line s1" id="lineS1" d="' + p1 + '"/>';
    svg += '<path class="line s2" id="lineS2" d="' + p2 + '"/>';
    // peaks (selective direct labels)
    [["koffie", "s1"], ["lounge", "s2"]].forEach(function (pair) {
      var arr = C[pair[0]], max = Math.max.apply(null, arr), i = arr.indexOf(max), px = x(C.hours[i]), py = y(max);
      var anchor = px > W - 90 ? "end" : px < 90 ? "start" : "middle";
      svg += '<g class="peak"><circle class="' + pair[1] + '" cx="' + px + '" cy="' + py + '" r="5"/>' +
        '<text x="' + px + '" y="' + (py - 22) + '" text-anchor="' + anchor + '">' + max + " " + esc(t("ritme.guests")) + "</text>" +
        '<text class="sub" x="' + px + '" y="' + (py - 9) + '" text-anchor="' + anchor + '">' + esc(t("ritme.peak")) + " " + pad(C.hours[i] % 24) + ":00</text></g>";
    });
    svg += '<g class="now" id="chartNow"></g>';
    svg += '<g class="cross" id="chartCross" style="display:none"><line y1="' + m.t + '" y2="' + base + '"/><circle class="s1" r="5"/><circle class="s2" r="5"/></g>';
    svg += '<rect id="chartHit" x="' + m.l + '" y="0" width="' + (W - m.l - m.r) + '" height="' + H + '" fill="transparent"/>';
    svg += "</svg>";
    host.innerHTML = svg;
    chartGeo = { x: x, y: y, m: m, W: W, H: H };
    renderChartNow();

    if (!state.chartDrawn && G && !reduce) {
      ["#lineS1", "#lineS2"].forEach(function (sel) {
        var p = $(sel, host), len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      });
    }
    // table view
    var rows = "<thead><tr><th>" + esc(t("ritme.hour")) + "</th><th>" + esc(t("ritme.s1")) + "</th><th>" + esc(t("ritme.s2")) + "</th></tr></thead><tbody>";
    C.hours.forEach(function (h, i) { rows += "<tr><td>" + pad(h % 24) + ":00</td><td>" + C.koffie[i] + "</td><td>" + C.lounge[i] + "</td></tr>"; });
    $("#chartTable").innerHTML = rows + "</tbody>";
    bindChartHover();
  }
  function drawChartLines() {
    if (state.chartDrawn) return;
    state.chartDrawn = true;
    if (!G || reduce) return;
    gsap.to(["#lineS1", "#lineS2"], { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", stagger: 0.25 });
    gsap.from("#crowdChart .area", { opacity: 0, duration: 1.6, delay: 0.6 });
    gsap.from("#crowdChart .peak", { opacity: 0, y: 10, duration: 0.8, delay: 1.8, stagger: 0.2 });
  }
  function renderChartNow() {
    var g = $("#chartNow");
    if (!g || !chartGeo) return;
    var now = ams(), hh = now.h + now.mi / 60;
    if (hh < 8 || hh > 24) { g.innerHTML = ""; return; }
    var px = chartGeo.x(hh), label = t("ritme.now") + " " + pad(now.h) + ":" + pad(now.mi);
    var w = label.length * 7 + 16, rx = clamp(px - w / 2, chartGeo.m.l, chartGeo.W - chartGeo.m.r - w);
    g.innerHTML = '<line x1="' + px + '" x2="' + px + '" y1="' + (chartGeo.m.t - 10) + '" y2="' + chartGeo.y(0) + '"/>' +
      '<rect x="' + rx + '" y="2" width="' + w + '" height="20" rx="10"/><text x="' + (rx + w / 2) + '" y="16" text-anchor="middle">' + esc(label) + "</text>";
  }
  function bindChartHover() {
    var hit = $("#chartHit"), cross = $("#chartCross"), tip = $("#chartTip"), host = $("#crowdChart");
    if (!hit) return;
    var C = D.CROWD;
    function move(e) {
      var svg = host.querySelector("svg"), r = svg.getBoundingClientRect();
      var sx = (e.clientX - r.left) * (chartGeo.W / r.width);
      var h = clamp(Math.round(8 + (sx - chartGeo.m.l) / (chartGeo.W - chartGeo.m.l - chartGeo.m.r) * 16), 8, 24), i = h - 8;
      var px = chartGeo.x(h);
      cross.style.display = "";
      cross.querySelector("line").setAttribute("x1", px); cross.querySelector("line").setAttribute("x2", px);
      var cs = cross.querySelectorAll("circle");
      cs[0].setAttribute("cx", px); cs[0].setAttribute("cy", chartGeo.y(C.koffie[i]));
      cs[1].setAttribute("cx", px); cs[1].setAttribute("cy", chartGeo.y(C.lounge[i]));
      tip.hidden = false;
      tip.innerHTML = "<b>" + pad(h % 24) + ":00</b>" +
        '<span><em><i class="sw sw--1"></i>' + esc(t("ritme.s1")) + "</em>" + C.koffie[i] + "</span>" +
        '<span><em><i class="sw sw--2"></i>' + esc(t("ritme.s2")) + "</em>" + C.lounge[i] + "</span>";
      var hostR = host.getBoundingClientRect(), cardR = host.parentElement.getBoundingClientRect();
      var left = (px / chartGeo.W) * r.width + (hostR.left - cardR.left);
      var tw = tip.offsetWidth;
      left = left + 16 + tw > cardR.width ? left - tw - 16 : left + 16;
      tip.style.left = clamp(left, 8, cardR.width - tw - 8) + "px";
      tip.style.top = (hostR.top - cardR.top + 30) + "px";
    }
    function leave() { cross.style.display = "none"; tip.hidden = true; }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
  }
  var resizeT = 0, lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      renderChart(); buildMarquees();
    }, 180);
  });

  /* ---------------- Agenda ---------------- */
  function renderAgenda() {
    var now = ams(), nowMin = now.h * 60 + now.mi;
    var base = Date.UTC(now.y, now.mo - 1, now.d);
    var list = D.EVENTS.map(function (ev) {
      var diff = (ev.dow - now.dow + 7) % 7;
      var evMin = +ev.time.slice(0, 2) * 60 + +ev.time.slice(3);
      if (diff === 0 && nowMin > evMin) diff = 7;
      return { ev: ev, date: new Date(base + diff * 864e5), diff: diff };
    }).sort(function (a, b) { return a.diff - b.diff || a.ev.time.localeCompare(b.ev.time); });
    var days = t("days"), months = t("months");
    $("#agendaList").innerHTML = list.map(function (o) {
      var d = o.date, dow = (d.getUTCDay() + 6) % 7;
      return '<li class="ev" data-img="' + D.IMG + o.ev.img + '">' +
        '<span class="ev__date">' + pad(d.getUTCDate()) + "<small><span>" + esc(days[dow]) + "</span><span>" + esc(months[d.getUTCMonth()]) + "</span></small></span>" +
        '<div><h3 class="ev__title">' + esc(t("ev." + o.ev.id + ".t")) + '</h3><p class="ev__desc">' + esc(t("ev." + o.ev.id + ".d")) + "</p></div>" +
        '<span class="ev__time">' + o.ev.time + "</span>" +
        '<span class="ev__price">' + esc(o.ev.price === "free" ? t("agenda.free") : o.ev.price) + "</span></li>";
    }).join("");
  }
  $("#agendaList").addEventListener("pointerover", function (e) { var li = e.target.closest(".ev"); if (li) hoverShow(li.getAttribute("data-img")); });
  $("#agendaList").addEventListener("pointerleave", hoverHide);

  /* ---------------- Visit: hours + map ---------------- */
  function renderHours() {
    var today = ams().dow, names = t("daysLong");
    $("#hoursTable").innerHTML = "<tbody>" + D.HOURS.map(function (h, i) {
      return '<tr class="' + (i === today ? "is-today" : "") + '"><td>' + esc(names[i]) + (i === today ? '<span class="tag">' + esc(t("bezoek.today")) + "</span>" : "") +
        "</td><td>" + hm(h.open) + " – " + hm(h.close) + "</td></tr>";
    }).join("") + "</tbody>";
  }
  function buildMap() {
    var cx = 300, cy = 70;
    var canals = [["Singel", 92, 84], ["Herengracht", 140, 130], ["Keizersgracht", 188, 176], ["Prinsengracht", 236, 222], ["Singelgracht", 296, 284]];
    var gC = $("#mapCanals"), gS = $("#mapStreets"), html = "";
    canals.forEach(function (c, i) {
      var d = "M" + (cx - c[1]) + " " + cy + " A" + c[1] + " " + c[2] + " 0 0 0 " + (cx + c[1]) + " " + cy;
      html += '<path class="map__canal" d="' + d + '"/><path class="map__canal-hi" id="canal' + i + '" d="' + d + '"/>' +
        '<text class="map__canal-label" dy="-9"><textPath href="#canal' + i + '" startOffset="' + (i % 2 ? 66 : 30) + '%">' + c[0] + "</textPath></text>";
    });
    gC.innerHTML = html;
    var sl = "";
    [100, 118, 136, 154, 172, 8, 26, 44, 62, 80].forEach(function (deg) {
      var a = deg * Math.PI / 180;
      sl += '<line x1="' + (cx + 70 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + 64 * Math.sin(a)).toFixed(1) + '" x2="' + (cx + 330 * Math.cos(a)).toFixed(1) + '" y2="' + (cy + 318 * Math.sin(a)).toFixed(1) + '"/>';
    });
    gS.innerHTML = sl;
    var th = 151 * Math.PI / 180;
    $("#mapPin").setAttribute("transform", "translate(" + (cx + 236 * Math.cos(th)).toFixed(1) + " " + (cy + 222 * Math.sin(th)).toFixed(1) + ")");
  }

  /* ---------------- Film ---------------- */
  var film = $("#filmVideo"), frame = $("#filmFrame"), userPaused = false;
  function updateFilmButton() {
    var playing = !film.paused;
    frame.classList.toggle("is-playing", playing);
    var btn = $("#filmPlay");
    btn.querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
    btn.querySelector("span").textContent = t(playing ? "film.pause" : "film.play");
  }
  function playFilm() { var p = film.play(); if (p && p.catch) p.catch(function () {}); }
  frame.addEventListener("click", function () {
    if (film.paused) { userPaused = false; playFilm(); } else { userPaused = true; film.pause(); }
  });
  function syncFilmCursor() { if (cursor.classList.contains("is-label") && frame.matches(":hover")) cLabel.textContent = t(film.paused ? "film.play" : "film.pause"); }
  film.addEventListener("play", function () { updateFilmButton(); syncFilmCursor(); });
  film.addEventListener("pause", function () { updateFilmButton(); syncFilmCursor(); });
  function filmTick() {
    var tc = film.currentTime || 0, fr = Math.floor((tc % 1) * 25);
    $("#filmTC").textContent = pad(Math.floor(tc / 60)) + ":" + pad(Math.floor(tc % 60)) + ":" + pad(fr);
    $("#filmBar").style.transform = "scaleX(" + (film.duration ? tc / film.duration : 0) + ")";
  }
  if (G) gsap.ticker.add(function () { if (!film.paused) filmTick(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && e.intersectionRatio > 0.35) { if (!userPaused && !reduce) playFilm(); }
      else if (!film.paused) film.pause();
    }, { threshold: [0, 0.35, 0.6] }).observe(frame);
  }

  /* ---------------- Newsletter ---------------- */
  $("#newsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#newsEmail"), msg = $("#newsMsg");
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    msg.classList.toggle("is-err", !ok);
    msg.textContent = t(ok ? "footer.ok" : "footer.err");
    if (ok) input.value = "";
  });

  /* ---------------- Toast ---------------- */
  var toastT = 0;
  function showModeToast() {
    if (!state.modeAuto || store.get("nt-toast", true)) return;
    store.set("nt-toast", "1", true);
    var now = ams(), toast = $("#toast");
    $("#toastText").textContent = t("toast.mode", { time: pad(now.h) + ":" + pad(now.mi), mode: t("mode." + state.mode) });
    $("#toastBtn").textContent = t("toast.try");
    toast.hidden = false;
    if (G) gsap.fromTo(toast, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "expo.out" });
    toastT = setTimeout(hideToast, 9000);
  }
  function hideToast() {
    var toast = $("#toast");
    clearTimeout(toastT);
    if (toast.hidden) return;
    if (G) gsap.to(toast, { y: 20, opacity: 0, duration: 0.4, onComplete: function () { toast.hidden = true; } });
    else toast.hidden = true;
  }
  $("#toastBtn").addEventListener("click", function () { setMode(state.mode === "dag" ? "nacht" : "dag", $("#modeToggle")); hideToast(); });

  /* ---------------- Scroll scenes ---------------- */
  function scenes() {
    if (!G || reduce) {
      $("#gallery").classList.add("is-native");
      return;
    }
    // hero parallax
    gsap.to(".hero__video", { yPercent: 14, scale: 1.16, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__content", { yPercent: -14, opacity: 0.15, ease: "none", scrollTrigger: { trigger: ".hero", start: "40% top", end: "bottom top", scrub: true } });

    // manifesto word lighting
    ScrollTrigger.create({
      trigger: "#manifesto", start: "top 82%", end: "bottom 40%",
      onUpdate: function (self) {
        var k = Math.round(self.progress * manifestoWords.length);
        manifestoWords.forEach(function (w, i) { w.classList.toggle("is-on", i < k); });
      }
    });
    $$(".stack__item").forEach(function (fig) {
      var depth = +fig.getAttribute("data-depth");
      gsap.fromTo(fig, { yPercent: depth * 40 }, { yPercent: -depth * 40, ease: "none", scrollTrigger: { trigger: ".concept", start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(fig, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: fig, start: "top 90%", once: true } });
    });
    $$("[data-count]").forEach(function (el) {
      var to = +el.getAttribute("data-count"), from = to === 0 ? 40 : 0, o = { v: from };
      el.textContent = from;
      ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: function () {
        gsap.to(o, { v: to, duration: 1.8, ease: "power3.out", onUpdate: function () { el.textContent = Math.round(o.v); } });
      } });
    });

    // dag/nacht panels
    gsap.from(".dn-panel", { clipPath: "inset(100% 0 0 0)", duration: 1.4, ease: "expo.inOut", stagger: 0.15, scrollTrigger: { trigger: ".dn__panels", start: "top 80%", once: true } });

    // film: frame grows to full screen while pinned
    var ftl = gsap.timeline({
      scrollTrigger: { trigger: ".film__pin", start: "top top", end: "+=140%", pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true }
    });
    ftl.to(".film__head", { yPercent: -40, opacity: 0, ease: "none", duration: 0.45 }, 0)
      .to(frame, {
        width: function () { return window.innerWidth; },
        height: function () { return window.innerWidth < window.innerHeight ? Math.min(window.innerHeight, window.innerWidth * 9 / 16 * 1.35) : window.innerHeight; },
        top: "50%", borderRadius: 0, ease: "none", duration: 1
      }, 0)
      .to({}, { duration: 0.35 });

    // horizontal gallery
    var track = $("#galleryTrack");
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var hTween = gsap.to(track, {
      x: function () { return -dist(); }, ease: "none",
      scrollTrigger: {
        trigger: ".gallery__pin", start: "top top", end: function () { return "+=" + dist(); }, pin: true, scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: function (self) { $("#galleryBar").style.transform = "scaleX(" + self.progress + ")"; }
      }
    });
    gsap.to(".gallery__bgtext", { xPercent: -28, ease: "none", scrollTrigger: { trigger: ".gallery__pin", start: "top top", end: function () { return "+=" + dist(); }, scrub: true, invalidateOnRefresh: true } });
    $$(".g-item__img img").forEach(function (img) {
      gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: "none", scrollTrigger: { trigger: img.parentElement, containerAnimation: hTween, start: "left right", end: "right left", scrub: true } });
    });

    // chart draw
    ScrollTrigger.create({ trigger: "#crowdChart", start: "top 75%", once: true, onEnter: drawChartLines });

    // map draw
    ScrollTrigger.create({ trigger: "#map", start: "top 80%", once: true, onEnter: function () {
      $$("#mapCanals path, .map__amstel").forEach(function (p) {
        var len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      });
      gsap.to("#mapCanals path, .map__amstel", { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", stagger: 0.08 });
      gsap.from("#mapPin", { scale: 0, transformOrigin: "50% 50%", duration: 1, ease: "back.out(2)", delay: 1.2 });
    } });

    // generic reveals
    $$(".h2, .lead, .eyebrow, .fact, .rule, .chart-card, .kaart__note, .bezoek__address, .bezoek__line, .hours, .news, .footer__meta, .tabs, .kaart__grid")
      .filter(function (el) { return !el.closest(".film__pin, .gallery__pin, .gate, .hero"); })
      .forEach(function (el) {
        gsap.from(el, { y: 44, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
    gsap.from(".ev", { x: -30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: "#agendaList", start: "top 85%", once: true } });
    gsap.from(".footer__giant > *", { yPercent: 60, opacity: 0, duration: 1.4, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".footer__giant", start: "top 95%", once: true } });

    // active nav link
    ["concept", "kaart", "film", "regels", "bezoek"].forEach(function (id) {
      var link = $('.nav__links a[href="#' + id + '"]');
      ScrollTrigger.create({ trigger: "#" + id, start: "top 50%", end: "bottom 50%", onToggle: function (self) { link.classList.toggle("is-active", self.isActive); } });
    });
  }

  /* ---------------- Loader → gate → intro ---------------- */
  function whenVideoReady(v) {
    return new Promise(function (res) {
      if (v.readyState >= 3 || v.error || v.networkState === 3) return res();
      v.addEventListener("canplay", res, { once: true });
      v.addEventListener("error", res, { once: true });
      $$("source", v).forEach(function (s) { s.addEventListener("error", function () { if (v.networkState === 3) res(); }); });
    });
  }
  function runLoader(done) {
    var loader = $("#loader"), num = $("#loaderNum"), bar = $("#loaderBar");
    if (!G) { loader.style.display = "none"; return done(); }
    var tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), whenVideoReady($("#heroVideo"))];
    var finished = 0, start = performance.now(), progress = 0;
    tasks.forEach(function (p) { p.then(function () { finished++; }); });
    (function tick(now) {
      var elapsed = now - start, all = finished === tasks.length || elapsed > 3800;
      var goal = all && elapsed > 900 ? 100 : Math.min(88, elapsed / 1300 * 88);
      progress += (goal - progress) * 0.1;
      if (goal === 100 && progress > 99.4) progress = 100;
      num.textContent = pad(Math.round(progress), 3);
      bar.style.transform = "scaleX(" + progress / 100 + ")";
      if (progress >= 100) {
        gsap.to(loader, { yPercent: -100, duration: 1.1, ease: "expo.inOut", delay: 0.15, onComplete: function () { loader.style.display = "none"; } });
        setTimeout(done, 450);
        return;
      }
      requestAnimationFrame(tick);
    })(start);
  }
  var gate = $("#gate");
  function trapFocus(e) {
    if (e.key !== "Tab" || gate.hidden) return;
    var f = $$("button:not([hidden])", gate).filter(function (b) { return b.offsetParent !== null; });
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function showGate() {
    gate.hidden = false;
    lockScroll(true);
    document.addEventListener("keydown", trapFocus);
    if (G && !reduce) gsap.from(".gate__inner > *:not(.gate__tulip)", { y: 34, opacity: 0, stagger: 0.08, duration: 1.1, ease: "expo.out", delay: 0.2 });
    setTimeout(function () { $("#gateYes").focus({ preventScroll: true }); }, 60);
  }
  $("#gateYes").addEventListener("click", function () {
    store.set("nt-age", "1", true);
    document.removeEventListener("keydown", trapFocus);
    if (G && !reduce) {
      gsap.to(gate, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut", onComplete: function () { gate.hidden = true; gate.style.clipPath = ""; } });
    } else gate.hidden = true;
    lockScroll(false);
    intro(0.35);
  });
  $("#gateNo").addEventListener("click", function () {
    var msg = $("#gateNoMsg");
    msg.hidden = false;
    if (G) gsap.from(msg, { y: 12, opacity: 0, duration: 0.6, ease: "expo.out" });
  });
  function intro(delay) {
    delay = delay || 0;
    if (G && !reduce) {
      var tl = gsap.timeline({ delay: delay });
      tl.from(".hero__video", { scale: 1.3, duration: 2.4, ease: "expo.out" }, 0)
        .from("#heroNeon .ch", { yPercent: 70, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.08 }, 0.15)
        .from(".hero__tulp", { opacity: 0, x: 60, duration: 1.6, ease: "expo.out" }, 0.45)
        .from(".hero__copy > *", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.1 }, 0.7)
        .from(".badge, .hero__meta, .hero__scroll", { opacity: 0, duration: 1.2 }, 0.9)
        .fromTo(".nav", { yPercent: -100 }, { yPercent: 0, duration: 1, ease: "expo.out", clearProps: "transform" }, 0.5);
    }
    setTimeout(showModeToast, (delay + 2.6) * 1000);
  }

  /* ---------------- Boot ---------------- */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  buildMap();
  applyLang(state.lang);
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(renderAgenda, 60000);
  scenes();
  lockScroll(true);
  runLoader(function () {
    if (store.get("nt-age", true) === "1") { lockScroll(false); intro(0); }
    else showGate();
  });
  window.addEventListener("load", function () {
    $$(".gallery img, .stack img").forEach(function (img) { img.loading = "eager"; });
    if (G) ScrollTrigger.refresh();
  });
  if (document.fonts && G) document.fonts.ready.then(function () { moveInk(); buildMarquees(); ScrollTrigger.refresh(); });
})();
