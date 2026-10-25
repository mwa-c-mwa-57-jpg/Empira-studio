'use strict';
// Logique de La Grimpe : altitude, énergie, refuges, cagnotte, classement,
// scènes de l'autopilote et mini-jeux. Aucune dépendance réseau : le serveur
// branche les événements TikTok (ou la simulation) sur les méthodes on*().

const DUREES_MINIJEUX = { vote: 30, course: 60, mot: 45, tempete: 40 };

// Les boss : envoyés par les saboteurs (cadeaux « méchants ») ou au hasard par l'autopilote.
// ralentit : vitesse de grimpe pendant le combat (l'araignée l'emprisonne dans sa toile).
const BOSS = {
  pigeon: { nom: 'Pigeon', emoji: '🐦', ralentit: 0.6 },
  chauvesouris: { nom: 'Chauve-souris', emoji: '🦇', ralentit: 0.6 },
  araignee: { nom: 'Araignée', emoji: '🕷️', ralentit: 0.2 },
  orage: { nom: "Nuage d'orage", emoji: '⛈️', ralentit: 0.5 },
  alien: { nom: 'Alien', emoji: '👽', ralentit: 0.4 },
  ours: { nom: 'Ours géant', emoji: '🐻', ralentit: 0.2 }
};

const TEXTES = {
  toctoc: [
    "Euh… y'a quelqu'un ? Tapotez s'il vous plaît, je glisse 😰",
    "Toc toc toc ! Vous m'entendez ? J'ai besoin de taps !",
    "Hé ho ! Tapez l'écran, mes bras lâchent…",
    "Je vous vois hein ! Un petit tap pour {mascotte} ? 🥺"
  ],
  bord: [
    "TAPEZ L'ÉCRAN, JE LÂCHE !",
    "AU SECOURS ! TAPEZ VITE !!",
    "Je tiens plus… TAPEZ !!!"
  ],
  ouf: ["Ouf… merci, j'ai eu chaud !", "Vous m'avez sauvé ! 😅", "Pfiou… on continue !"],
  chute: ["AAAAAAAAAH !", "NOOOOOOON !", "Ça glisse !!! AAAAH !"],
  atterrit: ["Aïe… bon, on recommence.", "Retour au refuge… on remonte ?", "J'ai mal partout. Tapez pour repartir !"],
  frayeur: ["WOUH ! J'ai failli tomber !", "Oups ! Ça glisse ici…", "Ah ! Rattrapé de justesse !"],
  pancarte: [
    "Il me faut un {cadeau} pour passer… quelqu'un ? 🥺",
    "La porte est fermée ! Un {cadeau} et je passe !",
    "Je suis bloqué… un {cadeau} s'il vous plaît ? 🙏"
  ],
  appel: [
    "@{pseudo} ! Toi ! Tu tapes vite toi, aide-moi !",
    "@{pseudo}, je compte sur toi ! Tape tape tape !",
    "Coucou @{pseudo} ! Tu me fais monter un peu ? 🥺",
    "@{pseudo} est là ! Bon, maintenant je peux grimper !"
  ],
  boude: [
    "Bon ben… je vais attendre ici hein.",
    "Personne ? D'accord. Je boude. 😤",
    "Je compte les nuages en attendant… 1… 2…"
  ],
  victoire: ["OUIIII ! MERCI {pseudo} !!! 😘", "ON EST PASSÉS !!! JE VOUS AIME !", "REFUGE DÉBLOQUÉ !!! 😘"],
  merci: ["MERCI {pseudo} !! ❤️", "{pseudo} tu es un(e) héros ! ❤️", "Merci {pseudo} !!! Je t'aime !"],
  sommet: ["LE SOMMET !!! ON L'A FAIT ENSEMBLE !!!"],
  bossPigeon: ['NOOON, un pigeon ! Tapez pour le chasser !!', 'Un pigeon me picore le bonnet ! TAPEZ !'],
  bossChauvesouris: ['Une chauve-souris ! Allez, tapez-la !!', 'Elle me tourne autour… TAPEZ !'],
  bossAraignee: ['Une ARAIGNÉE !!! Je suis coincé dans sa toile, TAPEZ !!', 'Aaah une toile ! Je peux plus bouger !!'],
  bossOrage: ['Un orage arrive… protégez-moi !! TAPEZ !', 'Les éclairs !!! Tapez pour chasser le nuage !'],
  bossAlien: ['Un ALIEN veut m\'enlever !! TAPEZ VITE !!', 'Le rayon m\'aspire !!! AU SECOURS !'],
  bossOurs: ["L'OURS GÉANT !!! Tout le monde TAPE !!!", 'Un ours… UN OURS !!! Envoyez des cadeaux !!'],
  bossGagne: ['DÉGAGE ! Haha, merci la team !!', 'K.O. !!! Vous êtes trop forts !', 'Et BIM ! Personne ne m\'arrête !'],
  bossPerdu: ['Aïe aïe aïe… il m\'a eu…', 'Noooon… je redescends…', 'Les saboteurs ont gagné… vengez-moi !'],
  record: ["NOUVEAU RECORD !!! On n'est jamais allés aussi haut !"]
};

function normaliser(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9&!]+/g, ' ').trim();
}

