// Rendu image par image : node tools/render.mjs [--fps 30] [--stills 1,5.5,12] [--out out/video.mp4] [--from 0 --to 30]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") && a.push([v.slice(2), arr[i + 1]]), a), []));
const FPS = +(args.fps || 30);
const OUT = path.resolve(ROOT, args.out || "out/empira-video-silent.mp4");

const MIME = { ".html": "text/html", ".png": "image/png", ".woff2": "font/woff2", ".wav": "audio/wav", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(data); });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", e => console.error("PAGE ERROR", e.message));
await page.goto(`http://localhost:${port}/index.html?render`);
await page.evaluate(() => window.ready);
const stage = await page.$("#stage");

if (args.stills) {
  fs.mkdirSync(path.join(ROOT, "out/stills"), { recursive: true });
  for (const t of args.stills.split(",").map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await stage.screenshot({ path: path.join(ROOT, `out/stills/t${t.toFixed(2).padStart(5, "0")}.png`) });
  }
} else {
  const from = +(args.from || 0), to = +(args.to || 30);
  const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], { stdio: ["pipe", "ignore", "inherit"] });
  const n = Math.round((to - from) * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = from + i / FPS;
    await page.evaluate(t => window.seek(t), t);
    const buf = await stage.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  console.log("OK →", OUT);
}
await browser.close();
server.close();
