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
    // les images sont écrites sur disque (reprise possible), puis assemblées avec le son
    const fps = Number(a3 || 30), dur = await page.evaluate(() => window.DURATION), frames = Math.round(dur * fps);
    const dir = path.join(path.dirname(out), 'frames'); fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < frames; i++) {
      const f = path.join(dir, `${String(i).padStart(4, '0')}.jpg`);
      if (fs.existsSync(f)) continue;
      await page.evaluate(t => window.renderAt(t), i / fps);
      fs.writeFileSync(f, await shot());
      if (i % 30 === 0) console.log(`image ${i}/${frames}`);
    }
    const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%04d.jpg')];
    if (a4) args.push('-i', a4, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
    await new Promise(r => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', r));
    console.log('OK ->', out);
  }
  await browser.close();
})();
