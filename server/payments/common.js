// Outils partagés par les moyens de paiement : réponses JSON, contrôle
// d'origine et reconstruction du panier à partir du catalogue (les prix
// envoyés par le navigateur ne sont jamais utilisés).
import { getProduct, fullName, SHIPPING, MAX_QTY } from "../../src/assets/js/catalog.js";

const MAX_LINES = 30;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

export const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export class CartError extends Error {}

export function validateCart(payload) {
  if (!payload || !Array.isArray(payload.items)) throw new CartError("Panier invalide.");
  if (payload.items.length === 0) throw new CartError("Ton panier est vide.");
  if (payload.items.length > MAX_LINES) throw new CartError("Trop d'articles différents.");

  const merged = new Map();
  for (const item of payload.items) {
    const id = typeof item?.id === "string" ? item.id : "";
    const qty = Number(item?.qty);
    if (!ID_PATTERN.test(id)) throw new CartError("Produit invalide.");
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new CartError("Quantité invalide.");
    if (!getProduct(id)) throw new CartError("Produit introuvable.");
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
  }

  const lines = [...merged].map(([id, qty]) => {
    const product = getProduct(id);
    return { product, qty, name: `${fullName(product)} — ${product.kind}`, unitCents: cents(product.price) };
  });
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
  const needsShipping = lines.some((l) => l.product.type !== "service");
  const shippingCents = !needsShipping || subtotalCents >= cents(SHIPPING.freeFrom) ? 0 : cents(SHIPPING.price);
  return { lines, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, needsShipping };
}

export const cents = (euros) => Math.round(euros * 100);
