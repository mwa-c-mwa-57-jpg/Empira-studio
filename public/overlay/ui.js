// Habillage HTML par-dessus la 3D : logo, notifications, statut, légende des paliers.
import { t, kindLabel } from './i18n.js';

const MAX_TOASTS = 3;
const TOAST_MS = 3400;

const $ = (sel) => document.querySelector(sel);

export function applyBranding(config) {
  $('#brand-title').textContent = config.branding.title;
  $('#brand-title').dataset.text = config.branding.title;
  $('#brand-sub').textContent = config.branding.subtitle;
  $('#brand-badge').textContent = config.branding.badge;
  $('#brand-badge').hidden = !config.branding.badge;
}

export function renderLegend(config) {
  const legend = $('#legend');
  legend.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'legend-title';
  title.textContent = t('legendTitle');
  legend.append(title);
  const grid = document.createElement('div');
  grid.className = 'legend-grid';
  config.tiers.forEach((tier, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (tier.fullPage ? ' premium' : '');
    chip.dataset.tier = `t${i}`;
    chip.textContent = t(tier.coins === 1 ? 'coin' : 'coins', { n: tier.coins });
    grid.append(chip);
  });
  legend.append(grid);
}

export function highlightTier(tierId) {
  for (const chip of document.querySelectorAll('#legend .chip')) {
    chip.classList.toggle('active', chip.dataset.tier === tierId);
  }
}

export function toast({ kind, name, coins, upgraded }) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = t(upgraded ? 'toastUpgrade' : 'toast', { name, kind: kindLabel(kind, coins) });
  box.append(el);
  while (box.children.length > MAX_TOASTS) box.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, TOAST_MS);
}

export function showStatus(job, queueLength) {
  const el = $('#status');
  const name = job.user.nickname || job.user.uniqueId;
  const kind = kindLabel(job.kind, job.coins);
  el.textContent = queueLength > 0 ? t('status', { name, kind, n: queueLength }) : t('statusNoQueue', { name, kind });
  el.classList.remove('hidden');
}

export function updateQueueCount(job, queueLength) {
  if (job) showStatus(job, queueLength);
}

export function hideStatus() {
  $('#status').classList.add('hidden');
}

export function setOffline(offline) {
  const el = $('#offline');
  el.textContent = t('offline');
  el.classList.toggle('hidden', !offline);
}
