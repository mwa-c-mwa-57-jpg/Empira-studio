// Tableau de bord : pilote le serveur local par WebSocket.
const $ = (sel) => document.querySelector(sel);

const KIND = {
  join: '👋 arrivée',
  follow: '➕ follow',
  share: '↗️ partage',
  comment: '💬 commentaire',
  like: '❤️ likes',
  gift: '🎁 cadeau',
  print: '🖨️',
  system: '⚙️',
};
const STYLE_NAMES = { pencil: 'Crayon', color: 'Couleur', festive: 'Fête', royal: 'Royal', legend: 'Légende' };
const STATUS = {
  connected: ['ok', 'connecté'],
  connecting: ['warn', 'connexion…'],
  offline: ['warn', 'pas en live'],
  error: ['bad', 'erreur'],
  disconnected: ['', 'déconnecté'],
};
const LOG_STATUS = {
  added: 'ajouté à la file',
  upgraded: 'impression améliorée',
  duplicate: 'déjà dans la file',
  cooldown: 'déjà imprimé récemment',
  full: 'file pleine',
};

let ws = null;
let state = null;
let formLoaded = false;
let formDirty = false;

const overlayUrl = `${location.origin}/overlay`;
$('#overlay-url').value = overlayUrl;
$('#btn-preview').href = overlayUrl;

