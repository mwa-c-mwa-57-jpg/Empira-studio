// Licence Lemon Squeezy : clé payante, activation sur 2 PC au plus (limite réglée dans Lemon Squeezy),
// vérification au lancement puis régulièrement, tolérance de quelques jours sans Internet.
//
// Protections (aucune n'est inviolable sur un PC que l'acheteur contrôle, mais elles arrêtent les contournements simples) :
//  - la clé doit appartenir à NOTRE boutique et à NOTRE produit (store_id + product_id) ; sans eux, tout est refusé ;
//  - le fichier de licence est chiffré (AES-256-GCM) avec une clé liée à ce PC : copié ailleurs ou modifié, il ne vaut rien ;
//  - une horloge reculée ne prolonge pas la tolérance hors ligne ;
//  - une clé révoquée (remboursement, partage) est bloquée à la vérification suivante, sans tolérance ;
//  - Node lancé avec des options ou variables qui permettraient d'intercepter la vérification → refus.

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

export const LEMON = { url: 'https://api.lemonsqueezy.com/v1/licenses', toleranceJours: 5 };
const HEURE = 3600000;
const JOUR = 24 * HEURE;
const ENTETE = 'EC1';

/** Identifiant stable de ce PC (MachineGuid sous Windows). */
export async function identifiantPc() {
  if (process.platform === 'win32') {
    const guid = await new Promise((resolve) => {
      execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true, timeout: 5000 }, (err, sortie) => resolve(err ? '' : /MachineGuid\s+REG_SZ\s+([\w-]+)/i.exec(String(sortie))?.[1] || ''));
    });
    if (guid) return guid;
  } else {
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      const t = await readFile(f, 'utf8').then((x) => x.trim(), () => '');
      if (t) return t;
    }
  }
  return `${os.hostname()}|${os.userInfo().username}`;
}

/** Variables ou options de Node qui permettraient d'intercepter ou de falsifier la vérification en ligne. */
export function environnementSuspect(env = process.env, execArgv = process.execArgv) {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return 'NODE_TLS_REJECT_UNAUTHORIZED';
  for (const v of ['NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_ENV_PROXY', 'NODE_USE_SYSTEM_CA', 'NODE_REPL_EXTERNAL_MODULE']) if (env[v]) return v;
  if (execArgv.length) return `options de Node (${execArgv.join(' ').slice(0, 60)})`;
  return null;
}

const cleFichier = (secret, pc) => crypto.createHash('sha256').update(`empira-conquest/licence|${secret}|${pc}`).digest();

function chiffrer(objet, cle) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const d = Buffer.concat([c.update(JSON.stringify(objet), 'utf8'), c.final()]);
  return Buffer.concat([Buffer.from(ENTETE), iv, c.getAuthTag(), d]).toString('base64');
}

function dechiffrer(texte, cle) {
  try {
    const b = Buffer.from(String(texte).trim(), 'base64');
    if (b.subarray(0, 3).toString() !== ENTETE) return null;
    const c = crypto.createDecipheriv('aes-256-gcm', cle, b.subarray(3, 15));
    c.setAuthTag(b.subarray(15, 31));
    return JSON.parse(Buffer.concat([c.update(b.subarray(31)), c.final()]).toString('utf8'));
  } catch {
    return null; // modifié, ou venu d'un autre PC
  }
}

