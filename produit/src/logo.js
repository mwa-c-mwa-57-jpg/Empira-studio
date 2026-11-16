// Logo Empira : « A » doré en chevron et « EMPIRA AGENCY », ou l'image images/logo-empira.png si elle est fournie.
// Il est toujours affiché (en haut de la colonne de droite, à côté de la carte, et sous le podium) et ne peut pas être masqué.

const POLICE = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";

export function dessinerLogo(ctx, x, y, ancrage = 'droite', image = null) {
  const l = 150;
  const h = 56;
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
  // « A » en chevron
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
