// Cloudflare Pages Functions : espace admin des produits.
import { handleAdmin } from "../../server/admin/handler.js";

export const onRequest = ({ request, env }) => handleAdmin(request, env);
