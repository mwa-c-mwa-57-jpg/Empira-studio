import { getProduct, fullName } from "../catalog.js";
import { $, $$, esc, price, icons, finePointer, reducedMotion, lerp } from "../utils.js";
import { cardHTML, stagger, savings } from "../products-ui.js";
import { heroGL } from "../hero-gl.js";
import { liveDemo, heroOverlay } from "../live-demo.js";
import { configurator } from "../configurator.js";
import { journey } from "../journey.js";

const FEATURED = ["maono-pd200xs-noir", "maono-g1-neo", "rode-podmic", "tonor-bras-profil-bas"];
const PACKS = ["pack-starter", "pack-maono-streaming", "pack-podcast-rode"];

function heroParallax(stage) {
  if (!stage || !finePointer() || reducedMotion()) return;
  const floats = $$("[data-depth]", stage);
  const monitor = $(".monitor", stage);
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    },
    { passive: true },
  );
  const loop = () => {
    x = lerp(x, tx, 0.06);
    y = lerp(y, ty, 0.06);
    floats.forEach((f) => {
      const d = Number(f.dataset.depth);
      f.style.transform = `translate3d(${x * d * -60}px, ${y * d * -60}px, 0)`;
    });
    if (monitor) monitor.style.transform = `rotateY(${-14 + x * 10}deg) rotateX(${6 - y * 8}deg)`;
    requestAnimationFrame(loop);
  };
  loop();
}

function packsHTML() {
  return PACKS.map((id, i) => {
    const p = getProduct(id);
    const s = savings(p);
    const featured = i === 1;
    return `<article class="plan${featured ? " featured" : ""}" ${featured ? 'data-flag="Recommandé"' : ""} data-reveal>
      <div class="plan-head">
        <span class="mono muted">${esc(p.kind)}</span>
        <h3 class="h-md">${esc(p.name)}</h3>
        <p>${esc(p.short)}</p>
      </div>
      <div class="plan-thumbs">${p.includes
        .map((pid) => `<img src="${esc(getProduct(pid).image)}" alt="${esc(fullName(getProduct(pid)))}" title="${esc(fullName(getProduct(pid)))}" loading="lazy" width="54" height="54">`)
        .join("")}</div>
      <div>
        <p class="plan-price">${price(p.price)} <s>${price(s.value)}</s></p>
        <p><span class="save-pill">Tu économises ${price(s.saved)}</span></p>
      </div>
      <ul>
        ${p.includes.map((pid) => `<li><span>${esc(fullName(getProduct(pid)))} <span class="muted">· ${esc(getProduct(pid).kind)}</span></span></li>`).join("")}
        ${p.specs.slice(1).map((x) => `<li><span><strong>${esc(x)}</strong></span></li>`).join("")}
      </ul>
      <button class="btn ${featured ? "btn-primary" : "btn-ghost"} btn-block" type="button" data-add="${esc(p.id)}" data-open-cart>${icons.bag} Ajouter le pack</button>
      <a class="link-arrow" href="produit.html?id=${esc(p.id)}">Voir le détail</a>
    </article>`;
  }).join("");
}

export function init() {
  const canvas = $("[data-hero-gl]");
  if (canvas && !heroGL(canvas)) canvas.replaceWith(Object.assign(document.createElement("div"), { className: "hero-fallback" }));
  heroParallax($("[data-hero-stage]"));
  heroOverlay($("[data-hero-stage]"));

  const featured = $("[data-featured]");
  if (featured) {
    featured.innerHTML = FEATURED.map((id, i) => cardHTML(getProduct(id), i)).join("");
    stagger(featured);
  }
  const packs = $("[data-packs]");
  if (packs) {
    packs.innerHTML = packsHTML();
    import("../ui.js").then(({ reveal }) => reveal(packs));
  }

  liveDemo($("[data-live-demo]"));
  configurator($("[data-quiz]"));
  journey($("[data-journey]"));

  // Les cartes « univers » révèlent leur vidéo au survol.
  $$(".world").forEach((w) => {
    const v = $("video", w);
    if (!v || reducedMotion()) return;
    w.addEventListener("pointerenter", () => v.play().catch(() => {}));
    w.addEventListener("pointerleave", () => v.pause());
  });
}

export { esc };
