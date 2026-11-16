// Licence Lemon Squeezy : activation sur 2 PC au plus (limite réglée dans Lemon Squeezy),
// vérification au lancement, tolérance de quelques jours sans Internet.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export const LEMON = {
  url: 'https://api.lemonsqueezy.com/v1/licenses',
  produitId: '', // identifiant du produit Lemon Squeezy, à renseigner par Empira ; vide = ne pas vérifier le produit
  toleranceJours: 5,
};

export function creerLicence({ fichier, url = LEMON.url, produitId = LEMON.produitId, toleranceJours = LEMON.toleranceJours, nomPc = 'PC', fetchImpl = fetch, maintenant = () => Date.now() }) {
  let cache = null;

  async function appeler(action, corps) {
    try {
      const r = await fetchImpl(`${url}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(corps).toString(),
        signal: AbortSignal.timeout(8000),
      });
      let json = null;
      try {
        json = await r.json();
      } catch {
        /* réponse illisible */
      }
      return { reseau: true, reponse: json };
    } catch {
      return { reseau: false, reponse: null }; // pas d'Internet (ou serveur injoignable)
    }
  }

  const produitOk = (meta) => !produitId || String(meta?.product_id) === String(produitId);

  async function lire() {
    try {
      return JSON.parse(await readFile(fichier, 'utf8'));
    } catch {
      return null;
    }
  }

  async function ecrire(l) {
    await mkdir(path.dirname(fichier), { recursive: true });
    await writeFile(fichier, JSON.stringify(l));
  }

  return {
    async etat() {
      if (cache && cache.expire > maintenant()) return cache.etat;
      const l = await lire();
      let etat;
      if (!l) etat = { ok: false, raison: 'Aucune clé de licence sur ce PC : entrez votre clé sur la page de démarrage.' };
      else {
        const { reseau, reponse: r } = await appeler('validate', { license_key: l.cle, instance_id: l.instance });
        if (reseau && r) {
          if (r.valid && r.license_key?.status === 'active' && produitOk(r.meta)) {
            await ecrire({ ...l, verifie: maintenant() });
            etat = { ok: true };
          } else etat = { ok: false, raison: 'Licence invalide, expirée ou désactivée. Contactez Empira.' };
        } else if ((maintenant() - (l.verifie || 0)) / 86400000 <= toleranceJours) etat = { ok: true, horsLigne: true };
        else etat = { ok: false, raison: `Connexion Internet nécessaire pour vérifier la licence (plus de ${toleranceJours} jours sans vérification).` };
      }
      cache = { etat, expire: maintenant() + 10 * 60000 };
      return etat;
    },

    async activer(cleBrute) {
      const cle = String(cleBrute || '').trim();
      if (cle.length < 8 || cle.length > 100) return { ok: false, raison: 'Clé de licence invalide.' };
      const { reseau, reponse: r } = await appeler('activate', { license_key: cle, instance_name: nomPc });
      if (!reseau) return { ok: false, raison: 'Pas de connexion Internet : l’activation doit se faire en ligne.' };
      if (r?.activated && produitOk(r.meta)) {
        await ecrire({ cle, instance: r.instance?.id, pc: nomPc, verifie: maintenant() });
        cache = null;
        return { ok: true };
      }
      if (/limit/i.test(String(r?.error || ''))) return { ok: false, raison: 'Cette clé est déjà activée sur 2 PC. Désactivez-la sur un autre PC ou contactez Empira.' };
      return { ok: false, raison: 'Clé refusée. Vérifiez la clé reçue par e-mail.' };
    },

    async desactiver() {
      const l = await lire();
      if (!l) return { ok: true };
      const { reseau } = await appeler('deactivate', { license_key: l.cle, instance_id: l.instance });
      if (!reseau) return { ok: false, raison: 'Pas de connexion Internet.' };
      await rm(fichier, { force: true });
      cache = null;
      return { ok: true };
    },
  };
}
