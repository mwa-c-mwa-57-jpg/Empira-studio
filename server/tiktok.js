// Connexion au live TikTok et normalisation des événements.
// Les champs TikTok changent régulièrement : tout est lu de façon défensive.
import { EventEmitter } from 'node:events';
import { TikTokLiveConnection, WebcastEvent, ControlEvent, UserOfflineError } from 'tiktok-live-connector';

const RETRY_DELAYS = [10, 20, 30, 60]; // secondes
const STREAK_TIMEOUT_MS = 6000; // fin de combo jamais reçue : on valide quand même

function firstUrl(image) {
  const list = image?.urlList || image?.url || image?.urls || [];
  if (!Array.isArray(list) || !list.length) return '';
  // Le JPEG passe partout ; sinon la première URL (souvent du WebP).
  return list.find((u) => /\.jpe?g(\?|$)/i.test(u)) || list[0] || '';
}

export function normalizeUser(u = {}) {
  const uniqueId = u.uniqueId || u.displayId || u.username || '';
  const nickname = u.nickname || uniqueId || 'viewer';
  const id = String(u.userId || u.idStr || u.id || uniqueId || nickname);
  const avatar =
    u.profilePictureUrl ||
    firstUrl(u.avatarLarge) ||
    firstUrl(u.avatarMedium) ||
    firstUrl(u.avatarThumb) ||
    firstUrl(u.profilePicture) ||
    '';
  return { id, uniqueId, nickname, avatar: typeof avatar === 'string' ? avatar : '' };
}

export function normalizeGift(data = {}) {
  const gift = data.gift || data.giftDetails || data.extendedGiftInfo || {};
  const unit = Number(gift.diamondCount ?? gift.diamond_count ?? data.diamondCount ?? 0) || 1;
  const giftType = Number(gift.type ?? gift.giftType ?? data.giftType ?? 0);
  const repeatCount = Math.max(1, Number(data.repeatCount ?? data.repeat_count ?? 1) || 1);
  return {
    giftId: String(data.giftId ?? gift.id ?? ''),
    giftName: gift.name || gift.giftName || data.giftName || 'gift',
    unit,
    repeatCount,
    streakable: giftType === 1,
    repeatEnd: Boolean(data.repeatEnd),
    groupId: String(data.groupId ?? ''),
  };
}

export class TikTokBridge extends EventEmitter {
  constructor(getConfig) {
    super();
    this.getConfig = getConfig;
    this.conn = null;
    this.manualStop = true;
    this.retryIndex = 0;
    this.retryTimer = null;
    this.streaks = new Map();
    this.finishedStreaks = new Map(); // combos validés par délai : évite de les compter deux fois
    this.likes = new Map();
    this.status = { state: 'disconnected', username: '', roomId: '', viewers: 0, message: '' };
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emit('status', this.status);
  }

  async connect(username) {
    const clean = String(username || '')
      .trim()
      .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '')
      .replace(/\/live.*$/i, '')
      .replace(/^@/, '');
    if (!clean) {
      this.setStatus({ state: 'error', message: 'Pseudo TikTok manquant.' });
      return;
    }
    clearTimeout(this.retryTimer);
    await this.teardown();
    this.manualStop = false;
    this.likes.clear();
    this.setStatus({ state: 'connecting', username: clean, roomId: '', viewers: 0, message: '' });

    const options = { processInitialData: false };
    const apiKey = this.getConfig().tiktok.signApiKey;
    if (apiKey) options.signApiKey = apiKey;

    const conn = new TikTokLiveConnection(clean, options);
    this.conn = conn;
    this.wire(conn);

