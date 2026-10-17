// Exporte une composition HTML (qui expose window.render(t)) en MP4 1080×1920.
// Usage : node motion/export.js <index.html> <sortie.mp4> [durée] [fps]
//         node motion/export.js <index.html> <dossier> --stills 0.5,3,7   (images fixes de contrôle)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const [src, out, a3, a4] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve(src) + '?export');
  await page.evaluate(() => document.fonts.ready);

  if (a3 === '--stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of a4.split(',').map(Number)) {
      await page.evaluate(t => render(t), t);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2)}.jpg`), quality: 85, type: 'jpeg' });
    }
    await browser.close();
    return;
  }

  const duration = Number(a3 || 25), fps = Number(a4 || 30);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => render(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`image ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('OK ->', out);
})();
