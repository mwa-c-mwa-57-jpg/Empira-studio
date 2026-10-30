// Receives events relayed by the local server (simulated control panel or real TikTok adapter)
// through Server-Sent Events. EventSource reconnects automatically after a network drop.

export function connectServerSource({ onEvent, onAdmin, onStatus, onGifts = () => {}, url = '/events' }) {
  if (typeof EventSource === 'undefined') return null;
  const es = new EventSource(url);
  es.onopen = () => onStatus({ server: 'connected' });
  es.onerror = () => onStatus({ server: 'reconnecting' });
  es.onmessage = (msg) => {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (data.kind === 'event') onEvent(data.event);
    else if (data.kind === 'admin') onAdmin(data);
    else if (data.kind === 'status') onStatus(data);
    else if (data.kind === 'gifts') onGifts(data.gifts);
  };
  return es;
}
