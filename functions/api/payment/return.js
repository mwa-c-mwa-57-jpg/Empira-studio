// Cloudflare Pages Functions : retour de PayPal et d'Alma.
import { handleReturn } from "../../../server/checkout.js";

export const onRequest = ({ request, env }) => handleReturn(request, env);
