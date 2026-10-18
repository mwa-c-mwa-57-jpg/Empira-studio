// Espace admin : liste, ajout, modification et suppression des produits.
//
//   GET  /api/admin                         → { products, categories }
//   POST /api/admin { action: "save", product, image? }   → ajoute ou modifie
//   POST /api/admin { action: "delete", id }              → supprime
//
// Accès protégé par le mot de passe ADMIN_PASSWORD (variable d'environnement,
// 12 caractères minimum), envoyé dans l'en-tête Authorization: Bearer <mot de passe>.
// Toutes les données sont revérifiées ici avant d'être enregistrées.
import { json, sameOrigin } from "../payments/common.js";
import { CATEGORIES } from "../../src/assets/js/catalog.js";
import { IMAGES_DIR } from "./products-file.js";
import { githubStorage, StorageConflict } from "./github.js";

const MAX_BODY = 5 * 1024 * 1024;
const MAX_IMAGE = 3 * 1024 * 1024;
const MIN_PASSWORD = 12;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const LIMITS = { name: 80, brand: 40, kind: 100, badge: 24, short: 240, description: 2500, spec: 140, specs: 12 };

class AdminError extends Error {}

/* ---------- Mot de passe ---------- */
async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
async function checkPassword(request, expected) {
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = given.length ? 0 : 1;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Validation ---------- */
function text(value, max, label, { required = false, multiline = false } = {}) {
  let s = typeof value === "string" ? value : value == null ? "" : String(value);
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, " ");
  s = multiline ? s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : s.replace(/\s+/g, " ").trim();
  if (required && !s) throw new AdminError(`${label} : champ obligatoire.`);
  if (s.length > max) throw new AdminError(`${label} : ${max} caractères maximum.`);
  return s;
}

function parsePrice(value) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/\s|€/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0.5 || n > 20000) throw new AdminError("Prix : indique un montant entre 0,50 € et 20 000 €.");
  return Math.round(n * 100) / 100;
}

function slugify(name) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34)
    .replace(/-+$/, "");
  return base || "produit";
}

