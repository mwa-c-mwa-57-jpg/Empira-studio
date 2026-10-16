import { getProduct, fullName, SELECTIONS, selectionTotal } from "../catalog.js";
import { $, $$, esc, price, icons, finePointer, reducedMotion, lerp } from "../utils.js";
import { cardHTML, stagger } from "../products-ui.js";
import { heroGL } from "../hero-gl.js";
import { liveDemo, heroOverlay } from "../live-demo.js";
import { configurator } from "../configurator.js";
import { journey } from "../journey.js";

const FEATURED = ["maono-pd200xs", "maono-g1-neo", "rode-podmic", "tonor-micro-usb-xlr"];

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

function selectionsHTML() {
  return SELECTIONS.map((sel, i) => {
    const featured = i === 1;
    const items = sel.items.map(getProduct);
    return `<article class="plan${featured ? " featured" : ""}" ${featured ? 'data-flag="Le plus complet"' : ""} data-reveal>
      <div class="plan-head">
        <span class="mono muted">${esc(sel.kind)}</span>
        <h3 class="h-md">${esc(sel.name)}</h3>
        <p>${esc(sel.short)}</p>
      </div>
      <div class="plan-visual">${items
        .map((it) => `<img src="${esc(it.image)}" alt="${esc(fullName(it))}" title="${esc(fullName(it))}" loading="lazy" width="160" height="160">`)
        .join("")}</div>
      <p class="plan-price">${price(selectionTotal(sel))} <small>${items.length > 1 ? `${items.length} articles` : "1 article"}</small></p>
      <ul>
        ${items.map((it) => `<li><span><a href="produit.html?id=${esc(it.id)}">${esc(fullName(it))}</a> <span class="muted">· ${price(it.price)}</span></span></li>`).join("")}
      </ul>
      <button class="btn ${featured ? "btn-primary" : "btn-ghost"} btn-block" type="button" data-add-selection="${esc(sel.id)}">${icons.bag} Ajouter la sélection</button>
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
    packs.innerHTML = selectionsHTML();
    import("../ui.js").then(({ reveal }) => reveal(packs));
    packs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add-selection]");
      if (!b) return;
      const sel = SELECTIONS.find((x) => x.id === b.dataset.addSelection);
      import("../cart.js").then(({ addToCart, openCart }) => {
        sel.items.forEach((id) => addToCart(id, 1, { silent: true }));
        openCart();
      });
    });
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
