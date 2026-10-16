// Page de confirmation de commande : vide le panier et lance des confettis.
import { clearCart } from "../cart.js";
import { $, reducedMotion } from "../utils.js";

function confetti(canvas) {
  const ctx = canvas.getContext("2d");
  const colors = ["#f6d892", "#e0b05a", "#a8712a", "#f6f3ee", "#c99a4a"];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  window.addEventListener("resize", resize);
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height,
    w: (6 + Math.random() * 8) * dpr,
    h: (3 + Math.random() * 5) * dpr,
    vy: (2 + Math.random() * 3.5) * dpr,
    vx: (Math.random() - 0.5) * 1.5 * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const loop = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fading = now - start > 4500;
    let alive = 0;
    for (const p of parts) {
      p.x += p.vx + Math.sin((now / 600) + p.r) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > canvas.height + 20) {
        if (fading) continue;
        p.y = -20;
      }
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function init() {
  const params = new URLSearchParams(location.search);
  // Stripe renvoie session_id ; PayPal et Alma passent par /api/payment/return qui ajoute ref.
  if (params.get("session_id") || params.get("ref")) clearCart();
  const canvas = $("[data-confetti]");
  if (canvas && !reducedMotion()) confetti(canvas);
}
