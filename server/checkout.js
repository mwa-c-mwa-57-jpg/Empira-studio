// Points d'entrée du paiement, communs à Netlify, Cloudflare Pages et au serveur local.
//
//   POST /api/checkout          { items } → { url } vers la page de paiement Stripe
//   GET  /api/payment/methods   → { stripe: true | false } selon la clé configurée
//
// Sans clé Stripe, le panier propose la commande avec lien de paiement Qonto
// (formulaire de commande, voir docs/GUIDE.md).
//
// Sécurité : prix relus dans le catalogue côté serveur, clé secrète uniquement
// dans les variables d'environnement de l'hébergeur, aucune donnée bancaire sur le site.

import { json, sameOrigin, validateCart, CartError } from "./payments/common.js";
import { stripeEnabled, createStripePayment } from "./payments/stripe.js";

const MAX_BODY = 8 * 1024;

export function handleMethods(request, env = {}) {
  if (request.method !== "GET") return json(405, { error: "Méthode non autorisée." });
  return json(200, { stripe: stripeEnabled(env) });
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

  if (!stripeEnabled(env)) {
    return json(503, { demo: true, error: "Le paiement par carte en ligne n'est pas encore activé." });
  }

  const origin = new URL(request.headers.get("origin")).origin;
  try {
    return json(200, { url: await createStripePayment(cart, origin, env) });
  } catch (err) {
    if (err instanceof CartError) return json(400, { error: err.message });
    console.error("[paiement stripe]", err.message);
    return json(502, { error: "Le paiement est momentanément indisponible. Réessaie dans un instant." });
  }
}
