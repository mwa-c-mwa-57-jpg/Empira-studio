// Netlify Functions : retour de PayPal et d'Alma, sur /api/payment/return.
import { handleReturn } from "../../server/checkout.js";

export default (request) => handleReturn(request, process.env);

export const config = { path: "/api/payment/return" };