function send(message) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=dashboard`);
  ws.onopen = () => setPill('#pill-ws', 'ok', 'Serveur : OK');
  ws.onclose = () => {
    setPill('#pill-ws', 'bad', 'Serveur : hors ligne');
    setTimeout(connect, 1500);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state') {
      state = msg;
      render();
    }
  };
}

function setPill(sel, cls, text) {
  const el = $(sel);
  el.className = `pill ${cls}`;
  el.textContent = text;
}

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function avatarHtml(user) {
  const a = user.avatar || '';
  if (a.startsWith('test:')) return `<span class="avatar">${esc(a.split(':')[1])}</span>`;
  if (a.startsWith('https://')) return `<span class="avatar" style="background-image:url('/avatar?u=${encodeURIComponent(a)}')"></span>`;
  return `<span class="avatar">${esc(Array.from(user.nickname || '?')[0])}</span>`;
}

function coins(n) {
  return `${n} coin${n > 1 ? 's' : ''}`;
}

function jobTag(job) {
  if (job.kind === 'gift') return `<span class="tag gift">🎁 ${coins(job.coins)} · ${STYLE_NAMES[job.tier?.style] || ''}</span>`;
  return `<span class="tag">${KIND[job.kind] || job.kind}</span>`;
}

// ---- rendu ------------------------------------------------------------------------------

function render() {
  const { tiktok, config } = state;
  const [cls, label] = STATUS[tiktok.state] || STATUS.disconnected;
  const viewers = tiktok.state === 'connected' && tiktok.viewers ? ` · ${tiktok.viewers} spectateurs` : '';
  setPill('#pill-tiktok', cls, `TikTok : ${label}${tiktok.username ? ' @' + tiktok.username : ''}${viewers}`);
  setPill('#pill-overlay', state.overlays ? 'ok' : 'bad', state.overlays ? `Overlay : ${state.overlays} ouvert(s)` : 'Overlay : fermé');
  setPill('#pill-queue', state.queue.length ? 'warn' : '', `File : ${state.queue.length}`);

  const msg = $('#tiktok-message');
  if (tiktok.message) {
    msg.textContent = tiktok.message + (tiktok.retryIn && tiktok.state !== 'connected' ? ` (nouvel essai dans ${tiktok.retryIn} s)` : '');
    msg.className = `hint ${tiktok.state === 'error' ? 'bad' : ''}`;
  } else if (tiktok.state === 'connected') {
    msg.textContent = `Connecté au live de @${tiktok.username}. Les spectateurs vont être imprimés !`;
    msg.className = 'hint ok';
  } else if (!state.overlays) {
    msg.textContent = 'Astuce : ouvre l’aperçu de l’overlay (étape 2) — la file n’avance que si un overlay est ouvert.';
    msg.className = 'hint';
  }
  if (document.activeElement !== $('#username') && !$('#username').value) $('#username').value = config.tiktok.username ? '@' + config.tiktok.username : '';

  renderGiftButtons(config);
  renderCurrent();
  renderQueue();
  renderLog();
  $('#btn-pause').textContent = state.paused ? '▶️ Reprendre' : '⏸ Pause';
  $('#btn-pause').classList.toggle('active', state.paused);
  if (!formLoaded || !formDirty) loadForm(config);
}

let giftKey = '';
function renderGiftButtons(config) {
  const key = JSON.stringify(config.tiers.map((t) => [t.coins, t.fullPage]));
  if (key === giftKey) return;
  giftKey = key;
  const box = $('#gift-buttons');
  box.innerHTML = '';
  for (const tier of config.tiers) {
    const b = document.createElement('button');
    b.className = 'gift' + (tier.fullPage ? ' premium' : '');
    b.textContent = `🎁 ${tier.coins} coin${tier.coins > 1 ? 's' : ''}`;
    b.onclick = () => send({ type: 'simulate', kind: 'gift', coins: tier.coins });
    box.append(b);
  }
}

let progressTimer = null;
function renderCurrent() {
  const box = $('#current');
  clearInterval(progressTimer);
  const job = state.current;
  if (!job) {
    box.className = 'current empty';
    box.textContent = state.feeding ? '📜 Avance du papier…' : state.paused ? '⏸ En pause.' : 'Aucune impression en cours.';
    return;
  }
  box.className = 'current';
  box.innerHTML = `${avatarHtml(job.user)}<span class="who">🖨️ <b>${esc(job.user.nickname)}</b> <small>@${esc(job.user.uniqueId)}</small></span>${jobTag(job)}<span class="progress"></span>`;
  const bar = box.querySelector('.progress');
  const tick = () => {
    const p = Math.min(1, (Date.now() - job.startedAt) / (job.duration * 1000));
    bar.style.width = `${p * 100}%`;
  };
  tick();
  progressTimer = setInterval(tick, 200);
}

function renderQueue() {
  const list = $('#queue');
  if (!state.queue.length) {
    list.innerHTML = '<li class="empty-queue">La file est vide. Utilise les boutons de test ou attends tes spectateurs !</li>';
    return;
  }
  list.innerHTML = state.queue
    .map(
      (job, i) => `<li>
        <span class="pos">${i + 1}</span>${avatarHtml(job.user)}
        <span class="who"><b>${esc(job.user.nickname)}</b> <small>@${esc(job.user.uniqueId)}</small></span>
        ${job.pinned ? '<span class="tag">📌</span>' : ''}${jobTag(job)}
        <button data-bump="${esc(job.id)}" title="Imprimer maintenant">⬆️</button>
        <button data-remove="${esc(job.id)}" title="Retirer" class="danger">✕</button>
      </li>`
    )
    .join('');
}

function renderLog() {
  $('#log').innerHTML = state.log
    .map((e) => {
      const time = new Date(e.at).toLocaleTimeString('fr-FR');
      const what =
        e.kind === 'print'
          ? `🖨️ impression de <b>${esc(e.name)}</b>${e.coins ? ` (${coins(e.coins)})` : ''}`
          : e.kind === 'system'
            ? `⚙️ ${esc(e.status)}`
            : `${KIND[e.kind] || e.kind} · <b>${esc(e.name)}</b>${e.coins ? ` · ${coins(e.coins)}` : ''}${e.comment ? ` · « ${esc(e.comment)} »` : ''} → ${LOG_STATUS[e.status] || esc(e.status)}`;
      return `<li><time>${time}</time>${what}</li>`;
    })
    .join('');
}

// ---- réglages ---------------------------------------------------------------------------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

function loadForm(config) {
  const form = $('#settings');
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.name === 'tiktok.signApiKey') {
      el.value = '';
      el.placeholder = config.tiktok.hasSignApiKey ? '•••••• (enregistrée)' : 'laisser vide';
      continue;
    }
    const value = getPath(config, el.name);
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value ?? '';
  }
  const tiers = $('#tiers');
  tiers.innerHTML = config.tiers
    .map(
      (t, i) => `<label class="tier ${t.fullPage ? 'premium' : ''}">
        <b>${STYLE_NAMES[t.style] || t.style}${t.fullPage ? ' · pleine page' : ''}</b>
        <span>À partir de (coins)</span>
        <input type="number" min="1" data-tier="${i}" value="${t.coins}">
      </label>`
    )
    .join('');
  formLoaded = true;
  formDirty = false;
}

$('#settings').addEventListener('input', () => {
  formDirty = true;
  $('#save-status').textContent = 'Modifications non enregistrées';
  $('#save-status').className = 'hint';
});

$('#settings').addEventListener('submit', (event) => {
  event.preventDefault();
  const config = structuredClone(state.config);
  for (const el of event.target.elements) {
    if (!el.name) continue;
    let value = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') value = Number(value);
    setPath(config, el.name, value);
  }
  for (const input of document.querySelectorAll('[data-tier]')) {
    config.tiers[Number(input.dataset.tier)].coins = Number(input.value);
  }
  send({ type: 'config.save', config });
  formDirty = false;
  $('#save-status').textContent = '✔ Enregistré';
  $('#save-status').className = 'hint ok';
});

// ---- actions ----------------------------------------------------------------------------

$('#connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  send({ type: 'connect', username: $('#username').value.trim() });
});
$('#btn-disconnect').onclick = () => send({ type: 'disconnect' });
$('#btn-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(overlayUrl);
  } catch {
    $('#overlay-url').select();
    document.execCommand('copy');
  }
  $('#btn-copy').textContent = 'Copié ✔';
  setTimeout(() => ($('#btn-copy').textContent = 'Copier'), 1500);
};
for (const b of document.querySelectorAll('[data-sim]')) b.onclick = () => send({ type: 'simulate', kind: b.dataset.sim });
$('#btn-burst').onclick = () => send({ type: 'burst', count: 10 });
$('#btn-pause').onclick = () => send({ type: 'pause', value: !state?.paused });
$('#btn-feed').onclick = () => send({ type: 'feed' });
$('#btn-clear-paper').onclick = () => confirm('Effacer tout le papier ?') && send({ type: 'paper.clear' });
$('#btn-clear-queue').onclick = () => confirm('Vider toute la file d’attente ?') && send({ type: 'queue.clear' });
$('#queue').addEventListener('click', (event) => {
  const bump = event.target.closest('[data-bump]');
  const remove = event.target.closest('[data-remove]');
  if (bump) send({ type: 'queue.bump', id: bump.dataset.bump });
  if (remove) send({ type: 'queue.remove', id: remove.dataset.remove });
});

connect();
