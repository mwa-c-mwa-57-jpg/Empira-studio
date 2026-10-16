// Panier : stocké dans le navigateur (localStorage, aucun cookie), affiché dans
// un tiroir latéral, et envoyé à /api/checkout pour le paiement Stripe.
import { PRODUCTS, getProduct, SHIPPING, MAX_QTY } from "./catalog.js";
import { $, $$, esc, price, icons } from "./utils.js";
import { lightDismiss, openModal, closeModal, toast, clearToasts } from "./ui.js";

const KEY = "empira-cart-v1";
const UPSELL_ID = "setup-remote";

let items = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw)
      ? raw
          .filter((l) => getProduct(l?.id) && Number.isInteger(l.qty) && l.qty > 0)
          .map((l) => ({ id: l.id, qty: Math.min(MAX_QTY, l.qty) }))
      : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* navigation privée : le panier vit le temps de la page */
  }
  render();
}

export const cartItems = () => items.map((l) => ({ ...l, product: getProduct(l.id) }));
export const cartCount = () => items.reduce((n, l) => n + l.qty, 0);

export function totals() {
  const lines = cartItems();
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const needsShipping = lines.some((l) => l.product.type !== "service");
  const shipping = !needsShipping || subtotal >= SHIPPING.freeFrom ? 0 : SHIPPING.price;
  return { subtotal, shipping, needsShipping, total: subtotal + (lines.length ? shipping : 0) };
}

export function addToCart(id, qty = 1, { silent = false, open = false } = {}) {
  const product = getProduct(id);
  if (!product) return;
  const line = items.find((l) => l.id === id);
  if (line) line.qty = Math.min(MAX_QTY, line.qty + qty);
  else items.push({ id, qty: Math.min(MAX_QTY, qty) });
  save();
  const badge = $("[data-cart-count]");
  badge?.classList.remove("bump");
  void badge?.offsetWidth;
  badge?.classList.add("bump");
  if (open) openCart();
  else if (!silent) {
    toast(`${product.name} ajouté au panier`, { image: product.image, action: "Voir", onAction: openCart });
  }
}

export function setQty(id, qty) {
  items = qty <= 0 ? items.filter((l) => l.id !== id) : items.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l));
  save();
}

export function clearCart() {
  items = [];
  save();
}

/* ---------- Rendu ---------- */
function lineHTML({ id, qty, product }) {
  return `<div class="line-item">
    <a class="line-item-media" href="produit.html?id=${esc(id)}"><img src="${esc(product.image)}" alt="" width="56" height="56"></a>
    <div>
      <h3>${esc(product.name)}</h3>
      <p>${esc(product.kind)}</p>
      <div class="qty" role="group" aria-label="Quantité de ${esc(product.name)}">
        <button type="button" data-qty="${esc(id)}" data-delta="-1" aria-label="Retirer un">−</button>
        <output>${qty}</output>
        <button type="button" data-qty="${esc(id)}" data-delta="1" aria-label="Ajouter un" ${qty >= MAX_QTY ? "disabled" : ""}>+</button>
      </div>
    </div>
    <div class="line-item-price">
      <span>${price(product.price * qty)}</span>
      <button class="remove-btn" type="button" data-remove="${esc(id)}">Retirer</button>
    </div>
  </div>`;
}

function render() {
  const count = cartCount();
  $$("[data-cart-count]").forEach((el) => {
    el.textContent = count;
    el.hidden = count === 0;
  });
  const titleCount = $("[data-cart-title-count]");
  if (titleCount) titleCount.textContent = count ? `(${count})` : "";

  const linesBox = $("[data-cart-lines]");
  if (!linesBox) return;
  const lines = cartItems();
  linesBox.innerHTML = lines.length
    ? lines.map(lineHTML).join("")
    : `<div class="cart-empty">${icons.bag}<p><strong>Ton panier est vide.</strong><br>Commence par un pack : tout est déjà pensé pour aller ensemble.</p><a class="btn btn-ghost btn-sm" href="boutique.html?cat=packs">Voir les packs</a></div>`;

  const t = totals();
  $("[data-cart-subtotal]").textContent = price(t.subtotal);
  $("[data-cart-shipping]").textContent = !lines.length ? "—" : t.shipping === 0 ? "Offerte" : price(t.shipping);
  $("[data-cart-total]").textContent = price(t.total);
  $("[data-checkout]").disabled = !lines.length;

  const meter = $("[data-ship-meter]");
  const left = SHIPPING.freeFrom - t.subtotal;
  meter.hidden = !lines.length || !t.needsShipping;
  $("[data-ship-text]").innerHTML =
    left > 0
      ? `Plus que <strong>${price(left)}</strong> pour la livraison offerte`
      : `<strong>Livraison offerte</strong> débloquée 🎉`;
  $("[data-ship-bar]").style.transform = `scaleX(${Math.min(1, t.subtotal / SHIPPING.freeFrom)})`;

  const upsell = $("[data-cart-upsell]");
  const svc = getProduct(UPSELL_ID);
  const show = lines.length > 0 && !items.some((l) => l.id === UPSELL_ID);
  upsell.hidden = !show;
  if (show) {
    upsell.innerHTML = `<img src="${esc(svc.image)}" alt=""><div><strong>Besoin d'un coup de main ?</strong><span>1 h de réglages en visio avec Empira Agency</span></div><button class="btn btn-primary btn-sm" type="button" data-add="${UPSELL_ID}" data-silent>+ ${price(svc.price)}</button>`;
  }
}

