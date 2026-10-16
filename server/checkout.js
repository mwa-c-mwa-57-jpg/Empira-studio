// Création d'une session de paiement Stripe Checkout.
//
// Sécurité :
// - le navigateur n'envoie que des identifiants de produits et des quantités ;
//   les prix sont relus dans le catalogue côté serveur (impossible de les modifier) ;
// - les données de carte bancaire ne passent jamais par ce site : Stripe les
//   saisit sur sa propre page (certifiée PCI-DSS niveau 1) ;
// - la clé secrète Stripe reste dans une variable d'environnement de l'hébergeur ;
// - seules les requêtes venant du site lui-même sont acceptées (contrôle d'origine).
//
// Ce fichier utilise uniquement les standards Web (Request / Response / fetch),
// il fonctionne donc sur Netlify, Cloudflare Pages et le serveur local.

import { getProduct, fullName, SHIPPING, MAX_QTY } from "../src/assets/js/catalog.js";

const MAX_LINES = 30;
const MAX_BODY = 8 * 1024;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const self = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host") || self.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Valide le panier envoyé par le navigateur et le reconstruit à partir du catalogue.
export function validateCart(payload) {
  if (!payload || !Array.isArray(payload.items)) throw new Error("Panier invalide.");
  if (payload.items.length === 0) throw new Error("Ton panier est vide.");
  if (payload.items.length > MAX_LINES) throw new Error("Trop d'articles différents.");

  const merged = new Map();
  for (const item of payload.items) {
    const id = typeof item?.id === "string" ? item.id : "";
    const qty = Number(item?.qty);
    if (!ID_PATTERN.test(id)) throw new Error("Produit invalide.");
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error("Quantité invalide.");
    const product = getProduct(id);
    if (!product) throw new Error("Produit introuvable.");
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
  }

  const lines = [...merged].map(([id, qty]) => ({ product: getProduct(id), qty }));
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const needsShipping = lines.some((l) => l.product.type !== "service");
  const shipping = !needsShipping || subtotal >= SHIPPING.freeFrom ? 0 : SHIPPING.price;
  return { lines, subtotal, shipping, needsShipping };
}

const cents = (euros) => Math.round(euros * 100);

function stripeParams(cart, origin) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("locale", "fr");
  p.set("success_url", `${origin}/succes.html?session_id={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${origin}/boutique.html?paiement=annule`);
  p.set("allow_promotion_codes", "true");
  p.set("billing_address_collection", "required");
  p.set("phone_number_collection[enabled]", "true");
  p.set(
    "custom_text[submit][message]",
    `En validant ta commande, tu acceptes nos conditions générales de vente : ${origin}/cgv.html`,
  );

  cart.lines.forEach(({ product, qty }, i) => {
    p.set(`line_items[${i}][quantity]`, String(qty));
    p.set(`line_items[${i}][price_data][currency]`, "eur");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(cents(product.price)));
    p.set(`line_items[${i}][price_data][product_data][name]`, `${fullName(product)} — ${product.kind}`);
    p.set(`line_items[${i}][price_data][product_data][metadata][id]`, product.id);
  });

  if (cart.needsShipping) {
    SHIPPING.countries.forEach((c, i) => p.set(`shipping_address_collection[allowed_countries][${i}]`, c));
    const rate = "shipping_options[0][shipping_rate_data]";
    p.set(`${rate}[type]`, "fixed_amount");
    p.set(`${rate}[display_name]`, cart.shipping === 0 ? "Livraison offerte (48-72 h)" : "Livraison suivie (48-72 h)");
    p.set(`${rate}[fixed_amount][amount]`, String(cents(cart.shipping)));
    p.set(`${rate}[fixed_amount][currency]`, "eur");
    p.set(`${rate}[delivery_estimate][minimum][unit]`, "business_day");
    p.set(`${rate}[delivery_estimate][minimum][value]`, "2");
    p.set(`${rate}[delivery_estimate][maximum][unit]`, "business_day");
    p.set(`${rate}[delivery_estimate][maximum][value]`, "3");
  }
  return p;
}

export async function handleCheckout(request, env = {}) {
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  if (!sameOrigin(request)) return json(403, { error: "Origine non autorisée." });
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return json(415, { error: "Format non pris en charge." });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(413, { error: "Requête trop volumineuse." });
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "Requête illisible." });
  }

  let cart;
  try {
    cart = validateCart(payload);
  } catch (err) {
    return json(400, { error: err.message });
  }

  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) {
    // Site en ligne mais Stripe pas encore branché : on le signale proprement.
    return json(503, { demo: true, error: "Le paiement en ligne n'est pas encore activé." });
  }

  const origin = new URL(request.headers.get("origin")).origin;
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: stripeParams(cart, origin),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    console.error("Stripe error", res.status, data?.error?.message);
    return json(502, { error: "Le paiement est momentanément indisponible. Réessaie dans un instant." });
  }
  return json(200, { url: data.url });
}
