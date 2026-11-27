// Tests du serveur : node --test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA = await mkdtemp(path.join(tmpdir(), "prointer-"));
Object.assign(process.env, { DATA_DIR: DATA, ADMIN_USER: "agence", ADMIN_PASSWORD: "secret-test", RATE_MAX: "1000" });
const { createServer } = await import("../server.mjs");
let server, base;
before(() => new Promise(ok => { server = createServer().listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); }); }));
after(async () => { server.close(); await rm(DATA, { recursive: true, force: true }); });

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const AUTH = { Authorization: "Basic " + Buffer.from("agence:secret-test").toString("base64") };
function candidat(over = {}) {
  const fd = new FormData();
  const v = { prenom: "Jeanne", nom: "Martin", email: "jeanne@example.com", telephone: "+352 621 000 000", metier: "Électricienne", agence: "Esch-sur-Alzette", consentement: "oui", ...over };
  for (const [k, x] of Object.entries(v)) if (x !== undefined && k !== "cv") fd.append(k, x);
  fd.append("contrats", "Intérim"); fd.append("contrats", "CDI"); fd.append("contrats", "Pirate");
  if (over.cv !== null) fd.append("cv", over.cv || new Blob([PDF], { type: "application/pdf" }), over.cvName || "mon-cv.pdf");
  return fd;
}
const post = (p, body, headers = { Accept: "application/json" }) => fetch(base + p, { method: "POST", body, headers });
const dossiers = async () => { try { return await readdir(path.join(DATA, "candidatures")); } catch { return []; } };

test("les pages s'affichent, avec les en-têtes de sécurité", async () => {
  for (const p of ["/", "/candidature", "/entreprises", "/confidentialite", "/mentions-legales"]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-type"), /text\/html/);
    assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  }
  assert.equal((await fetch(base + "/nexiste-pas")).status, 404);
});

test("impossible de lire un fichier hors du dossier public", async () => {
  for (const p of ["/../server.mjs", "/%2e%2e/server.mjs", "/..%2fserver.mjs", "/assets/../../server.mjs"]) {
    const r = await fetch(base + p);
    assert.notEqual(r.status, 200, p);
    assert.doesNotMatch(await r.text(), /createServer/, p);
  }
});

test("la vidéo répond aux requêtes partielles (lecture sur iPhone)", async () => {
  const r = await fetch(base + "/assets/video/viseur.mp4", { headers: { Range: "bytes=0-99" } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  assert.match(r.headers.get("content-range"), /^bytes 0-99\/\d+$/);
});

test("une candidature complète est enregistrée avec son CV", async () => {
  const r = await post("/api/candidature", candidat());
  assert.equal(r.status, 201);
  const { ok, id } = await r.json();
  assert.ok(ok); assert.match(id, /^\d{8}-\d{6}-[a-f0-9]{6}$/);
  const dir = path.join(DATA, "candidatures", id);
  assert.deepEqual((await readdir(dir)).sort(), ["candidature.json", "cv.pdf"]);
  const c = JSON.parse(await readFile(path.join(dir, "candidature.json"), "utf8"));
  assert.equal(c.prenom, "Jeanne"); assert.equal(c.agence, "Esch-sur-Alzette");
  assert.deepEqual(c.contrats, ["Intérim", "CDI"]);                     // la valeur inconnue est écartée
  assert.equal(c.fichiers.cv.nom_original, "mon-cv.pdf");
  assert.deepEqual(new Uint8Array(await readFile(path.join(dir, "cv.pdf"))), PDF);
});

test("un faux PDF est refusé", async () => {
  const avant = (await dossiers()).length;
  const r = await post("/api/candidature", candidat({ cv: new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0])]), cvName: "cv.pdf" }));
  assert.equal(r.status, 422);
  assert.match((await r.json()).errors.cv, /PDF, DOC ou DOCX/);
  assert.equal((await dossiers()).length, avant);
});

test("un CV de plus de 5 Mo est refusé, un envoi de plus de 12 Mo aussi", async () => {
  const r1 = await post("/api/candidature", candidat({ cv: new Blob([PDF, new Uint8Array(5.5 * 1024 * 1024)]) }));
  assert.equal(r1.status, 422);
  assert.match((await r1.json()).errors.cv, /5 Mo/);
  const r2 = await post("/api/candidature", candidat({ cv: new Blob([PDF, new Uint8Array(13 * 1024 * 1024)]) }));
  assert.equal(r2.status, 413);
});

test("champs obligatoires, e-mail et accord RGPD vérifiés", async () => {
  const r = await post("/api/candidature", candidat({ prenom: "", email: "pas-un-email", consentement: undefined, cv: null }));
  assert.equal(r.status, 422);
  const { errors } = await r.json();
  assert.deepEqual(Object.keys(errors).sort(), ["consentement", "cv", "email", "prenom"]);
});

test("le piège à robots ne crée rien", async () => {
  const avant = (await dossiers()).length;
  const r = await post("/api/candidature", candidat({ site_web: "http://spam.example" }));
  assert.equal(r.status, 201);
  assert.equal((await dossiers()).length, avant);
});

test("sans JavaScript, le navigateur est redirigé vers la page de remerciement", async () => {
  const r = await fetch(base + "/api/candidature", { method: "POST", body: candidat(), redirect: "manual" });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/merci");
});

test("une demande d'entreprise est enregistrée", async () => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ entreprise: "Bâti Lux", contact: "Paul Weber", telephone: "26 00 00 00", email: "paul@batilux.lu", besoin: "2 électriciens", agence: "Dudelange", consentement: "oui" })) fd.append(k, v);
  const r = await post("/api/entreprise", fd);
  assert.equal(r.status, 201);
  const lines = (await readFile(path.join(DATA, "entreprises.jsonl"), "utf8")).trim().split("\n");
  assert.equal(JSON.parse(lines.at(-1)).entreprise, "Bâti Lux");
});

test("l'espace agence est protégé et n'exécute pas le texte des candidats", async () => {
  assert.equal((await fetch(base + "/admin")).status, 401);
  assert.equal((await fetch(base + "/admin", { headers: { Authorization: "Basic " + Buffer.from("agence:faux").toString("base64") } })).status, 401);
  await post("/api/candidature", candidat({ prenom: "<script>alert(1)</script>" }));
  const r = await fetch(base + "/admin", { headers: AUTH });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.match(html, /Bâti Lux/);
  const csv = await fetch(base + "/admin/candidatures.csv", { headers: AUTH });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /Jeanne/);
});

test("téléchargement d'un CV et suppression d'une candidature", async () => {
  const { id } = await (await post("/api/candidature", candidat({ prenom: "Luc" }))).json();
  const f = await fetch(`${base}/admin/fichier/${id}/cv.pdf`, { headers: AUTH });
  assert.equal(f.status, 200);
  assert.match(f.headers.get("content-disposition"), /attachment; filename="CV-Luc-Martin\.pdf"/);
  assert.equal((await fetch(`${base}/admin/fichier/${id}/..%2f..%2fserver.mjs`, { headers: AUTH })).status, 404);
  const sansOrigine = await fetch(`${base}/admin/supprimer/candidature/${id}`, { method: "POST", headers: AUTH, redirect: "manual" });
  assert.equal(sansOrigine.status, 403);
  const ok = await fetch(`${base}/admin/supprimer/candidature/${id}`, { method: "POST", headers: { ...AUTH, Origin: base }, redirect: "manual" });
  assert.equal(ok.status, 303);
  assert.ok(!(await dossiers()).includes(id));
});
