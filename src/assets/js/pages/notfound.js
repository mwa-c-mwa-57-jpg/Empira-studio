// Page 404 « signal perdu » : neige d'écran TV animée.
import { $, reducedMotion } from "../utils.js";

export function init() {
  const canvas = $("[data-static]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = (canvas.width = 240);
  const h = (canvas.height = 135);
  const img = ctx.createImageData(w, h);
  const frame = () => {
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 60;
      img.data[i] = v * 0.9;
      img.data[i + 1] = v * 0.8;
      img.data[i + 2] = v * 1.2;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  frame();
  if (reducedMotion()) return;
  let last = 0;
  const loop = (now) => {
    if (now - last > 60) {
      frame();
      last = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
