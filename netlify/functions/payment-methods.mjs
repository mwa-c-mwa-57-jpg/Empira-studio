// Netlify Functions : moyens de paiement activés, sur /api/payment/methods.
import { handleMethods } from "../../server/checkout.js";

export default (request) => handleMethods(request, process.env);

export const config = { path: "/api/payment/methods" };
