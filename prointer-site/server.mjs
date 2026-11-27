// Site PRO-INTER : pages statiques, inscription des candidats (avec CV), demandes des entreprises,
// et espace agence protégé par mot de passe pour consulter, télécharger et supprimer les envois.
// Node 20 ou plus, aucune dépendance. Lancement : ADMIN_PASSWORD="…" node server.mjs
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile, appendFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const env = process.env;
const DATA = path.resolve(env.DATA_DIR || path.join(ROOT, "data"));
const CAND = path.join(DATA, "candidatures"), ENTR = path.join(DATA, "entreprises.jsonl");
const ADMIN_USER = env.ADMIN_USER || "agence", ADMIN_PASSWORD = env.ADMIN_PASSWORD || "";
const RETENTION_DAYS = +(env.RETENTION_DAYS || 730);              // RGPD : 2 ans, puis suppression automatique
const RATE_MAX = +(env.RATE_MAX || 6), RATE_WINDOW = 10 * 60 * 1000;  // envois par adresse IP et par fenêtre de 10 min
const WEBHOOK = env.NOTIFY_WEBHOOK_URL || "";                   // facultatif : prévenir l'agence (Make, Zapier, n8n…)
const TRUST_PROXY = env.TRUST_PROXY === "1";
const MAX_FILE = 5 * 1024 * 1024, MAX_BODY = 12 * 1024 * 1024;

const CHOIX = {
  pays: ["Luxembourg", "France", "Belgique", "Allemagne", "Autre"],
  secteur: ["Bâtiment", "Industrie", "Tertiaire", "Autre"],
  contrats: ["Intérim", "CDD", "CDI"],
  agence: ["Esch-sur-Alzette", "Dudelange", "Mondorf-les-Bains", "Peu importe"],
  disponibilite: ["Immédiate", "Sous 1 mois", "Plus tard"],
  permis: ["Oui", "Non"],
  langues: ["Français", "Luxembourgeois", "Allemand", "Anglais", "Portugais"],
  contrat: ["Intérim", "CDD", "CDI", "À définir"],
};
const FICHIERS = [                                                // extension → signature (premiers octets du fichier)
  { ext: "pdf", sig: [0x25, 0x50, 0x44, 0x46] },                  // %PDF
  { ext: "docx", sig: [0x50, 0x4b, 0x03, 0x04] },                 // archive Office Open XML
  { ext: "doc", sig: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* ---------------- utilitaires ---------------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clean = (v, max = 200) => typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
const oneOf = (v, list) => list.includes(clean(v)) ? clean(v) : "";
const manyOf = (vs, list) => [...new Set(vs.map(v => clean(v)).filter(v => list.includes(v)))];
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/, PHONE = /^[+()0-9 .\-/]{6,25}$/;
const ID = /^\d{8}-\d{6}-[a-f0-9]{6}$/;
const newId = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15) + "-" + crypto.randomBytes(3).toString("hex");
const idDate = id => new Date(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T${id.slice(9, 11)}:${id.slice(11, 13)}:${id.slice(13, 15)}Z`);
const ipOf = req => (TRUST_PROXY && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
const wantsJson = req => String(req.headers.accept || "").includes("application/json");

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}
function json(res, status, obj) { send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); }

// réponse d'un formulaire : JSON pour le script de la page, page HTML si le navigateur envoie le formulaire sans JavaScript
function reply(req, res, status, obj) {
  if (wantsJson(req)) return json(res, status, obj);
  if (obj.ok) return send(res, 303, "", { Location: "/merci" });
  const items = Object.values(obj.errors || {}).concat(obj.errors ? [] : [obj.message]).map(m => `<li>${esc(m)}</li>`).join("");
  const back = req.url.startsWith("/api/entreprise") ? "/entreprises" : "/candidature";
  send(res, status, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Formulaire incomplet | PRO-INTER</title><link rel="stylesheet" href="/assets/css/style.css"></head>
<body><main class="section"><div class="container prose"><h1>Formulaire incomplet</h1><ul>${items}</ul><p><a class="btn btn--dark" href="${back}">Revenir au formulaire</a></p></div></main></body></html>`,
    { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
}

/* ---------------- limitation des envois ---------------- */
const hits = new Map();
function rateOk(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list); return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of hits) if (l.every(t => now - t >= RATE_WINDOW)) hits.delete(ip); }, RATE_WINDOW).unref();

