// Connexion directe au live TikTok, sans TikFinity.
// Bibliothèque : tiktok-live-connector 2.4.0 (licence MIT ; les versions ≥ 2.5.0 sont sous AGPL, à ne pas utiliser).
// Ce n'est pas une API officielle de TikTok : la signature des connexions passe par le service Euler Stream.
// Les événements sont convertis au format « TikTok-Live-Connector à plat » que le jeu lit déjà (comme TikFinity).

const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : undefined);

function image(o) {
  if (!o) return undefined;
  return https(o.image?.urlList?.[0] ?? o.image?.url_list?.[0] ?? o.image?.url?.[0] ?? o.icon?.urlList?.[0] ?? o.giftImage?.giftPictureUrl ?? o.giftPictureUrl);
}

/** Type d'événement social (abonnement ou partage) d'après les libellés de TikTok. */
function typeSocial(d) {
  const t = [d.common?.displayText?.key, d.common?.displayText?.displayType, d.displayType, d.action].filter(Boolean).join(' ').toLowerCase();
  if (t.includes('share') || Number(d.shareCount) > 0 || d.shareType) return 'share';
  if (t.includes('follow') || Number(d.followCount) > 0) return 'follow';
  return null;
}

/**
 * Événement de la bibliothèque (schéma v3 de TikTok, observé sur un vrai live ; ancien schéma en repli)
 * → message à plat { event, data } que le jeu lit déjà.
 */
export function aplatir(sorte, d) {
  if (!d) return null;
  const u = d.user || {};
  const pseudo = u.displayId || u.uniqueId || d.uniqueId;
  if (!pseudo) return null;
  const base = {
    uniqueId: String(pseudo),
    nickname: u.nickname || d.nickname || String(pseudo),
    // photo en 720 px (avatarMedium) plutôt que la miniature de 100 px, floue une fois agrandie dans un département
    profilePictureUrl: https(u.avatarMedium?.urlList?.[0] ?? u.avatarLarge?.urlList?.[0] ?? u.avatarThumb?.urlList?.[0] ?? u.profilePicture?.url?.[0] ?? u.profilePicture?.urls?.[0] ?? d.profilePictureUrl),
    msgId: String(d.common?.msgId ?? d.msgId ?? ''),
    isModerator: Boolean(d.userIdentity?.isModeratorOfAnchor || u.userAttr?.isAdmin || d.isModerator),
  };
  if (!base.msgId) delete base.msgId;
  switch (sorte) {
    case 'chat':
      return { event: 'chat', data: { ...base, comment: String(d.content ?? d.comment ?? '') } };
    case 'like':
      return { event: 'like', data: { ...base, likeCount: Number(d.count ?? d.likeCount ?? 1) } };
    case 'gift': {
      const g = d.gift || d.giftDetails || {};
      // cadeau « en série » (combo) : TikTok renvoie le message à chaque envoi, seule la fin de série compte
      const serie = g.combo === true || Number(g.type ?? g.giftType) === 1;
      return {
        event: 'gift',
        data: {
          ...base,
          giftId: String(d.giftId ?? g.id ?? g.giftId ?? ''),
          giftName: g.name ?? g.giftName ?? d.giftName ?? 'Cadeau',
          diamondCount: Number(g.diamondCount ?? d.diamondCount ?? 0),
          giftType: serie ? 1 : Number(g.type ?? 0),
          repeatCount: Number(d.repeatCount || d.comboCount || 1),
          repeatEnd: Boolean(Number(d.repeatEnd)),
          giftPictureUrl: image(g) ?? image(d.extendedGiftInfo) ?? image(d),
        },
      };
    }
    case 'follow':
    case 'share':
      return { event: sorte, data: base };
    case 'social': {
      const t = typeSocial(d);
      return t ? { event: t, data: base } : null;
    }
    default:
      return null;
  }
}

/**
 * Gère la connexion au live : connecter(pseudo), deconnecter(), etat().
 * surMessage reçoit les messages à plat, surEtat chaque changement d'état.
 */
