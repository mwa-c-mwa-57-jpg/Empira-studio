'use strict';
// La Grimpe : serveur local.
//   node server.js            -> mode live (pseudo TikTok lu dans config.json)
//   node server.js --demo     -> mode démo (faux spectateurs, aucune connexion TikTok)
//   node server.js --pseudo moncompte
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Jeu, BOSS } = require('./src/jeu');
const { Bots } = require('./src/demo');
const { ConnexionTikTok } = require('./src/tiktok');

const RACINE = __dirname;
const PUBLIC = path.join(RACINE, 'public');
const DONNEES = path.join(RACINE, 'donnees');
const FICHIER_ETAT = path.join(DONNEES, 'etat.json');

function log(msg) {
  const h = new Date().toLocaleTimeString('fr-FR');
  console.log(`[${h}] ${msg}`);
}

function lireConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RACINE, 'config.json'), 'utf8'));
  } catch (e) {
    console.error('\n❌ config.json est illisible : ' + e.message);
    console.error('   Vérifie les virgules et les guillemets (tu peux coller le fichier sur https://jsonlint.com).\n');
    process.exit(1);
  }
}

const config = lireConfig();
const args = process.argv.slice(2);
const iPseudo = args.indexOf('--pseudo');
const pseudo = String(iPseudo >= 0 ? args[iPseudo + 1] || '' : config.tiktok.pseudo || '').replace(/^@/, '').trim();
const MODE = args.includes('--demo') || !pseudo ? 'demo' : 'live';
const PORT = Number(process.env.PORT || config.serveur.port || 3000);

const reglages = {
  volume: config.sons.volume,
  sonsAutomatiques: config.sons.sonsAutomatiques,
  aussiSurLaRegie: config.sons.aussiSurLaRegie
};
let connexion = { statut: MODE === 'demo' ? 'demo' : 'arret', detail: MODE === 'demo' ? 'Mode démo : aucune connexion TikTok.' : '' };
let spectateurs = null;
let ecranFin = null;

// ---------- Diffusion WebSocket ----------
const { WebSocketServer } = require('ws');
const clients = new Set();
function envoyer(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function diffuser(msg) {
  const s = JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === 1) ws.send(s);
}

let etatModifie = true;
const jeu = new Jeu(config, {
  emit: (type, donnees) => {
    etatModifie = true;
    diffuser({ t: 'evt', type, d: donnees });
    if (type === 'refuge') log(`🏁 Refuge ${donnees.index + 1} débloqué${donnees.user ? ' par @' + donnees.user.pseudo : ''}`);
    if (type === 'cadeau') log(`🎁 @${donnees.user.pseudo} : « ${donnees.cadeau} » x${donnees.repeat} (${donnees.valeur} pièces)`);
    if (type === 'sabotage') log(`🦹 @${donnees.user.pseudo} sabote avec « ${donnees.cadeau} » : ${donnees.nomBoss}${donnees.renfort ? ' (renfort)' : ''}`);
    if (type === 'bossFin') log(`${donnees.gagne ? '💥 Boss vaincu' : '😈 Boss gagnant'} : ${donnees.nom}${donnees.perte ? ' (-' + donnees.perte + ' m)' : ''}`);
  }
});

// ---------- Sauvegarde ----------
fs.mkdirSync(DONNEES, { recursive: true });
try {
  if (fs.existsSync(FICHIER_ETAT)) {
    jeu.charger(JSON.parse(fs.readFileSync(FICHIER_ETAT, 'utf8')));
    log(`💾 Partie reprise : refuge ${jeu.etat.objIndex}/${jeu.N}, ${Math.round(jeu.etat.alt)} m, ${Object.keys(jeu.etat.users).length} spectateurs connus.`);
  }
} catch (e) {
  log('⚠️  Sauvegarde illisible, nouvelle partie : ' + e.message);
}
function sauvegarder() {
  try {
    const tmp = FICHIER_ETAT + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(jeu.versJSON()));
    fs.renameSync(tmp, FICHIER_ETAT);
  } catch (e) {
    log('⚠️  Sauvegarde impossible : ' + e.message);
  }
}
setInterval(sauvegarder, 3000);