/* ---------------- lecture des formulaires (multipart ou urlencoded), taille plafonnée ---------------- */
async function readForm(req) {
  const type = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data|^application\/x-www-form-urlencoded/i.test(type)) throw new HttpError(415, "Format d'envoi non pris en charge.");
  if (+req.headers["content-length"] > MAX_BODY) throw new HttpError(413, "Envoi trop lourd : 5 Mo maximum par fichier.");
  let size = 0, tooBig = false;
  const counter = new Transform({ transform(chunk, _enc, cb) { size += chunk.length; if (size > MAX_BODY) { tooBig = true; cb(new Error("trop lourd")); } else cb(null, chunk); } });
  req.on("error", e => counter.destroy(e));
  req.pipe(counter);
  try {
    return await new Request("http://local/", { method: "POST", headers: { "content-type": type }, body: Readable.toWeb(counter), duplex: "half" }).formData();
  } catch {
    req.unpipe(counter); req.resume();
    throw tooBig ? new HttpError(413, "Envoi trop lourd : 5 Mo maximum par fichier.") : new HttpError(400, "Formulaire illisible, merci de réessayer.");
  }
}

async function checkFile(f, label, required) {
  if (!f || typeof f === "string" || f.size === 0) return required ? `Ajoutez votre ${label} (PDF, DOC ou DOCX).` : "";
  if (f.size > MAX_FILE) return `${label[0].toUpperCase() + label.slice(1)} trop lourd : 5 Mo maximum.`;
  const ext = path.extname(f.name || "").slice(1).toLowerCase();
  const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
  return FICHIERS.some(k => k.ext === ext && k.sig.every((b, i) => head[i] === b)) ? "" : "Format accepté : PDF, DOC ou DOCX.";
}
const fileExt = f => path.extname(f.name).slice(1).toLowerCase();

function notify(payload) {
  if (!WEBHOOK) return;
  fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) })
    .catch(e => console.error("webhook :", e.message));
}

/* ---------------- candidature ---------------- */
async function candidature(req, res) {
  if (!rateOk(ipOf(req))) return reply(req, res, 429, { ok: false, message: "Trop d'envois depuis votre connexion. Réessayez dans quelques minutes." });
  const fd = await readForm(req);
  if (clean(fd.get("site_web"))) return reply(req, res, 201, { ok: true });   // piège à robots : on fait comme si tout allait bien
  const c = {
    prenom: clean(fd.get("prenom"), 80), nom: clean(fd.get("nom"), 80), email: clean(fd.get("email"), 160).toLowerCase(), telephone: clean(fd.get("telephone"), 30),
    ville: clean(fd.get("ville"), 80), pays: oneOf(fd.get("pays"), CHOIX.pays), metier: clean(fd.get("metier"), 120), secteur: oneOf(fd.get("secteur"), CHOIX.secteur),
    contrats: manyOf(fd.getAll("contrats"), CHOIX.contrats), agence: oneOf(fd.get("agence"), CHOIX.agence), disponibilite: oneOf(fd.get("disponibilite"), CHOIX.disponibilite),
    permis: oneOf(fd.get("permis"), CHOIX.permis), langues: manyOf(fd.getAll("langues"), CHOIX.langues), message: clean(fd.get("message"), 2000),
  };
  const errors = {};
  if (!c.prenom) errors.prenom = "Indiquez votre prénom.";
  if (!c.nom) errors.nom = "Indiquez votre nom.";
  if (!EMAIL.test(c.email)) errors.email = "Adresse e-mail invalide (exemple : vous@exemple.com).";
  if (!PHONE.test(c.telephone)) errors.telephone = "Numéro de téléphone invalide.";
  if (!c.metier) errors.metier = "Indiquez le métier recherché.";
  if (fd.get("consentement") !== "oui") errors.consentement = "Votre accord est nécessaire pour envoyer le formulaire.";
  const cv = fd.get("cv"), lettre = fd.get("lettre");
  const e1 = await checkFile(cv, "CV", true), e2 = await checkFile(lettre, "lettre de motivation", false);
  if (e1) errors.cv = e1;
  if (e2) errors.lettre = e2;
  if (Object.keys(errors).length) return reply(req, res, 422, { ok: false, errors });

  const id = newId(), dir = path.join(CAND, id), fichiers = {};
  await mkdir(dir, { recursive: true });
  for (const [key, f] of [["cv", cv], ["lettre", lettre]]) {
    if (!f || typeof f === "string" || !f.size) continue;
    const name = `${key}.${fileExt(f)}`;
    await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
    fichiers[key] = { fichier: name, nom_original: clean(f.name, 150), taille: f.size };
  }
  const recue = new Date().toISOString();
  await writeFile(path.join(dir, "candidature.json"), JSON.stringify({ id, recue_le: recue, ...c, fichiers, consentement: { accepte: true, le: recue } }, null, 2));
  console.log(`candidature reçue ${id}`);
  notify({ type: "candidature", id, recue_le: recue, nom: `${c.prenom} ${c.nom}`, metier: c.metier, agence: c.agence || "Peu importe" });
  return reply(req, res, 201, { ok: true, id });
}

