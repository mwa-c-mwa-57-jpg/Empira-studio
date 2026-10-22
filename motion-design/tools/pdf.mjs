// Export PDF d'une page HTML (A4, marges de la page CSS) : node tools/pdf.mjs page.html sortie.pdf
import { chromium } from "playwright";
import path from "node:path";
const [src, out] = process.argv.slice(2).map(p => path.resolve(p));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + src, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log("PDF →", out);
