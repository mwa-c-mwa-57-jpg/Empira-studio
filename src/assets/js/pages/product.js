import { getProduct, LISTED, CATEGORIES, variantsOf, fullName } from "../catalog.js";
import { $, esc, price, icons, finePointer, reducedMotion } from "../utils.js";
import { cardHTML, stagger, savings, visualHTML, badgeFor } from "../products-ui.js";
import { addToCart, openCart } from "../cart.js";


function jsonLd(p) {
  const site = document.querySelector('link[rel="canonical"]').href.replace(/\/[^/]*$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${fullName(p)} — ${p.kind}`,
    description: p.description,
    image: `${site}/${p.image}`,
    brand: { "@type": "Brand", name: p.brand || "Empira Studio" },
    sku: p.id,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: p.price.toFixed(2),
      availability: "https://schema.org/InStock",
      url: `${site}/produit.html?id=${p.id}`,
    },
  };
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify(data);
  document.head.append(s);
}

function stageTilt(stage) {
  if (!finePointer() || reducedMotion()) return;
  const img = stage.querySelector("img, .pack-stack");
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    img.style.transform = `rotateY(${px * 18}deg) rotateX(${-py * 18}deg) scale(1.04)`;
  });
  stage.addEventListener("pointerleave", () => (img.style.transform = ""));
}

function variantPicker(p) {
  const vs = variantsOf(p);
  if (vs.length < 2) return "";
  const label = p.group === "cable-xlr" ? "Longueur" : "Coloris";
  return `<fieldset class="variant-picker field radio-pills">
    <legend>${label} : <strong data-variant-label>${esc(p.variant)}</strong></legend>
    ${vs
      .map(
        (v) => `<label><input type="radio" name="variant" value="${esc(v.id)}" ${v.id === p.id ? "checked" : ""}><span>${esc(v.variant)}${
          v.price !== p.price ? ` · ${price(v.price)}` : ""
        }</span></label>`,
      )
      .join("")}
  </fieldset>`;
}

function productHTML(p) {
  const s = savings(p);
  const badge = badgeFor(p);
  return `<div class="product">
    <div class="product-stage" data-spotlight data-reveal="scale">${visualHTML(p)}</div>
    <div class="product-info">
      <div>${badge ? `<span class="badge">${esc(badge)}</span>` : ""}</div>
      <div>
        <p class="eyebrow">${esc(p.brand ? `${p.brand} · ${p.kind}` : p.kind)}</p>
        <h1 class="h-lg">${esc(p.name)}</h1>
      </div>
      <p class="lead">${esc(p.short)}</p>
      <div>
        <p class="price"><span data-unit-price>${price(p.price)}</span>${s ? `<s>${price(s.value)}</s>` : ""}</p>
        <p class="muted">TTC · ${p.type === "service" ? "session planifiée sous 72 h" : "expédié sous 24 h ouvrées"}</p>
      </div>
      ${s ? `<p><span class="save-pill">Tu économises ${price(s.saved)} par rapport aux produits à l'unité</span></p>` : ""}
      ${variantPicker(p)}
      <div class="product-buy">
        <div class="qty lg" role="group" aria-label="Quantité">
          <button type="button" data-step="-1" aria-label="Diminuer">−</button>
          <output data-qty-out>1</output>
          <button type="button" data-step="1" aria-label="Augmenter">+</button>
        </div>
        <button class="btn btn-primary" type="button" data-buy data-magnetic>${icons.bag} Ajouter au panier · <span data-buy-total>${price(p.price)}</span></button>
      </div>
      <ul class="reassure">
        <li>${icons.truck}<strong>Livraison 48-72 h</strong>Offerte dès 149 €</li>
        <li>${icons.return}<strong>30 jours</strong>pour changer d'avis</li>
        <li>${icons.shield}<strong>Garantie 2 ans</strong>SAV en France</li>
      </ul>
      ${
        p.type === "pack"
          ? `<div class="includes"><h2 class="h-sm">Dans le pack</h2>${p.includes
              .map((pid) => {
                const it = getProduct(pid);
                return `<a href="produit.html?id=${esc(it.id)}"><img src="${esc(it.image)}" alt=""><div><strong>${esc(fullName(it))}</strong><br><span>${esc(it.kind)}</span></div><span>${price(it.price)}</span></a>`;
              })
              .join("")}</div>`
          : ""
      }
      <div>
        <h2 class="h-sm">En détail</h2>
        <p class="muted">${esc(p.description)}</p>
      </div>
      <ul class="specs">${p.specs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <a class="agency-card" href="agency.html#rdv">
        <svg viewBox="0 0 100 100" aria-hidden="true"><use href="#empira-mark" fill="url(#gold-grad)"/></svg>
        <span><strong>On l'installe avec toi</strong>Réglages, scènes OBS, son : Empira Agency t'accompagne. Appel découverte gratuit.</span>
      </a>
      <p class="muted">Une question avant d'acheter ? <a class="link-arrow" href="contact.html?sujet=conseil&produit=${esc(p.id)}">Demande conseil à l'équipe</a></p>
    </div>
  </div>`;
}

function setMeta(p) {
  const cat = CATEGORIES.find((c) => c.id === p.category);
  document.title = `${fullName(p)} — ${p.kind} | Empira Studio`;
  document.querySelector('meta[name="description"]').setAttribute("content", `${fullName(p)} : ${p.short}`);
  $("[data-crumb-cat]").innerHTML = `<a href="boutique.html?cat=${esc(cat.id)}">${esc(cat.label)}</a>`;
  $("[data-crumb-name]").textContent = p.name;
}

export function init() {
  let p = getProduct(new URLSearchParams(location.search).get("id"));
  const root = $("[data-product]");
  if (!p) {
    root.innerHTML = `<div class="shop-empty"><h1 class="h-md">Produit introuvable</h1><p>Ce produit n'existe pas ou n'est plus disponible.</p><a class="btn btn-primary" href="boutique.html">Retour à la boutique</a></div>`;
    return;
  }
  if (p.type === "service") document.body.classList.add("theme-gold");

  let qty = 1;
  const refresh = () => {
    $("[data-qty-out]", root).textContent = qty;
    $("[data-buy-total]", root).textContent = price(p.price * qty);
  };
  const render = () => {
    setMeta(p);
    root.innerHTML = productHTML(p);
    refresh();
    stageTilt($(".product-stage", root));
    import("../ui.js").then(({ reveal }) => reveal(root));
  };

  root.addEventListener("click", (e) => {
    const st = e.target.closest("[data-step]");
    if (st) {
      qty = Math.max(1, Math.min(10, qty + Number(st.dataset.step)));
      refresh();
    }
    if (e.target.closest("[data-buy]")) {
      addToCart(p.id, qty, { silent: true });
      openCart();
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.name === "variant") {
      const next = getProduct(e.target.value);
      if (!next) return;
      p = next;
      render();
      $(`input[name="variant"][value="${CSS.escape(p.id)}"]`, root)?.focus();
      const url = new URL(location.href);
      url.searchParams.set("id", p.id);
      history.replaceState(null, "", url);
    }
  });

  render();
  jsonLd(p);

  const group = (x) => x.group || x.id;
  const related = LISTED.filter((x) => group(x) !== group(p) && (x.category === p.category || (p.includes || []).includes(x.id)))
    .concat(LISTED.filter((x) => x.type === "pack" && x.id !== p.id && variantsOf(p).some((v) => x.includes.includes(v.id))))
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .slice(0, 4);
  const fill = related.length < 4 ? LISTED.filter((x) => group(x) !== group(p) && !related.includes(x)).slice(0, 4 - related.length) : [];
  const rel = $("[data-related]");
  rel.innerHTML = [...related, ...fill].map((x, i) => cardHTML(x, i)).join("");
  stagger(rel);
}
