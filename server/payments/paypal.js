// PayPal (API Orders v2) : le client valide le paiement sur PayPal, puis revient
// sur /api/payment/return où la commande est « capturée » (encaissée).
// Clés : PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, et PAYPAL_MODE=live en production
// (par défaut : bac à sable « sandbox » pour les tests).
import { euros, urls } from "./common.js";

export const paypalEnabled = (env) => Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
const base = (env) => (env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token(env) {
  const res = await fetch(`${base(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`PayPal auth ${res.status}`);
  return data.access_token;
}

const money = (c) => ({ currency_code: "EUR", value: euros(c) });

export async function createPaypalPayment(cart, origin, env) {
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: "empira",
        description: "Commande Empira Studio",
        amount: {
          ...money(cart.totalCents),
          breakdown: { item_total: money(cart.subtotalCents), shipping: money(cart.shippingCents) },
        },
        items: cart.lines.map((l) => ({
          name: l.name.slice(0, 127),
          sku: l.product.id,
          quantity: String(l.qty),
          unit_amount: money(l.unitCents),
          category: l.product.type === "service" ? "DIGITAL_GOODS" : "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Empira Studio",
          locale: "fr-FR",
          user_action: "PAY_NOW",
          shipping_preference: cart.needsShipping ? "GET_FROM_FILE" : "NO_SHIPPING",
          return_url: `${origin}/api/payment/return?provider=paypal`,
          cancel_url: urls(origin).cancel,
        },
      },
    },
  };
  const res = await fetch(`${base(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: { authorization: `Bearer ${await token(env)}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const link = (data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!res.ok || !link) throw new Error(`PayPal ${res.status}: ${data?.message || "réponse inattendue"}`);
  return link.href;
}

// Encaisse la commande validée par le client. Rejouer l'URL de retour ne débite
// pas deux fois : si la commande est déjà encaissée, on le vérifie et on confirme.
export async function capturePaypalPayment(orderId, env) {
  if (!/^[A-Z0-9]{10,40}$/.test(orderId || "")) return { ok: false };
  const auth = { authorization: `Bearer ${await token(env)}`, "content-type": "application/json" };
  const res = await fetch(`${base(env)}/v2/checkout/orders/${orderId}/capture`, { method: "POST", headers: auth, body: "{}" });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: data.status === "COMPLETED", ref: orderId };
  }
  const check = await fetch(`${base(env)}/v2/checkout/orders/${orderId}`, { headers: auth });
  const order = await check.json().catch(() => ({}));
  return { ok: order.status === "COMPLETED", ref: orderId };
}
