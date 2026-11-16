// Interface HTML/CSS par-dessus le canvas, aux positions du cahier des charges (scène 1080 × 1920).
// Les pseudos sont toujours insérés comme texte (textContent), jamais comme HTML.

import { CADEAUX, REGLES, TITRE, EVENEMENTS } from './config.js';
import { PAR_CODE } from './game.js';
import { placeForms, capitalize } from '../../public/src/france/names.js';
import { pseudoPropre } from './theme.js';
import { dessinerLogo } from './logo.js';

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const chrono = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const el = (tag, cls, parent, texte) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  if (parent) parent.appendChild(e);
  return e;
};
const leDep = (code) => placeForms(PAR_CODE.get(code)?.name ?? code).the;

const ONGLETS = [
  { id: 'renforts', titre: '🪖 RENFORTS' },
  { id: 'bonus', titre: '🛡️ BONUS & DÉFENSE' },
  { id: 'attaques', titre: '💥 ATTAQUES' },
  { id: 'gratuit', titre: '👆 GRATUIT' },
];

export class Interface {
  constructor(racine, partie, theme, photos) {
    this.racine = racine;
    this.partie = partie;
    this.theme = theme;
    this.photos = photos;
    this.onglet = 0;
    this.tOnglet = 0;
    this.messages = [];
    this.fil = [];
    racine.style.setProperty('--contour', theme.contour);
    this.#construire();
  }

  #construire() {
    const r = this.racine;
    const entete = el('div', 'entete cadre', r);
    const drapeau = el('div', 'drapeau', entete);
    el('i', 'bleu', drapeau);
    el('i', 'blanc', drapeau);
    el('i', 'rouge', drapeau);
    el('div', 'titre', entete, TITRE);
    this.eTotal = el('div', 'case', entete);
    el('small', '', this.eTotal, 'SOLDATS');
    this.eTotalV = el('b', '', this.eTotal, '0');
    this.ePartie = el('div', 'case', entete);
    this.ePartieT = el('small', '', this.ePartie, 'PARTIE');
    this.eChrono = el('b', '', this.ePartie, '15:00');

    this.eGeneral = el('div', 'general cadre', r);
    el('span', 'medaille', this.eGeneral, '🎖️');
    this.eGeneralL = el('small', '', this.eGeneral, 'LE GÉNÉRAL');
    this.eGeneralT = el('p', '', this.eGeneral, '');

    const cad = el('div', 'cadeaux cadre', r);
    this.eOnglets = el('div', 'onglets', cad);
    this.boutons = ONGLETS.map((o) => el('span', '', this.eOnglets, o.titre));
    this.eCartes = el('div', 'cartes', cad);

    this.eTop = el('div', 'top3', r);
    this.cartesTop = [0, 1, 2].map((i) => {
      const c = el('div', `place cadre p${i}`, this.eTop);
      const photo = el('canvas', 'photo', c);
      photo.width = photo.height = 120;
      const num = el('b', 'num', c);
      const nom = el('span', 'nom', c);
      const det = el('small', 'det', c);
      el('span', 'medaille', c, ['🥇', '🥈', '🥉'][i]);
      return { c, photo, num, nom, det };
    });

    this.eRoi = el('div', 'roi cadre', r);
    this.roiPhoto = el('canvas', 'photo', this.eRoi);
    this.roiPhoto.width = this.roiPhoto.height = 100;
    el('small', '', this.eRoi, '👑 ROI DU PAYS');
    this.eRoiNom = el('b', '', this.eRoi, '—');
    this.eRoiDet = el('span', '', this.eRoi, '');

