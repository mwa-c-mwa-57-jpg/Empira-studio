'use strict';
// Connexion au live TikTok (bibliothèque non officielle tiktok-live-connector)
// et conversion des événements bruts dans le format attendu par le jeu.

function premiereUrl(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img.url) && img.url.length) return img.url[0];
  if (Array.isArray(img.url_list) && img.url_list.length) return img.url_list[0];
  if (Array.isArray(img.urlList) && img.urlList.length) return img.urlList[0];
  return '';
}

function userDe(d) {
  const u = (d && d.user) || {};
  return {
    id: String(u.userId || u.uniqueId || d.userId || d.uniqueId || u.nickname || 'anonyme'),
    pseudo: u.uniqueId || u.displayId || d.uniqueId || u.nickname || 'anonyme',
    nom: u.nickname || d.nickname || '',
    avatar: premiereUrl(u.profilePicture) || premiereUrl(u.profilePictureMedium) || u.profilePictureUrl || d.profilePictureUrl || ''
  };
}

function cadeauDe(d) {
  const det = d.giftDetails || {};
  const ext = d.extendedGiftInfo || {};
  const giftType = det.giftType !== undefined ? det.giftType : (ext.type !== undefined ? ext.type : d.giftType);
  return {
    user: userDe(d),
    nom: det.giftName || ext.name || d.giftName || '',
    pieces: Number(det.diamondCount || ext.diamond_count || d.diamondCount || 0),
    giftType: Number(giftType),
    repeatCount: Number(d.repeatCount || d.comboCount || 1),
    repeatEnd: Boolean(d.repeatEnd),
    image: premiereUrl(det.giftImage) || premiereUrl(ext.image) || d.giftPictureUrl || ''
  };
}

class ConnexionTikTok {
  constructor({ pseudo, signApiKey, reconnexionSecondes, jeu, onStatut, onSpectateurs, log }) {
    this.pseudo = pseudo;
    this.signApiKey = signApiKey;
    this.delai = Math.max(5, reconnexionSecondes || 15) * 1000;
    this.jeu = jeu;
    this.onStatut = onStatut;
    this.onSpectateurs = onSpectateurs;
    this.log = log;
    this.statut = 'arret';
    this.timer = null;
  }

  changerStatut(s, detail) {
    this.statut = s;
    this.onStatut(s, detail || '');
  }

  demarrer() {
    let lib;
    try {
      lib = require('tiktok-live-connector');
    } catch (e) {
      this.changerStatut('erreur', "Bibliothèque manquante : lance « npm install » dans le dossier la-grimpe.");
      return;
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    const options = { enableExtendedGiftInfo: true, processInitialData: false };
    if (this.signApiKey) options.signApiKey = this.signApiKey;
    const c = new TikTokLiveConnection(this.pseudo, options);
    this.connexion = c;
    const J = this.jeu;
    const sur = (evt, fn) => c.on(evt, d => {
      try { fn(d); } catch (e) { this.log('Erreur en traitant « ' + evt + ' » : ' + e.message); }
    });
    sur(WebcastEvent.GIFT, d => J.onCadeau(cadeauDe(d)));
    sur(WebcastEvent.LIKE, d => J.onLike({ user: userDe(d), nombre: d.likeCount }));
    sur(WebcastEvent.CHAT, d => J.onChat({ user: userDe(d), texte: d.comment }));
    sur(WebcastEvent.MEMBER, d => J.onArrivee({ user: userDe(d) }));
    sur(WebcastEvent.FOLLOW, d => J.onAbonne({ user: userDe(d) }));
    sur(WebcastEvent.SHARE, d => J.onPartage({ user: userDe(d) }));
    sur(WebcastEvent.ROOM_USER, d => { if (d.viewerCount !== undefined) this.onSpectateurs(Number(d.viewerCount)); });
    sur(WebcastEvent.STREAM_END, () => {
      this.changerStatut('termine', 'Le live est terminé.');
    });
    c.on(ControlEvent.DISCONNECTED, () => {
      if (this.statut === 'connecte' || this.statut === 'termine') {
        this.changerStatut('deconnecte', 'Connexion perdue, nouvelle tentative…');
        this.planifier(this.delai);
      }
    });
    c.on(ControlEvent.ERROR, err => {
      this.log('Erreur TikTok : ' + ((err && (err.message || err.info)) || err));
    });
    this.connecter();
  }

  connecter() {
    clearTimeout(this.timer);
    this.changerStatut('connexion', 'Connexion à @' + this.pseudo + '…');
    this.connexion.connect().then(state => {
      this.changerStatut('connecte', 'Connecté au live de @' + this.pseudo + ' (salle ' + state.roomId + ')');
    }).catch(err => {
      const nom = (err && err.constructor && err.constructor.name) || '';
      if (nom === 'UserOfflineError') {
        this.changerStatut('hors-ligne', "@" + this.pseudo + " n'est pas en live. Nouvelle tentative dans 30 s…");
        this.planifier(30000);
      } else if (nom === 'AlreadyConnectedError' || nom === 'AlreadyConnectingError') {
        // rien à faire
      } else {
        this.changerStatut('erreur', 'Connexion impossible : ' + ((err && err.message) || err) + ' — nouvelle tentative…');
        this.planifier(this.delai * 2);
      }
    });
  }

  planifier(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      try { this.connexion.disconnect(); } catch (e) { /* déjà fermé */ }
      this.connecter();
    }, ms);
  }

  arreter() {
    clearTimeout(this.timer);
    try { this.connexion && this.connexion.disconnect(); } catch (e) { /* déjà fermé */ }
  }
}

module.exports = { ConnexionTikTok, userDe, cadeauDe };
