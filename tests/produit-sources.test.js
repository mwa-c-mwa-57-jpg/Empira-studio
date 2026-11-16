import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSources } from '../produit/serveur/sources.mjs';
import * as faux from '../produit/serveur/faux-tiktok.mjs';
import { createFauxTikFinity } from '../tools/faux-tikfinity.mjs';

const attendre = async (f, ms = 3000) => {
  for (const fin = Date.now() + ms; Date.now() < fin; await new Promise((r) => setTimeout(r, 20))) if (f()) return true;
  return false;
};

async function monter() {
  const tik = createFauxTikFinity();
  await new Promise((r) => tik.listen(0, '127.0.0.1', r));
  const recus = [];
  const s = creerSources({ surMessage: (m) => recus.push(m), charger: async () => faux, urlTikFinity: `ws://127.0.0.1:${tik.address().port}`, intervalle: 100, attenteTikFinity: 400 });
  return { tik, recus, s };
}

test('mode automatique : TikFinity ouvert → le live passe par TikFinity, pas par la connexion directe', async () => {
  const { tik, recus, s } = await monter();
  s.connecter('@Mon_Live', 'auto');
  assert.ok(await attendre(() => s.etat().etat === 'connecte' && s.etat().source === 'tikfinity'), JSON.stringify(s.etat()));
  assert.equal(faux.emettre('chat', {}), 0, 'aucune connexion directe ouverte');
  tik.envoyer({ event: 'chat', data: { uniqueId: 'zoe', comment: '974' } });
  tik.envoyer({ event: 'roomUser', data: {} }); // événement inutile au jeu : filtré
  assert.ok(await attendre(() => recus.length === 1));
  assert.deepEqual(recus[0], { event: 'chat', data: { uniqueId: 'zoe', comment: '974' } });

  // TikFinity se ferme → bascule automatique sur la connexion directe
  tik.fermerClients();
  tik.close();
  assert.ok(await attendre(() => s.etat().etat === 'connecte' && s.etat().source === 'direct'), JSON.stringify(s.etat()));
  assert.equal(faux.emettre('chat', { user: { displayId: 'kenzo' }, content: '63', common: { msgId: '9' } }), 1);
  assert.equal(recus.at(-1).data.uniqueId, 'kenzo');
  s.deconnecter();
});

test('mode automatique sans TikFinity : connexion directe, rapidement', async () => {
  const recus = [];
  const s = creerSources({ surMessage: (m) => recus.push(m), charger: async () => faux, urlTikFinity: 'ws://127.0.0.1:1', intervalle: 100, attenteTikFinity: 5000 });
  const t = Date.now();
  s.connecter('mon_live', 'auto');
  assert.ok(await attendre(() => s.etat().etat === 'connecte' && s.etat().source === 'direct'));
  assert.ok(Date.now() - t < 2000, 'pas besoin d’attendre la fin du délai quand TikFinity refuse la connexion');
  s.deconnecter();
});

test('modes forcés : « direct » ignore TikFinity, « tikfinity » n’ouvre jamais la connexion directe', async () => {
  const { tik, s } = await monter();
  s.connecter('mon_live', 'direct');
  assert.ok(await attendre(() => s.etat().source === 'direct' && s.etat().etat === 'connecte'));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(tik.nbClients(), 0);
  s.connecter('mon_live', 'tikfinity');
  assert.ok(await attendre(() => s.etat().source === 'tikfinity' && s.etat().etat === 'connecte'));
  assert.equal(faux.emettre('chat', {}), 0);
  tik.fermerClients();
  tik.close();
  assert.ok(await attendre(() => s.etat().etat === 'reconnexion'));
  assert.match(s.etat().detail, /TikFinity ne répond pas/);
  assert.equal(faux.emettre('chat', {}), 0, 'pas de bascule en mode TikFinity forcé');
  s.deconnecter();
  assert.equal(s.etat().etat, 'deconnecte');
});
