// Netlify Functions : espace admin des produits, sur /api/admin.
import { handleAdmin } from "../../server/admin/handler.js";

export default (request) => handleAdmin(request, process.env);

export const config = { path: "/api/admin" };
