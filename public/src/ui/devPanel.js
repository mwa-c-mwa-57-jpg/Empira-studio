// Test / control panel. Used inside the game page (local events) and in control.html
// (events sent to the local server, which relays them to the OBS page).

import { Simulator } from '../sources/simulator.js';

const TEMPLATE = `
  <h2>Panneau de test <small>(touche D pour masquer)</small></h2>
  <section>
    <label>Spectateur <input data-id="name" maxlength="24"></label>
    <div class="row">
      <button data-act="c1" class="a">Commente « 1 »</button>
      <button data-act="c2" class="b">Commente « 2 »</button>
    </div>
    <div class="row">
      <input data-id="comment" placeholder="Commentaire libre…" maxlength="200">
      <button data-act="comment">Envoyer</button>
    </div>
    <div class="row">
      <button data-act="like10">♥ +10</button>
      <button data-act="like100">♥ +100</button>
      <button data-act="follow">Abonnement</button>
      <button data-act="share">Partage</button>
    </div>
    <div class="row">
      <button data-act="gsmall">Petit cadeau (1💎)</button>
      <button data-act="gmedium">Moyen (30💎)</button>
      <button data-act="gbig">Gros (500💎)</button>
    </div>
    <div class="row">
      <button data-act="combo">Combo ×5 petits</button>
      <button data-act="dup">Doublon (test)</button>
    </div>
  </section>
  <section>
    <h3>Foule simulée</h3>
    <label><input type="checkbox" data-id="crowd"> Activer</label>
    <label>Événements / s <input type="range" data-id="rate" min="1" max="80" value="6"> <span data-id="rateV">6</span></label>
    <label>Préférence <span class="a">SOLAIRE</span> <input type="range" data-id="bias" min="0" max="100" value="50"> <span class="b">AZUR</span></label>
    <label>Taux de cadeaux <input type="range" data-id="giftRate" min="0" max="20" value="3"> <span data-id="giftV">3%</span></label>
    <button data-act="storm">Tempête : 1000 événements</button>
  </section>
  <section>
    <h3>Partie</h3>
    <div class="row">
      <button data-act="restart">Nouvelle partie</button>
      <button data-act="pause">Pause</button>
      <button data-act="speed">Vitesse ×1</button>
    </div>
  </section>
  <section><h3>Diagnostic</h3><pre data-id="stats"></pre></section>
`;

export function createDevPanel(container, { sink, admin, getStats }) {
  container.innerHTML = TEMPLATE;
  const $ = (id) => container.querySelector(`[data-id="${id}"]`);
  const sim = new Simulator(sink);
  const nameInput = $('name');
  nameInput.value = sim.viewers[0].name;
  const me = () => {
    const name = nameInput.value.trim() || 'Testeur';
    return { id: `manual-${name.toLowerCase()}`, name };
  };

  let speed = 1;
  let paused = false;
  const actions = {
    c1: () => sim.comment(me(), '1'),
    c2: () => sim.comment(me(), '2'),
    comment: () => {
      const text = $('comment').value;
      if (text.trim()) sim.comment(me(), text);
      $('comment').value = '';
    },
    like10: () => sim.like(me(), 10),
    like100: () => sim.like(me(), 100),
    follow: () => sim.follow(me()),
    share: () => sim.share(me()),
    gsmall: () => sim.gift(me(), 'small'),
    gmedium: () => sim.gift(me(), 'medium'),
    gbig: () => sim.gift(me(), 'big'),
    combo: () => sim.gift(me(), 'small', 5),
    dup: () => sim.duplicate(me()),
    storm: () => sim.storm(1000),
    restart: () => admin({ action: 'restart' }),
    pause: (btn) => {
      paused = !paused;
      btn.textContent = paused ? 'Reprendre' : 'Pause';
      admin({ action: 'pause', value: paused });
    },
    speed: (btn) => {
      speed = speed >= 4 ? 1 : speed * 2;
      btn.textContent = `Vitesse ×${speed}`;
      admin({ action: 'speed', value: speed });
    },
  };
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (btn) actions[btn.dataset.act]?.(btn);
  });
  $('comment').addEventListener('keydown', (e) => e.key === 'Enter' && actions.comment());
  $('crowd').addEventListener('change', (e) => (e.target.checked ? sim.startCrowd() : sim.stopCrowd()));
  $('rate').addEventListener('input', (e) => {
    sim.crowd.rate = Number(e.target.value);
    $('rateV').textContent = e.target.value;
  });
  $('bias').addEventListener('input', (e) => (sim.crowd.bias = 1 - Number(e.target.value) / 100));
  $('giftRate').addEventListener('input', (e) => {
    sim.crowd.giftRate = Number(e.target.value) / 100;
    $('giftV').textContent = `${e.target.value}%`;
  });

  if (getStats) setInterval(() => ($('stats').textContent = getStats()), 500);
  return sim;
}
