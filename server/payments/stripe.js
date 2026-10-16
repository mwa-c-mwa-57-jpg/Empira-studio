// Stripe Checkout : carte bancaire, Apple Pay, Google Pay. Les ventes sont
// versées automatiquement sur le compte bancaire indiqué dans Stripe (ton IBAN Qonto).
import { SHIPPING } from "../../src/assets/js/catalog.js";

export const stripeEnabled = (env) => Boolean(env.STRIPE_SECRET_KEY);

export async function createStripePayment(cart, origin, env) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("locale", "fr");
  p.set("success_url", `${origin}/succes.html?session_id={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${origin}/boutique.html?paiement=annule`);
  p.set("allow_promotion_codes", "true");
  p.set("billing_address_collection", "required");
  p.set("phone_number_collection[enabled]", "true");
  p.set("custom_text[submit][message]", `En validant ta commande, tu acceptes nos conditions générales de vente : ${origin}/cgv.html`);

  cart.lines.forEach((l, i) => {
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, "eur");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
    p.set(`line_items[${i}][price_data][product_data][name]`, l.name);
    p.set(`line_items[${i}][price_data][product_data][metadata][id]`, l.product.id);
  });

  if (cart.needsShipping) {
    SHIPPING.countries.forEach((c, i) => p.set(`shipping_address_collection[allowed_countries][${i}]`, c));
    const rate = "shipping_options[0][shipping_rate_data]";
    p.set(`${rate}[type]`, "fixed_amount");
    p.set(`${rate}[display_name]`, cart.shippingCents === 0 ? "Livraison offerte (48-72 h)" : "Livraison suivie (48-72 h)");
    p.set(`${rate}[fixed_amount][amount]`, String(cart.shippingCents));
    p.set(`${rate}[fixed_amount][currency]`, "eur");
    p.set(`${rate}[delivery_estimate][minimum][unit]`, "business_day");
    p.set(`${rate}[delivery_estimate][minimum][value]`, "2");
    p.set(`${rate}[delivery_estimate][maximum][unit]`, "business_day");
    p.set(`${rate}[delivery_estimate][maximum][value]`, "3");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: p,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(`Stripe ${res.status}: ${data?.error?.message || "réponse inattendue"}`);
  return data.url;
}
