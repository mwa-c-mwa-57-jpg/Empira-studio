// Netlify Functions : expose server/checkout.js sur /api/checkout.
import { handleCheckout } from "../../server/checkout.js";

export default (request) => handleCheckout(request, { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY });

export const config = { path: "/api/checkout" };
