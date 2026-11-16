// Point d'entrée du jeu : TikFinity → garde-fous → moteur → rendu, interface, voix, sons.

import { Partie } from './game.js';
import { Theme, lireReglages } from './theme.js';
import { Photos } from './photos.js';
import { Rendu } from './rendu.js';
import { Interface } from './hud.js';
import { Annonceur, sortieVoix } from './voix.js';
import { Bruitages, Musique } from './audio.js';
import { connecterTikFinity, convertirTikFinity, URL_TIKFINITY } from './tikfinity.js';
import { EventGuard } from '../../public/src/core/guard.js';

/* global VENTE */
const VERSION_VENDUE = typeof VENTE !== 'undefined' && VENTE;
const STOCKAGE = 'guerre-des-departements';

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

  const recevoir = (donnees) => {
    const r = convertirTikFinity(donnees, { hote: reglages.hote });
    if (!r) return;
    if (r.commande) return executer(r.commande);
    const g = garde.check(r.evenement);
    if (g.ok) partie.traiter(g.event);
  };
  connecterTikFinity({ url: reglages.tikfinity || URL_TIKFINITY, surMessage: recevoir, surEtat: (e) => hud.etatTikFinity(e) });

  // sons associés aux événements du moteur
  const sons = (evs) => {
    for (const e of evs) {
      if (e.type === 'arrivee' && e.annoncer) bruitages.jouer('carillon');
      else if (e.type === 'cadeau' && e.renfort === 'escouade') bruitages.jouer('avion');
      else if (e.type === 'cadeau' && e.renfort === 'commandos') bruitages.jouer('avion');
      else if (e.type === 'tank') bruitages.jouer('canon');
      else if (e.type === 'attaque') {
        const s = { chasseur: 'chasseur', missiles: 'missile', helicos: 'helico', tsunami: 'vague', nucleaire: 'sifflet', tomate: 'rafale' }[e.sorte];
        if (s) bruitages.jouer(s);
      } else if (e.type === 'impact' && !e.bloque && e.detruit > 0) bruitages.jouer(e.sorte === 'nucleaire' ? 'nucleaire' : e.sorte === 'helicos' ? 'mitrailleuse' : 'explosion');
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
