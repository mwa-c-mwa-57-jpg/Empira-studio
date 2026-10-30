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
    user: { id: userId, name: u.nickname || u.uniqueId || userId },
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

export async function startTikTokSource(username, { onEvent, onStatus }) {
  let lib;
  try {
    lib = await import('tiktok-live-connector');
  } catch {
    onStatus({ state: 'unavailable', detail: 'module "tiktok-live-connector" non installé (npm install tiktok-live-connector)' });
    return null;
  }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  const options = process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {};
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