/* ---------------- demande entreprise ---------------- */
async function entreprise(req, res) {
  if (!rateOk(ipOf(req))) return reply(req, res, 429, { ok: false, message: "Trop d'envois depuis votre connexion. Réessayez dans quelques minutes." });
  const fd = await readForm(req);
  if (clean(fd.get("site_web"))) return reply(req, res, 201, { ok: true });
  const d = {
    entreprise: clean(fd.get("entreprise"), 120), contact: clean(fd.get("contact"), 120), fonction: clean(fd.get("fonction"), 120), telephone: clean(fd.get("telephone"), 30),
    email: clean(fd.get("email"), 160).toLowerCase(), besoin: clean(fd.get("besoin"), 200), contrat: oneOf(fd.get("contrat"), CHOIX.contrat),
    agence: oneOf(fd.get("agence"), CHOIX.agence), message: clean(fd.get("message"), 2000),
  };
  const errors = {};
  if (!d.entreprise) errors.entreprise = "Indiquez le nom de l'entreprise.";
  if (!d.contact) errors.contact = "Indiquez une personne de contact.";
  if (!PHONE.test(d.telephone)) errors.telephone = "Numéro de téléphone invalide.";
  if (!EMAIL.test(d.email)) errors.email = "Adresse e-mail invalide.";
  if (!d.besoin) errors.besoin = "Décrivez le profil recherché.";
  if (fd.get("consentement") !== "oui") errors.consentement = "Votre accord est nécessaire pour envoyer le formulaire.";
  if (Object.keys(errors).length) return reply(req, res, 422, { ok: false, errors });
  const id = newId(), recue = new Date().toISOString();
  await mkdir(DATA, { recursive: true });
  await appendFile(ENTR, JSON.stringify({ id, recue_le: recue, ...d }) + "\n");
  console.log(`demande entreprise reçue ${id}`);
  notify({ type: "entreprise", id, recue_le: recue, entreprise: d.entreprise, besoin: d.besoin, agence: d.agence || "Peu importe" });
  return reply(req, res, 201, { ok: true, id });
}

