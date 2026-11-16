// Point d'entrée du jeu : live TikTok (relayé par le serveur du jeu : connexion directe ou TikFinity) → garde-fous → moteur → rendu, interface, voix, sons.

import { Partie } from './game.js';
import { Theme, lireReglages } from './theme.js';
import { Photos } from './photos.js';
import { Rendu } from './rendu.js';
import { Interface } from './hud.js';
import { Annonceur, sortieVoix } from './voix.js';
import { Bruitages, Musique } from './audio.js';
import { connecterTikFinity, convertirTikFinity } from './tikfinity.js';
import { EventGuard } from '../../public/src/core/guard.js';
import { LOGO_COMPLET, poserIcone } from './logo.js';

/* global VENTE */
const VERSION_VENDUE = typeof VENTE !== 'undefined' && VENTE;
const STOCKAGE = 'empira-conquest';

function lire(cle, defaut) {
  try {
    return JSON.parse(localStorage.getItem(`${STOCKAGE}:${cle}`)) ?? defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(`${STOCKAGE}:${cle}`, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : le jeu continue sans sauvegarde */
  }
}

function adapterEchelle() {
  const k = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  document.documentElement.style.setProperty('--k', String(k));
  return k;
}

async function licenceValide() {
  if (!VERSION_VENDUE) return { ok: true };
  try {
    const r = await fetch('/licence', { cache: 'no-store' });
    return await r.json();
  } catch {
    return { ok: false, raison: 'Le serveur du jeu ne répond pas : lancez « LANCER LE JEU ».' };
  }
}

async function demarrer() {
  poserIcone();
  const logoLicence = document.createElement('img');
  logoLicence.src = LOGO_COMPLET;
  logoLicence.alt = 'Empira Agency';
  document.querySelector('#licence > div')?.prepend(logoLicence);
  adapterEchelle();
  window.addEventListener('resize', adapterEchelle);
  const reglages = lireReglages(location.search);
  const licence = await licenceValide();
  if (!licence.ok) {
    document.getElementById('licence').classList.add('montre');
    if (licence.raison) document.getElementById('licence-texte').textContent = licence.raison;
    return;
  }

  const stats = lire('stats', { parties: 0, victoires: {} });
  const partie = new Partie({ membres: lire('membres', {}), surMembres: (m) => ecrire('membres', m) });
  const theme = new Theme(reglages);
  const photos = new Photos();
  const rendu = new Rendu(document.getElementById('carte'), partie, theme, { photos });
  // netteté : le canevas suit la taille réelle de l'affichage et la mise à l'échelle de Windows
  const idEcran = Math.random().toString(36).slice(2, 12);
  const alerteTaille = document.createElement('div');
  alerteTaille.className = 'alerte-taille';
  document.getElementById('interface').appendChild(alerteTaille);
  let finAlerte = null;
  const signaler = () => {
    const dpr = window.devicePixelRatio || 1;
    fetch('/ecran', { method: 'POST', body: JSON.stringify({ id: idEcran, largeur: window.innerWidth, hauteur: window.innerHeight, dpr, q: rendu.q, agent: navigator.userAgent }) }).catch(() => {});
  };
  const ajuster = () => {
    const dpr = window.devicePixelRatio || 1;
    rendu.adapter(adapterEchelle() * dpr);
    signaler();
    // la source est trop petite ou couchée : l'image sera étirée, donc floue ; on le dit clairement pendant 25 s
    const l = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    const petit = l < 1000 || h < 1700 || window.innerWidth > window.innerHeight;
    alerteTaille.textContent = petit ? `Image floue : le jeu est affiché en ${l} × ${h} pixels. Règle la source sur 1080 × 1920 (voir la fenêtre de pilotage).` : '';
    alerteTaille.classList.toggle('montre', petit);
    clearTimeout(finAlerte);
    if (petit) finAlerte = setTimeout(() => alerteTaille.classList.remove('montre'), 25000);
  };
  ajuster();
  window.addEventListener('resize', ajuster);
  setInterval(signaler, 15000);
  const suivreDpr = () => matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => (ajuster(), suivreDpr()), { once: true });
  suivreDpr();
  const hud = new Interface(document.getElementById('interface'), partie, theme, photos);
  const bruitages = new Bruitages();
  const musique = new Musique();
  musique.charger();
  const annonceur = new Annonceur(partie, { parler: sortieVoix({ nomVoix: reglages.nomVoix, genre: reglages.voix }), surParole: (ms) => musique.baisser(ms) });
  const garde = new EventGuard({ maxEventAgeSec: 120, dedupeWindow: 5000, maxEventsPerSec: 500, maxNameLength: 24, maxCommentLength: 200 });

  const executer = ({ nom, arg }) => {
    if (partie.commande(nom, arg)) return;
    if (nom === 'dire' && arg) annonceur.dire(arg, 4, `dire:${Date.now()}`);
    else if (nom === 'suivant') musique.suivant();
    else if (nom === 'musique') musique.basculer();
    else if (nom === 'son') bruitages.actif = !bruitages.actif;
    else if (nom === 'zoom') rendu.zoomActif = !rendu.zoomActif;
    else if (nom === 'cris') bruitages.jouer('hourra');
    else if (nom === 'guerre') {
      bruitages.jouer('tambour');
      setTimeout(() => bruitages.jouer('clairon'), 1300);
      setTimeout(() => bruitages.jouer('bataille'), 1800);
    }
  };

  // état des connexions, résumé dans un bandeau discret
  const connexion = { canal: 'connexion', tiktok: null };
  const majEtat = () => {
    if (connexion.canal !== 'connecte') hud.afficherEtat(connexion.canal === 'connexion' ? 'Connexion au serveur du jeu…' : 'Serveur du jeu injoignable — relancez « LANCER LE JEU »');
    else if (connexion.tiktok && connexion.tiktok.etat !== 'connecte') hud.afficherEtat(`TikTok : ${connexion.tiktok.detail} — le jeu continue`);
    else hud.afficherEtat(null);
  };

  const recevoir = (donnees) => {
    let msg = donnees;
    if (typeof msg === 'string') {
      try {
        msg = JSON.parse(msg);
      } catch {
        return;
      }
    }
    // messages du serveur du jeu : commandes de la régie et état de la connexion TikTok
    if (msg && msg.commande) return executer(msg.commande);
    if (msg && msg.licence && !msg.licence.ok) {
      document.getElementById('licence').classList.add('montre');
      if (msg.licence.raison) document.getElementById('licence-texte').textContent = msg.licence.raison;
      return;
    }
    if (msg && msg.statut) {
      connexion.tiktok = msg.statut;
      return majEtat();
    }
    const r = convertirTikFinity(msg, { hote: reglages.hote });
    if (!r) return;
    if (r.commande) return executer(r.commande);
    const g = garde.check(r.evenement);
    if (g.ok) partie.traiter(g.event);
  };
  connecterTikFinity({ url: `ws://${location.host}/evenements`, surMessage: recevoir, surEtat: (e) => ((connexion.canal = e), majEtat()) });

  // sons associés aux événements du moteur
  const sons = (evs) => {
    for (const e of evs) {
      if (e.type === 'arrivee' && e.annoncer) bruitages.jouer('carillon');
      else if (e.type === 'cadeau' && e.renfort === 'escouade') bruitages.jouer('avion');
      else if (e.type === 'cadeau' && e.renfort === 'commandos') bruitages.jouer('avion');
      else if (e.type === 'tank') bruitages.jouer('canon');
      else if (e.type === 'attaque') {
        const s = { chasseur: 'chasseur', missiles: 'missile', helicos: 'helico', tsunami: 'vague', nucleaire: 'sifflet', tomate: 'rafale', porteavions: 'clairon' }[e.sorte];
        if (s) bruitages.jouer(s);
      } else if (e.type === 'impact' && !e.bloque && e.detruit > 0) bruitages.jouer(e.sorte === 'nucleaire' ? 'nucleaire' : e.sorte === 'helicos' ? 'mitrailleuse' : 'explosion');
      else if (e.type === 'vagueAerienne') bruitages.jouer('chasseur');
      else if (e.type === 'ambiance' && e.sorte === 'ravitaillement') bruitages.jouer('avion');
      else if (e.type === 'ambiance' && e.sorte === 'bombardement') bruitages.jouer('sifflet');
      else if (e.type === 'impact' && e.sorte === 'bombardement' && !e.bloque) bruitages.jouer('explosion');
      else if (e.type === 'vagueAnnonce') bruitages.jouer('tension');
      else if (e.type === 'vagueDebut') bruitages.jouer(e.vague.sirene ? 'sirene' : 'clairon');
      else if (e.type === 'evenementDebut' || e.type === 'occupation') bruitages.jouer('tambour');
      else if (e.type === 'podium') bruitages.jouer('hourra');
      else if (e.type === 'debutPartie') bruitages.jouer('clairon');
    }
  };

  const suivi = (evs) => {
    for (const e of evs) {
      if (e.type === 'debutPartie') theme.reinitialiser();
      if (e.type === 'podium') {
        stats.parties++;
        const g = e.podium.top[0];
        if (g) stats.victoires[g.code] = (stats.victoires[g.code] || 0) + 1;
        ecrire('stats', stats);
      }
    }
  };

  let precedent = performance.now();
  let horlogeInterface = 0;
  const image = (maintenant) => {
    // quoi qu'il arrive, l'image suivante est programmée : une erreur ne doit jamais figer le live
    requestAnimationFrame(image);
    try {
      const dt = Math.max(0, (maintenant - precedent) / 1000);
      precedent = maintenant;
      partie.update(dt); // temps réel, même à peu d'images par seconde
      const evs = partie.drain();
      suivi(evs);
      rendu.surEvenements(evs);
      hud.surEvenements(evs);
      annonceur.surEvenements(evs);
      sons(evs);
      annonceur.tick();
      rendu.dessiner(Math.min(dt, 0.1));
      horlogeInterface += dt;
      if (horlogeInterface >= 0.125) {
        hud.rafraichir(horlogeInterface);
        horlogeInterface = 0;
      }
    } catch (err) {
      console.error('Erreur pendant une image (le jeu continue) :', err);
    }
  };
  requestAnimationFrame(image);

  // accès de diagnostic (console) — aucune simulation n'est incluse dans le jeu
  window.empira = { partie, rendu, hud, theme, annonceur, recevoir, stats };
}

demarrer();
