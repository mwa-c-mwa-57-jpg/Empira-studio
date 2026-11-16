// Fenêtre de pilotage : licence, connexion directe au live TikTok, vérifications, couleurs, voix, régie, adresse pour LIVE Studio.

import { PALETTE } from './config.js';
import { LOGO_COMPACT, poserIcone } from './logo.js';

/* global VENTE */
const VERSION_VENDUE = typeof VENTE !== 'undefined' && VENTE;
const $ = (id) => document.getElementById(id);
const MEMOIRE = 'empira-conquest:demarrage';

const memoire = (() => {
  try {
    return JSON.parse(localStorage.getItem(MEMOIRE)) || {};
  } catch {
    return {};
  }
})();
const memoriser = () => {
  try {
    localStorage.setItem(MEMOIRE, JSON.stringify(memoire));
  } catch {
    /* rien */
  }
};

function marquer(icone, texte, sous, etat) {
  $(icone).textContent = etat === 'ok' ? '✔' : etat === 'ko' ? '✘' : '…';
  $(icone).className = etat;
  if (sous !== null) $(texte).textContent = sous;
}

const valeur = (nom) => document.querySelector(`input[name="${nom}"]:checked`)?.value;
function cocher(nom, v) {
  const el = v && document.querySelector(`input[name="${nom}"][value="${v}"]`);
  if (el) el.checked = true;
}

// ------------------------------------------------------------------ licence

async function verifierLicence() {
  if (!VERSION_VENDUE) {
    $('blocLicence').hidden = true;
    return true;
  }
  try {
    const r = await (await fetch('/licence', { cache: 'no-store' })).json();
    $('etatLicence').textContent = r.ok ? `✔ Licence active${r.horsLigne ? ' (vérification hors ligne)' : ''}` : `✘ ${r.raison || 'Licence non activée'}`;
    $('etatLicence').className = r.ok ? 'ok' : 'ko';
    $('formLicence').hidden = r.ok;
    $('ligneDesactiver').hidden = !r.ok;
    const achat = typeof r.achat === 'string' && /^https:\/\//.test(r.achat) ? r.achat : '';
    $('ligneAcheter').hidden = r.ok || !achat;
    if (achat) $('acheter').href = achat;
    return r.ok;
  } catch {
    $('etatLicence').textContent = '✘ Le serveur du jeu ne répond pas : relancez « LANCER LE JEU ».';
    $('etatLicence').className = 'ko';
    return false;
  }
}

