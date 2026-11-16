// Événements du live au format TikTok-Live-Connector « à plat » ({ event, data }).
// Ils viennent du serveur du jeu (connexion directe à TikTok, par défaut) ou, en secours, de l'application TikFinity.
// Le jeu se connecte en WebSocket local, avec reconnexion toutes les 3 s.

import { normalizeKeyword } from '../../public/src/core/events.js';

export const URL_TIKFINITY = 'ws://127.0.0.1:21213';

const COMMANDES = new Set(['fin', 'duree', 'vague', 'revolution', 'duel', 'prime', 'invasion', 'mission', 'avion', 'dire', 'fixe', 'efface', 'suivant', 'musique', 'son', 'zoom', 'cris', 'guerre', 'membres', 'reset']);

/** « !Durée 10 » → { nom: 'duree', arg: '10' } ; null si ce n'est pas une commande connue. */
export function lireCommande(texte) {
  const m = /^\s*!(\S+)\s*(.*)$/s.exec(String(texte || ''));
  if (!m) return null;
  const nom = normalizeKeyword(m[1]).replace(/ /g, '');
  return COMMANDES.has(nom) ? { nom, arg: m[2].trim().slice(0, 200) } : null;
}

const httpsOuRien = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : undefined);

/**
 * Message TikFinity → { evenement } (format normalisé du jeu), { commande } ou null.
 * hote : pseudo TikTok du créateur (ses commandes sont acceptées, comme celles des modérateurs).
 */
export function convertirTikFinity(message, { hote = '' } = {}) {
  let msg = message;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const type = String(msg.event ?? msg.type ?? '');
  const d = msg.data && typeof msg.data === 'object' ? msg.data : msg;
  const u = d.user && typeof d.user === 'object' ? { ...d.user, ...d } : d;
  const pseudo = String(u.uniqueId ?? u.userId ?? '').replace(/^@/, '');
  if (!pseudo) return null;
  const user = { id: pseudo.toLowerCase(), name: u.nickname || pseudo, avatar: httpsOuRien(u.profilePictureUrl ?? u.profilePicture?.url?.[0]) };
  const base = { id: d.msgId ? `tf-${type}-${d.msgId}` : undefined, source: 'tikfinity', ts: Date.now(), user };

  switch (type) {
    case 'chat': {
      const estHote = Boolean(hote) && pseudo.toLowerCase() === String(hote).replace(/^@/, '').toLowerCase();
      const estModo = Boolean(d.isModerator || d.userIdentity?.isModeratorOfAnchor);
      const cmd = (estHote || estModo) ? lireCommande(d.comment) : null;
      if (cmd) return { commande: cmd, user };
      return { evenement: { ...base, type: 'comment', comment: d.comment } };
    }
    case 'like':
      return { evenement: { ...base, type: 'like', likeCount: d.likeCount } };
    case 'gift': {
      // les cadeaux en série (giftType 1) arrivent plusieurs fois : on ne compte que la fin de la série
      if (Number(d.giftType) === 1 && !d.repeatEnd) return null;
      return {
        evenement: {
          ...base,
          type: 'gift',
          gift: {
            id: String(d.giftId ?? d.giftDetails?.giftId ?? 'inconnu'),
            name: d.giftName ?? d.giftDetails?.giftName ?? 'Cadeau',
            diamonds: d.diamondCount ?? d.giftDetails?.diamondCount ?? 0,
            count: d.repeatCount || 1,
            image: httpsOuRien(d.giftPictureUrl ?? d.giftDetails?.giftImage?.giftPictureUrl ?? d.extendedGiftInfo?.image?.url_list?.[0]),
          },
        },
      };
    }
    case 'follow':
      return { evenement: { ...base, type: 'follow' } };
    case 'share':
      return { evenement: { ...base, type: 'share' } };
    case 'social': {
      const t = String(d.displayType ?? d.label ?? '').toLowerCase();
      if (t.includes('share') || t.includes('partag')) return { evenement: { ...base, type: 'share' } };
      if (t.includes('follow') || t.includes('abonn')) return { evenement: { ...base, type: 'follow' } };
      return null;
    }
    default:
      return null;
  }
}

/** Connexion WebSocket à TikFinity avec reconnexion automatique toutes les 3 s. */
export function connecterTikFinity({ url = URL_TIKFINITY, surMessage, surEtat = () => {}, WebSocketImpl = globalThis.WebSocket } = {}) {
  let ws = null;
  let arret = false;
  let minuteur = null;
  const ouvrir = () => {
    if (arret) return;
    surEtat('connexion');
    try {
      ws = new WebSocketImpl(url);
    } catch {
      return planifier();
    }
    ws.onopen = () => surEtat('connecte');
    ws.onmessage = (m) => surMessage(m.data);
    ws.onclose = () => planifier();
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* déjà fermé */
      }
    };
  };
  const planifier = () => {
    if (arret || minuteur) return;
    surEtat('deconnecte');
    minuteur = setTimeout(() => {
      minuteur = null;
      ouvrir();
    }, 3000);
  };
  ouvrir();
  return {
    fermer() {
      arret = true;
      clearTimeout(minuteur);
      try {
        ws?.close();
      } catch {
        /* rien */
      }
    },
  };
}
