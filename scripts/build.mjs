// Génère le site statique dans dist/ à partir de src/.
//
// - src/pages/*.html   : les pages. Un commentaire en tête définit le titre,
//                        la description et l'apparition dans le sitemap.
// - src/partials/*.html: blocs communs ({{> header}}, {{> footer}}…).
// - src/public/        : fichiers copiés à la racine (_headers, robots.txt…).
// - src/assets/        : CSS, JS, images, vidéos, polices.
// - site.config.json   : nom de domaine et coordonnées, injectés partout.
//
// Aucune dépendance : `node scripts/build.mjs` suffit.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const out = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
const siteUrl = config.siteUrl.replace(/\/$/, "");

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function readMeta(html) {
  const match = html.match(/^<!--([\s\S]*?)-->\s*/);
  const meta = {};
  if (!match) return { meta, body: html };
  for (const line of match[1].split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, body: html.slice(match[0].length) };
}

const partials = Object.fromEntries(
  readdirSync(join(src, "partials"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => [basename(f, ".html"), readFileSync(join(src, "partials", f), "utf8")]),
);

function render(template, vars, depth = 0) {
  if (depth > 5) throw new Error("Inclusions de partials trop profondes");
  return template
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Partial introuvable : ${name}`);
      return render(partials[name], vars, depth + 1);
    })
    .replace(/\{\{current:([\w-]+)\}\}/g, (_, key) => (vars.nav === key ? 'aria-current="page"' : ""))
    .replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
      if (!(key in vars)) throw new Error(`Variable inconnue : {{${key}}} (${vars.file})`);
      return vars[key];
    });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, "assets"), join(out, "assets"), { recursive: true });

const common = {
  siteUrl,
  siteHost: new URL(siteUrl).host,
  name: config.name,
  agencyName: config.agencyName,
  email: config.email,
  phone: config.phone,
  instagram: config.instagram,
  tiktok: config.tiktok,
  tiktokLabel: config.tiktokHandle ? `@${config.tiktokHandle.replace(/^@/, "")}` : "Empira Agency",
  twitch: config.twitch,
  youtube: config.youtube,
  year: String(new Date().getFullYear()),
};

const sitemap = [];
for (const file of readdirSync(join(src, "pages")).filter((f) => f.endsWith(".html")).sort()) {
  const { meta, body } = readMeta(readFileSync(join(src, "pages", file), "utf8"));
  const slug = basename(file, ".html");
  const path = slug === "index" ? "/" : `/${slug}.html`;
  const vars = {
    ...common,
    file,
    page: slug,
    nav: meta.nav || slug,
    title: escapeAttr(meta.title || config.name),
    description: escapeAttr(meta.description || config.tagline),
    canonical: `${siteUrl}${path}`,
    ogImage: `${siteUrl}/assets/img/og-image.jpg`,
    robots: meta.sitemap === "no" ? "noindex, follow" : "index, follow",
    base: slug === "404" ? '<base href="/">' : "",
  };
  writeFileSync(join(out, file), render(body, vars));
  if (meta.sitemap !== "no") sitemap.push({ loc: `${siteUrl}${path}`, priority: meta.priority || "0.6" });
}

const publicDir = join(src, "public");
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    const content = readFileSync(join(publicDir, file), "utf8");
    writeFileSync(join(out, file), content.replace(/\{\{siteUrl\}\}/g, siteUrl).replace(/\{\{siteHost\}\}/g, common.siteHost));
  }
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`)
    .join("\n")}\n</urlset>\n`,
);

console.log(`✓ Site généré dans dist/ (${sitemap.length} pages indexables) pour ${siteUrl}`);