async function activer() {
  const cle = $('cle').value.trim();
  if (!cle) return;
  $('msgLicence').textContent = 'Activation…';
  try {
    const r = await (await fetch('/licence/activer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle }) })).json();
    $('msgLicence').textContent = r.ok ? 'Licence activée sur ce PC.' : r.raison || 'Activation refusée.';
    $('msgLicence').className = r.ok ? 'ok' : 'ko';
  } catch {
    $('msgLicence').textContent = 'Impossible de joindre le serveur du jeu.';
    $('msgLicence').className = 'ko';
  }
  await verifierLicence();
}

// ------------------------------------------------------------------ connexion directe au live TikTok

const ETATS_LIVE = { connecte: 'ok', erreur: 'ko', deconnecte: 'ko', reconnexion: 'attente', connexion: 'attente' };
async function etatLive() {
  try {
    const e = await (await fetch('/tiktok/etat', { cache: 'no-store' })).json();
    const via = e.etat === 'connecte' ? (e.source === 'tikfinity' ? ' — via TikFinity' : ' — connexion directe') : '';
    marquer('iLive', 'sLive', `${e.detail || ''}${e.source === 'tikfinity' ? '' : via}`, ETATS_LIVE[e.etat] || 'attente');
  } catch {
    marquer('iLive', 'sLive', 'Le serveur du jeu ne répond pas : relancez « LANCER LE JEU ».', 'ko');
  }
}

async function connecter() {
  const pseudo = $('pseudo').value.trim().replace(/^@/, '');
  if (!pseudo) return $('pseudo').focus();
  marquer('iLive', 'sLive', `Connexion au live de @${pseudo}…`, 'attente');
  try {
    await fetch('/tiktok/connecter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo, cleEuler: $('euler').value.trim(), source: $('source').value }) });
  } catch {
    /* l'état affiché dira ce qu'il en est */
  }
  majAdresse();
  etatLive();
}

async function deconnecter() {
  await fetch('/tiktok/deconnecter', { method: 'POST' }).catch(() => {});
  etatLive();
}

async function commande(nom, arg = '') {
  try {
    const r = await (await fetch('/commande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom, arg }) })).json();
    $('retourRegie').textContent = r.ok ? (r.pages ? `Envoyé au jeu (${r.pages} écran${r.pages > 1 ? 's' : ''}).` : 'Envoyé, mais aucun écran de jeu n’est ouvert.') : 'Commande refusée.';
    $('retourRegie').className = r.ok && r.pages ? 'ok' : 'ko';
  } catch {
    $('retourRegie').textContent = 'Le serveur du jeu ne répond pas.';
    $('retourRegie').className = 'ko';
  }
  clearTimeout(commande.minuteur);
  commande.minuteur = setTimeout(() => ($('retourRegie').textContent = ''), 3000);
}

// ------------------------------------------------------------------ vérifications

let voix = [];
async function verifierVoix() {
  try {
    voix = await (await fetch('/voix', { cache: 'no-store' })).json();
  } catch {
    voix = [];
  }
  const fr = voix.filter((v) => /^fr/i.test(v.langue));
  marquer('iVoix', 'sVoix', fr.length ? `${fr.length} voix française(s) : ${fr.map((v) => v.nom).join(', ')}` : voix.length ? 'Aucune voix française : Paramètres Windows → Heure et langue → Voix.' : 'Le serveur ne répond pas : la voix du navigateur sera utilisée.', fr.length ? 'ok' : 'ko');
  remplirVoix();
}

function remplirVoix() {
  const genre = valeur('voix') === 'homme' ? 'Male' : 'Female';
  const triees = [...voix].sort((a, b) => (/^fr/i.test(b.langue) - /^fr/i.test(a.langue)) || ((b.genre === genre) - (a.genre === genre)));
  const sel = $('nomVoix');
  sel.replaceChildren(...triees.map((v) => {
    const o = document.createElement('option');
    o.value = v.nom;
    o.textContent = `${v.nom} (${v.genre === 'Male' ? 'homme' : v.genre === 'Female' ? 'femme' : v.genre}, ${v.langue})`;
    return o;
  }));
  const voulue = memoire.nomVoix && triees.find((v) => v.nom === memoire.nomVoix && v.genre === genre);
  const defaut = triees.find((v) => /^fr/i.test(v.langue) && v.genre === genre) || triees[0];
  if (voulue || defaut) sel.value = (voulue || defaut).nom;
  majAdresse();
}

// netteté : taille à laquelle LIVE Studio (ou OBS, ou le navigateur) affiche réellement le jeu
async function verifierAffichage() {
  let liste = [];
  try {
    liste = await (await fetch('/ecrans', { cache: 'no-store' })).json();
  } catch {
    return;
  }
  if (!liste.length) return marquer('iAff', 'sAff', 'Aucun écran de jeu ouvert : ajoute la source dans LIVE Studio (ou « Ouvrir le jeu dans le navigateur »).', 'attente');
  const textes = liste.map((e) => {
    const l = Math.round(e.largeur * (e.dpr || 1));
    const h = Math.round(e.hauteur * (e.dpr || 1));
    const couche = e.largeur > e.hauteur;
    const ok = l >= 1000 && h >= 1700 && !couche;
    const conseil = couche ? 'la source est en paysage : règle-la en 1080 × 1920 (portrait)' : !ok ? 'trop petit, LIVE Studio l’étire → flou. Tape la « taille à taper dans LIVE Studio » indiquée plus bas, sans agrandir la source à la souris' : 'net';
    return { ok, texte: `${l} × ${h} pixels — ${conseil}` };
  });
  const ok = textes.every((t) => t.ok);
  marquer('iAff', 'sAff', textes.map((t) => t.texte).join(' · '), ok ? 'ok' : 'ko');
}

async function verifierMusique() {
  try {
    const l = await (await fetch('/musiques', { cache: 'no-store' })).json();
    marquer('iMus', 'sMus', l.length ? `${l.length} musique(s) dans le dossier « musique ».` : 'Aucune musique : dépose des MP3 dans le dossier « musique » (facultatif).', l.length ? 'ok' : 'ko');
  } catch {
    marquer('iMus', 'sMus', 'Le serveur ne répond pas.', 'ko');
  }
}

// ------------------------------------------------------------------ couleurs et adresse

// Taille de la source « Lien » : LIVE Studio réduit la source de la mise à l'échelle de Windows (125 %, 150 %…).
// En tapant 1080 × 1920 multiplié par cette échelle, la source remplit l'écran sans être étirée : l'image reste nette.
const ECHELLES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
function echelleWindows() {
  const dpr = window.devicePixelRatio || 1;
  return ECHELLES.reduce((a, b) => (Math.abs(b - dpr) < Math.abs(a - dpr) ? b : a));
}
function majTaille() {
  const e = Number($('echelle').value) || 1;
  const l = Math.round(1080 * e);
  const h = Math.round(1920 * e);
  $('tailleValeur').textContent = `${l} × ${h}`;
  $('tailleExplication').textContent = e === 1
    ? 'La source doit remplir tout l’écran de LIVE Studio sans que tu l’agrandisses à la souris.'
    : `Windows est réglé à ${Math.round(e * 100)} % : avec 1080 × 1920, LIVE Studio afficherait la source à ${Math.round(100 / e)} % et tu devrais l’étirer, ce qui rend l’image floue. Avec ${l} × ${h}, elle remplit l’écran et reste nette. Ne l’agrandis jamais à la souris : si elle ne remplit pas tout, essaie l’échelle suivante.`;
}

function majAdresse() {
  const p = new URLSearchParams();
  const hote = $('pseudo').value.trim().replace(/^@/, '');
  if (hote) p.set('hote', hote);
  const couleurs = valeur('couleurs');
  p.set('couleurs', couleurs);
  if (couleurs === 'fixe') {
    memoire.graine = memoire.graine || Math.floor(Math.random() * 2 ** 31);
    p.set('graine', memoire.graine);
  }
  if (couleurs === 'perso') p.set('palette', $('palette').value.split(',').map((c) => c.trim().replace('#', '')).filter(Boolean).join(','));
  p.set('unites', valeur('unites'));
  if (valeur('unites') === 'perso') p.set('unitesperso', $('unitesPerso').value.replace('#', ''));
  p.set('vehicules', valeur('vehicules'));
  if (valeur('vehicules') === 'perso') p.set('vehiculesperso', $('vehiculesPerso').value.replace('#', ''));
  p.set('contours', valeur('contours'));
  p.set('voix', valeur('voix'));
  if ($('nomVoix').value) p.set('nomvoix', $('nomVoix').value);
  const adresse = `${location.origin}/empira-conquest.html?${p}`;
  $('adresse').textContent = adresse;
  $('ouvrir').href = adresse;
  $('perso').hidden = couleurs !== 'perso';
  const palette = couleurs === 'perso' ? $('palette').value.split(',').map((c) => `#${c.trim().replace('#', '')}`) : PALETTE;
  $('apercu').replaceChildren(...palette.slice(0, 32).map((c) => {
    const i = document.createElement('i');
    i.style.background = c;
    return i;
  }));
  Object.assign(memoire, { couleurs, palette: $('palette').value, unites: valeur('unites'), unitesPerso: $('unitesPerso').value, vehicules: valeur('vehicules'), vehiculesPerso: $('vehiculesPerso').value, contours: valeur('contours'), voix: valeur('voix'), nomVoix: $('nomVoix').value });
  memoriser();
}

async function copier() {
  const t = $('adresse').textContent;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('adresse'));
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    try {
      document.execCommand('copy');
    } catch {
      /* rien */
    }
  }
  $('copie').textContent = 'Copiée !';
  setTimeout(() => ($('copie').textContent = ''), 2200);
}

function init() {
  $('logo').src = LOGO_COMPACT;
  poserIcone();
  fetch('/reglages', { cache: 'no-store' }).then((r) => r.json()).then((r) => {
    if (r.pseudo && !$('pseudo').value) $('pseudo').value = r.pseudo;
    if (r.source) $('source').value = r.source;
    $('euler').placeholder = r.euler ? 'ta clé est enregistrée (écris « aucune » pour l’effacer)' : r.eulerInclus ? 'facultatif : une clé Empira est déjà incluse' : 'laisser vide';
    majAdresse();
  }).catch(() => {});
  $('palette').value = memoire.palette || '';
  cocher('couleurs', memoire.couleurs);
  cocher('unites', memoire.unites);
  cocher('vehicules', memoire.vehicules);
  if (memoire.unitesPerso) $('unitesPerso').value = memoire.unitesPerso;
  if (memoire.vehiculesPerso) $('vehiculesPerso').value = memoire.vehiculesPerso;
  cocher('contours', memoire.contours);
  cocher('voix', memoire.voix);
  for (const el of document.querySelectorAll('input')) el.addEventListener('input', majAdresse);
  // choisir une couleur personnalisée sélectionne « Ma couleur »
  for (const nom of ['unites', 'vehicules']) {
    $(`${nom}Perso`).addEventListener('input', () => {
      cocher(nom, 'perso');
      majAdresse();
    });
  }
  for (const el of document.querySelectorAll('input[name="voix"]')) el.addEventListener('change', remplirVoix);
  $('nomVoix').addEventListener('change', majAdresse);
  $('activer').addEventListener('click', activer);
  $('desactiver').addEventListener('click', async () => {
    if (!confirm('Désactiver la licence sur ce PC ? Elle pourra être activée sur un autre PC.')) return;
    const r = await (await fetch('/licence/desactiver', { method: 'POST' })).json().catch(() => ({ ok: false }));
    $('msgLicence').textContent = r.ok ? 'Licence désactivée sur ce PC.' : r.raison || 'Désactivation impossible.';
    $('msgLicence').className = r.ok ? 'ok' : 'ko';
    verifierLicence();
  });
  $('connecter').addEventListener('click', connecter);
  $('deconnecter').addEventListener('click', deconnecter);
  $('source').addEventListener('change', () => $('pseudo').value.trim() && connecter());
  // échelle détectée sur ce PC (le navigateur doit être à 100 % de zoom), modifiable
  $('echelle').value = String(memoire.echelle || echelleWindows());
  majTaille();
  $('echelle').addEventListener('change', () => {
    memoire.echelle = Number($('echelle').value);
    try {
      localStorage.setItem(MEMOIRE, JSON.stringify(memoire));
    } catch {
      /* stockage indisponible */
    }
    majTaille();
  });
  $('pseudo').addEventListener('keydown', (e) => e.key === 'Enter' && connecter());
  for (const b of document.querySelectorAll('button[data-cmd]')) b.addEventListener('click', () => commande(b.dataset.cmd, b.dataset.arg || ''));
  $('btnDuree').addEventListener('click', () => commande('duree', $('duree').value));
  $('btnDire').addEventListener('click', () => $('texteDire').value.trim() && commande('dire', $('texteDire').value.trim()));
  $('btnFixe').addEventListener('click', () => $('texteFixe').value.trim() && commande('fixe', $('texteFixe').value.trim()));
  $('btnMembres').addEventListener('click', () => confirm('Tout le monde oublie son département ?') && commande('membres'));
  $('btnReset').addEventListener('click', () => confirm('Tout remettre à zéro (partie, membres) ?') && commande('reset'));
  etatLive();
  setInterval(etatLive, 2000);
  $('copier').addEventListener('click', copier);
  $('reverifier').addEventListener('click', () => Promise.all([verifierVoix(), verifierMusique()]));
  $('tester').addEventListener('click', () => fetch(`/parler?t=${encodeURIComponent('Que la guerre commence ! Écris le numéro de ton département !')}&voix=${encodeURIComponent($('nomVoix').value)}`).catch(() => {}));
  majAdresse();
  verifierLicence();
  verifierVoix();
  verifierMusique();
  verifierAffichage();
  setInterval(verifierAffichage, 3000);
}

init();