    try {
      const state = await conn.connect();
      if (this.conn !== conn) return;
      this.retryIndex = 0;
      this.setStatus({ state: 'connected', roomId: String(state?.roomId || conn.roomId || ''), message: '' });
    } catch (err) {
      if (this.conn !== conn) return;
      const offline = err instanceof UserOfflineError || /offline|not.*live|isn't online/i.test(err?.message || '');
      this.setStatus({
        state: offline ? 'offline' : 'error',
        message: offline ? `@${clean} n'est pas en live.` : `Connexion impossible : ${err?.message || err}`,
      });
      this.scheduleRetry();
    }
  }

  async disconnect() {
    this.manualStop = true;
    clearTimeout(this.retryTimer);
    await this.teardown();
    this.setStatus({ state: 'disconnected', roomId: '', viewers: 0, message: '' });
  }

  async teardown() {
    const conn = this.conn;
    this.conn = null;
    for (const s of this.streaks.values()) clearTimeout(s.timer);
    this.streaks.clear();
    this.finishedStreaks.clear();
    if (!conn) return;
    conn.removeAllListeners();
    try {
      await conn.disconnect();
    } catch {
      /* déjà fermé */
    }
  }

  scheduleRetry() {
    if (this.manualStop) return;
    const delay = RETRY_DELAYS[Math.min(this.retryIndex, RETRY_DELAYS.length - 1)];
    this.retryIndex++;
    this.setStatus({ retryIn: delay });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (!this.manualStop) this.connect(this.status.username);
    }, delay * 1000);
  }

  viewer(kind, data, extra = {}) {
    const user = normalizeUser(data?.user || data);
    this.emit('viewer', { kind, user, ...extra });
  }

  wire(conn) {
    const guard = (fn) => (data) => {
      if (this.conn !== conn) return;
      try {
        fn(data);
      } catch (err) {
        console.warn('Événement TikTok ignoré :', err?.message || err);
      }
    };

    conn.on(WebcastEvent.MEMBER, guard((d) => this.viewer('join', d)));
    conn.on(WebcastEvent.FOLLOW, guard((d) => this.viewer('follow', d)));
    conn.on(WebcastEvent.SHARE, guard((d) => this.viewer('share', d)));
    conn.on(WebcastEvent.CHAT, guard((d) => this.viewer('comment', d, { comment: String(d?.comment || '') })));

    conn.on(
      WebcastEvent.LIKE,
      guard((d) => {
        const user = normalizeUser(d?.user);
        const total = (this.likes.get(user.id) || 0) + (Number(d?.likeCount) || 1);
        this.likes.set(user.id, total);
        this.emit('viewer', { kind: 'like', user, likeTotal: total });
      })
    );

    conn.on(WebcastEvent.GIFT, guard((d) => this.onGift(d)));

    conn.on(
      WebcastEvent.ROOM_USER,
      guard((d) => {
        const viewers = Number(d?.viewerCount ?? d?.total ?? 0);
        if (viewers) this.setStatus({ viewers });
      })
    );

    conn.on(
      WebcastEvent.STREAM_END,
      guard(() => {
        this.setStatus({ state: 'offline', message: 'Le live est terminé.' });
      })
    );

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.conn !== conn || this.manualStop) return;
      this.setStatus({ state: 'offline', message: 'Connexion perdue, nouvelle tentative…' });
      this.scheduleRetry();
    });

    conn.on(ControlEvent.ERROR, (e) => {
      if (this.conn !== conn) return;
      console.warn('Erreur TikTok :', e?.info || '', e?.exception?.message || e?.exception || '');
    });
  }

  // Les cadeaux « combo » envoient plusieurs événements : on ne compte que le total final.
  onGift(data) {
    const user = normalizeUser(data?.user);
    const gift = normalizeGift(data);
    const key = `${user.id}:${gift.giftId}:${gift.groupId}`;

    const finish = (repeatCount, byTimeout = false) => {
      const pending = this.streaks.get(key);
      if (pending) clearTimeout(pending.timer);
      this.streaks.delete(key);
      const already = this.finishedStreaks.get(key);
      this.finishedStreaks.delete(key);
      const count = repeatCount - (already?.count || 0);
      if (byTimeout) this.finishedStreaks.set(key, { count: repeatCount, at: Date.now() });
      if (count <= 0) return;
      this.emit('viewer', {
        kind: 'gift',
        user,
        coins: gift.unit * count,
        giftName: gift.giftName,
        repeatCount: count,
      });
    };

    for (const [k, v] of this.finishedStreaks) {
      if (Date.now() - v.at > 60_000) this.finishedStreaks.delete(k);
    }

    if (gift.streakable && !gift.repeatEnd) {
      const pending = this.streaks.get(key);
      if (pending) clearTimeout(pending.timer);
      const timer = setTimeout(() => finish(gift.repeatCount, true), STREAK_TIMEOUT_MS);
      this.streaks.set(key, { timer, repeatCount: gift.repeatCount });
      return;
    }
    finish(gift.repeatCount);
  }
}
