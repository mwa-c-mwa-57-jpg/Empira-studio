// Points d'entrée du paiement, communs à Netlify, Cloudflare Pages et au serveur local.
//
//   POST /api/checkout          { items, provider: "stripe" | "paypal" | "alma", installments }
//                                → { url } vers la page de paiement sécurisée du prestataire
//   GET  /api/payment/methods   → moyens de paiement activés (selon les clés configurées)
//   GET  /api/payment/return    → retour de PayPal / Alma : encaissement ou vérification,
//                                  puis redirection vers la page de confirmation
//
// Sécurité : prix relus dans le catalogue côté serveur, clés secrètes uniquement
// dans les variables d'environnement de l'hébergeur, aucune donnée bancaire sur le site.

import { json, redirect, sameOrigin, validateCart, CartError, urls } from "./payments/common.js";
import { stripeEnabled, createStripePayment } from "./payments/stripe.js";
import { paypalEnabled, createPaypalPayment, capturePaypalPayment } from "./payments/paypal.js";
import { almaEnabled, createAlmaPayment, verifyAlmaPayment } from "./payments/alma.js";

const MAX_BODY = 8 * 1024;

const PROVIDERS = {
  stripe: { enabled: stripeEnabled, create: (cart, origin, env) => createStripePayment(cart, origin, env) },
  paypal: { enabled: paypalEnabled, create: (cart, origin, env) => createPaypalPayment(cart, origin, env) },
  alma: { enabled: almaEnabled, create: (cart, origin, env, payload) => createAlmaPayment(cart, origin, env, Number(payload.installments)) },
};

export function handleMethods(request, env = {}) {
  if (request.method !== "GET") return json(405, { error: "Méthode non autorisée." });
  return json(200, Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.enabled(env)])));
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

  const providerId = payload?.provider || "stripe";
  const provider = PROVIDERS[providerId];
  if (!provider) return json(400, { error: "Moyen de paiement inconnu." });

  let cart;
  try {
    cart = validateCart(payload);
  } catch (err) {
    return json(400, { error: err.message });
  }

  if (!provider.enabled(env)) {
    return json(503, { demo: true, error: "Ce moyen de paiement n'est pas encore activé." });
  }

  const origin = new URL(request.headers.get("origin")).origin;
  try {
    return json(200, { url: await provider.create(cart, origin, env, payload) });
  } catch (err) {
    if (err instanceof CartError) return json(400, { error: err.message });
    console.error(`[paiement ${providerId}]`, err.message);
    return json(502, { error: "Le paiement est momentanément indisponible. Réessaie dans un instant ou choisis un autre moyen de paiement." });
  }
}

export async function handleReturn(request, env = {}) {
  const url = new URL(request.url);
  const origin = url.origin;
  const provider = url.searchParams.get("provider");
  try {
    if (provider === "paypal" && paypalEnabled(env)) {
      const r = await capturePaypalPayment(url.searchParams.get("token"), env);
      return redirect(r.ok ? urls(origin).success("paypal", r.ref) : urls(origin).failure);
    }
    if (provider === "alma" && almaEnabled(env)) {
      const r = await verifyAlmaPayment(url.searchParams.get("pid"), env);
      return redirect(r.ok ? urls(origin).success("alma", r.ref) : urls(origin).failure);
    }
  } catch (err) {
    console.error(`[retour ${provider}]`, err.message);
  }
  return redirect(urls(origin).failure);
}
