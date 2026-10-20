// Petits sons d'imprimante générés en direct (pas de fichiers audio).
// OBS / TikTok LIVE Studio autorisent le son sans clic ; un navigateur classique attend un clic.

let ctx = null;
let enabled = true;
let noiseBuffer = null;

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx.state === 'running' ? ctx : null;
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

window.addEventListener('pointerdown', () => audio(), { once: true });

// Un aller du chariot : bourdonnement de moteur pas-à-pas + frottement.
export function pass(seconds) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const dur = Math.max(0.08, seconds * 0.92);
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150 + Math.random() * 30, now);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.028, now + 0.02);
  gain.gain.setValueAtTime(0.028, now + dur - 0.04);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(lp).connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 1.4;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.012, now);
  ng.gain.linearRampToValueAtTime(0, now + dur);
  noise.connect(bp).connect(ng).connect(ac.destination);
  noise.start(now, Math.random() * 0.5, dur);
}

// Avance papier : glissement + rouleau.
export function feed(seconds) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const dur = Math.max(0.3, seconds);
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(500, now);
  bp.frequency.linearRampToValueAtTime(1400, now + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(600, now + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.2);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  noise.connect(bp).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + dur + 0.05);
}

// Petit « ding » quand une impression est terminée.
export function done() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const [i, f] of [880, 1320].entries()) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now + i * 0.09);
    g.gain.linearRampToValueAtTime(0.05, now + i * 0.09 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.5);
    osc.connect(g).connect(ac.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.55);
  }
}
