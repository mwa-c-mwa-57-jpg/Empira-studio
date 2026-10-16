// Serveur local : `npm run dev` puis http://localhost:8080
// Reproduit le comportement de l'hébergeur : en-têtes de sécurité de _headers,
// URL sans .html, page 404 et fonction de paiement /api/checkout.
// Pour tester un vrai paiement en mode test : STRIPE_SECRET_KEY=sk_test_... npm run dev

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { handleCheckout } from "../server/checkout.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const port = Number(process.env.PORT) || 8080;

execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "inherit" });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

// En-têtes déclarés pour "/*" dans _headers (les mêmes qu'en production).
function globalHeaders() {
  const file = join(dist, "_headers");
  if (!existsSync(file)) return {};
  const headers = {};
  let inGlobal = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobal = line.trim() === "/*";
      continue;
    }
    const i = line.indexOf(":");
    if (inGlobal && i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  // Pas de HTTPS en local : on retire ce qui l'impose.
  delete headers["Strict-Transport-Security"];
  if (headers["Content-Security-Policy"]) {
    headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");
  }
  return headers;
}
const securityHeaders = globalHeaders();

function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [clean, `${clean}.html`, join(clean, "index.html")];
  for (const c of candidates) {
    const full = join(dist, c);
    if (full.startsWith(dist) && existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/checkout") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
    });
    const response = await handleCheckout(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }

  const file = resolveFile(url.pathname === "/" ? "/index.html" : url.pathname);
  const status = file ? 200 : 404;
  const target = file || join(dist, "404.html");
  res.writeHead(status, {
    ...securityHeaders,
    "content-type": TYPES[extname(target)] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  res.end(readFileSync(target));
}).listen(port, () => {
  console.log(`\n  Empira Studio en local : http://localhost:${port}\n`);
  if (!process.env.STRIPE_SECRET_KEY) console.log("  (paiement en mode démo : STRIPE_SECRET_KEY non défini)\n");
});
