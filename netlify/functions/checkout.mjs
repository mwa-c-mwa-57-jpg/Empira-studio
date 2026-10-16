// Netlify Functions : expose la création de paiement sur /api/checkout.
import { handleCheckout } from "../../server/checkout.js";

export default (request) => handleCheckout(request, process.env);

export const config = { path: "/api/checkout" };