/** Pseudo TikTok nettoyé (@, lien de profil acceptés), ou null s'il est invalide. */
export function normaliserPseudo(brut) {
  const p = String(brut || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/, '').replace(/\/.*$/, '');
  return /^[\w.]{2,40}$/.test(p) ? p : null;
}

export function creerConnexionTikTok({ surMessage, surEtat = () => {}, cleEuler = '', charger = () => import('tiktok-live-connector') }) {
  let connexion = null;
  let pseudo = '';
  let etat = { etat: 'deconnecte', detail: 'Entrez votre pseudo TikTok et cliquez sur Connecter.' };
  let minuteur = null;
  let delai = 5000;
  let generation = 0;

  const changer = (e) => {
    etat = { ...e, pseudo };
    surEtat(etat);
  };

  async function ouvrir(gen) {
    if (gen !== generation) return;
    let lib;
    try {
      lib = await charger();
    } catch (err) {
      changer({ etat: 'erreur', detail: `Bibliothèque de connexion introuvable : ${err.message}` });
      return;
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    changer({ etat: 'connexion', detail: `Connexion au live de @${pseudo}…` });
    // enableExtendedGiftInfo reste désactivé : il exige un abonnement payant chez Euler Stream (l'image arrive avec chaque cadeau)
    const cle = typeof cleEuler === 'function' ? cleEuler() : cleEuler;
    const c = new TikTokLiveConnection(pseudo, { enableExtendedGiftInfo: false, ...(cle ? { signApiKey: cle } : {}) });
    connexion = c;
    // abonnements et partages arrivent aussi par l'événement « social » : le jeu ignore les doublons (même msgId)
    const sortes = { chat: WebcastEvent.CHAT, like: WebcastEvent.LIKE, gift: WebcastEvent.GIFT, follow: WebcastEvent.FOLLOW, share: WebcastEvent.SHARE, social: WebcastEvent.SOCIAL };
    for (const [sorte, nom] of Object.entries(sortes)) {
      c.on(nom, (d) => {
        if (gen !== generation) return;
        try {
          const m = aplatir(sorte, d);
          if (m) surMessage(m);
        } catch {
          /* un événement illisible est ignoré, la connexion continue */
        }
      });
    }
    const relancer = (raison) => {
      if (gen !== generation || minuteur) return;
      changer({ etat: 'reconnexion', detail: `${raison} — nouvel essai dans ${Math.round(delai / 1000)} s` });
      minuteur = setTimeout(() => {
        minuteur = null;
        ouvrir(gen);
      }, delai);
      delai = Math.min(delai * 2, 60000);
    };
    c.on(ControlEvent.DISCONNECTED, () => relancer('Connexion perdue'));
    c.on(WebcastEvent.STREAM_END, () => relancer('Le live est terminé'));
    c.on(ControlEvent.ERROR, () => {});
    try {
      const s = await c.connect();
      if (gen !== generation) return c.disconnect?.();
      delai = 5000;
      changer({ etat: 'connecte', detail: `Connecté au live de @${pseudo}`, salle: s?.roomId ? String(s.roomId) : undefined });
    } catch (err) {
      const msg = String(err?.message || err);
      relancer(/offline|not live|UserOffline/i.test(msg) || err?.constructor?.name === 'UserOfflineError' ? `@${pseudo} n'est pas en live` : `Échec de connexion (${msg.slice(0, 100)})`);
    }
  }

  return {
    connecter(nouveau) {
      const p = normaliserPseudo(nouveau);
      if (!p) {
        changer({ etat: 'erreur', detail: 'Pseudo TikTok invalide.' });
        return false;
      }
      this.deconnecter(true);
      pseudo = p;
      generation++;
      delai = 5000;
      ouvrir(generation);
      return true;
    },
    deconnecter(silencieux = false) {
      generation++;
      clearTimeout(minuteur);
      minuteur = null;
      try {
        connexion?.disconnect?.();
      } catch {
        /* déjà fermée */
      }
      connexion = null;
      if (!silencieux) changer({ etat: 'deconnecte', detail: 'Déconnecté.' });
    },
    etat: () => etat,
  };
}
