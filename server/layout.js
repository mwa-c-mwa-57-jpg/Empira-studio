// Mise en page des impressions sur une page de papier (unités : 1000 × 1400).
// Rangées centrées ; une impression « pleine page » occupe la page à elle seule.

export const PAGE = { W: 1000, H: 1400, MARGIN: 50, GAP: 28 };

export class PageLayout {
  constructor() {
    this.reset();
  }

  reset() {
    this.count = 0;
    this.full = false;
    this.inRow = false;
    this.cursorX = 0;
    this.cursorY = PAGE.MARGIN;
    this.rowH = 0;
  }

  get isEmpty() {
    return this.count === 0;
  }

  // Emplacement possible sur la page actuelle, ou null s'il faut avancer le papier.
  tryPlace(w, h, fullPage = false) {
    const { W, H, MARGIN, GAP } = PAGE;
    if (this.full) return null;

    if (fullPage) {
      if (!this.isEmpty) return null;
      return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, newRow: false };
    }

    if (this.inRow && this.cursorX + w <= W - MARGIN && this.cursorY + h <= H - MARGIN) {
      return { x: this.cursorX, y: this.cursorY, w, h, newRow: false };
    }

    const y = this.inRow ? this.cursorY + this.rowH + GAP : this.cursorY;
    // Sur une page vierge on accepte toujours (même si la carte est immense).
    if (y + h > H - MARGIN && !this.isEmpty) return null;
    // On centre la rangée comme si elle allait être remplie de cartes de cette taille.
    const perRow = Math.max(1, Math.floor((W - 2 * MARGIN + GAP) / (w + GAP)));
    const rowWidth = perRow * w + (perRow - 1) * GAP;
    const x = Math.max(0, Math.round((W - rowWidth) / 2));
    return { x, y: Math.min(y, Math.max(0, H - h)), w, h, newRow: true };
  }

  // Réserve l'emplacement. Retourne null si la page est pleine (il faut d'abord reset()).
  place(w, h, fullPage = false) {
    const spot = this.tryPlace(w, h, fullPage);
    if (!spot) return null;
    const { GAP } = PAGE;
    this.count++;
    if (fullPage) {
      this.full = true;
    } else if (spot.newRow) {
      this.inRow = true;
      this.cursorY = spot.y;
      this.rowH = h;
      this.cursorX = spot.x + w + GAP;
    } else {
      this.cursorX += w + GAP;
      this.rowH = Math.max(this.rowH, h);
    }
    return { x: spot.x, y: spot.y, w, h };
  }
}
