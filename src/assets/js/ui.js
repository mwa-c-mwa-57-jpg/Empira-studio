// Interactions communes à toutes les pages : en-tête, menu mobile, apparitions
// au scroll, curseur, boutons magnétiques, effets de lumière, modale, toasts.
import { $, $$, clamp, lerp, reducedMotion, finePointer, onVisible, esc } from "./utils.js";

function header() {
  const el = $("[data-header]");
  const bar = $("[data-scroll-progress]");
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    el?.classList.toggle("is-scrolled", y > 24);
    const menuOpen = !$("[data-mobile-menu]")?.hidden;
    el?.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 4);
    if (y < lastY - 4 || y < 400) el?.classList.remove("is-hidden");
    lastY = y;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

function mobileMenu() {
  const btn = $("[data-menu-toggle]");
  const menu = $("[data-mobile-menu]");
  if (!btn || !menu) return;
  const set = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  };
  btn.addEventListener("click", () => set(menu.hidden));
  menu.addEventListener("click", (e) => e.target.closest("a") && set(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && !menu.hidden && set(false));
  window.matchMedia("(min-width: 1021px)").addEventListener("change", (e) => e.matches && set(false));
}

export function reveal(root = document) {
  const items = $$("[data-reveal]:not(.is-in)", root);
  if (!items.length) return;
  if (!("IntersectionObserver" in window) || reducedMotion()) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  // Décalage en cascade pour les éléments frères d'un même groupe.
  $$("[data-stagger]", root).forEach((group) => {
    $$(":scope > [data-reveal]", group).forEach((el, i) => el.style.setProperty("--i", i));
  });
  items.forEach((el) => io.observe(el));
}

function cursor() {
  if (!finePointer() || reducedMotion()) return;
  const wrap = $(".cursor");
  if (!wrap) return;
  document.documentElement.classList.add("has-cursor");
  const dot = $(".cursor-dot", wrap);
  const ring = $(".cursor-ring", wrap);
  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  window.addEventListener(
    "pointermove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target;
      wrap.classList.toggle("is-hover", !!t.closest?.("a, button, [data-cursor], input, select, textarea, label, summary"));
      wrap.classList.remove("is-hidden");
    },
    { passive: true },
  );
  document.addEventListener("pointerdown", () => wrap.classList.add("is-down"));
  document.addEventListener("pointerup", () => wrap.classList.remove("is-down"));
  document.documentElement.addEventListener("pointerleave", () => wrap.classList.add("is-hidden"));
  const loop = () => {
    rx = lerp(rx, x, 0.18);
    ry = lerp(ry, y, 0.18);
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

function magnetic() {
  if (!finePointer() || reducedMotion()) return;
  document.addEventListener("pointermove", (e) => {
    for (const el of $$("[data-magnetic]")) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 40;
      el.style.transform = near ? `translate(${dx * 0.22}px, ${dy * 0.3}px)` : "";
    }
  });
}

function spotlight() {
  document.addEventListener(
    "pointermove",
    (e) => {
      const el = e.target.closest?.("[data-spotlight]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

export function tilt(root = document) {
  if (!finePointer() || reducedMotion()) return;
  $$("[data-tilt]", root).forEach((el) => {
    const max = Number(el.dataset.tilt) || 6;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}

function counters() {
  $$("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    if (reducedMotion()) return;
    el.textContent = "0";
    const io = onVisible(el, (visible) => {
      if (!visible) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
}

// Les vidéos ne tournent que lorsqu'elles sont visibles (économie de batterie)
// et jamais si l'utilisateur a demandé à réduire les animations.
export function videos(root = document) {
  $$("video[data-autoplay]", root).forEach((v) => {
    v.muted = true;
    v.playsInline = true;
    if (reducedMotion()) return;
    onVisible(
      v,
      (visible) => {
        if (visible && !v.dataset.paused) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.05 },
    );
  });
}

/* ---------- Modale ---------- */
const modal = () => $("[data-modal]");

function lightDismiss(dialog, close) {
  dialog.addEventListener("click", (e) => {
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside && e.clientX !== 0) close();
  });
}

// Les toasts ne sont pas dans la « top layer » : on les retire quand une fenêtre s'ouvre.
export const clearToasts = () => $$(".toast").forEach((t) => t.remove());

export function openModal(html, { size = "" } = {}) {
  const dlg = modal();
  if (!dlg) return;
  clearToasts();
  $("[data-modal-body]", dlg).innerHTML = html;
  dlg.className = `modal ${size}`.trim();
  if (!dlg.open) dlg.showModal();
  reveal(dlg);
  return dlg;
}
export function closeModal() {
  modal()?.close();
}

/* ---------- Toasts ---------- */
export function toast(message, { image, action, onAction, timeout = 3200 } = {}) {
  const box = $("[data-toasts]");
  if (!box) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `${image ? `<img src="${esc(image)}" alt="">` : ""}<span>${esc(message)}</span>${
    action ? `<button type="button">${esc(action)}</button>` : ""
  }`;
  if (action) $("button", t).addEventListener("click", () => onAction?.());
  box.append(t);
  setTimeout(() => {
    t.classList.add("out");
    t.addEventListener("animationend", () => t.remove(), { once: true });
  }, timeout);
}

export function initUI() {
  header();
  mobileMenu();
  reveal();
  cursor();
  magnetic();
  spotlight();
  tilt();
  counters();
  videos();
  const dlg = modal();
  if (dlg) {
    lightDismiss(dlg, closeModal);
    dlg.addEventListener("click", (e) => e.target.closest("[data-modal-close]") && closeModal());
  }
}

export { lightDismiss };
