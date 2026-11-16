// Sources des événements du live, toutes reçues par le serveur puis relayées au jeu :
//  - « direct »    : connexion directe au live TikTok (tiktok-live-connector), sans autre logiciel ;
//  - « tikfinity » : TikFinity, s'il est ouvert sur le PC (API WebSocket, port 21213) ;
//  - « auto »      : TikFinity s'il répond, sinon connexion directe ; bascule toute seule si l'un tombe.

import { creerConnexionTikTok, normaliserPseudo } from './tiktok.mjs';

export const URL_TIKFINITY = 'ws://127.0.0.1:21213';
export const MODES = ['auto', 'direct', 'tikfinity'];
const SORTES = new Set(['chat', 'like', 'gift', 'follow', 'share', 'social', 'member', 'subscribe']);

/** Client WebSocket vers TikFinity, avec reconnexion. Les messages sont déjà au format à plat { event, data }. */
export function creerClientTikFinity({ url = URL_TIKFINITY, surMessage, surChangement = () => {}, WebSocketImpl = globalThis.WebSocket, intervalle = 3000 }) {
  let ws = null;
  let actif = false;
  let ouvert = false;
  let tente = false; // au moins une tentative terminée (réussie ou non)
  let minuteur = null;

  const planifier = () => {
    if (!actif || minuteur) return;
    minuteur = setTimeout(() => {
      minuteur = null;
      ouvrir();
    }, intervalle);
  };

  function ouvrir() {
    if (!actif) return;
    let w;
    try {
      w = new WebSocketImpl(url);
    } catch {
      tente = true;
      surChangement();
      return planifier();
    }
    ws = w;
    w.onopen = () => {
      if (ws !== w) return;
      ouvert = true;
      tente = true;
      surChangement();
    };
    w.onmessage = (e) => {
      if (ws !== w) return;
      let m;
      try {
        m = JSON.parse(typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString('utf8'));
      } catch {
        return;
      }
      if (m && typeof m === 'object' && SORTES.has(m.event) && m.data && typeof m.data === 'object') surMessage({ event: m.event, data: m.data });
    };
    // Node (undici) ne déclenche que « error » quand la connexion échoue : les deux mènent à la même fin
    const fin = () => {
      if (ws !== w) return;
      ws = null;
      ouvert = false;
      tente = true;
      try {
        w.close();
      } catch {
        /* déjà fermé */
      }
      surChangement();
      planifier();
    };
    w.onerror = fin;
    w.onclose = fin;
  }

  return {
    demarrer() {
      if (actif) return;
      actif = true;
      ouvrir();
    },
    arreter() {
      actif = false;
      clearTimeout(minuteur);
      minuteur = null;
      const w = ws;
      ws = null;
      ouvert = false;
      tente = false;
      try {
        w?.close();
      } catch {
        /* déjà fermé */
      }
    },
    ouvert: () => ouvert,
    tente: () => tente,
  };
}

export function creerSources({ surMessage, surEtat = () => {}, cleEuler, charger, urlTikFinity = URL_TIKFINITY, WebSocketImpl, intervalle, attenteTikFinity = 2500 }) {
  let mode = 'auto';
  let pseudo = '';
  let voulu = false; // une connexion a été demandée
  let actif = null; // source utilisée : 'direct' | 'tikfinity' | null
  let etatDirect = null;
  let attente = null;
  let etat = { etat: 'deconnecte', detail: 'Entrez votre pseudo TikTok et cliquez sur Connecter.', source: null, mode };

  function calculer() {
    if (!voulu) return { etat: 'deconnecte', detail: pseudo ? 'Déconnecté.' : 'Entrez votre pseudo TikTok et cliquez sur Connecter.', source: null, mode, pseudo };
    if (actif === 'tikfinity') {
      return tik.ouvert()
        ? { etat: 'connecte', detail: `Relié à TikFinity (live de @${pseudo})`, source: 'tikfinity', mode, pseudo }
        : { etat: 'reconnexion', detail: 'TikFinity ne répond pas : ouvrez TikFinity, connectez votre live et activez son API WebSocket (port 21213)', source: 'tikfinity', mode, pseudo };
    }
    if (actif === 'direct') return { ...(etatDirect || { etat: 'connexion', detail: `Connexion au live de @${pseudo}…` }), source: 'direct', mode, pseudo };
    return { etat: 'connexion', detail: 'Recherche de TikFinity sur ce PC…', source: null, mode, pseudo };
  }
  const publier = () => {
    etat = calculer();
    surEtat(etat);
  };

  const direct = creerConnexionTikTok({
    cleEuler,
    charger,
    surMessage: (m) => actif === 'direct' && surMessage(m),
    surEtat: (e) => {
      etatDirect = e;
      if (actif === 'direct') publier();
    },
  });
  const tik = creerClientTikFinity({ url: urlTikFinity, WebSocketImpl, intervalle, surMessage: (m) => actif === 'tikfinity' && surMessage(m), surChangement: () => choisir() });

  function choisir() {
    if (!voulu) return;
    let voulue;
    if (mode === 'direct') voulue = 'direct';
    else if (mode === 'tikfinity') voulue = 'tikfinity';
    else if (tik.ouvert()) voulue = 'tikfinity';
    else if (!tik.tente() && attente) return publier(); // on laisse à TikFinity le temps de répondre
    else voulue = 'direct';
    if (voulue === actif) return publier();
    if (actif === 'direct') direct.deconnecter(true);
    actif = voulue;
    etatDirect = null;
    if (voulue === 'direct') direct.connecter(pseudo);
    publier();
  }

  return {
    connecter(brut, nouveauMode = mode) {
      const p = normaliserPseudo(brut);
      if (!p) {
        etat = { etat: 'erreur', detail: 'Pseudo TikTok invalide.', source: null, mode };
        surEtat(etat);
        return false;
      }
      this.deconnecter(true);
      mode = MODES.includes(nouveauMode) ? nouveauMode : 'auto';
      pseudo = p;
      voulu = true;
      if (mode !== 'direct') tik.demarrer();
      if (mode === 'auto') {
        attente = setTimeout(() => {
          attente = null;
          choisir();
        }, attenteTikFinity);
      }
      choisir();
      return true;
    },
    deconnecter(silencieux = false) {
      voulu = false;
      actif = null;
      clearTimeout(attente);
      attente = null;
      direct.deconnecter(true);
      tik.arreter();
      if (!silencieux) publier();
    },
    etat: () => etat,
  };
}
