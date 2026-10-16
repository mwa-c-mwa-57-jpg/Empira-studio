// Gabarits HTML des produits (cartes, aperçu rapide), réutilisés sur toutes les pages.
import { getProduct, packValue } from "./catalog.js";
import { esc, price, icons } from "./utils.js";
import { openModal } from "./ui.js";

export function savings(p) {
  if (p.type !== "pack") return null;
  const value = packValue(p);
  return { value, saved: value - p.price, pct: Math.round(((value - p.price) / value) * 100) };
}

export function badgeFor(p) {
  const s = savings(p);
  if (s) return `-${s.pct} %`;
  if (p.type === "service") return "Agency";
  return p.badge || "";
}

export function visualHTML(p) {
  if (p.type === "pack") {
    const imgs = p.includes
      .slice(0, 3)
      .map((id) => `<img src="${esc(getProduct(id).image)}" alt="" loading="lazy" width="200" height="200">`)
      .join("");
    return `<div class="pack-stack">${imgs}</div>`;
  }
  return `<img src="${esc(p.image)}" alt="${esc(p.name)} — ${esc(p.kind)}" loading="lazy" width="300" height="300">`;
}

export function cardHTML(p, i = 0) {
  const s = savings(p);
  const badge = badgeFor(p);
  return `<article class="p-card enter" data-spotlight data-i="${i}">
    <div class="p-media">
      ${badge ? `<div class="p-badges"><span class="badge">${esc(badge)}</span></div>` : ""}
      ${visualHTML(p)}
      <button class="btn btn-ghost btn-sm p-quick" type="button" data-quick="${esc(p.id)}">Aperçu rapide</button>
    </div>
    <div class="p-body">
      <p class="p-kind">${esc(p.kind)}</p>
      <h3 class="p-name"><a href="produit.html?id=${esc(p.id)}">${esc(p.name)}</a></h3>
      <p class="p-short">${esc(p.short)}</p>
    </div>
    <div class="p-foot">
      <p class="price">${price(p.price)}${s ? `<s>${price(s.value)}</s>` : ""}</p>
      <button class="add-btn" type="button" data-add="${esc(p.id)}" aria-label="Ajouter ${esc(p.name)} au panier">${icons.plus}</button>
    </div>
  </article>`;
}

// Applique le décalage d'apparition des cartes (sans attribut style, compatible CSP).
export function stagger(container) {
  container.querySelectorAll(".p-card[data-i]").forEach((el) => el.style.setProperty("--i", el.dataset.i));
}

export function quickView(id) {
  const p = getProduct(id);
  if (!p) return;
  const s = savings(p);
  openModal(`<div class="qv">
    <div class="qv-media">${visualHTML(p)}</div>
    <div class="qv-info">
      <span class="badge">${esc(p.kind)}</span>
      <h2 class="h-md">${esc(p.name)}</h2>
      <p class="price">${price(p.price)}${s ? `<s>${price(s.value)}</s>` : ""}</p>
      ${s ? `<p><span class="save-pill">Tu économises ${price(s.saved)}</span></p>` : ""}
      <p class="muted">${esc(p.description)}</p>
      <ul class="specs">${p.specs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-add="${esc(p.id)}" data-open-cart>${icons.bag} Ajouter au panier</button>
        <a class="btn btn-ghost" href="produit.html?id=${esc(p.id)}">Voir la fiche ${icons.arrow}</a>
      </div>
    </div>
  </div>`);
}

export function initQuickView() {
  document.addEventListener("click", (e) => {
    const q = e.target.closest("[data-quick]");
    if (q) quickView(q.dataset.quick);
  });
}