function remplir(modele, vars) {
  return modele.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

class Jeu {
  constructor(config, { now = Date.now, random = Math.random, emit = () => {} } = {}) {
    this.config = config;
    this.now = now;
    this.random = random;
    this.emit = emit;
    this.objectifs = config.objectifs;
    this.N = this.objectifs.length;
    this.aliases = this.objectifs.map(o => new Set([o.nom, ...(o.alias || [])].map(normaliser)));
    const S = config.saboteurs || {};
    this.saboteurs = S.actifs === false ? [] : (S.liste || []);
    this.aliasSaboteurs = this.saboteurs.map(x => [x.nom, ...(x.alias || [])].map(normaliser));
    this.etat = this.etatInitial(0);
    this.runtimeInitial();
  }

  etatInitial(record) {
    return {
      version: 1,
      debut: this.now(),
      objIndex: 0,
      cagnotte: 0,
      alt: 0,
      record: record || 0,
      recordDebut: record || 0,
      likesTotal: 0,
      piecesTotal: 0,
      chutes: 0,
      sommetAtteint: false,
      bossVaincus: 0,
      bossPerdus: 0,
      users: {},
      chefId: null,
      validations: []
    };
  }

  runtimeInitial() {
    const t = this.now();
    this.energie = 60;
    this.statut = 'repos';
    this.protectionJusqua = 0;
    this.boostRestant = 0;
    this.taps = []; // [instant, nombre] sur les dernières secondes
    this.historiqueTaps = []; // [instant, nombre] sur 5 minutes (cible de la course)
    this.accrocheDepuis = 0;
    this.bloqueDepuis = 0;
    this.derniereActivite = t;
    this.dernierePresence = t;
    this.presence = 'ok';
    this.autopilote = this.config.autopilote.actifAuDemarrage !== false;
    this.derniereScene = 0;
    this.dernieresScenes = {};
    this.dernierMiniJeu = t;
    this.miniJeuPrecedent = null;
    this.miniJeu = null;
    this.chatteursRecents = []; // [instant, user]
    this.appeles = {}; // id -> instant
    this.recordAnnonce = false;
    this.cooldownCommandes = { global: 0, users: {} };
    this.dernierArrivee = 0;
    this.arriveesEnAttente = [];
    this.accDirecteur = 0;
    this.boss = null;
    this.fileBoss = [];
    this.prochainBossApres = 0;
    this.dernierBossAleatoire = t;
  }

  // ---------- Persistance ----------
  charger(sauvegarde) {
    if (!sauvegarde || sauvegarde.version !== 1) return;
    this.etat = Object.assign(this.etatInitial(sauvegarde.record), sauvegarde);
    this.etat.objIndex = Math.max(0, Math.min(this.N, this.etat.objIndex | 0));
    this.etat.alt = Math.min(this.etat.alt, this.porte());
    this.etat.recordDebut = this.etat.record;
  }

  versJSON() {
    return this.etat;
  }

  // ---------- Calculs ----------
  get esp() { return this.config.jeu.metresEntreRefuges; }
  porte() { return this.etat.objIndex < this.N ? (this.etat.objIndex + 1) * this.esp : Infinity; }
  sol() { return Math.min(this.etat.objIndex, Math.floor(this.etat.alt / this.esp)) * this.esp; }
  objectifCourant() { return this.etat.objIndex < this.N ? this.objectifs[this.etat.objIndex] : null; }
  protege() { return this.now() < this.protectionJusqua; }

  tapsParSeconde(fenetre = 3) {
    const lim = this.now() - fenetre * 1000;
    let n = 0;
    for (const [t, c] of this.taps) if (t >= lim) n += c;
    return n / fenetre;
  }

  utilisateur(u) {
    const id = String(u.id || u.pseudo || 'anonyme');
    let x = this.etat.users[id];
    if (!x) x = this.etat.users[id] = { id, pseudo: u.pseudo || id, nom: u.nom || u.pseudo || id, avatar: u.avatar || '', pieces: 0, taps: 0 };
    if (u.avatar) x.avatar = u.avatar;
    if (u.nom) x.nom = u.nom;
    if (u.pseudo) x.pseudo = u.pseudo;
    return x;
  }

  classement(n = 5) {
    return Object.values(this.etat.users).filter(u => u.pieces > 0)
      .sort((a, b) => b.pieces - a.pieces).slice(0, n)
      .map(({ id, pseudo, nom, avatar, pieces }) => ({ id, pseudo, nom, avatar, pieces }));
  }

  tapeurs(n = 3) {
    return Object.values(this.etat.users).filter(u => u.taps > 0)
      .sort((a, b) => b.taps - a.taps).slice(0, n)
      .map(({ id, pseudo, nom, avatar, taps }) => ({ id, pseudo, nom, avatar, taps }));
  }

  texte(cle, vars = {}) {
    const liste = TEXTES[cle];
    const modele = liste[Math.floor(this.random() * liste.length)];
    return remplir(modele, Object.assign({ mascotte: this.config.mascotte.nom }, vars));
  }

  scene(type, extra = {}) {
    const t = this.now();
    this.derniereScene = t;
    this.dernieresScenes[type] = t;
    this.emit('scene', Object.assign({ type }, extra));
  }

  publicUser(u) {
    return { id: u.id, pseudo: u.pseudo, nom: u.nom, avatar: u.avatar };
  }

  // ---------- Événements entrants ----------
  activite() { this.derniereActivite = this.now(); }

  onLike({ user, nombre }) {
    const n = Math.max(1, nombre | 0);
    const u = this.utilisateur(user);
    const t = this.now();
    u.taps += n;
    const avant = Math.floor(this.etat.likesTotal / this.config.jeu.paliersLikes);
    this.etat.likesTotal += n;
    const apres = Math.floor(this.etat.likesTotal / this.config.jeu.paliersLikes);
    this.taps.push([t, n]);
    this.historiqueTaps.push([t, n]);
    this.energie = Math.min(100, this.energie + n * this.config.jeu.energieParTap);
    this.activite();
    if (this.miniJeu && this.miniJeu.type === 'course') {
      this.miniJeu.progres += n;
      if (this.miniJeu.progres >= this.miniJeu.cible) this.finirMiniJeu();
    }
    if (this.boss) this.frapper(u, n * this.reglesSaboteurs().degatsParTap);
    if (apres > avant) this.emit('palierLikes', { total: apres * this.config.jeu.paliersLikes });
  }

  onCadeau(g) {
    const u = this.utilisateur(g.user);
    this.activite();
    const repeat = Math.max(1, g.repeatCount | 0);
    const infos = {
      user: this.publicUser(u),
      cadeau: g.nom || 'Cadeau',
      image: g.image || '',
      pieces: g.pieces | 0,
      repeat
    };
    // Combos (giftType 1) : on anime pendant la série, on compte à la fin.
    if (g.giftType === 1 && !g.repeatEnd) {
      this.emit('combo', infos);
      return;
    }
    const valeur = (g.pieces | 0) * repeat;
    const iSab = this.trouverSaboteur(g.nom);
    if (iSab >= 0) { this.sabotage(u, iSab, repeat, valeur, infos); return; }
    const ancienChef = this.etat.chefId;
    u.pieces += valeur;
    this.etat.piecesTotal += valeur;

    const nomNorm = normaliser(g.nom);
    let iMatch = this.aliases.findIndex(set => set.has(nomNorm));
    if (iMatch < 0 && g.pieces > 0) iMatch = this.objectifs.findIndex(o => o.pieces === g.pieces);
    const objMatch = iMatch >= 0 ? this.objectifs[iMatch] : null;

    let effet;
    if (objMatch) {
      effet = Object.assign({}, objMatch.effet);
      if (!infos.image) infos.image = objMatch.image;
    } else {
      effet = {
        style: valeur >= 300 ? 'charge' : valeur >= 30 ? 'saut' : 'encourage',
        montee: Math.max(5, Math.min(600, Math.round(valeur * 1.2))),
        energie: Math.min(100, 20 + valeur),
        replique: TEXTES.merci[0]
      };
    }
    const facteur = 1 + 0.5 * (Math.min(repeat, 10) - 1);
    const montee = Math.round((effet.montee || 0) * facteur);
    const tier = valeur >= 300 ? 3 : valeur >= 30 ? 2 : 1;

    this.emit('cadeau', Object.assign(infos, {
      valeur, tier, style: effet.style, montee,
      replique: remplir(effet.replique || TEXTES.merci[0], { pseudo: '@' + u.pseudo, mascotte: this.config.mascotte.nom }),
      objectifIndex: iMatch
    }));

    // Pendant un combat, le cadeau frappe le boss (réglage saboteurs.cadeauxContreBoss) :
    //   "double"  : il frappe le boss ET remplit la cagnotte (par défaut)
    //   "partage" : ses pièces servent d'abord à battre le boss, le reste va dans la cagnotte
    //   "non"     : seuls les taps frappent le boss
    const RS = this.reglesSaboteurs();
    let pourCagnotte = valeur;
    let coupsBoss = 0;
    if (this.boss && RS.cadeauxContreBoss !== 'non') {
      const besoin = Math.ceil(Math.max(0, this.boss.pv) / RS.degatsParPiece);
      const utilise = RS.cadeauxContreBoss === 'partage' ? Math.min(valeur, besoin) : valeur;
      coupsBoss = utilise * RS.degatsParPiece;
      if (RS.cadeauxContreBoss === 'partage') pourCagnotte = valeur - utilise;
    }

    // Cagnotte de l'objectif en cours (le bon cadeau, ou n'importe quel cadeau de valeur égale ou supérieure).
    const refuges = [];
    if (this.etat.objIndex < this.N) {
      const obj = this.objectifCourant();
      if (nomNorm && this.aliases[this.etat.objIndex].has(nomNorm) && !(g.pieces > 0)) {
        this.etat.cagnotte = Math.max(this.etat.cagnotte, obj.pieces);
      }
      this.etat.cagnotte += pourCagnotte;
      while (this.etat.objIndex < this.N && this.etat.cagnotte >= this.objectifs[this.etat.objIndex].pieces) {
        this.etat.cagnotte -= this.objectifs[this.etat.objIndex].pieces;
        refuges.push(this.etat.objIndex);
        this.etat.validations.push({ index: this.etat.objIndex, pseudo: u.pseudo, at: this.now() });
        this.etat.objIndex++;
        if (!this.config.jeu.surplusEnchaineLesRefuges) break;
      }
      if (this.etat.objIndex >= this.N) this.etat.cagnotte = 0;
    }
    refuges.forEach((index, k) => {
      this.emit('refuge', {
        index, objectif: this.objectifs[index], user: this.publicUser(u),
        mega: refuges.length > 1, rang: k + 1, total: refuges.length,
        texte: this.texte('victoire', { pseudo: '@' + u.pseudo }),
        dernier: index === this.N - 1
      });
    });
    if (refuges.length) this.bloqueDepuis = 0;

    // Un refuge débloqué hisse la mascotte jusqu'à lui (MÉGA SAUT si plusieurs), puis l'effet du cadeau s'ajoute.
    if (refuges.length) {
      const cible = (refuges[refuges.length - 1] + 1) * this.esp;
      this.boostRestant = Math.max(this.boostRestant, cible - this.etat.alt);
    }
    this.boostRestant += montee;
    this.energie = Math.min(100, this.energie + (effet.energie || 0));
    if (effet.protection) this.protectionJusqua = Math.max(this.protectionJusqua, this.now() + effet.protection * 1000);
    if (this.statut === 'accroche' || this.statut === 'chute') this.statut = 'grimpe';

    const chef = this.classement(1)[0];
    if (chef && chef.id !== ancienChef) {
      this.etat.chefId = chef.id;
      if (ancienChef) {
        const ancien = this.etat.users[ancienChef];
        this.emit('nouveauChef', { user: chef, ancien: ancien ? this.publicUser(ancien) : null });
      }
    }
    // Pendant un combat, chaque cadeau d'aide frappe le boss (1 pièce = plusieurs coups)
    if (coupsBoss) this.frapper(u, coupsBoss);
  }

  // ---------- Saboteurs et boss ----------
  reglesSaboteurs() {
    return Object.assign({ degatsParTap: 1, degatsParPiece: 6, bossAleatoires: true, minutesEntreBossAleatoires: 7, cadeauxContreBoss: 'double', detteCagnotte: true }, this.config.saboteurs || {});
  }

  trouverSaboteur(nom) {
    const n = normaliser(nom);
    if (!n) return -1;
    return this.aliasSaboteurs.findIndex(liste => liste.some(a => n === a || (a.length >= 5 && n.startsWith(a + ' '))));
  }

  sabotage(u, i, repeat, valeur, infos) {
    const s = this.saboteurs[i];
    u.sabotage = (u.sabotage || 0) + valeur;
    this.etat.piecesTotal += valeur;
    const pv = s.pv * Math.min(repeat, 10);
    const chute = s.chute * Math.min(repeat, 3);
    const type = BOSS[s.boss] ? s.boss : 'pigeon';
    this.emit('sabotage', Object.assign(infos, { valeur, boss: type, nomBoss: BOSS[type].nom, image: infos.image || s.image, renfort: !!this.boss }));
    const demande = { type, pv, secondes: s.secondes || 20, chute, valeur, saboteur: this.publicUser(u), image: s.image };
    if (this.boss) this.renforcer(demande);
    else if (this.miniJeu || this.fileBoss.length || this.now() < this.prochainBossApres) {
      if (this.fileBoss.length < 5) this.fileBoss.push(demande);
    } else this.lancerBoss(demande);
  }

  lancerBoss(d) {
    const t = this.now();
    const info = BOSS[d.type];
    this.boss = { type: d.type, nom: info.nom, emoji: info.emoji, pv: d.pv, pvMax: d.pv, debut: t, fin: t + d.secondes * 1000, chute: d.chute, valeur: d.valeur || 0, saboteur: d.saboteur || null, image: d.image || '', degats: {} };
    const cle = 'boss' + d.type.charAt(0).toUpperCase() + d.type.slice(1);
    this.emit('boss', Object.assign(this.bossPublic(), { texte: this.texte(cle) }));
  }

  renforcer(d) {
    const b = this.boss;
    const t = this.now();
    b.pv += d.pv;
    b.pvMax += d.pv;
    b.fin = Math.min(b.fin + 5000, t + 45000);
    b.chute = Math.max(b.chute, d.chute);
    b.valeur += d.valeur || 0;
    this.emit('bossRenfort', Object.assign(this.bossPublic(), { par: d.saboteur }));
  }

  frapper(u, degats) {
    const b = this.boss;
    if (!b || degats <= 0) return;
    b.pv -= degats;
    b.degats[u.id] = (b.degats[u.id] || 0) + degats;
    if (b.pv <= 0) this.finirBoss(true, u);
  }

  finirBoss(gagne, coupFinal) {
    const b = this.boss;
    if (!b) return;
    const t = this.now();
    this.boss = null;
    this.prochainBossApres = t + 4000;
    const meilleurs = Object.entries(b.degats).sort((x, y) => y[1] - x[1]).slice(0, 3)
      .map(([id, d]) => Object.assign(this.publicUser(this.etat.users[id]), { degats: Math.round(d) }));
    let perte = 0, dette = 0;
    if (gagne) {
      this.etat.bossVaincus++;
      this.boostRestant += 15;
      this.energie = 100;
    } else {
      this.etat.bossPerdus++;
      // Jamais sous le dernier refuge débloqué : les cadeaux des autres ne sont jamais annulés
      const enjeu = this.enjeuBoss(b);
      const avant = this.etat.alt;
      this.etat.alt = Math.max(this.sol(), this.etat.alt - enjeu.metres);
      perte = Math.round(avant - this.etat.alt);
      dette = enjeu.pieces;
      this.etat.cagnotte -= dette;
      this.energie = Math.max(10, this.energie - 30);
      this.boostRestant = 0;
    }
    this.emit('bossFin', {
      gagne, type: b.type, nom: b.nom, emoji: b.emoji, saboteur: b.saboteur, perte, dette,
      coupFinal: gagne && coupFinal ? this.publicUser(coupFinal) : null, meilleurs,
      texte: this.texte(gagne ? 'bossGagne' : 'bossPerdu')
    });
  }

  // Ce que coûte un boss qui gagne. Règle : 1 pièce de saboteur annule 1 pièce d'aide.
  //  - la cagnotte du refuge en cours perd la valeur du sabotage (elle peut passer en négatif) ;
  //  - la mascotte perd les mètres que ces pièces auraient fait gagner au prix du refuge en cours
  //    (prix du refuge / 300 m), au moins la chute minimum du boss, jamais sous le dernier refuge.
  enjeuBoss(b) {
    const RS = this.reglesSaboteurs();
    const prix = (this.objectifCourant() || this.objectifs[this.N - 1]).pieces;
    const metres = Math.max(b.chute, Math.round(b.valeur * this.esp / Math.max(1, prix)));
    const possible = Math.max(0, Math.floor(this.etat.alt - this.sol()));
    return {
      metres: Math.min(metres, possible),
      pieces: RS.detteCagnotte && this.etat.objIndex < this.N ? b.valeur : 0
    };
  }

  bossAleatoire() {
    const t = this.now();
    const alt = this.etat.alt;
    const type = alt < 900 ? 'pigeon' : alt < 2600 ? 'chauvesouris' : alt < 3600 ? 'orage' : 'alien';
    const lim = t - 5 * 60000;
    this.historiqueTaps = this.historiqueTaps.filter(([x]) => x >= lim);
    const parSeconde = this.historiqueTaps.reduce((s, [, c]) => s + c, 0) / 300;
    const secondes = 18;
    const pv = Math.max(40, Math.min(800, Math.round(parSeconde * secondes * 0.7)));
    this.dernierBossAleatoire = t;
    this.lancerBoss({ type, pv, secondes, chute: 10, valeur: 0, saboteur: null });
  }

  bossPublic() {
    const b = this.boss;
    if (!b) return null;
    return { type: b.type, nom: b.nom, emoji: b.emoji, pv: Math.max(0, Math.ceil(b.pv)), pvMax: b.pvMax, debut: b.debut, fin: b.fin, maintenant: this.now(), chute: b.chute, valeur: b.valeur, enjeu: this.enjeuBoss(b), saboteur: b.saboteur, image: b.image };
  }

  saboteursClassement(n = 3) {
    return Object.values(this.etat.users).filter(u => u.sabotage > 0)
      .sort((a, b) => b.sabotage - a.sabotage).slice(0, n)
      .map(({ id, pseudo, nom, avatar, sabotage }) => ({ id, pseudo, nom, avatar, pieces: sabotage }));
  }

  onChat({ user, texte }) {
    const u = this.utilisateur(user);
    const t = this.now();
    this.activite();
    this.chatteursRecents.push([t, this.publicUser(u)]);
    if (this.chatteursRecents.length > 50) this.chatteursRecents.shift();
    const norm = normaliser(texte);
    const mj = this.miniJeu;
    if (mj && mj.type === 'vote' && !mj.votants.has(u.id)) {
      const mots = norm.split(' ');
      let choix = null;
      if (mots.includes('aide') || mots.includes('aider') || mots.includes('1')) choix = 'aide';
      else if (mots.includes('piege') || mots.includes('pieges') || mots.includes('2')) choix = 'piege';
      if (choix) { mj.votants.add(u.id); mj.votes[choix]++; this.emit('miniJeuMaj', this.miniJeuPublic()); }
    }
    if (mj && mj.type === 'mot' && !mj.gagnant && norm.split(' ').includes(mj.mot)) {
      mj.gagnant = this.publicUser(u);
      this.finirMiniJeu();
    }
    // Commandes sons
    const cc = this.config.commandesChat;
    if (cc.actives) {
      const cmd = String(texte || '').trim().split(/\s+/)[0].toLowerCase();
      const son = cc.liste[cmd];
      if (son) {
        const cdU = this.cooldownCommandes.users[u.id] || 0;
        if (t >= this.cooldownCommandes.global && t >= cdU) {
          this.cooldownCommandes.global = t + cc.secondesEntreDeuxAuTotal * 1000;
          this.cooldownCommandes.users[u.id] = t + cc.secondesEntreDeuxParSpectateur * 1000;
          this.emit('son', { son, user: this.publicUser(u) });
        }
      }
    }
    this.emit('chat', { user: this.publicUser(u), texte: String(texte || '').slice(0, 120) });
  }

  onArrivee({ user }) {
    const u = this.utilisateur(user);
    const t = this.now();
    if (t - this.dernierArrivee >= 1500) {
      this.dernierArrivee = t;
      const autres = this.arriveesEnAttente.length;
      this.arriveesEnAttente = [];
      this.emit('arrivee', { user: this.publicUser(u), autres });
    } else if (this.arriveesEnAttente.length < 500) {
      this.arriveesEnAttente.push(u.id);
    }
  }

  onAbonne({ user }) { this.activite(); this.emit('abonne', { user: this.publicUser(this.utilisateur(user)) }); }
  onPartage({ user }) { this.activite(); this.emit('partage', { user: this.publicUser(this.utilisateur(user)) }); }

  // ---------- Régie ----------
  present() {
    this.dernierePresence = this.now();
    if (this.presence !== 'ok') {
      this.presence = 'ok';
      this.emit('presence', { presence: 'ok' });
    }
  }

  changerObjectif(delta) {
    const avant = this.etat.objIndex;
    this.etat.objIndex = Math.max(0, Math.min(this.N, avant + delta));
    this.etat.cagnotte = 0;
    if (this.etat.objIndex > avant) {
      this.etat.validations.push({ index: avant, pseudo: null, at: this.now() });
      this.emit('refuge', { index: avant, objectif: this.objectifs[avant], user: null, mega: false, rang: 1, total: 1, texte: this.texte('victoire', { pseudo: '' }), dernier: avant === this.N - 1 });
    }
    this.etat.alt = Math.min(this.etat.alt, this.porte());
  }

  nouveauLive() {
    const record = this.etat.record;
    this.etat = this.etatInitial(record);
    const auto = this.autopilote;
    this.runtimeInitial();
    this.autopilote = auto;
    this.emit('reset', {});
  }

  recap() {
    return {
      altitude: Math.round(this.etat.alt),
      record: Math.round(this.etat.record),
      recordBattu: this.etat.record > this.etat.recordDebut + 0.5,
      refuges: this.etat.objIndex,
      total: this.N,
      likes: this.etat.likesTotal,
      pieces: this.etat.piecesTotal,
      chutes: this.etat.chutes,
      podium: this.classement(3),
      bossVaincus: this.etat.bossVaincus,
      bossPerdus: this.etat.bossPerdus,
      saboteurs: this.saboteursClassement(1),
      tapeurs: this.tapeurs(3),
      duree: Math.round((this.now() - this.etat.debut) / 60000)
    };
  }

  parler(texte) {
    this.scene('parole', { texte: String(texte).slice(0, 140) });
  }

  sceneManuelle(type) {
    const obj = this.objectifCourant();
    if (type === 'pancarte') {
      if (!obj) return;
      this.scene('pancarte', { texte: this.texte('pancarte', { cadeau: obj.nom }), objectif: obj, cagnotte: this.etat.cagnotte });
    } else if (type === 'appel') {
      const c = this.choisirChatteur(true);
      if (c) this.scene('appel', { texte: this.texte('appel', { pseudo: c.pseudo }), user: c });
    } else if (type === 'frayeur') {
      this.frayeur();
    } else if (TEXTES[type]) {
      this.scene(type, { texte: this.texte(type, { pseudo: '' }) });
    }
  }

  // ---------- Mini-jeux ----------
  lancerMiniJeu(type) {
    if (this.miniJeu || this.boss || this.fileBoss.length) return false;
    if (!DUREES_MINIJEUX[type]) {
      const types = Object.keys(DUREES_MINIJEUX).filter(t => t !== this.miniJeuPrecedent);
      type = types[Math.floor(this.random() * types.length)];
    }
    const t = this.now();
    const mj = { type, debut: t, fin: t + DUREES_MINIJEUX[type] * 1000 };
    if (type === 'vote') { mj.votes = { aide: 0, piege: 0 }; mj.votants = new Set(); }
    if (type === 'course') {
      const lim = t - 5 * 60000;
      this.historiqueTaps = this.historiqueTaps.filter(([x]) => x >= lim);
      const parMin = this.historiqueTaps.reduce((s, [, c]) => s + c, 0) / 5;
      mj.cible = Math.max(150, Math.min(20000, Math.round(parMin * 1.3 / 10) * 10));
      mj.progres = 0;
    }
    if (type === 'mot') {
      const mots = this.config.miniJeux.motsMagiques;
      mj.mot = normaliser(mots[Math.floor(this.random() * mots.length)]);
      mj.gagnant = null;
    }
    this.miniJeu = mj;
    this.dernierMiniJeu = t;
    this.miniJeuPrecedent = type;
    this.emit('miniJeu', this.miniJeuPublic());
    return true;
  }

  miniJeuPublic() {
    const mj = this.miniJeu;
    if (!mj) return null;
    const p = { type: mj.type, debut: mj.debut, fin: mj.fin, maintenant: this.now() };
    if (mj.type === 'vote') p.votes = mj.votes;
    if (mj.type === 'course') { p.cible = mj.cible; p.progres = mj.progres; }
    if (mj.type === 'mot') p.mot = mj.mot;
    return p;
  }

  arreterMiniJeu() {
    if (!this.miniJeu) return;
    this.miniJeu = null;
    this.emit('miniJeuFin', { type: null, annule: true });
  }

  finirMiniJeu() {
    const mj = this.miniJeu;
    if (!mj) return;
    this.miniJeu = null;
    const res = { type: mj.type };
    if (mj.type === 'vote') {
      res.votes = mj.votes;
      if (mj.votes.aide + mj.votes.piege === 0) {
        res.resultat = 'personne';
      } else if (mj.votes.aide >= mj.votes.piege) {
        res.resultat = 'aide';
        this.boostRestant += 60;
        this.energie = 100;
      } else {
        const pieges = ['banane', 'vent', 'pigeon'];
        res.resultat = 'piege';
        res.piege = pieges[Math.floor(this.random() * pieges.length)];
        const sol = this.sol();
        if (res.piege === 'banane') this.etat.alt = Math.max(sol, this.etat.alt - 25);
        if (res.piege === 'vent') this.energie = Math.max(5, this.energie - 40);
        if (res.piege === 'pigeon') { this.etat.alt = Math.max(sol, this.etat.alt - 15); this.energie = Math.max(5, this.energie - 20); }
      }
    } else if (mj.type === 'course') {
      res.cible = mj.cible; res.progres = mj.progres;
      res.resultat = mj.progres >= mj.cible ? 'gagne' : 'perdu';
      if (res.resultat === 'gagne') { this.boostRestant += 80; this.energie = 100; }
      else this.etat.alt = Math.max(this.sol(), this.etat.alt - 10);
    } else if (mj.type === 'mot') {
      res.mot = mj.mot;
      res.gagnant = mj.gagnant;
      res.resultat = mj.gagnant ? 'gagne' : 'personne';
      if (mj.gagnant) this.boostRestant += 30;
    } else if (mj.type === 'tempete') {
      res.resultat = this.statut !== 'chute' && this.energie > 0 ? 'gagne' : 'perdu';
      if (res.resultat === 'gagne') this.boostRestant += 40;
    }
    this.emit('miniJeuFin', res);
  }

  // ---------- Boucle ----------
  frayeur() {
    if (this.protege() || this.statut === 'chute') return;
    const perte = 4 + this.random() * 6;
    this.etat.alt = Math.max(this.sol(), this.etat.alt - perte);
    this.scene('frayeur', { texte: this.texte('frayeur') });
  }

  choisirChatteur(force) {
    const t = this.now();
    const recents = this.chatteursRecents.filter(([x, u]) => t - x < 90000 && (force || !this.appeles[u.id] || t - this.appeles[u.id] > 15 * 60000));
    if (!recents.length) return null;
    const [, u] = recents[Math.floor(this.random() * recents.length)];
    this.appeles[u.id] = t;
    return u;
  }

  tick(dt) {
    const J = this.config.jeu;
    const t = this.now();
    const e = this.etat;
    this.taps = this.taps.filter(([x]) => t - x < 5000);
    const protege = this.protege();
    const tempete = this.miniJeu && this.miniJeu.type === 'tempete';
    const tapRate = this.tapsParSeconde();
    const facteurPerte = (tempete ? 3 : 1) * (this.boss ? 1.4 : 1);
    const ralenti = this.boss ? BOSS[this.boss.type].ralentit : 1;

    if (!protege) this.energie = Math.max(0, this.energie - J.perteEnergieParSeconde * facteurPerte * dt);

    const porte = this.porte();
    const sol = this.sol();

    if (this.statut === 'accroche') {
      if (this.energie > 0 || protege) {
        this.statut = 'grimpe';
        this.emit('scene', { type: 'ouf', texte: this.texte('ouf') });
      } else if (t - this.accrocheDepuis > J.secondesAccrocheAvantChute * 1000) {
        this.statut = 'chute';
        e.chutes++;
        this.emit('scene', { type: 'chute', texte: this.texte('chute') });
      }
    } else if (this.statut === 'chute') {
      e.alt = Math.max(sol, e.alt - J.vitesseChuteMetresParSeconde * dt);
      if (e.alt <= sol + 0.01) {
        e.alt = sol;
        this.statut = 'repos';
        this.energie = Math.max(this.energie, 25);
        this.emit('scene', { type: 'atterrit', texte: this.texte('atterrit') });
      }
    } else {
      if (this.energie <= 0 && !protege && e.alt > sol + 1) {
        this.statut = 'accroche';
        this.accrocheDepuis = t;
        this.boostRestant = 0;
        this.scene('bord', { texte: this.texte('bord') });
      } else {
        let monte = 0;
        if (this.energie > 0) monte += J.vitesseMaxMetresParSeconde * Math.min(1, tapRate / J.tapsParSecondePourVitesseMax) * ralenti * dt;
        if (this.boostRestant > 0) {
          const pas = Math.min(this.boostRestant, Math.min(250, Math.max(25, this.boostRestant * 0.8)) * dt);
          this.boostRestant -= pas;
          monte += pas;
        }
        e.alt = Math.min(porte, e.alt + monte);
        if (e.alt >= porte - 0.01) {
          this.boostRestant = 0;
          if (this.statut !== 'bloque') { this.statut = 'bloque'; this.bloqueDepuis = t; }
        } else {
          this.statut = monte > 0.05 * dt ? 'grimpe' : 'repos';
          this.bloqueDepuis = 0;
        }
      }
    }

    if (e.alt > e.record) {
      e.record = e.alt;
      if (!this.recordAnnonce && e.recordDebut >= 50 && e.alt > e.recordDebut + 1) {
        this.recordAnnonce = true;
        this.emit('record', { altitude: Math.round(e.alt), texte: this.texte('record') });
      }
    }
    if (!e.sommetAtteint && e.objIndex >= this.N && e.alt >= this.N * this.esp) {
      e.sommetAtteint = true;
      this.emit('sommet', { texte: this.texte('sommet') });
    }

    if (this.miniJeu && t >= this.miniJeu.fin) this.finirMiniJeu();
    if (this.boss && t >= this.boss.fin) this.finirBoss(false, null);
    if (!this.boss && !this.miniJeu && this.fileBoss.length && t >= this.prochainBossApres) this.lancerBoss(this.fileBoss.shift());

    // Présence de l'animateur
    const minutes = (t - this.dernierePresence) / 60000;
    const P = this.config.presence;
    let p = 'ok';
    if (minutes >= P.minutesAvantAlerte + P.minutesAvantPause) p = 'pause';
    else if (minutes >= P.minutesAvantAlerte) p = 'alerte';
    if (p !== this.presence) {
      this.presence = p;
      if (p === 'pause') this.arreterMiniJeu();
      this.emit('presence', { presence: p });
    }

    this.accDirecteur += dt;
    if (this.accDirecteur >= 1) {
      this.accDirecteur = 0;
      this.directeur(tapRate);
    }
  }

  // Décide des scènes et des mini-jeux quand l'autopilote est actif.
  directeur(tapRate) {
    if (!this.autopilote || this.presence === 'pause') return;
    const A = this.config.autopilote;
    const t = this.now();
    const depuis = k => (t - (this.dernieresScenes[k] || 0)) / 1000;

    if (this.config.jeu.frayeursAleatoires && this.statut === 'grimpe' && this.random() < 1 / 150) {
      this.frayeur();
      return;
    }
    if (this.statut === 'chute' || this.statut === 'accroche') return;
    if ((t - this.derniereScene) / 1000 < A.secondesMiniEntreScenes) return;

    const obj = this.objectifCourant();
    if (obj && this.statut === 'bloque' && this.bloqueDepuis && t - this.bloqueDepuis > 40000 && depuis('pancarte') >= A.secondesEntrePancartes) {
      this.scene('pancarte', { texte: this.texte('pancarte', { cadeau: obj.nom }), objectif: obj, cagnotte: this.etat.cagnotte });
      return;
    }
    if (tapRate < 0.5 && this.energie < 35 && depuis('toctoc') >= 60) {
      this.scene('toctoc', { texte: this.texte('toctoc') });
      return;
    }
    if ((t - this.derniereActivite) / 1000 >= A.secondesInactivitePourBouder && depuis('boude') >= 240) {
      this.scene('boude', { texte: this.texte('boude') });
      return;
    }
    const RS = this.reglesSaboteurs();
    if (RS.bossAleatoires && !this.boss && !this.miniJeu && !this.fileBoss.length && t >= this.prochainBossApres &&
        (t - this.dernierBossAleatoire) / 60000 >= RS.minutesEntreBossAleatoires) {
      this.bossAleatoire();
      return;
    }
    if (!this.miniJeu && !this.boss && (t - this.dernierMiniJeu) / 60000 >= A.minutesEntreMiniJeux) {
      this.lancerMiniJeu();
      return;
    }
    if (depuis('appel') >= A.secondesEntreAppelsPseudo) {
      const c = this.choisirChatteur(false);
      if (c) this.scene('appel', { texte: this.texte('appel', { pseudo: c.pseudo }), user: c });
    }
  }

  // Ce que l'overlay doit afficher en continu (envoyé ~10 fois par seconde).
  instantane() {
    return {
      alt: Math.round(this.etat.alt * 100) / 100,
      sol: this.sol(),
      porte: Number.isFinite(this.porte()) ? this.porte() : null,
      energie: Math.round(this.energie),
      statut: this.statut,
      protection: Math.max(0, Math.ceil((this.protectionJusqua - this.now()) / 1000)),
      boost: this.boostRestant > 0.5,
      tapRate: Math.round(this.tapsParSeconde() * 10) / 10,
      boss: this.boss ? { pv: Math.max(0, Math.ceil(this.boss.pv)), pvMax: this.boss.pvMax, fin: this.boss.fin, maintenant: this.now() } : null
    };
  }

  etatPublic() {
    const e = this.etat;
    return {
      objIndex: e.objIndex,
      cagnotte: e.cagnotte,
      record: Math.round(e.record),
      likesTotal: e.likesTotal,
      piecesTotal: e.piecesTotal,
      chutes: e.chutes,
      classement: this.classement(5),
      tapeurs: this.tapeurs(3),
      miniJeu: this.miniJeuPublic(),
      presence: this.presence,
      autopilote: this.autopilote,
      sommetAtteint: e.sommetAtteint,
      boss: this.bossPublic(),
      bossEnAttente: this.fileBoss.length,
      saboteurs: this.saboteursClassement(3)
    };
  }
}

module.exports = { Jeu, normaliser, TEXTES, DUREES_MINIJEUX, BOSS };