// ---------- Données envoyées aux pages ----------
function configPublique() {
  return {
    mode: MODE,
    pseudo,
    mascotte: config.mascotte.nom,
    metresEntreRefuges: config.jeu.metresEntreRefuges,
    objectifs: config.objectifs.map(o => ({ nom: o.nom, pieces: o.pieces, image: o.image })),
    phrasesBandeau: config.autopilote.phrasesBandeau.map(p => p.replace(/\{mascotte\}/g, config.mascotte.nom)).concat(phrasesSaboteurs()),
    saboteurs: listeSaboteurs().map(s => ({ nom: s.nom, pieces: s.pieces, image: s.image, boss: s.boss, nomBoss: (BOSS[s.boss] || BOSS.pigeon).nom, emoji: (BOSS[s.boss] || BOSS.pigeon).emoji })),
    degatsParPiece: (config.saboteurs || {}).degatsParPiece || 6,
    secondesEntrePhrasesBandeau: config.autopilote.secondesEntrePhrasesBandeau,
    commandes: Object.keys(config.commandesChat.liste),
    fichiersPerso: config.sons.fichiersPerso || {},
    sonsCadeaux: {
      applaudirDes: config.sons.applaudirDesPieces ?? 100,
      merciVocalDes: config.sons.merciVocalDesPieces ?? 1000,
      finRafaleSecondes: config.sons.secondesFinRafalePetitsCadeaux ?? 3
    }
  };
}
function listeSaboteurs() {
  const S = config.saboteurs || {};
  return S.actifs === false ? [] : (S.liste || []);
}
// Le bandeau rappelle aux spectateurs comment saboter… et comment se défendre
function phrasesSaboteurs() {
  const liste = listeSaboteurs();
  if (!liste.length) return [];
  const p = liste.map(s => `😈 Un ${s.nom} (${s.pieces} 🪙) lâche ${(BOSS[s.boss] || BOSS.pigeon).emoji} sur ${config.mascotte.nom} !`);
  p.push(`⚔️ Contre un boss : tapez, ou envoyez un cadeau (1 pièce = ${(config.saboteurs || {}).degatsParPiece || 6} coups)`);
  return p;
}
function etatComplet() {
  return Object.assign(jeu.etatPublic(), {
    connexion,
    spectateurs,
    reglages,
    bots: bots.actif,
    ecranFin
  });
}

// ---------- Mode démo / live ----------
const bots = new Bots(jeu, config.objectifs);
let tiktok = null;
if (MODE === 'live') {
  tiktok = new ConnexionTikTok({
    pseudo,
    signApiKey: config.tiktok.signApiKey,
    reconnexionSecondes: config.tiktok.reconnexionSecondes,
    jeu,
    log,
    onStatut: (statut, detail) => {
      connexion = { statut, detail };
      etatModifie = true;
      log('📡 ' + detail);
    },
    onSpectateurs: n => { spectateurs = n; etatModifie = true; }
  });
}

// ---------- Commandes de la régie ----------
function commande(c) {
  jeu.present();
  switch (c.cmd) {
    case 'present': break;
    case 'autopilote': jeu.autopilote = !!c.valeur; break;
    case 'reglage':
      if (c.cle in reglages) reglages[c.cle] = c.cle === 'volume' ? Math.max(0, Math.min(1, Number(c.valeur))) : !!c.valeur;
      break;
    case 'son': diffuser({ t: 'evt', type: 'son', d: { son: String(c.son), regie: true } }); break;
    case 'scene': jeu.sceneManuelle(String(c.type)); break;
    case 'parler': if (c.texte) jeu.parler(c.texte); break;
    case 'miniJeu': jeu.lancerMiniJeu(String(c.type || '')); break;
    case 'stopMiniJeu': jeu.arreterMiniJeu(); break;
    case 'boss': if (!jeu.boss && !jeu.miniJeu) jeu.bossAleatoire(); break;
    case 'objectif': jeu.changerObjectif(c.delta > 0 ? 1 : -1); break;
    case 'finLive': ecranFin = jeu.recap(); diffuser({ t: 'evt', type: 'finLive', d: ecranFin }); break;
    case 'masquerFin': ecranFin = null; diffuser({ t: 'evt', type: 'masquerFin', d: {} }); break;
    case 'nouveauLive': ecranFin = null; jeu.nouveauLive(); sauvegarder(); log('🔄 Nouveau live : compteurs remis à zéro (record conservé).'); break;
    case 'bots':
      if (MODE !== 'demo') return;
      if (c.valeur) bots.demarrer(); else bots.arreter();
      break;
    case 'simuler':
      if (MODE !== 'demo') return; // jamais de fausses données pendant un vrai live
      simuler(c);
      break;
    default: return;
  }
  etatModifie = true;
}