    this.eMission = el('div', 'mission cadre', r);
    this.eEvenement = el('div', 'evenement cadre', r);
    this.eVague = el('div', 'vague', r);
    this.eFil = el('div', 'fil', r);
    this.eAnnonce = el('div', 'annonce cadre', r);
    this.eAttente = el('div', 'attente', r);
    el('h2', '', this.eAttente, 'Écris le numéro de ton département dans le tchat pour entrer en guerre !');
    el('p', '', this.eAttente, 'La partie démarre à la première action.');
    this.eEtat = el('div', 'etat', r);
    this.ePodium = el('div', 'podium', r);
  }

  // ------------------------------------------------------------------ événements → messages, fil, annonces

  #filAjouter(texte, couleur) {
    this.fil.unshift({ texte, couleur });
    this.fil.length = Math.min(this.fil.length, 3);
    this.eFil.replaceChildren(...this.fil.map((f) => {
      const l = el('div', 'ligne');
      l.textContent = f.texte;
      l.style.borderColor = f.couleur;
      return l;
    }));
  }

  #general(texte, sec = 6, priorite = 1) {
    this.messages.push({ texte, fin: this.partie.t + sec, priorite });
    this.messages = this.messages.filter((m) => m.fin > this.partie.t).sort((a, b) => b.priorite - a.priorite).slice(0, 4);
  }

  annoncer(texte, couleur = 'var(--contour)', sec = 2.6) {
    this.eAnnonce.textContent = texte;
    this.eAnnonce.style.borderColor = couleur;
    this.eAnnonce.classList.remove('montre');
    void this.eAnnonce.offsetWidth; // relance l'animation CSS
    this.eAnnonce.classList.add('montre');
    clearTimeout(this.minuteurAnnonce);
    this.minuteurAnnonce = setTimeout(() => this.eAnnonce.classList.remove('montre'), sec * 1000);
  }

  surEvenements(evs) {
    const P = this.partie;
    for (const e of evs) {
      const c = e.equipe ? this.theme.couleur(e.equipe) : 'var(--contour)';
      const nom = e.joueur ? pseudoPropre(e.joueur.nom) : '';
      switch (e.type) {
        case 'arrivee':
          this.#filAjouter(`${nom} rejoint ${leDep(e.equipe)} (+${REGLES.soldatsArrivee})`, c);
          break;
        case 'gain':
          if (e.sorte === 'partage') this.#filAjouter(`${nom} partage le live pour le ${e.equipe} (+${fmt(e.soldats)})`, c);
          else if (e.sorte === 'abonnement') this.#filAjouter(`${nom} s'abonne pour le ${e.equipe} (+${fmt(e.soldats)})`, c);
          break;
        case 'cadeau': {
          const quoi = e.cadeau?.effetTexte ? ` → ${e.cadeau.effetTexte}` : '';
          this.#filAjouter(`${nom} envoie ${e.nom}${e.nombre > 1 ? ` ×${e.nombre}` : ''}${quoi}`, c);
          this.photos.apprendreCadeau({ id: e.cadeau?.id, name: e.nom, image: e.image });
          if (e.pieces >= 100) this.annoncer(`${nom} : ${e.nom}${e.nombre > 1 ? ` ×${e.nombre}` : ''} !`, c);
          break;
        }
        case 'cadeauEnAttente':
          this.#filAjouter(`${nom} : écris ton département pour utiliser ton cadeau !`, 'var(--contour)');
          break;
        case 'attaque': {
          const verbes = { chasseur: 'bombarde', missiles: 'envoie ses missiles sur', helicos: 'envoie ses hélicoptères sur', tsunami: 'déclenche un tsunami sur', tomate: 'lance une tomate sur', nucleaire: 'lâche la bombe sur' };
          const texte = `Le ${e.de} ${verbes[e.sorte] || 'attaque'} ${e.vers.map((v) => `le ${v}`).join(', ')}${e.riposte ? ' (riposte ×2)' : ''} !`;
          this.#filAjouter(texte, this.theme.couleur(e.de));
          this.#general(texte, 5, 2);
          if (e.sorte === 'nucleaire' || e.sorte === 'tsunami' || e.sorte === 'helicos') this.annoncer(texte, this.theme.couleur(e.de));
          break;
        }
        case 'bouclier':
          this.#filAjouter(`🛡 Bouclier sur ${leDep(e.equipe)} pendant ${e.sec} s`, c);
          break;
        case 'boost':
          this.#filAjouter(`⚡ ${capitalize(leDep(e.equipe))} : ×${String(e.mult).replace('.', ',')} pendant ${e.sec} s`, c);
          break;
        case 'tank':
          this.#filAjouter(`Un tank prend position sur ${leDep(e.equipe)}`, c);
          break;
        case 'occupation':
          this.#filAjouter(`Le ${e.occupant} envahit le ${e.equipe} !`, this.theme.couleur(e.occupant));
          this.#general(`Invasion ! Le ${e.occupant} occupe le ${e.equipe} et touche la moitié de ses gains. Un cadeau de ${REGLES.liberationPieces} pièces le libère !`, 10, 2);
          this.annoncer(`INVASION : le ${e.occupant} occupe le ${e.equipe} !`, this.theme.couleur(e.occupant));
          break;
        case 'liberation':
          this.#filAjouter(`${capitalize(leDep(e.equipe))} est libéré grâce à ${nom} !`, c);
          this.annoncer(`LIBÉRATION du ${e.equipe} !`, c);
          break;
        case 'vagueAnnonce':
          this.#general(`Vague « ${e.vague.nom} » dans ${e.dans} s : ${e.vague.texte} !`, Math.max(5, e.dans), 3);
          this.annoncer(`VAGUE DANS ${e.dans} s : ${e.vague.nom}`, '#ffd23d');
          break;
        case 'vagueDebut':
          this.annoncer(`🌊 ${e.vague.nom} : ${e.vague.texte} !`, '#ffd23d', 3);
          break;
        case 'evenementDebut':
          this.annoncer(this.#titreEvenement(e.evenement), '#ffd23d');
          break;
        case 'evenementFin': {
          const r = e.resultat;
          let t = null;
          if (e.evenement.type === 'duel') t = r.gagnant ? `Duel gagné par le ${r.gagnant} : ${fmt(r.vol)} soldats volés au ${r.perdant} !` : 'Duel nul !';
          else if (e.evenement.type === 'mission') t = r.reussie ? `Mission réussie : +${EVENEMENTS.mission.prime} par département participant !` : 'Mission échouée…';
          else if (e.evenement.type === 'prime') t = r.gagnant ? `Le ${r.gagnant} dépasse le ${e.evenement.cible} et touche la prime !` : null;
          else if (e.evenement.type === 'revolution') t = 'Fin de la révolution. Le calme revient… pour l’instant.';
          if (t) {
            this.#general(t, 6, 2);
            this.#filAjouter(t, '#ffd23d');
          }
          break;
        }
        case 'depassement':
          this.#general(`${capitalize(leDep(e.equipe))} passe en tête !`, 5, 2);
          break;
        case 'rappel':
          this.annoncer(e.minutes === 1 ? 'PLUS QU’UNE MINUTE !' : `PLUS QUE ${e.minutes} MINUTES !`, '#ff6b5b');
          break;
        case 'largage':
          this.#filAjouter(`Largage de renforts sur le ${e.equipe} (+${fmt(e.soldats)})`, c);
          break;
        case 'podium':
          this.#podium(e.podium);
          break;
        case 'attente':
        case 'debutPartie':
          this.ePodium.classList.remove('montre');
          this.fil = [];
          this.eFil.replaceChildren();
          break;
        default:
          break;
      }
    }
    void P;
  }

  #titreEvenement(ev) {
    if (ev.type === 'revolution') return `✊ RÉVOLUTION contre le ${ev.cible} !`;
    if (ev.type === 'duel') return `⚔️ DUEL : ${ev.a} contre ${ev.b} !`;
    if (ev.type === 'prime') return `💰 TÊTE MISE À PRIX : le ${ev.cible} !`;
    if (ev.type === 'mission') return `🎯 MISSION pour ${placeForms(ev.region).the} !`;
    return '';
  }

  // ------------------------------------------------------------------ rafraîchissement (8 fois par seconde)

  #dessinerPhoto(canvas, joueur, couleur) {
    const g = canvas.getContext('2d');
    const t = canvas.width;
    g.clearRect(0, 0, t, t);
    if (!joueur) return;
    const img = this.photos.image(joueur) || this.photos.initiales(joueur);
    g.save();
    g.beginPath();
    g.arc(t / 2, t / 2, t / 2 - 5, 0, Math.PI * 2);
    g.clip();
    g.drawImage(img, 0, 0, t, t);
    g.restore();
    g.lineWidth = 6;
    g.strokeStyle = couleur;
    g.beginPath();
    g.arc(t / 2, t / 2, t / 2 - 4, 0, Math.PI * 2);
    g.stroke();
  }

  #carte(parent, icone, image, prix, nom, effet) {
    const c = el('div', 'carte', parent);
    if (image) {
      const i = el('img', 'icone', c);
      i.src = image;
      i.referrerPolicy = 'no-referrer';
      i.alt = '';
    } else el('span', 'icone', c, icone);
    if (prix) el('small', 'prix', c, `🪙 ${fmt(prix)}`);
    el('b', '', c, nom);
    el('span', 'effet', c, effet);
  }

  #cadeaux() {
    const o = ONGLETS[this.onglet];
    this.boutons.forEach((b, i) => b.classList.toggle('actif', i === this.onglet));
    const cartes = el('div', 'cartes');
    if (o.id === 'gratuit') {
      this.#carte(cartes, '👆', null, 0, "Taper l'écran", `${REGLES.likesParSoldat} likes = 1 soldat`);
      this.#carte(cartes, '💬', null, 0, 'Commenter', `+${REGLES.soldatsCommentaire} soldat`);
      this.#carte(cartes, '📣', null, 0, 'Partager le live', `+${REGLES.soldatsPartage} soldats`);
      this.#carte(cartes, '⭐', null, 0, "S'abonner", `+${REGLES.soldatsAbonnement} soldats`);
      this.#carte(cartes, '🗺️', null, 0, 'Ton département', 'écris son numéro');
    } else {
      for (const c of CADEAUX.filter((x) => x.onglet === o.id)) this.#carte(cartes, c.icone, this.photos.adresseCadeau(c), c.coins, c.nomCarte || c.noms[0], c.effetTexte);
    }
    this.eCartes.replaceWith(cartes);
    this.eCartes = cartes;
  }

  rafraichir(dt) {
    const P = this.partie;
    this.tOnglet += dt;
    if (this.tOnglet >= 7 || !this.dejaCadeaux) {
      this.tOnglet = this.dejaCadeaux ? 0 : this.tOnglet;
      if (this.dejaCadeaux) this.onglet = (this.onglet + 1) % ONGLETS.length;
      this.dejaCadeaux = true;
      this.#cadeaux();
    }
    this.eTotalV.textContent = fmt(P.totalSoldats());
    this.ePartieT.textContent = `PARTIE ${Math.max(1, P.numero)}`;
    this.eChrono.textContent = chrono(P.tempsRestant);
    this.eChrono.classList.toggle('urgent', P.phase === 'partie' && P.tempsRestant <= 60);

    // bandeau du Général
    const v = P.vague;
    let label = 'LE GÉNÉRAL';
    let texte;
    const messages = this.messages.filter((m) => m.fin > P.t);
    if (P.messageFixe) texte = P.messageFixe;
    else if (v && P.t < v.debut) {
      label = 'ALERTE';
      texte = `Vague « ${v.nom} » dans ${Math.ceil(v.debut - P.t)} s : ${v.texte} !`;
    } else if (v) {
      label = 'VAGUE';
      texte = `${v.nom} : ${v.texte} — encore ${Math.ceil(v.fin - P.t)} s. Les derniers gagnent ×1,5 !`;
    } else if (messages.length) texte = messages[0].texte;
    else {
      const cl = P.classement();
      const astuces = [
        'Écris le numéro de ton département dans le tchat pour entrer en guerre !',
        `Tout cadeau = ${REGLES.soldatsParPiece} soldats par pièce, et plus pour les gros cadeaux.`,
        'Les cadeaux d’attaque frappent le département juste devant toi au classement.',
        'Attaqué ? Tu as 30 s pour riposter avec une force ×2 !',
        `Partage le live : +${REGLES.soldatsPartage} soldats pour ton département.`,
      ];
      if (cl[0]) astuces.push(`${capitalize(leDep(cl[0].code))} mène avec ${fmt(cl[0].soldats)} soldats : qui va l’arrêter ?`);
      texte = astuces[Math.floor(P.t / 7) % astuces.length];
    }
    this.eGeneralL.textContent = label;
    this.eGeneralT.textContent = texte;
    this.eGeneral.classList.toggle('alerte', label !== 'LE GÉNÉRAL');

    // top 3
    const cl = P.classement();
    this.cartesTop.forEach((t, i) => {
      const e = cl[i];
      t.c.classList.toggle('vide', !e);
      if (!e) {
        t.num.textContent = '—';
        t.nom.textContent = i === 0 ? 'Écris ton département !' : '';
        t.det.textContent = '';
        this.#dessinerPhoto(t.photo, null);
        return;
      }
      const c = this.theme.couleur(e.code);
      t.num.textContent = e.code;
      t.num.style.color = c;
      t.nom.textContent = e.nom;
      t.det.textContent = `${fmt(e.soldats)} soldats · ${(P.part(e) * 100).toFixed(1).replace('.', ',')} %`;
      this.#dessinerPhoto(t.photo, P.meilleurJoueur(e), c);
    });

    // roi du pays
    const roi = P.roi();
    this.eRoiNom.textContent = roi ? pseudoPropre(roi.nom) : 'La place est libre !';
    this.eRoiDet.textContent = roi ? `${fmt(roi.total)} soldats · ${roi.equipe} ${PAR_CODE.get(roi.equipe)?.name ?? ''}` : '';
    this.#dessinerPhoto(this.roiPhoto, roi, '#ffd23d');

    // carte d'événement et mission
    const ev = P.evenement;
    this.eEvenement.classList.toggle('montre', Boolean(ev && ev.type !== 'mission'));
    this.eMission.classList.toggle('montre', Boolean(ev && ev.type === 'mission'));
    if (ev && ev.type !== 'mission') this.#evenement(ev);
    if (ev && ev.type === 'mission') this.#mission(ev);

    // bandeau de vague sur la carte
    const va = P.vagueActive();
    this.eVague.classList.toggle('montre', Boolean(va));
    if (va) this.eVague.textContent = `🌊 ${va.nom} — ${chrono(va.fin - P.t)}`;

    this.eAttente.classList.toggle('montre', P.phase === 'attente');
  }

  #evenement(ev) {
    const P = this.partie;
    const reste = chrono(Math.max(0, ev.fin - P.t));
    const e = this.eEvenement;
    e.replaceChildren();
    const h = el('div', 'tete', e);
    el('b', '', h, this.#titreEvenement(ev));
    el('span', 'temps', h, reste);
    if (ev.type === 'duel') {
      const a = ev.scores[ev.a];
      const b = ev.scores[ev.b];
      el('p', '', e, `Celui qui recrute le plus vole ${Math.round(EVENEMENTS.duel.vol * 100)} % à l’autre`);
      const barre = el('div', 'barre', e);
      const g = el('i', '', barre);
      g.style.width = `${a + b > 0 ? (100 * a) / (a + b) : 50}%`;
      g.style.background = this.theme.couleur(ev.a);
      barre.style.background = this.theme.couleur(ev.b);
      el('small', '', e, `${ev.a} +${fmt(a)}  contre  ${ev.b} +${fmt(b)}`);
    } else if (ev.type === 'revolution') {
      el('p', '', e, `Tout le monde contre le ${ev.cible} : ×${EVENEMENTS.revolution.mult} pour tous les autres !`);
    } else if (ev.type === 'prime') {
      el('p', '', e, `${EVENEMENTS.prime.prime} soldats pour le premier qui dépasse le ${ev.cible} !`);
    }
    const t = el('div', 'temps-barre', e);
    el('i', '', t).style.width = `${(100 * Math.max(0, ev.fin - P.t)) / ev.duree}%`;
  }

  #mission(ev) {
    const P = this.partie;
    const m = this.eMission;
    m.replaceChildren();
    const h = el('div', 'tete', m);
    el('b', '', h, '🎯 MISSION');
    el('span', 'temps', h, chrono(Math.max(0, ev.fin - P.t)));
    el('p', '', m, `${capitalize(placeForms(ev.region).the)} doit ${ev.sorte === 'messages' ? `envoyer ${ev.objectif} messages` : `recruter ${fmt(ev.objectif)} soldats`}`);
    const barre = el('div', 'barre', m);
    el('i', '', barre).style.width = `${Math.min(100, (100 * ev.progres) / ev.objectif)}%`;
    el('small', '', m, `${fmt(Math.min(ev.progres, ev.objectif))} / ${fmt(ev.objectif)} · prime : +${EVENEMENTS.mission.prime} par département qui participe`);
  }

  #podium(p) {
    const d = this.ePodium;
    d.replaceChildren();
    el('h1', '', d, 'VICTOIRE');
    const g = p.top[0];
    if (g) {
      const n = el('div', 'gagnant', d, g.code);
      n.style.color = g.couleur || this.theme.couleur(g.code);
      el('h2', '', d, g.nom);
      el('p', '', d, `${fmt(g.soldats)} soldats`);
    } else el('h2', '', d, 'Aucun département en guerre');
    const liste = el('div', 'liste', d);
    p.top.forEach((t, i) => {
      const l = el('div', 'ligne cadre', liste);
      el('span', 'medaille', l, ['🥇', '🥈', '🥉'][i]);
      const ph = el('canvas', 'photo', l);
      ph.width = ph.height = 100;
      this.#dessinerPhoto(ph, t.heros, this.theme.couleur(t.code));
      el('b', '', l, `${t.code} ${t.nom}`);
      el('small', '', l, `${fmt(t.soldats)} soldats${t.heros ? ` · héros : ${pseudoPropre(t.heros.nom)}` : ''}`);
    });
    if (p.roi) {
      const r = el('div', 'roi-final cadre', d);
      const ph = el('canvas', 'photo', r);
      ph.width = ph.height = 120;
      this.#dessinerPhoto(ph, p.roi, '#ffd23d');
      el('small', '', r, '👑 ROI DU PAYS');
      el('b', '', r, `${pseudoPropre(p.roi.nom)} — ${fmt(p.roi.total)} soldats`);
    }
    // le logo Empira, toujours affiché sous le podium
    const logo = el('canvas', 'logo', d);
    logo.width = 300;
    logo.height = 120;
    const g2 = logo.getContext('2d');
    g2.scale(2, 2);
    dessinerLogo(g2, 75, 2, 'centre', this.photos.logo);
    el('p', 'suite', d, 'La prochaine partie démarre à la première action — écris ton département !');
    d.classList.add('montre');
  }

  /** Bandeau d'état en bas de la carte : affiché seulement quand quelque chose ne va pas. */
  afficherEtat(texte) {
    this.eEtat.textContent = texte || '';
    this.eEtat.classList.toggle('montre', Boolean(texte));
  }
}