/* ---------- Tiroir ---------- */
const drawer = () => $("[data-cart]");
export function openCart() {
  const d = drawer();
  clearToasts();
  if (d && !d.open) d.showModal();
}
function closeCart() {
  drawer()?.close();
}

/* ---------- Paiement ---------- */
function mailtoOrder() {
  const lines = cartItems()
    .map((l) => `- ${l.qty} × ${l.product.name} (${price(l.product.price)})`)
    .join("\n");
  const body = `Bonjour Empira Studio,\n\nJe souhaite commander :\n${lines}\n\nTotal estimé : ${price(totals().total)}\n\nMes coordonnées :\n`;
  const email = document.body.dataset.email || "";
  return `mailto:${email}?subject=${encodeURIComponent("Commande Empira Studio")}&body=${encodeURIComponent(body)}`;
}

function showDemoNotice() {
  closeCart();
  openModal(
    `<div class="notice-box">
      <div class="icon">✦</div>
      <h2 class="h-md">Le paiement en ligne arrive très bientôt</h2>
      <p class="muted">Notre caisse sécurisée est en cours d'activation. Ton panier est conservé : envoie-le-nous par e-mail et on te recontacte dans la journée pour finaliser ta commande et te conseiller.</p>
      <div class="hero-ctas">
        <a class="btn btn-primary" href="${mailtoOrder()}">Envoyer ma commande ${icons.arrow}</a>
        <a class="btn btn-ghost" href="contact.html">Nous contacter</a>
      </div>
    </div>`,
    { size: "sm" },
  );
}

async function checkout(btn) {
  if (!items.length) return;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Connexion sécurisée…";
  try {
    const res = await fetch("api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.url === "string" && data.url.startsWith("https://checkout.stripe.com/")) {
      window.location.assign(data.url);
      return;
    }
    if (data.demo || [404, 405, 501].includes(res.status)) showDemoNotice();
    else toast(data.error || "Le paiement est momentanément indisponible.");
  } catch {
    showDemoNotice();
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

export function initCart() {
  const d = drawer();
  if (d) {
    lightDismiss(d, closeCart);
    d.addEventListener("click", (e) => {
      if (e.target.closest("[data-cart-close]")) closeCart();
    });
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    const open = t.closest("[data-cart-open]");
    if (open) return openCart();

    const add = t.closest("[data-add]");
    if (add) {
      const id = add.dataset.add;
      const qty = Number(add.dataset.qty) || 1;
      if ("openCart" in add.dataset) closeModal();
      addToCart(id, qty, { silent: "silent" in add.dataset || !!drawer()?.open, open: "openCart" in add.dataset });
      if (add.classList.contains("add-btn")) {
        add.classList.add("done");
        add.innerHTML = icons.check;
        setTimeout(() => {
          add.classList.remove("done");
          add.innerHTML = icons.plus;
        }, 1400);
      }
      return;
    }
    const q = t.closest("[data-qty]");
    if (q) {
      const line = items.find((l) => l.id === q.dataset.qty);
      if (line) setQty(line.id, line.qty + Number(q.dataset.delta));
      return;
    }
    const rm = t.closest("[data-remove]");
    if (rm) return setQty(rm.dataset.remove, 0);
    const co = t.closest("[data-checkout]");
    if (co) checkout(co);
  });
  // Synchronise plusieurs onglets ouverts.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      items = load();
      render();
    }
  });
  render();
}

export { PRODUCTS };