function uniqueId(name, products) {
  const taken = new Set(products.map((p) => p.id));
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

function cleanProduct(input) {
  if (!input || typeof input !== "object") throw new AdminError("Produit invalide.");
  const specsRaw = Array.isArray(input.specs) ? input.specs : String(input.specs || "").split("\n");
  const specs = specsRaw.map((s) => text(s, LIMITS.spec, "Caractéristique")).filter(Boolean);
  if (specs.length > LIMITS.specs) throw new AdminError(`Caractéristiques : ${LIMITS.specs} lignes maximum.`);
  const category = String(input.category || "");
  if (!CATEGORIES.some((c) => c.id === category)) throw new AdminError("Catégorie : choisis une catégorie de la liste.");
  return {
    brand: text(input.brand, LIMITS.brand, "Marque"),
    name: text(input.name, LIMITS.name, "Nom du produit", { required: true }),
    kind: text(input.kind, LIMITS.kind, "Type de produit", { required: true }),
    category,
    price: parsePrice(input.price),
    badge: text(input.badge, LIMITS.badge, "Badge"),
    short: text(input.short, LIMITS.short, "Accroche", { required: true }),
    description: text(input.description, LIMITS.description, "Description", { required: true, multiline: true }),
    specs,
  };
}

// Photo envoyée en data URL ; le type réel est vérifié sur le contenu du fichier.
const SIGNATURES = [
  { ext: "webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];
function cleanImage(dataUrl) {
  const m = /^data:image\/(?:webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ""));
  if (!m) throw new AdminError("Photo : format non pris en charge (JPEG, PNG ou WebP).");
  const base64 = m[1];
  const size = Math.floor((base64.length * 3) / 4);
  if (size > MAX_IMAGE) throw new AdminError("Photo : fichier trop lourd (3 Mo maximum).");
  const head = Uint8Array.from(atob(base64.slice(0, 24)), (c) => c.charCodeAt(0));
  const type = SIGNATURES.find((s) => s.test(head));
  if (!type) throw new AdminError("Photo : le fichier n'est pas une image valide.");
  return { base64, ext: type.ext };
}

/* ---------- Opérations ---------- */
function applySave(products, payload) {
  const fields = cleanProduct(payload.product);
  const id = payload.product?.id;
  const files = [];
  let product;

  if (id) {
    const current = products.find((p) => p.id === id);
    if (!current) throw new AdminError("Ce produit n'existe plus. Recharge la page.");
    product = { ...current, ...fields };
  } else {
    if (!payload.image) throw new AdminError("Photo : ajoute une photo du produit.");
    product = { id: uniqueId(fields.name, products), ...fields };
  }
  if (payload.image) {
    const img = cleanImage(payload.image);
    const file = `${product.id}-${Date.now().toString(36)}.${img.ext}`;
    files.push({ path: `${IMAGES_DIR}/${file}`, base64: img.base64 });
    product.image = `assets/img/products/${file}`;
  }
  // Champs vides retirés pour garder le fichier propre.
  for (const k of ["brand", "badge"]) if (!product[k]) delete product[k];
  if (!ID_PATTERN.test(product.id)) throw new AdminError("Identifiant de produit invalide.");

  const next = id ? products.map((p) => (p.id === id ? product : p)) : [product, ...products];
  const message = id ? `Admin : modification de « ${product.name} »` : `Admin : ajout de « ${product.name} »`;
  return { products: next, files, message, product };
}

function applyDelete(products, payload) {
  const target = products.find((p) => p.id === payload.id);
  if (!target) throw new AdminError("Ce produit n'existe plus. Recharge la page.");
  if (products.length === 1) throw new AdminError("La boutique doit garder au moins un produit.");
  return {
    products: products.filter((p) => p.id !== target.id),
    files: [],
    message: `Admin : suppression de « ${target.name}${target.variant ? ` (${target.variant})` : ""} »`,
  };
}

/* ---------- Point d'entrée ---------- */
export async function handleAdmin(request, env = {}, storage = githubStorage(env)) {
  const password = env.ADMIN_PASSWORD || "";
  if (password.length < MIN_PASSWORD) {
    return json(503, { error: `Espace admin non activé : ajoute la variable ADMIN_PASSWORD (${MIN_PASSWORD} caractères minimum) dans Netlify.` });
  }
  if (!storage) {
    return json(503, { error: "Espace admin non relié à GitHub : ajoute les variables GITHUB_TOKEN et GITHUB_REPO dans Netlify." });
  }
  if (!(await checkPassword(request, password))) {
    await pause(800);
    return json(401, { error: "Mot de passe incorrect." });
  }

  try {
    if (request.method === "GET") {
      const { products } = await storage.load();
      return json(200, { products, categories: CATEGORIES });
    }
    if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
    if (!sameOrigin(request)) return json(403, { error: "Origine non autorisée." });
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return json(415, { error: "Format non pris en charge." });
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(413, { error: "Envoi trop lourd : choisis une photo plus légère." });
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json(400, { error: "Requête illisible." });
    }
    const apply = payload?.action === "save" ? applySave : payload?.action === "delete" ? applyDelete : null;
    if (!apply) return json(400, { error: "Action inconnue." });

    // Si quelqu'un a enregistré entre-temps, on recharge et on réapplique une fois.
    for (let attempt = 0; ; attempt++) {
      const { products, version } = await storage.load();
      const result = apply(products, payload);
      try {
        await storage.save({ ...result, version });
        return json(200, { ok: true, products: result.products, product: result.product || null });
      } catch (err) {
        if (!(err instanceof StorageConflict) || attempt > 0) throw err;
      }
    }
  } catch (err) {
    if (err instanceof AdminError) return json(400, { error: err.message });
    console.error("[admin]", err.message);
    return json(502, { error: "L'enregistrement a échoué. Réessaie dans un instant." });
  }
}
