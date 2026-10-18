// Espace admin : connexion par mot de passe, liste des produits, ajout,
// modification et suppression. Les données partent vers /api/admin, qui les
// revérifie et les enregistre (GitHub en ligne, fichiers locaux avec npm run dev).
import { $, $$, esc, price } from "../utils.js";
import { CATEGORIES } from "../catalog.js";
import LOCAL_PRODUCTS from "../products-data.js";

const KEY = "empira-admin";
const MAX_SIDE = 1200;
const MAX_DATA_URL = 3.8 * 1024 * 1024;

let password = "";
let products = [];
let categories = CATEGORIES;
let editing = null; // produit en cours de modification (null = nouveau)
let photo = null; // nouvelle photo (data URL) en attente d'enregistrement
let demo = false; // aperçu hors du vrai site : rien n'est enregistré
const fresh = new Map(); // photos tout juste envoyées, affichées le temps que le site se republie

/* ---------- API ---------- */
async function api(method, body) {
  if (demo) return demoApi(method, body);
  const res = await fetch("api/admin", {
    method,
    headers: { authorization: `Bearer ${password}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// Mode aperçu : quand le site est affiché ailleurs que chez l'hébergeur (pas de
// fonction /api/admin), on montre l'interface avec les produits actuels.
function demoApi(method, body) {
  if (method === "GET") return { ok: true, status: 200, data: { products: structuredClone(LOCAL_PRODUCTS), categories: CATEGORIES } };
  if (body.action === "delete") products = products.filter((p) => p.id !== body.id);
  else {
    const p = { ...(editing || { id: `nouveau-${Date.now()}` }), ...body.product };
    p.price = Number(String(p.price).replace(",", ".")) || 0;
    p.specs = String(body.product.specs || "").split("\n").filter(Boolean);
    if (photo) p.image = photo;
    products = editing ? products.map((x) => (x.id === p.id ? p : x)) : [p, ...products];
  }
  return { ok: true, status: 200, data: { products, product: null } };
}

const isRealSite = () => {
  const site = document.body.dataset.site || "";
  try {
    return ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.endsWith(new URL(site).hostname) || location.hostname.endsWith(".netlify.app");
  } catch {
    return true;
  }
};

/* ---------- Connexion ---------- */
async function login(pw) {
  password = pw;
  const error = $("[data-admin-login-error]");
  error.hidden = true;
  let r;
  try {
    r = await api("GET");
  } catch {
    r = { status: 0, ok: false, data: {} };
  }
  if (r.ok && !Array.isArray(r.data.products)) r = { status: 0, ok: false, data: {} }; // pas de fonction admin derrière
  if (!r.ok && [0, 404, 405, 501].includes(r.status) && !isRealSite()) {
    demo = true;
    r = await api("GET");
  }
  if (!r.ok) {
    error.textContent =
      r.status === 401 ? "Mot de passe incorrect." : r.data.error || "L'espace admin est indisponible pour le moment. Réessaie dans un instant.";
    error.hidden = false;
    password = "";
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    return false;
  }
  try {
    sessionStorage.setItem(KEY, pw);
  } catch {}
  products = r.data.products;
  categories = r.data.categories || CATEGORIES;
  $("[data-admin-login]").hidden = true;
  $("[data-admin-app]").hidden = false;
  if (demo) banner("Mode aperçu : tu peux tout essayer, mais rien n'est enregistré. Sur ton site en ligne, les changements sont publiés pour de vrai.", "info");
  renderList();
  return true;
}

function logout() {
  password = "";
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  location.reload();
}

/* ---------- Liste ---------- */
const catLabel = (id) => categories.find((c) => c.id === id)?.label || id;

function renderList() {
  const q = $("[data-admin-search]").value.trim().toLowerCase();
  const list = products.filter((p) => !q || `${p.brand || ""} ${p.name} ${p.variant || ""} ${p.kind}`.toLowerCase().includes(q));
  $("[data-admin-count]").textContent = `(${products.length})`;
  $("[data-admin-list]").innerHTML = list.length
    ? list
        .map(
          (p) => `<button class="admin-row" type="button" data-edit="${esc(p.id)}">
      <img src="${esc(fresh.get(p.id) || p.image)}" alt="" width="56" height="56" loading="lazy">
      <span class="admin-row-main"><strong>${esc(p.name)}${p.variant ? ` <small>${esc(p.variant)}</small>` : ""}</strong><span>${esc(catLabel(p.category))}${p.badge ? ` · ${esc(p.badge)}` : ""}</span></span>
      <span class="admin-row-price">${price(p.price)}</span>
      <span class="admin-row-edit">Modifier</span>
    </button>`,
        )
        .join("")
    : `<p class="muted admin-empty">Aucun produit ne correspond à ta recherche.</p>`;
}

function banner(message, tone = "ok") {
  const b = $("[data-admin-banner]");
  b.textContent = message;
  b.dataset.tone = tone;
  b.hidden = false;
}

/* ---------- Éditeur ---------- */
const editor = () => $("[data-admin-editor]");

function setPreview(src) {
  $("[data-photo-preview]").innerHTML = src ? `<img src="${esc(src)}" alt="Photo du produit">` : "<span>Aucune photo</span>";
}

function openEditor(product = null) {
  editing = product;
  photo = null;
  const form = $("[data-editor-form]");
  form.reset();
  $("[data-editor-categories]").innerHTML = categories.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
  $("[data-editor-title]").textContent = product ? `Modifier ${product.name}${product.variant ? ` (${product.variant})` : ""}` : "Nouveau produit";
  if (product) {
    const f = form.elements;
    f.name.value = product.name || "";
    f.brand.value = product.brand || "";
    f.kind.value = product.kind || "";
    f.category.value = product.category;
    f.price.value = Number(product.price).toFixed(2).replace(".", ",");
    f.badge.value = product.badge || "";
    f.short.value = product.short || "";
    f.description.value = product.description || "";
    f.specs.value = (product.specs || []).join("\n");
  }
  setPreview(product ? fresh.get(product.id) || product.image : "");
  const del = $("[data-editor-delete]");
  del.hidden = !product;
  del.textContent = "Supprimer";
  delete del.dataset.armed;
  $("[data-editor-error]").hidden = true;
  editor().showModal();
  editor().scrollTop = 0;
}

function closeEditor() {
  editor().close();
}

function showError(message) {
  const e = $("[data-editor-error]");
  e.textContent = message;
  e.hidden = false;
  e.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Réduit la photo (1200 px max) et la convertit en WebP quand le navigateur sait le faire.
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}
async function preparePhoto(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choisis une photo au format JPEG, PNG ou WebP.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Cette photo est trop lourde (25 Mo maximum).");
  const img = await loadImage(await readAsDataURL(file));
  for (const side of [MAX_SIDE, 900, 700]) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/webp", 0.86);
    if (!data.startsWith("data:image/webp")) data = file.type === "image/jpeg" ? canvas.toDataURL("image/jpeg", 0.86) : canvas.toDataURL("image/png");
    if (data.length <= MAX_DATA_URL) return data;
  }
  throw new Error("Cette photo est trop lourde, même réduite. Essaie une autre photo.");
}

async function onPhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  $("[data-editor-error]").hidden = true;
  try {
    photo = await preparePhoto(file);
    setPreview(photo);
  } catch (err) {
    photo = null;
    e.target.value = "";
    showError(err.message || "Impossible de lire cette photo.");
  }
}

async function save(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const f = form.elements;
  const missing = ["name", "kind", "price", "short", "description"].find((k) => !f[k].value.trim());
  if (missing) {
    f[missing].focus();
    return showError(`Remplis le champ « ${form.querySelector(`label[for="${f[missing].id}"]`).textContent.replace(" *", "")} ».`);
  }
  if (!editing && !photo) return showError("Ajoute une photo du produit.");
  const product = {
    id: editing?.id,
    name: f.name.value,
    brand: f.brand.value,
    kind: f.kind.value,
    category: f.category.value,
    price: f.price.value,
    badge: f.badge.value,
    short: f.short.value,
    description: f.description.value,
    specs: f.specs.value,
  };
  const btn = $("[data-editor-save]");
  btn.disabled = true;
  btn.textContent = "Enregistrement…";
  try {
    const r = await api("POST", { action: "save", product, image: photo || undefined });
    if (r.status === 401) return logout();
    if (!r.ok) return showError(r.data.error || "L'enregistrement a échoué. Réessaie dans un instant.");
    products = r.data.products;
    if (photo && r.data.product) fresh.set(r.data.product.id, photo);
    renderList();
    closeEditor();
    if (!demo) banner(`« ${product.name.trim()} » est enregistré. Ton site sera à jour dans 1 à 2 minutes.`);
  } catch {
    showError("Connexion impossible. Vérifie ta connexion internet et réessaie.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enregistrer";
  }
}

// Suppression en deux temps : un premier appui arme le bouton, le second confirme.
async function remove() {
  const btn = $("[data-editor-delete]");
  if (!btn.dataset.armed) {
    btn.dataset.armed = "1";
    btn.textContent = "Confirmer la suppression";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Suppression…";
  try {
    const name = editing.name;
    const r = await api("POST", { action: "delete", id: editing.id });
    if (r.status === 401) return logout();
    if (!r.ok) return showError(r.data.error || "La suppression a échoué. Réessaie dans un instant.");
    products = r.data.products;
    renderList();
    closeEditor();
    if (!demo) banner(`« ${name} » est retiré. Ton site sera à jour dans 1 à 2 minutes.`);
  } catch {
    showError("Connexion impossible. Vérifie ta connexion internet et réessaie.");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Initialisation ---------- */
export function init() {
  $("[data-admin-login-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector("[type=submit]");
    btn.disabled = true;
    await login(e.currentTarget.elements.password.value);
    btn.disabled = false;
  });
  $("[data-admin-logout]").addEventListener("click", logout);
  $("[data-admin-new]").addEventListener("click", () => openEditor());
  $("[data-admin-search]").addEventListener("input", renderList);
  $("[data-admin-list]").addEventListener("click", (e) => {
    const row = e.target.closest("[data-edit]");
    if (row) openEditor(products.find((p) => p.id === row.dataset.edit));
  });

  // Pas de fermeture en touchant à côté : on ne perd pas une fiche en cours de saisie.
  const dlg = editor();
  $$("[data-editor-close]", dlg).forEach((b) => b.addEventListener("click", closeEditor));
  $("[data-photo-input]").addEventListener("change", onPhoto);
  $("[data-editor-form]").addEventListener("submit", save);
  $("[data-editor-delete]").addEventListener("click", remove);

  let saved = "";
  try {
    saved = sessionStorage.getItem(KEY) || "";
  } catch {}
  if (saved) login(saved);
}