/* ---------------- données enregistrées ---------------- */
async function listCandidatures() {
  let ids = [];
  try { ids = (await readdir(CAND)).filter(n => ID.test(n)); } catch { return []; }
  const out = [];
  for (const id of ids) { try { out.push(JSON.parse(await readFile(path.join(CAND, id, "candidature.json"), "utf8"))); } catch { /* dossier incomplet */ } }
  return out.sort((a, b) => b.id.localeCompare(a.id));
}
async function listEntreprises() {
  let txt = "";
  try { txt = await readFile(ENTR, "utf8"); } catch { return []; }
  return txt.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).sort((a, b) => b.id.localeCompare(a.id));
}
async function saveEntreprises(list) { await writeFile(ENTR, list.map(d => JSON.stringify(d)).join("\n") + (list.length ? "\n" : "")); }

// suppression automatique au-delà de la durée de conservation
async function purge() {
  const limit = Date.now() - RETENTION_DAYS * 864e5;
  for (const c of await listCandidatures()) if (idDate(c.id) < limit) await rm(path.join(CAND, c.id), { recursive: true, force: true });
  const ent = await listEntreprises(), keep = ent.filter(d => idDate(d.id) >= limit);
  if (keep.length !== ent.length) await saveEntreprises(keep);
}

/* ---------------- espace agence ---------------- */
function authorized(req) {
  const m = /^Basic (.+)$/.exec(String(req.headers.authorization || ""));
  if (!m) return false;
  const given = crypto.createHash("sha256").update(Buffer.from(m[1], "base64").toString()).digest();
  const wanted = crypto.createHash("sha256").update(`${ADMIN_USER}:${ADMIN_PASSWORD}`).digest();
  return crypto.timingSafeEqual(given, wanted);
}
function sameOrigin(req) {
  const o = req.headers.origin || req.headers.referer || "";
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
const ADMIN_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const date = iso => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Luxembourg", dateStyle: "short", timeStyle: "short" });

async function admin(req, res, url) {
  if (!ADMIN_PASSWORD) return send(res, 503, "Espace agence désactivé : définissez la variable ADMIN_PASSWORD.", { "Content-Type": "text/plain; charset=utf-8", ...ADMIN_HEADERS });
  if (!authorized(req)) return send(res, 401, "Accès réservé aux agences PRO-INTER.", { "WWW-Authenticate": 'Basic realm="Espace agence PRO-INTER", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8", ...ADMIN_HEADERS });
  const parts = url.pathname.split("/").filter(Boolean);              // ["admin", …]

  if (req.method === "POST") {
    if (!sameOrigin(req)) throw new HttpError(403, "Requête refusée.");
    const [, action, kind, id] = parts;
    if (action !== "supprimer" || !ID.test(id || "")) throw new HttpError(404, "Introuvable.");
    if (kind === "candidature") await rm(path.join(CAND, id), { recursive: true, force: true });
    else if (kind === "entreprise") await saveEntreprises((await listEntreprises()).filter(d => d.id !== id));
    else throw new HttpError(404, "Introuvable.");
    return send(res, 303, "", { Location: "/admin", ...ADMIN_HEADERS });
  }

  if (parts[1] === "fichier") {                                       // /admin/fichier/<id>/<cv.pdf>
    const [, , id, name] = parts;
    if (!ID.test(id || "") || !/^(cv|lettre)\.(pdf|docx?)$/.test(name || "")) throw new HttpError(404, "Introuvable.");
    const file = path.join(CAND, id, name);
    let c; try { c = JSON.parse(await readFile(path.join(CAND, id, "candidature.json"), "utf8")); await stat(file); } catch { throw new HttpError(404, "Introuvable."); }
    const nice = `${name.split(".")[0] === "cv" ? "CV" : "Lettre"}-${c.prenom}-${c.nom}`.normalize("NFD").replace(/[^\w-]+/g, "") + path.extname(name);
    res.writeHead(200, { ...SECURITY, ...ADMIN_HEADERS, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${nice}"` });
    return createReadStream(file).pipe(res);
  }

  const cands = await listCandidatures(), ents = await listEntreprises();
  if (parts[1] === "candidatures.csv") {
    const cols = ["id", "recue_le", "prenom", "nom", "email", "telephone", "ville", "pays", "metier", "secteur", "contrats", "agence", "disponibilite", "permis", "langues", "message"];
    const cell = v => { let s = Array.isArray(v) ? v.join(", ") : String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const csv = "﻿" + [cols.join(";"), ...cands.map(c => cols.map(k => cell(c[k])).join(";"))].join("\r\n");
    return send(res, 200, csv, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="candidatures.csv"', ...ADMIN_HEADERS });
  }
  if (parts.length > 1) throw new HttpError(404, "Introuvable.");

  const filtre = oneOf(url.searchParams.get("agence"), CHOIX.agence);
  const shown = filtre ? cands.filter(c => c.agence === filtre || c.agence === "Peu importe" || !c.agence) : cands;
  const del = (kind, id, label) => `<form method="post" action="/admin/supprimer/${kind}/${id}" data-confirm="Supprimer ${esc(label)} ? Cette action est définitive."><button class="link-danger" type="submit">Supprimer</button></form>`;
  const file = (c, k) => c.fichiers?.[k] ? `<a href="/admin/fichier/${c.id}/${esc(c.fichiers[k].fichier)}">${k === "cv" ? "CV" : "Lettre"} (${Math.max(1, Math.round(c.fichiers[k].taille / 1024))} Ko)</a>` : "";
  const rows = shown.map(c => `<tr>
    <td>${esc(date(c.recue_le))}</td>
    <td><strong>${esc(c.prenom)} ${esc(c.nom)}</strong><br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br><a href="tel:${esc(c.telephone.replace(/[^+0-9]/g, ""))}">${esc(c.telephone)}</a></td>
    <td><strong>${esc(c.metier)}</strong>${c.secteur ? `<br>${esc(c.secteur)}` : ""}${c.contrats?.length ? `<br>${esc(c.contrats.join(", "))}` : ""}</td>
    <td>${esc(c.agence || "Peu importe")}<br>${esc([c.ville, c.pays].filter(Boolean).join(", "))}</td>
    <td>${esc(c.disponibilite)}${c.permis ? `<br>Permis B : ${esc(c.permis)}` : ""}${c.langues?.length ? `<br>${esc(c.langues.join(", "))}` : ""}</td>
    <td>${file(c, "cv")}${c.fichiers?.lettre ? "<br>" + file(c, "lettre") : ""}</td>
    <td>${c.message ? `<details><summary>Lire</summary><p>${esc(c.message)}</p></details>` : ""}</td>
    <td>${del("candidature", c.id, `la candidature de ${c.prenom} ${c.nom}`)}</td></tr>`).join("");
  const erows = ents.map(d => `<tr>
    <td>${esc(date(d.recue_le))}</td>
    <td><strong>${esc(d.entreprise)}</strong><br>${esc(d.contact)}${d.fonction ? `, ${esc(d.fonction)}` : ""}</td>
    <td><a href="mailto:${esc(d.email)}">${esc(d.email)}</a><br><a href="tel:${esc(d.telephone.replace(/[^+0-9]/g, ""))}">${esc(d.telephone)}</a></td>
    <td><strong>${esc(d.besoin)}</strong>${d.contrat ? `<br>${esc(d.contrat)}` : ""}</td>
    <td>${esc(d.agence || "Peu importe")}</td>
    <td>${d.message ? `<details><summary>Lire</summary><p>${esc(d.message)}</p></details>` : ""}</td>
    <td>${del("entreprise", d.id, `la demande de ${d.entreprise}`)}</td></tr>`).join("");
  const tabs = ["", ...CHOIX.agence.slice(0, 3)].map(a => `<a href="/admin${a ? `?agence=${encodeURIComponent(a)}` : ""}"${a === filtre ? ' aria-current="page"' : ""}>${a || "Toutes les agences"}</a>`).join("");
  send(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Espace agence | PRO-INTER</title><link rel="icon" href="/assets/img/favicon.svg"><link rel="stylesheet" href="/assets/css/style.css"><link rel="stylesheet" href="/assets/css/admin.css"><script src="/assets/js/admin.js" defer></script></head>
<body class="admin"><header class="admin-head"><img src="/assets/img/logo-clair.svg" alt="PRO-INTER" width="140" height="37"><span>Espace agence</span></header>
<main class="admin-main">
<section><div class="admin-title"><h1>Candidatures <span>${shown.length}</span></h1><a class="btn btn--sm" href="/admin/candidatures.csv">Exporter (CSV)</a></div>
<nav class="admin-tabs" aria-label="Filtrer par agence">${tabs}</nav>
${rows ? `<div class="table-wrap"><table><thead><tr><th>Reçue le</th><th>Candidat</th><th>Recherche</th><th>Agence · lieu</th><th>Profil</th><th>Fichiers</th><th>Message</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">Aucune candidature pour le moment.</p>`}</section>
<section><div class="admin-title"><h1>Demandes des entreprises <span>${ents.length}</span></h1></div>
${erows ? `<div class="table-wrap"><table><thead><tr><th>Reçue le</th><th>Entreprise</th><th>Contact</th><th>Besoin</th><th>Agence</th><th>Message</th><th></th></tr></thead><tbody>${erows}</tbody></table></div>` : `<p class="empty">Aucune demande pour le moment.</p>`}</section>
<p class="admin-note">Les envois sont supprimés automatiquement ${RETENTION_DAYS} jours après leur réception (RGPD). Un candidat qui demande la suppression de ses données : bouton « Supprimer ».</p>
</main></body></html>`, { "Content-Type": "text/html; charset=utf-8", ...ADMIN_HEADERS });
}

/* ---------------- fichiers statiques (avec requêtes partielles pour la vidéo) ---------------- */
async function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, "Adresse invalide."); }
  if (p.includes("\0")) throw new HttpError(400, "Adresse invalide.");
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC + path.sep)) throw new HttpError(404, "Introuvable.");
  let st = await stat(file).catch(() => null);
  if ((!st || st.isDirectory()) && !path.extname(file)) { file += ".html"; st = await stat(file).catch(() => null); }   // adresses propres : /candidature
  if (!st || !st.isFile()) {
    const page = await readFile(path.join(PUBLIC, "404.html")).catch(() => "Introuvable.");
    return send(res, 404, page, { "Content-Type": "text/html; charset=utf-8" });
  }
  const ext = path.extname(file).toLowerCase();
  const headers = { ...SECURITY, "Content-Type": MIME[ext] || "application/octet-stream", "Accept-Ranges": "bytes",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? +range[1] : st.size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
    if (start < 0) start = 0;
    if (start > end || start >= st.size) { res.writeHead(416, { ...headers, "Content-Range": `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    return req.method === "HEAD" ? res.end() : createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "Content-Length": st.size });
  return req.method === "HEAD" ? res.end() : createReadStream(file).pipe(res);
}

/* ---------------- aiguillage ---------------- */
export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://local");
    try {
      if (url.pathname === "/api/candidature" || url.pathname === "/api/entreprise") {
        if (req.method !== "POST") throw new HttpError(405, "Méthode non autorisée.");
        return await (url.pathname === "/api/candidature" ? candidature : entreprise)(req, res);
      }
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return await admin(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Méthode non autorisée.");
      return await serveStatic(req, res, url);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (res.headersSent) return res.destroy();
      if (url.pathname.startsWith("/api/")) return reply(req, res, status, { ok: false, message: status === 500 ? "Erreur du serveur, merci de réessayer." : e.message });
      send(res, status, status === 500 ? "Erreur du serveur." : e.message, { "Content-Type": "text/plain; charset=utf-8" });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(CAND, { recursive: true });
  await purge();
  setInterval(() => purge().catch(e => console.error("purge :", e)), 864e5).unref();
  createServer().listen(+(env.PORT || 8080), () => {
    console.log(`Site PRO-INTER : http://localhost:${env.PORT || 8080}`);
    if (!ADMIN_PASSWORD) console.log("Espace agence désactivé : définissez ADMIN_PASSWORD pour l'activer.");
  });
}