export function creerLicence({
  fichier,
  url = LEMON.url,
  storeId = '',
  produitId = '',
  secret = 'developpement',
  idPc = identifiantPc,
  toleranceJours = LEMON.toleranceJours,
  nomPc = 'PC',
  fetchImpl = fetch,
  maintenant = () => Date.now(),
  verifierEnvironnement = environnementSuspect,
}) {
  let cache = null;
  let cle = null;
  const configuree = Boolean(String(storeId) && String(produitId));

  const obtenirCle = async () => (cle ??= cleFichier(secret, typeof idPc === 'function' ? await idPc() : idPc));
  const notreProduit = (meta) => configuree && String(meta?.store_id) === String(storeId) && String(meta?.product_id) === String(produitId);

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
        /* réponse illisible : traitée comme une absence de réseau */
      }
      return { reseau: true, reponse: json && typeof json === 'object' ? json : null };
    } catch {
      return { reseau: false, reponse: null };
    }
  }

  async function lire() {
    const t = await readFile(fichier, 'utf8').catch(() => null);
    return t ? dechiffrer(t, await obtenirCle()) : null;
  }

  async function ecrire(l) {
    await mkdir(path.dirname(fichier), { recursive: true });
    await writeFile(fichier, chiffrer(l, await obtenirCle()));
  }

  function bloquage() {
    if (!configuree) return 'Cette copie du jeu n’est pas configurée pour la vente (produit Lemon Squeezy manquant). Contactez Empira.';
    const v = verifierEnvironnement();
    if (v) return `Node.js a été lancé avec un réglage qui empêche de vérifier la licence (${v}). Fermez tout et lancez le jeu avec « LANCER LE JEU ».`;
    return null;
  }

  async function calculer() {
    const b = bloquage();
    if (b) return { ok: false, raison: b };
    const l = await lire();
    if (!l?.cle || !l.instance) return { ok: false, raison: 'Aucune licence active sur ce PC : entrez votre clé dans la fenêtre de pilotage.' };
    const t = maintenant();
    const { reseau, reponse: r } = await appeler('validate', { license_key: l.cle, instance_id: l.instance });
    if (reseau && r && typeof r.valid === 'boolean') {
      const ok = r.valid && r.license_key?.status === 'active' && notreProduit(r.meta) && (!r.instance || r.instance.id === l.instance);
      // une réponse négative supprime la tolérance hors ligne : couper Internet après une révocation ne sert à rien
      await ecrire({ ...l, verifie: ok ? t : 0, vu: Math.max(l.vu || 0, t) });
      return ok ? { ok: true } : { ok: false, raison: 'Licence invalide, désactivée ou remboursée. Contactez Empira.' };
    }
    if (l.vu && t < l.vu - HEURE) return { ok: false, raison: 'L’horloge du PC a été reculée : connectez-vous à Internet pour vérifier la licence.' };
    if (l.verifie && t - l.verifie <= toleranceJours * JOUR) {
      if (t > (l.vu || 0)) await ecrire({ ...l, vu: t });
      return { ok: true, horsLigne: true };
    }
    return { ok: false, raison: `Connexion Internet nécessaire pour vérifier la licence (plus de ${toleranceJours} jours sans vérification).` };
  }

  return {
    configuree,
    async etat(forcer = false) {
      if (!forcer && cache && cache.expire > maintenant()) return cache.etat;
      const etat = await calculer();
      cache = { etat, expire: maintenant() + 10 * 60000 };
      return etat;
    },

    async activer(cleBrute) {
      const b = bloquage();
      if (b) return { ok: false, raison: b };
      const cleLicence = String(cleBrute || '').trim();
      if (cleLicence.length < 8 || cleLicence.length > 100 || /\s/.test(cleLicence)) return { ok: false, raison: 'Clé de licence invalide.' };
      const { reseau, reponse: r } = await appeler('activate', { license_key: cleLicence, instance_name: nomPc });
      if (!reseau) return { ok: false, raison: 'Pas de connexion Internet : l’activation doit se faire en ligne.' };
      if (r?.activated && r.instance?.id) {
        if (!notreProduit(r.meta)) {
          // clé d'un autre produit ou d'une autre boutique : on libère l'activation et on refuse
          await appeler('deactivate', { license_key: cleLicence, instance_id: r.instance.id });
          return { ok: false, raison: 'Cette clé n’est pas une clé Empira Conquest.' };
        }
        const t = maintenant();
        await ecrire({ cle: cleLicence, instance: r.instance.id, pc: nomPc, verifie: t, vu: t });
        cache = null;
        return { ok: true };
      }
      if (/limit/i.test(String(r?.error || ''))) return { ok: false, raison: 'Cette clé est déjà activée sur 2 PC. Désactivez-la sur un autre PC ou contactez Empira.' };
      return { ok: false, raison: 'Clé refusée. Vérifiez la clé reçue par e-mail après l’achat.' };
    },

    async desactiver() {
      const l = await lire();
      if (!l) {
        await rm(fichier, { force: true });
        return { ok: true };
      }
      const { reseau } = await appeler('deactivate', { license_key: l.cle, instance_id: l.instance });
      if (!reseau) return { ok: false, raison: 'Pas de connexion Internet.' };
      await rm(fichier, { force: true });
      cache = null;
      return { ok: true };
    },
  };
}
