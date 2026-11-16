// Logo Empira (images fournies par Empira, intégrées au jeu à l'assemblage) : version compacte sur la carte,
// version complète sur le podium, la fenêtre de pilotage et l'écran de licence. Toujours affiché, non remplaçable.

import LOGO_COMPACT from '../images/logo-empira.png';
import LOGO_COMPLET from '../images/logo-empira-complet.png';
import ICONE from '../images/icone-empira.png';

export { LOGO_COMPACT, LOGO_COMPLET, ICONE };

let imageCompacte = null;
if (typeof Image !== 'undefined') {
  const i = new Image();
  i.onload = () => (imageCompacte = i);
  i.src = LOGO_COMPACT;
}

/** Ajoute l'icône Empira à l'onglet du navigateur. */
export function poserIcone(doc = document) {
  const l = doc.createElement('link');
  l.rel = 'icon';
  l.href = ICONE;
  doc.head.appendChild(l);
}

const POLICE = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";

export function dessinerLogo(ctx, x, y, ancrage = 'droite', image = imageCompacte) {
  const l = image ? 200 : 150;
  const h = image ? 58 : 56;
  const x0 = ancrage === 'droite' ? x - l : ancrage === 'centre' ? x - l / 2 : x;
  if (image) {
    const k = Math.min(l / image.width, h / image.height);
    ctx.drawImage(image, x0 + (l - image.width * k) / 2, y, image.width * k, image.height * k);
    return;
  }
  const or = ctx.createLinearGradient(0, y, 0, y + h);
  or.addColorStop(0, '#f6dc8f');
  or.addColorStop(1, '#b8862f');
  ctx.save();
  ctx.fillStyle = or;
  ctx.beginPath();
  // repli dessiné, le temps que l'image se charge : « A » en chevron
  ctx.moveTo(x0 + 22, y + 4);
  ctx.lineTo(x0 + 42, y + 48);
  ctx.lineTo(x0 + 33, y + 48);
  ctx.lineTo(x0 + 22, y + 22);
  ctx.lineTo(x0 + 11, y + 48);
  ctx.lineTo(x0 + 2, y + 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x0 + 14, y + 34, 16, 4);
  ctx.font = `800 21px Georgia, 'Times New Roman', serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('EMPIRA', x0 + 50, y + 32);
  ctx.font = `700 10px ${POLICE}`;
  ctx.fillStyle = '#d9a84e';
  ctx.fillText('A G E N C Y', x0 + 52, y + 47);
  ctx.restore();
}
