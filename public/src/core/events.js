// Normalised live event schema, shared by every event source (simulator, TikTok, tests).
//
// {
//   id: string            unique id used for de-duplication
//   type: 'comment' | 'like' | 'gift' | 'follow' | 'share' | 'join'
//   source: string        'sim' | 'tiktok' | 'test' | ...
//   ts: number            epoch ms when the event happened
//   user: { id: string, name: string, avatar?: string (https URL of the profile picture) }
//   comment?: string      (type 'comment')
//   likeCount?: number    (type 'like')
//   gift?: { id: string, name: string, diamonds: number, count: number }  (type 'gift', one finished streak)
// }

export const EVENT_TYPES = ['comment', 'like', 'gift', 'follow', 'share', 'join'];

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

export function sanitizeText(value, maxLength) {
  if (value === null || value === undefined) return '';
  return String(value).replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

let syntheticCounter = 0;

/**
 * Validates and normalises a raw event. Returns { ok: true, event } or { ok: false, reason }.
 * Never throws: anything unexpected coming from the network is rejected, not crashed on.
 */
export function normalizeEvent(raw, { now = Date.now(), maxEventAgeSec = 120, maxNameLength = 24, maxCommentLength = 200 } = {}) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not-an-object' };
  if (!EVENT_TYPES.includes(raw.type)) return { ok: false, reason: 'unknown-type' };

  const userId = sanitizeText(raw.user?.id ?? raw.user?.name, 64);
  if (!userId) return { ok: false, reason: 'missing-user' };
  const userName = sanitizeText(raw.user?.name ?? userId, maxNameLength) || userId.slice(0, maxNameLength);

  let ts = Number(raw.ts);
  if (!Number.isFinite(ts) || ts <= 0) ts = now;
  if (now - ts > maxEventAgeSec * 1000) return { ok: false, reason: 'stale' };
  if (ts - now > 60_000) ts = now; // clock skew from the source: trust our clock

  const id = sanitizeText(raw.id, 128) || `${raw.type}:${userId}:${ts}:${++syntheticCounter}`;

  const event = {
    id,
    type: raw.type,
    source: sanitizeText(raw.source, 16) || 'unknown',
    ts,
    user: { id: userId, name: userName },
  };
  const avatar = sanitizeText(raw.user?.avatar, 600);
  if (/^https:\/\/[^\s"'<>]+$/i.test(avatar)) event.user.avatar = avatar;

  switch (raw.type) {
    case 'comment': {
      const comment = sanitizeText(raw.comment, maxCommentLength);
      if (!comment) return { ok: false, reason: 'empty-comment' };
      event.comment = comment;
      break;
    }
    case 'like':
      event.likeCount = clampInt(raw.likeCount, 1, 1000, 1);
      break;
    case 'gift': {
      const g = raw.gift || {};
      event.gift = {
        id: sanitizeText(g.id, 32) || 'unknown',
        name: sanitizeText(g.name, 32) || 'Cadeau',
        diamonds: clampInt(g.diamonds, 0, 50_000, 0),
        count: clampInt(g.count, 1, 1000, 1),
      };
      break;
    }
    default:
      break;
  }
  return { ok: true, event };
}

/** Lower-cases and strips accents so "Soléil!" matches the keyword "soleil". */
export function normalizeKeyword(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
