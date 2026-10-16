// Alma : paiement en 3 ou 4 fois. Le client paie sur la page Alma puis revient
// sur /api/payment/return?provider=alma&pid=…, où le paiement est vérifié auprès d'Alma.
// Clé : ALMA_API_KEY (sk_test_… = bac à sable, sk_live_… = production).
import { PAYMENTS } from "../../src/assets/js/catalog.js";
import { cents, urls, CartError } from "./common.js";

export const almaEnabled = (env) => Boolean(env.ALMA_API_KEY);
const base = (env) => (String(env.ALMA_API_KEY).startsWith("sk_live_") ? "https://api.getalma.eu" : "https://api.sandbox.getalma.eu");
const headers = (env) => ({ authorization: `Alma-Auth ${env.ALMA_API_KEY}`, "content-type": "application/json" });

export async function createAlmaPayment(cart, origin, env, installments) {
  if (!PAYMENTS.almaInstallments.includes(installments)) throw new CartError("Nombre d'échéances non proposé.");
  if (cart.totalCents < cents(PAYMENTS.almaMinTotal)) {
    throw new CartError(`Le paiement en plusieurs fois est disponible dès ${PAYMENTS.almaMinTotal} € d'achat.`);
  }
  const res = await fetch(`${base(env)}/v1/payments`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      origin: "online",
      payment: {
        purchase_amount: cart.totalCents,
        installments_count: installments,
        locale: "fr",
        return_url: `${origin}/api/payment/return?provider=alma`,
        customer_cancel_url: urls(origin).cancel,
        failure_return_url: urls(origin).failure,
        custom_data: { produits: cart.lines.map((l) => `${l.qty}x ${l.product.id}`).join(", ").slice(0, 250) },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    if (res.status === 400 || res.status === 422) throw new CartError("Le paiement en plusieurs fois n'est pas disponible pour ce panier.");
    throw new Error(`Alma ${res.status}`);
  }
  return data.url;
}

// Vérifie auprès d'Alma que le paiement est bien accepté avant d'afficher la confirmation.
export async function verifyAlmaPayment(pid, env) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(pid || "")) return { ok: false };
  const res = await fetch(`${base(env)}/v1/payments/${pid}`, { headers: headers(env) });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && (["authorized", "captured"].includes(data.processing_status) || ["in_progress", "paid"].includes(data.state));
  return { ok, ref: pid };
}
