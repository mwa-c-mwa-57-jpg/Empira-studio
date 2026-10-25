// Dessin de la mascotte (bonnet rouge, veste bleue, baudrier orange), entièrement en code.
// dessinerMascotte(ctx, x, y, echelle, pose) — (x, y) = centre du buste.
(function () {
  'use strict';
  const C = {
    trait: '#2b1a12', peau: '#ffcf9e', joue: 'rgba(255,110,110,.45)', bonnet: '#e63946', revers: '#b5172b',
    pompon: '#fff4e0', veste: '#2f6fd6', vesteOmbre: '#2558ad', pantalon: '#31415e', chaussure: '#7a4a2a',
    baudrier: '#ff9f1c', blanc: '#ffffff', pupille: '#1b1b1b'
  };

  function membre(ctx, x1, y1, x2, y2, plie, epaisseur, couleur) {
    const mx = (x1 + x2) / 2 + plie.x;
    const my = (y1 + y2) / 2 + plie.y;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.trait;
    ctx.lineWidth = epaisseur + 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  }

  function rond(ctx, x, y, r, fond, trait = 4) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fond; ctx.fill();
    if (trait) { ctx.lineWidth = trait; ctx.strokeStyle = C.trait; ctx.stroke(); }
  }

  function main(ctx, x, y, r = 11) { rond(ctx, x, y, r, C.peau); }
  function pied(ctx, x, y, sens) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.ellipse(sens * 6, 4, 16, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.chaussure; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.trait; ctx.stroke();
    ctx.restore();
  }

  function visage(ctx, p, t) {
    const hx = 0, hy = -78;
    // Tête
    rond(ctx, hx, hy, 50, C.peau, 5);
    // Joues
    ctx.fillStyle = C.joue;
    ctx.beginPath(); ctx.ellipse(hx - 30, hy + 14, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 30, hy + 14, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

    const ex = p.expression;
    const clign = (Math.sin(t * 1.3) > 0.985) && ex !== 'peur';
    const rx = p.regard ? p.regard.x : 0;
    const ry = p.regard ? p.regard.y : 0;
    // Yeux
    for (const s of [-1, 1]) {
      const x = hx + s * 18, y = hy - 4;
      if (ex === 'joie') {
        ctx.lineWidth = 5; ctx.strokeStyle = C.trait; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y + 4, 9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        continue;
      }
      const grand = ex === 'peur' ? 1.25 : ex === 'supplie' ? 1.2 : 1;
      ctx.beginPath(); ctx.ellipse(x, y, 12 * grand, (clign ? 2 : 15) * grand, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.blanc; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = C.trait; ctx.stroke();
      if (!clign) {
        const pr = ex === 'peur' ? 4 : ex === 'supplie' ? 9 : 6.5;
        rond(ctx, x + rx * 4, y + ry * 4 + 2, pr, C.pupille, 0);
        rond(ctx, x + rx * 4 - 2.5, y + ry * 4 - 1, ex === 'supplie' ? 3.5 : 2, C.blanc, 0);
        if (ex === 'supplie') rond(ctx, x + rx * 4 + 3, y + ry * 4 + 5, 1.6, C.blanc, 0);
      }
      if (ex === 'fatigue' || ex === 'boude') {
        // Paupières lourdes
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 13, 16, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = C.peau; ctx.fillRect(x - 14, y - 17, 28, ex === 'boude' ? 15 : 13);
        ctx.restore();
        ctx.lineWidth = 3.5; ctx.strokeStyle = C.trait;
        ctx.beginPath(); ctx.moveTo(x - 12, y - (ex === 'boude' ? 2 : 4)); ctx.lineTo(x + 12, y - (ex === 'boude' ? 2 : 4)); ctx.stroke();
      }
    }
    // Sourcils
    ctx.lineWidth = 5; ctx.strokeStyle = C.trait; ctx.lineCap = 'round';
    const sourcils = {
      peur: [[-28, -30, -10, -36], [10, -36, 28, -30]],
      supplie: [[-28, -28, -10, -34], [10, -34, 28, -28]],
      boude: [[-28, -30, -9, -24], [9, -24, 28, -30]],
      fatigue: [[-27, -26, -9, -27], [9, -27, 27, -26]],
      joie: [[-28, -32, -10, -35], [10, -35, 28, -32]],
      normal: [[-27, -30, -9, -32], [9, -32, 27, -30]]
    }[ex] || [[-27, -30, -9, -32], [9, -32, 27, -30]];
    for (const [a, b, c, d] of sourcils) { ctx.beginPath(); ctx.moveTo(hx + a, hy + b); ctx.lineTo(hx + c, hy + d); ctx.stroke(); }
    // Bouche
    const by = hy + 24;
    ctx.lineWidth = 4.5;
    if (ex === 'peur' || p.crie) {
      ctx.beginPath(); ctx.ellipse(hx, by + 2, 9, 12 + Math.sin(t * 30) * 1.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.stroke();
    } else if (ex === 'joie') {
      ctx.beginPath(); ctx.moveTo(hx - 18, by - 4); ctx.quadraticCurveTo(hx, by + 26, hx + 18, by - 4); ctx.closePath();
      ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx, by + 8, 7, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#ff7b8a'; ctx.fill();
    } else if (ex === 'fatigue') {
      ctx.beginPath(); ctx.moveTo(hx - 12, by + 2);
      ctx.quadraticCurveTo(hx - 6, by - 4, hx, by + 2); ctx.quadraticCurveTo(hx + 6, by + 8, hx + 12, by + 2); ctx.stroke();
    } else if (ex === 'boude') {
      ctx.beginPath(); ctx.moveTo(hx - 10, by + 4); ctx.quadraticCurveTo(hx, by - 3, hx + 10, by + 4); ctx.stroke();
    } else if (ex === 'supplie') {
      ctx.beginPath(); ctx.moveTo(hx - 8, by + 4); ctx.quadraticCurveTo(hx, by - 2, hx + 8, by + 4); ctx.stroke();
    } else if (p.parle) {
      const o = Math.abs(Math.sin(t * 18)) * 9 + 2;
      ctx.beginPath(); ctx.ellipse(hx, by + 2, 10, o, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(hx, by - 6, 14, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    }
    // Gouttes de sueur
    if (ex === 'fatigue' || ex === 'peur') {
      const k = (t * 1.5) % 1;
      ctx.fillStyle = '#8fd3ff';
      ctx.beginPath(); ctx.ellipse(hx + 46, hy - 10 + k * 26, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Bonnet
    ctx.beginPath();
    ctx.moveTo(hx - 50, hy - 18);
    ctx.bezierCurveTo(hx - 52, hy - 78, hx + 52, hy - 78, hx + 50, hy - 18);
    ctx.closePath();
    ctx.fillStyle = C.bonnet; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.trait; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(hx - 54, hy - 30, 108, 18, 9);
    ctx.fillStyle = C.revers; ctx.fill(); ctx.stroke();
    rond(ctx, hx + Math.sin(t * 3) * 3, hy - 76, 13, C.pompon, 4);
  }

  function corps(ctx) {
    // Sac à dos (dépasse sur les côtés)
    ctx.beginPath(); ctx.roundRect(-44, -24, 88, 60, 16);
    ctx.fillStyle = '#e09a3e'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.trait; ctx.stroke();
    // Veste
    ctx.beginPath(); ctx.roundRect(-34, -32, 68, 80, 22);
    ctx.fillStyle = C.veste; ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.vesteOmbre; ctx.beginPath(); ctx.roundRect(-30, 20, 60, 24, 12); ctx.fill();
    ctx.strokeStyle = '#d7e3ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, 44); ctx.stroke();
    // Baudrier
    ctx.strokeStyle = C.baudrier; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-32, 36); ctx.lineTo(32, 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, 36); ctx.lineTo(-10, 50); ctx.moveTo(20, 36); ctx.lineTo(10, 50); ctx.stroke();
    rond(ctx, 0, 40, 6, '#c0c0c0', 3);
  }

  function dessiner(ctx, x, y, s, p) {
    const t = p.temps || 0;
    ctx.save();
    let dx = 0, dy = 0;
    if (p.tremble) { dx = (Math.random() - 0.5) * p.tremble; dy = (Math.random() - 0.5) * p.tremble; }
    ctx.translate(x + dx, y + dy);
    ctx.scale(s, s);
    if (p.rotation) ctx.rotate(p.rotation);

    const ph = p.phase || 0;
    const mode = p.mode || 'grimpe';
    let bras, jambes;
    if (mode === 'grimpe' || mode === 'repos' || mode === 'bloque') {
      const a = Math.sin(ph), b = Math.sin(ph + Math.PI);
      const respire = mode === 'grimpe' ? 0 : Math.sin(t * 2) * 3;
      const haut = mode === 'bloque' ? -150 : -125;
      bras = [[-30, -18, -58, haut + a * 30 + respire, { x: -18, y: 0 }], [30, -18, 58, haut + b * 30 + respire, { x: 18, y: 0 }]];
      jambes = [[-16, 46, -38, 108 + b * 22, { x: -22, y: -6 }], [16, 46, 38, 108 + a * 22, { x: 22, y: -6 }]];
    } else if (mode === 'accroche') {
      const bal = Math.sin(t * 3.2) * 18;
      bras = [[-26, -20, -24, -165, { x: -4, y: 0 }], [26, -20, 24, -165, { x: 4, y: 0 }]];
      jambes = [[-14, 46, -18 + bal, 125, { x: bal * 0.3, y: 0 }], [14, 46, 18 + bal, 120, { x: bal * 0.3, y: 0 }]];
    } else if (mode === 'chute') {
      const w = t * 14;
      bras = [[-30, -18, -60 + Math.sin(w) * 20, -110 + Math.cos(w) * 30, { x: -10, y: 0 }], [30, -18, 60 + Math.cos(w) * 20, -110 + Math.sin(w) * 30, { x: 10, y: 0 }]];
      jambes = [[-16, 46, -40 + Math.sin(w * 1.3) * 15, 105, { x: -10, y: 0 }], [16, 46, 40 + Math.cos(w * 1.3) * 15, 100, { x: 10, y: 0 }]];
    } else if (mode === 'boude') {
      const tape = Math.max(0, Math.sin(t * 7)) * 8;
      bras = [[-30, -10, 22, 6, { x: -8, y: 18 }], [30, -10, -22, 2, { x: 8, y: 18 }]];
      jambes = [[-16, 46, -48, 64, { x: -18, y: -12 }], [16, 46, 50, 62 - tape, { x: 18, y: -12 }]];
    } else if (mode === 'joie') {
      const j = Math.abs(Math.sin(t * 8)) * 10;
      bras = [[-30, -18, -70, -120 - j, { x: -14, y: 4 }], [30, -18, 70, -120 - j, { x: 14, y: 4 }]];
      jambes = [[-16, 46, -26, 112, { x: -8, y: 0 }], [16, 46, 26, 112, { x: 8, y: 0 }]];
    } else if (mode === 'toctoc') {
      const k = p.toc || 0; // 0..1 : poing en avant
      bras = [[-30, -18, -52, 30, { x: -14, y: 0 }], [30, -18, 40 - k * 6, -70 - k * 10, { x: 24, y: 10 }]];
      jambes = [[-16, 46, -26, 112, { x: -8, y: 0 }], [16, 46, 26, 112, { x: 8, y: 0 }]];
    } else if (mode === 'supplie') {
      const m = Math.sin(t * 6) * 4;
      bras = [[-30, -18, -8, -20 + m, { x: -14, y: 14 }], [30, -18, 8, -20 + m, { x: 14, y: 14 }]];
      jambes = [[-16, 46, -26, 112, { x: -8, y: 0 }], [16, 46, 26, 112, { x: 8, y: 0 }]];
    } else {
      bras = [[-30, -18, -58, 30, { x: -12, y: 0 }], [30, -18, 58, 30, { x: 12, y: 0 }]];
      jambes = [[-16, 46, -26, 112, { x: -8, y: 0 }], [16, 46, 26, 112, { x: 8, y: 0 }]];
    }

    for (const [x1, y1, x2, y2, pl] of jambes) membre(ctx, x1, y1, x2, y2, pl, 18, C.pantalon);
    for (const [, , x2, y2] of jambes) pied(ctx, x2, y2 + 4, x2 < 0 ? -1 : 1);
    corps(ctx);
    const bdevant = mode === 'boude' || mode === 'supplie';
    if (!bdevant) {
      for (const [x1, y1, x2, y2, pl] of bras) membre(ctx, x1, y1, x2, y2, pl, 16, C.veste);
      bras.forEach(([, , x2, y2], i) => main(ctx, x2, y2, mode === 'toctoc' && i === 1 ? 14 + (p.toc || 0) * 8 : 11));
    }
    visage(ctx, p, t);
    if (bdevant) {
      for (const [x1, y1, x2, y2, pl] of bras) membre(ctx, x1, y1, x2, y2, pl, 16, C.veste);
      bras.forEach(([, , x2, y2]) => main(ctx, x2, y2));
    }
    ctx.restore();
  }

  window.dessinerMascotte = dessiner;
})();