function simuler(c) {
  const user = c.pseudo
    ? { id: 'sim-' + c.pseudo, pseudo: String(c.pseudo).slice(0, 24), nom: String(c.pseudo).slice(0, 24), avatar: '' }
    : bots.user();
  if (c.type === 'cadeau') bots.simulerCadeau(user, Number(c.index) || 0, Math.max(1, Math.min(50, Number(c.repeat) || 1)));
  if (c.type === 'sabotage') bots.simulerSabotage(user, Number(c.index) || 0);
  if (c.type === 'taps') jeu.onLike({ user, nombre: Math.max(1, Math.min(500, Number(c.nombre) || 10)) });
  if (c.type === 'chat') jeu.onChat({ user, texte: String(c.texte || '').slice(0, 120) });
  if (c.type === 'arrivee') jeu.onArrivee({ user });
  if (c.type === 'abonne') jeu.onAbonne({ user });
  if (c.type === 'partage') jeu.onPartage({ user });
}

// ---------- Serveur HTTP ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon', '.webp': 'image/webp'
};
const serveur = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  const fichier = path.normalize(path.join(PUBLIC, url));
  if (!fichier.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: serveur, path: '/ws' });
wss.on('connection', ws => {
  clients.add(ws);
  ws.role = 'inconnu';
  envoyer(ws, { t: 'init', config: configPublique(), etat: etatComplet(), tick: jeu.instantane() });
  ws.on('message', brut => {
    let m;
    try { m = JSON.parse(brut); } catch (e) { return; }
    if (m.t === 'hello') ws.role = m.role;
    if (m.t === 'cmd' && ws.role === 'regie') {
      try { commande(m); } catch (e) { log('Erreur commande ' + m.cmd + ' : ' + e.message); }
    }
  });
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// ---------- Boucle de jeu ----------
let dernier = Date.now();
let dernierEtat = 0;
setInterval(() => {
  const t = Date.now();
  const dt = Math.min(0.5, (t - dernier) / 1000);
  dernier = t;
  try { jeu.tick(dt); } catch (e) { log('Erreur boucle : ' + e.stack); }
  diffuser({ t: 'tick', d: jeu.instantane() });
  if ((etatModifie && t - dernierEtat > 150) || t - dernierEtat > 2000) {
    etatModifie = false;
    dernierEtat = t;
    diffuser({ t: 'etat', d: etatComplet() });
  }
}, 100);

function adressesLocales() {
  const ips = [];
  for (const liste of Object.values(os.networkInterfaces())) {
    for (const i of liste || []) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  }
  return ips;
}

serveur.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ Le port ${PORT} est déjà utilisé. La Grimpe tourne peut-être déjà dans une autre fenêtre ?\n   Ferme-la, ou change "port" dans config.json.\n`);
    process.exit(1);
  }
  throw e;
});

serveur.listen(PORT, '0.0.0.0', () => {
  const ips = adressesLocales();
  console.log('\n🧗  LA GRIMPE est lancée !  (' + (MODE === 'demo' ? 'MODE DÉMO — faux spectateurs disponibles' : 'MODE LIVE — @' + pseudo) + ')\n');
  console.log('   Overlay (à ajouter dans TikTok LIVE Studio / OBS) :');
  console.log(`      http://localhost:${PORT}/overlay.html`);
  console.log('   Régie (sur ce PC) :');
  console.log(`      http://localhost:${PORT}/regie.html`);
  if (ips.length) {
    console.log('   Régie sur la tablette / le téléphone (même Wi-Fi) :');
    ips.forEach(ip => console.log(`      http://${ip}:${PORT}/regie.html`));
  }
  console.log('\n   Pour arrêter : Ctrl + C\n');
  if (!pseudo) console.log('   ⚠️  Aucun pseudo TikTok dans config.json : mode démo. Ajoute ton pseudo dans "tiktok" > "pseudo" pour le vrai live.\n');
  if (tiktok) tiktok.demarrer();
});

function quitter() {
  sauvegarder();
  if (tiktok) tiktok.arreter();
  bots.arreter();
  process.exit(0);
}
process.on('SIGINT', quitter);
process.on('SIGTERM', quitter);
