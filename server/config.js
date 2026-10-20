// Chargement / sauvegarde de la configuration.
// config.default.json contient les valeurs d'usine ; config.json (créé au premier lancement)
// contient les réglages de l'utilisateur et n'est jamais écrasé par une mise à jour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PATH = path.join(ROOT, 'config.default.json');
const USER_PATH = path.join(ROOT, 'config.json');

export const STYLES = ['pencil', 'color', 'festive', 'royal', 'legend'];
export const EVENT_KINDS = ['join', 'follow', 'share', 'comment', 'like', 'gift'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Fusion récursive : les tableaux de l'utilisateur remplacent ceux par défaut.
function deepMerge(base, extra) {
  if (!isPlainObject(extra)) return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(extra)) {
    if (!(key in base)) continue;
    out[key] = isPlainObject(base[key]) ? deepMerge(base[key], value) : structuredClone(value);
  }
  return out;
}

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value, fallback, maxLength = 60) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function sanitizeTier(tier, fallback) {
  return {
    coins: Math.round(num(tier?.coins, fallback.coins ?? 0, 0, 1_000_000)),
    style: STYLES.includes(tier?.style) ? tier.style : fallback.style,
    size: Math.round(num(tier?.size, fallback.size, 200, 920)),
    seconds: num(tier?.seconds, fallback.seconds, 2, 60),
    fullPage: typeof tier?.fullPage === 'boolean' ? tier.fullPage : Boolean(fallback.fullPage),
  };
}

// Garantit des valeurs utilisables, même si config.json a été modifié à la main.
export function sanitize(config, defaults = loadDefaults()) {
  const c = deepMerge(defaults, config);
  c.port = Math.round(num(c.port, defaults.port, 1024, 65535));
  c.host = str(c.host, defaults.host, 100);
  c.language = c.language === 'en' ? 'en' : 'fr';
  c.tiktok.username = str(c.tiktok.username, '', 100).trim();
  c.tiktok.autoConnect = Boolean(c.tiktok.autoConnect);
  c.tiktok.signApiKey = str(c.tiktok.signApiKey, '', 200).trim();
  for (const kind of EVENT_KINDS) c.events[kind] = Boolean(c.events[kind]);
  c.commentKeyword = str(c.commentKeyword, '', 40).trim();
  c.likeThreshold = Math.round(num(c.likeThreshold, defaults.likeThreshold, 1, 100_000));
  c.cooldownMinutes = num(c.cooldownMinutes, defaults.cooldownMinutes, 0, 24 * 60);
  c.maxQueue = Math.round(num(c.maxQueue, defaults.maxQueue, 1, 500));
  c.speed = num(c.speed, defaults.speed, 0.25, 4);
  c.feedSeconds = num(c.feedSeconds, defaults.feedSeconds, 0.5, 10);
  c.autoFeedIdleSeconds = num(c.autoFeedIdleSeconds, defaults.autoFeedIdleSeconds, 0, 3600);
  c.sound = Boolean(c.sound);
  for (const key of ['title', 'subtitle', 'badge']) {
    c.branding[key] = str(c.branding[key], defaults.branding[key], 40);
  }
  c.freeTier = sanitizeTier(c.freeTier, defaults.freeTier);
  c.freeTier.coins = 0;
  c.freeTier.fullPage = false;
  const tiers = Array.isArray(c.tiers) && c.tiers.length ? c.tiers : defaults.tiers;
  c.tiers = tiers
    .slice(0, 12)
    .map((tier, i) => sanitizeTier(tier, defaults.tiers[Math.min(i, defaults.tiers.length - 1)]))
    .map((tier) => ({ ...tier, coins: Math.max(1, tier.coins) }))
    .sort((a, b) => a.coins - b.coins);
  return c;
}

export function loadDefaults() {
  return JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
}

export function loadConfig() {
  const defaults = loadDefaults();
  let user = {};
  if (fs.existsSync(USER_PATH)) {
    try {
      user = JSON.parse(fs.readFileSync(USER_PATH, 'utf8'));
    } catch (err) {
      console.warn(`⚠️  config.json illisible (${err.message}) : réglages par défaut utilisés.`);
    }
  }
  const config = sanitize(user, defaults);
  if (!fs.existsSync(USER_PATH)) saveConfig(config);
  return config;
}

export function saveConfig(config) {
  fs.writeFileSync(USER_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// Les réglages envoyés aux navigateurs : jamais la clé API.
export function publicConfig(config) {
  const { tiktok, ...rest } = config;
  return { ...rest, tiktok: { username: tiktok.username, autoConnect: tiktok.autoConnect, hasSignApiKey: Boolean(tiktok.signApiKey) } };
}
