// Cloudflare Pages Functions : moyens de paiement activés.
import { handleMethods } from "../../../server/checkout.js";

export const onRequest = ({ request, env }) => handleMethods(request, env);
