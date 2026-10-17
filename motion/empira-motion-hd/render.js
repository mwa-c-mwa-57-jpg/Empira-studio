// Rendu du plan-séquence 3D (three.js / WebGL logiciel) en images ou en MP4.
// node render.js stills <dossier> 0,2.4,3.75      → images de contrôle
// node render.js video <sortie.mp4> [fps] [audio.wav]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const [mode, out, a3, a4] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.log('ERREUR page :', e.message));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const shot = () => page.screenshot({ type: 'jpeg', quality: 95 });

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of a3.split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      fs.writeFileSync(path.join(out, `t${t.toFixed(2)}.jpg`), await shot());
    }
  } else {
    const fps = Number(a3 || 30), dur = await page.evaluate(() => window.DURATION), frames = Math.round(dur * fps);
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
    if (a4) args.push('-i', a4, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.renderAt(t), i / fps);
      const buf = await shot();
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(`image ${i}/${frames}`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log('OK ->', out);
  }
  await browser.close();
})();
