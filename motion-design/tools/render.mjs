// Rendu image par image : node tools/render.mjs [--fps 30] [--stills 1,5.5,12] [--out out/video.mp4] [--from 0 --to 30] [--query grain=0.03]
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
const AR = args.ar || "9x16", VW = AR === "16x9" ? 1920 : 1080, VH = AR === "16x9" ? 1080 : 1920;
const PAGE = args.page || "index.html", URL_Q = `${PAGE}?render&ar=${AR}${args.query ? "&" + args.query : ""}`;   // --query grain=0.03 : paramètres en plus

const MIME = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".wav": "audio/wav", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(data); });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
page.on("pageerror", e => console.error("PAGE ERROR", e.message));
await page.goto(`http://localhost:${port}/${URL_Q}`);
await page.evaluate(() => window.ready);
const stage = await page.$("#stage");

if (args.stills) {
  fs.mkdirSync(path.join(ROOT, "out/stills"), { recursive: true });
  for (const t of args.stills.split(",").map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await stage.screenshot({ path: path.join(ROOT, `out/stills/${PAGE.replace(".html", "")}-${AR}-t${t.toFixed(2).padStart(5, "0")}.png`) });
  }
} else {
  // rendu parallèle : N pages (processus de rendu distincts), chacune encode un segment, puis concaténation
  const from = +(args.from || 0), to = +(args.to || 30), WORKERS = +(args.workers || 1);
  const n = Math.round((to - from) * FPS), per = Math.ceil(n / WORKERS), t0 = Date.now();
  const tmp = path.join(ROOT, "out/.chunks-" + PAGE.replace(".html", "") + "-" + AR); fs.mkdirSync(tmp, { recursive: true });
  let done = 0;
  const work = async (w) => {
    const pg = w === 0 ? page : await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
    if (w) { pg.on("pageerror", e => console.error("PAGE ERROR", e.message)); await pg.goto(`http://localhost:${port}/${URL_Q}`); await pg.evaluate(() => window.ready); }
    const st = await pg.$("#stage"), a = w * per, b = Math.min(n, a + per), file = path.join(tmp, `c${w}.mp4`);
    const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", "13", "-pix_fmt", "yuv420p", file], { stdio: ["pipe", "ignore", "ignore"] });
    for (let i = a; i < b; i++) {
      await pg.evaluate(t => window.seek(t), from + i / FPS);
      const buf = await st.screenshot({ type: "jpeg", quality: 96 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (++done % 60 === 0) process.stdout.write(`frame ${done}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
    ff.stdin.end(); await new Promise(r => ff.on("close", r));
    return file;
  };
  const files = await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)));
  fs.writeFileSync(path.join(tmp, "list.txt"), files.map(f => `file '${f}'`).join("\n"));
  await new Promise(r => spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"), "-c", "copy", "-movflags", "+faststart", OUT], { stdio: "ignore" }).on("close", r));
  console.log("OK →", OUT, ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
await browser.close();
server.close();
