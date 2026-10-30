// TikTok LIVE adapter (EXPERIMENTAL — not yet tested against a real live stream).
//
// Uses the community library "tiktok-live-connector" (https://github.com/zerodytrash/TikTok-Live-Connector),
// which is NOT an official TikTok API. It relies on a third-party signing service (Euler Stream) and
// may stop working whenever TikTok changes its internals. Check TikTok's terms before using it live.
//
// The library is an optional dependency: install it with `npm install tiktok-live-connector`.
// This adapter only converts library events into Empira's normalised event format; the game never
// depends on the library directly, so another source (official API, third-party service) can be
// plugged in by writing another adapter producing the same events.

function profilePicture(u) {
  const pic = u.profilePicture;
  const url = pic?.url?.[0] ?? pic?.urls?.[0] ?? pic?.urlList?.[0] ?? u.profilePictureUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : undefined;
}

/** Picture of a gift, whatever the shape the library gives it (gift event, extended info or catalogue). */
export function giftImage(g) {
  if (!g) return undefined;
  const url = g.image?.url_list?.[0] ?? g.image?.urlList?.[0] ?? g.image?.url?.[0] ?? g.icon?.url_list?.[0] ?? g.icon?.urlList?.[0]
    ?? g.giftImage?.giftPictureUrl ?? g.giftPictureUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : undefined;
}

const withImage = (image) => (image ? { image } : {});

/** Room gift list → [{ id, name, diamonds, image }] (only gifts with a picture). */
export function mapGiftCatalog(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((g) => ({ id: String(g.id ?? g.giftId ?? ''), name: String(g.name ?? g.giftName ?? ''), diamonds: Number(g.diamond_count ?? g.diamondCount ?? 0), image: giftImage(g) }))
    .filter((g) => g.id && g.name && g.image)
    .slice(0, 1000);
}

/** Pure mapping from a library event to a normalised Empira event (or null to ignore). */
export function mapTikTokEvent(kind, data) {
  if (!data) return null;
  const u = data.user || {};
  const userId = String(u.userId ?? u.uniqueId ?? '');
  if (!userId) return null;
  const msgId = data.common?.msgId ?? data.msgId;
  const base = {
    id: msgId ? `tt-${kind}-${msgId}` : undefined,
    source: 'tiktok',
    // arrival time: the unit of TikTok's createTime is not documented, so we do not rely on it
    ts: Date.now(),
    user: { id: userId, name: u.nickname || u.uniqueId || userId, avatar: profilePicture(u) },
  };
  switch (kind) {
    case 'chat':
      return { ...base, type: 'comment', comment: data.comment };
    case 'like':
      return { ...base, type: 'like', likeCount: data.likeCount };
    case 'gift': {
      const details = data.giftDetails || {};
      // Streakable gifts (giftType 1) fire repeatedly while the streak runs: only count the final event.
      if (details.giftType === 1 && !data.repeatEnd) return null;
      return {
        ...base,
        type: 'gift',
        gift: {
          id: String(data.giftId ?? details.giftId ?? 'unknown'),
          name: details.giftName || data.extendedGiftInfo?.name || 'Cadeau',
          diamonds: details.diamondCount ?? data.extendedGiftInfo?.diamond_count ?? 0,
          count: data.repeatCount || 1,
          ...withImage(giftImage(data.extendedGiftInfo) ?? giftImage(details) ?? giftImage(data)),
        },
      };
    }
    case 'follow':
      return { ...base, type: 'follow' };
    case 'share':
      return { ...base, type: 'share' };
    case 'member':
      return { ...base, type: 'join' };
    default:
      return null;
  }
}

export async function startTikTokSource(username, { onEvent, onStatus, onGifts = () => {} }) {
  let lib;
  try {
    lib = await import('tiktok-live-connector');
  } catch {
    onStatus({ state: 'unavailable', detail: 'module "tiktok-live-connector" non installé (npm install tiktok-live-connector)' });
    return null;
  }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  // enableExtendedGiftInfo: the room gift list (names, prices, pictures) is fetched at connection time
  const options = { enableExtendedGiftInfo: true, ...(process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {}) };
  const connection = new TikTokLiveConnection(username, options);
  let retryDelay = 5000;
  let stopped = false;
  let retryTimer = null;

  const events = {
    chat: WebcastEvent?.CHAT ?? 'chat',
    like: WebcastEvent?.LIKE ?? 'like',
    gift: WebcastEvent?.GIFT ?? 'gift',
    follow: WebcastEvent?.FOLLOW ?? 'follow',
    share: WebcastEvent?.SHARE ?? 'share',
    member: WebcastEvent?.MEMBER ?? 'member',
  };
  for (const [kind, name] of Object.entries(events)) {
    connection.on(name, (data) => {
      try {
        const ev = mapTikTokEvent(kind, data);
        if (ev) onEvent(ev);
      } catch (err) {
        onStatus({ state: 'connected', detail: `événement ignoré : ${err.message}` });
      }
    });
  }

  const scheduleReconnect = (reason) => {
    if (stopped || retryTimer) return;
    onStatus({ state: 'reconnecting', detail: `${reason} — nouvel essai dans ${Math.round(retryDelay / 1000)} s` });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  };

  connection.on(ControlEvent?.DISCONNECTED ?? 'disconnected', () => scheduleReconnect('déconnecté'));
  connection.on(WebcastEvent?.STREAM_END ?? 'streamEnd', () => scheduleReconnect('live terminé'));
  connection.on(ControlEvent?.ERROR ?? 'error', (err) => onStatus({ state: 'error', detail: String(err?.info || err?.message || err).slice(0, 160) }));

  async function connect() {
    onStatus({ state: 'connecting', detail: `@${username}` });
    try {
      const state = await connection.connect();
      retryDelay = 5000;
      const catalog = mapGiftCatalog(state?.availableGifts ?? connection.state?.availableGifts ?? connection.availableGifts);
      if (catalog.length) onGifts(catalog);
      onStatus({ state: 'connected', detail: `room ${state?.roomId ?? '?'}` });
    } catch (err) {
      scheduleReconnect(String(err?.message || err).slice(0, 120));
    }
  }
  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      try {
        connection.disconnect();
      } catch {
        /* already closed */
      }
    },
  };
}
