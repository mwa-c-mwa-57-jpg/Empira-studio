// Cloudflare Pages Functions : expose server/checkout.js sur /api/checkout.
// (Utilisé uniquement si le site est hébergé sur Cloudflare Pages au lieu de Netlify.)
import { handleCheckout } from "../../server/checkout.js";

export const onRequest = ({ request, env }) => handleCheckout(request, env);
