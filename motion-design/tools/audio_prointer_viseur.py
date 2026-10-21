"""Bande son PRO-INTER « Le viseur » — électro-pop nerveuse 128 BPM en la mineur + bruitages calés sur chaque tir.
Calée sur prointer-viseur.html (mêmes temps, en pulsations). Sorties : out/prointer-viseur-music.wav, -sfx.wav, -mix.wav
"""
import numpy as np, os, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 27.5; N = int(SR * DUR)
B = 60 / 128; BAR = 4 * B
def bt(n): return n * B
OUT = os.path.join(os.path.dirname(__file__), "..", "out")
rng = np.random.default_rng(11)

def note(n):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    return 440.0 * 2 ** ((names[n[:-1]] + (int(n[-1]) - 4) * 12) / 12)
def tt(d): return np.arange(int(SR * d)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, min(hi, SR / 2 - 100)], "band", fs=SR, output="sos"), x)
def saw(f, t, ph=0.0): return 2 * ((f * t + ph) % 1.0) - 1
def stereo(sig, pan=0.0):
    if sig.ndim == 2: return sig
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); return np.stack([sig * l, sig * r], 1) * np.sqrt(2)
def place(buf, sig, start, gain=1.0, pan=0.0):
    sig = stereo(sig, pan); i0 = int(round(start * SR))
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n > 0: buf[i0:i0 + n] += sig[:n] * gain
def reverb(x, decay=1.6, wet=0.25, tone=7000):
    n = int(SR * decay); t = np.arange(n) / SR; out = []
    for c in range(2):
        ir = lp(rng.standard_normal(n) * np.exp(-t * 6.9 / decay), tone); ir[:int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        out.append(fftconvolve(x[:, c], ir)[:len(x)])
    return x * (1 - wet) + np.stack(out, 1) * wet * 1.4

# ---------------------------- instruments ----------------------------
def kick(g=1.0):
    t = tt(0.42); f = 46 + 120 * np.exp(-t * 38); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400) * 0.35
    return np.tanh((s + click) * 1.6) * g
def clap(g=1.0):
    t = tt(0.3); nz = bp(rng.standard_normal(len(t)), 900, 7000)
    e = sum(np.where(t > k * 0.009, np.exp(-(t - k * 0.009) * (120 if k < 3 else 22)), 0) for k in range(4))
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.3
    return (nz * e + body) * g
def hat(g=1.0, d=0.05):
    t = tt(d); return hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t * (90 if d < .1 else 14)) * g
def snare(g=1.0):
    t = tt(0.18); return (bp(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t * 28) + np.sin(2 * np.pi * 210 * t) * np.exp(-t * 35) * .5) * g
def crash(g=1.0, d=2.2):
    t = tt(d); return np.stack([hp(rng.standard_normal(len(t)), 5000, 2) for _ in range(2)], 1) * (np.exp(-t * 2.4) * g * 0.6)[:, None]
def supersaw(freqs, d, cut, g=1.0, n=5, det=0.011):
    t = tt(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for f in freqs:
        for v in range(n):
            k = (v - (n - 1) / 2) / ((n - 1) / 2); s = saw(f * (1 + det * k), t, rng.random())
            L += s * (1 - .35 * (k > 0)); R += s * (1 - .35 * (k < 0))
    return np.stack([lp(L, cut, 2), lp(R, cut, 2)], 1) / (len(freqs) * n) * g
def pluck(f, g=1.0):
    t = tt(0.32); idx = 2.2 * np.exp(-t * 18)
    return np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 13) * np.minimum(1, t / 0.002) * g
def bassnote(f, d, g=1.0):
    t = tt(d); s = lp(saw(f, t) * 0.6 + np.sign(np.sin(2 * np.pi * f * t)) * 0.3, 650, 2) + np.sin(2 * np.pi * f * t) * 0.7
    e = np.minimum(1, t / 0.003) * np.exp(-t * 7); e[-int(.006 * SR):] *= np.linspace(1, 0, int(.006 * SR)); return s * e * g

CH = {"Am": ["A3", "C4", "E4", "A4"], "F": ["F3", "A3", "C4", "F4"], "C": ["G3", "C4", "E4", "G4"], "G": ["G3", "B3", "D4", "G4"]}
ROOT = {"Am": "A1", "F": "F1", "C": "C2", "G": "G1"}
PROG = ["Am", "F", "C", "G"]
def chord_of(beat):
    if beat >= 44: return PROG[int((beat - 44) // 4) % 4]
    if 36 <= beat < 44: return "Am" if beat < 40 else ("F" if beat < 42 else "G")
    return PROG[int(beat // 4) % 4]

drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); chords = np.zeros((N, 2)); arp = np.zeros((N, 2)); pad = np.zeros((N, 2)); fx = np.zeros((N, 2))
GROOVE = lambda b: (8 <= b < 36) or (44 <= b < 56)

# batterie
kicks = [b for b in range(0, 37)] + list(range(44, 57))
for b in kicks: place(drums, kick(0.88 if b < 8 else 0.95), bt(b))
for b in list(range(9, 36, 2)) + list(range(45, 56, 2)): place(drums, clap(0.42), bt(b), pan=0.03)
for i in range(int(56 * 4)):
    b = i / 4
    if b < 36 or b >= 44: place(drums, hat((0.10 if i % 2 else 0.05) * (0.7 if b < 8 else 1)), bt(b), pan=0.25)
    if GROOVE(b) and i % 4 == 2: place(drums, hat(0.09, 0.22), bt(b), pan=-0.2)
for k in range(8):                                                           # roulement avant le drop
    place(drums, snare(0.06 + 0.03 * k), bt(6 + k * 0.25), pan=-0.1)
roll = [41 + k * 0.5 for k in range(4)] + [43 + k * 0.25 for k in range(2)] + [43.5 + k * 0.125 for k in range(2)]
for k, b in enumerate(roll): place(drums, snare(0.12 + 0.045 * k), bt(b), pan=0.1)
place(drums, crash(0.5), bt(8)); place(drums, crash(0.6), bt(44)); place(drums, crash(0.45), bt(56))

# basse roulante (doubles croches) et accords « 3-3-2 »
for i in range(int(56 * 4)):
    b = i / 4
    if not GROOVE(b): continue
    f = note(ROOT[chord_of(b)]) * (2 if i % 4 == 2 else 1); place(bass, bassnote(f, B / 4 * 0.95, 0.42), bt(b))
for bar in range(14):
    b0 = bar * 4
    if 36 <= b0 < 44: continue
    cut = 1400 + 2200 * (b0 / 8) if b0 < 8 else 3600
    for pos in (0, 3, 6, 8, 11, 14):
        b = b0 + pos / 4; place(chords, supersaw([note(n) for n in CH[chord_of(b)]], 0.17, cut, 0.55 if b0 >= 8 else 0.5), bt(b))
# arpège pincé à partir de la 4e mesure
for i in range(int(56 * 4)):
    b = i / 4
    if b < 16 or (41 <= b < 44): continue
    ns = CH[chord_of(b)]; f = note(ns[[0, 2, 1, 3, 2, 1, 3, 2][i % 8]]) * 2
    g = 0.16 if GROOVE(b) else 0.09
    place(arp, pluck(f, g), bt(b), pan=0.35 if i % 2 else -0.35)
# nappe : pont (36 → 44) puis discrète sur la fin
for b0, b1, nm in ((36, 40, "Am"), (40, 42, "F"), (42, 44, "G")):
    s = supersaw([note(n) / 2 for n in CH[nm]] + [note(n) for n in CH[nm]], bt(b1 - b0) + .3, 1300 if b0 < 42 else 2000, 1.0)
    e = np.minimum(1, tt(bt(b1 - b0) + .3) / 0.15)[:, None]; e[-int(.3 * SR):] *= np.linspace(1, 0, int(.3 * SR))[:, None]; place(pad, s * e, bt(b0))

# pompage par la grosse caisse
env = np.ones(N); kt = np.array([bt(b) for b in kicks]); ts = np.arange(N) / SR
last = kt[np.clip(np.searchsorted(kt, ts, side="right") - 1, 0, None)]; on = ts >= kt[0]
env[on] = 1 - 0.62 * np.exp(-(ts[on] - last[on]) / 0.11)
for x in (bass, chords, arp): x *= env[:, None]
pad *= (0.55 + 0.45 * env)[:, None]

# montées, impacts
def riser(d, g, f0=200, f1=2400):
    t = tt(d); u = t / d; nz = rng.standard_normal(len(t)); out = np.zeros(len(t))
    for k in range(20):
        s0, s1 = k * len(t) // 20, (k + 1) * len(t) // 20; fc = f0 * (f1 / f0) ** (k / 19); out[s0:s1] = bp(nz, fc * .7, fc * 1.6)[s0:s1]
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (u * 2)) / SR) * 0.25
    return (out + tone) * u ** 2.2 * g
place(fx, riser(bt(2), 0.16, 400, 5000), bt(6))
place(fx, riser(bt(3), 0.5, 200, 7000), bt(41))
t = tt(1.6); place(fx, np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.4) * 0.75, bt(44))      # boum au centre
t = tt(1.2); place(fx, np.sin(2 * np.pi * np.cumsum(35 + 60 * np.exp(-t * 7)) / SR) * np.exp(-t * 3) * 0.45, bt(36))
t = tt(1.0); place(fx, np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 7)) / SR) * np.exp(-t * 3) * 0.4, bt(56))
place(chords, supersaw([note(n) for n in CH["Am"]] + [note("A2")], 1.4, 3000, 0.7) * np.exp(-tt(1.4) * 2.2)[:, None], bt(44))
place(chords, supersaw([note(n) for n in CH["Am"]] + [note("A2")], 1.25, 2600, 0.65) * np.exp(-tt(1.25) * 2.6)[:, None], bt(56))
t = tt(bt(1)); place(fx, lp(rng.standard_normal(len(t)), 3000) * (1 - t / t[-1]) ** 2 * 0.12, bt(36))                      # descente après « +15 »

music = reverb(drums, 0.6, 0.06) + bass + reverb(chords, 1.3, 0.22) + reverb(arp, 1.1, 0.3) + reverb(pad, 2.4, 0.4) + reverb(fx, 1.8, 0.25)
# silence d'un huitième juste avant l'impact
g = np.ones(N); a, b = int(bt(43.75) * SR), int(bt(44) * SR) - 1; g[a:b] = np.linspace(1, 0.08, b - a) ** 0.5; music *= g[:, None]

# ---------------------------- BRUITAGES ----------------------------
sb = np.zeros((N, 2))
def whoosh(d, lo=300, hi=4000, g=0.2, pf=-0.5, pt=0.5):
    t = tt(d); u = t / d; nz = rng.standard_normal(len(t)); out = np.zeros(len(t))
    for k in range(24):
        s0, s1 = k * len(t) // 24, (k + 1) * len(t) // 24; fc = lo * (hi / lo) ** np.sin(np.pi * (k + .5) / 24); out[s0:s1] = bp(nz, fc * .6, fc * 1.6)[s0:s1]
    s = out * np.sin(np.pi * u) ** 2.2 * g; pans = pf + (pt - pf) * u
    return np.stack([s * np.cos((pans + 1) * np.pi / 4), s * np.sin((pans + 1) * np.pi / 4)], 1) * np.sqrt(2)
def lock_snd(big=False):
    t = tt(0.5); thump = np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-t * 45)) / SR) * np.exp(-t * 16)
    clk = bp(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 220)
    ping = (np.sin(2 * np.pi * 2350 * t) + .4 * np.sin(2 * np.pi * 3520 * t)) * np.exp(-t * 14) * .18
    return (thump * (0.6 if big else .38) + clk * .55 + ping) * (1.25 if big else 1)
def thud(g=0.2):
    t = tt(0.25); return (np.sin(2 * np.pi * np.cumsum(60 + 120 * np.exp(-t * 40)) / SR) * np.exp(-t * 20) + lp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 40) * .5) * g
def blip(f, g=0.06):
    t = tt(0.16); fm = f * (1 + .5 * np.exp(-t * 40)); return np.sin(2 * np.pi * np.cumsum(fm) / SR) * np.exp(-t * 24) * np.minimum(1, t / 0.002) * g
def tick(f=3200, g=0.05):
    t = tt(0.05); return np.sin(2 * np.pi * f * t) * np.exp(-t * 120) * g + hp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 300) * g * .5
def glass(base, g=0.05):
    out = np.zeros(int(SR * 1.6))
    for k, iv in enumerate([0, 7, 12, 16]):
        t = tt(1.4); s = (np.sin(2 * np.pi * base * 2 ** (iv / 12) * t) + .3 * np.sin(2 * np.pi * base * 2 ** (iv / 12) * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.2) * g
        i0 = int(k * 0.05 * SR); out[i0:i0 + len(s)] += s[:len(out) - i0]
    return out

# tirs du viseur : (pulsation, durée du déplacement, gros impact)
LOCKS = [(2, .5, 0), (4.5, .42, 0), (6.5, .42, 0), (8, .45, 1), (11, .3, 0), (12.5, .42, 0), (14, .22, 0), (16, .22, 0),
         (18, .42, 0), (19.5, .25, 0), (21, .25, 0), (23, .25, 0), (25, .42, 0), (27, .3, 0), (29.5, .3, 0),
         (32, .42, 0), (32.75, .3, 0), (33.5, .22, 0), (35, .42, 0), (36, 0, 1), (44, bt(3), 1)]
for k, (b, d, big) in enumerate(LOCKS):
    tl = bt(b); pan = -0.35 if k % 2 else 0.35
    if b == 44: pass
    elif d >= .35: place(sb, whoosh(d + .12, 350, 5200, 0.075, -pan, pan), tl - d * .9)
    elif d > 0: place(sb, whoosh(d + .08, 1500, 9000, 0.035, -pan * .5, pan * .5), tl - d * .9)
    place(sb, lock_snd(bool(big)), tl, 0.32 if big else 0.22, pan * .3)
# mots qui claquent
for b in (1.5, 2.5, 4.2, 6.2, 9, 9.5, 10, 32.2, 38.6, 39, 39.5, 40.1):
    place(sb, thud(0.16), bt(b))
for k in range(3): place(sb, thud(0.12), bt(36) + k * .08)
# réactions : pastilles, tuiles, coches, épingles
for k, b in enumerate((12.5, 14, 16)): place(sb, blip(900 + 220 * k, 0.07), bt(b) + .02, pan=-.2)
for k, b in enumerate((18, 19.5, 21, 23)): place(sb, blip(760 + 160 * k, 0.07), bt(b) + .02, pan=.2)
for k, b in enumerate((25, 27, 29.5)): place(sb, glass(note("E6") * 2 ** (k * 2 / 12), 0.03), bt(b) + .02)
for k, b in enumerate((32, 32.75, 33.5)): place(sb, blip(1100 + 200 * k, 0.07), bt(b) + .03, pan=-.3 + .3 * k)
place(sb, whoosh(.3, 2500, 9000, .04, -.4, .4), bt(4.6))                                                           # soulignement
place(sb, glass(note("A5"), 0.035), bt(11) + .02)                                                                  # le point de « JUSTE. »
t = tt(.6); place(sb, bp(rng.standard_normal(len(t)), 2500, 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) * np.sin(np.pi * t / .6) * .05, bt(31) - .05)   # tracé de la carte
for k in range(1, 16):                                                                                              # compteur +15
    u = 1 - (1 - (k - .5) / 15) ** (1 / 3); place(sb, tick(2600 + 60 * k, 0.05), bt(35) + u * (bt(36) - bt(35)))
place(sb, whoosh(bt(2.7), 180, 2600, 0.11, .3, -.3), bt(37))                                                     # grand dézoom
t = tt(bt(3)); u = t / t[-1]                                                                                        # plongée en spirale
sp = bp(rng.standard_normal(len(t)), 600, 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(2 + 14 * u ** 2.4) / SR)) * u ** 1.8 * 0.1
place(sb, np.stack([sp * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(1 + 6 * u ** 2.4) / SR)), sp * (0.5 - 0.5 * np.sin(2 * np.pi * np.cumsum(1 + 6 * u ** 2.4) / SR))], 1) * 1.4, bt(41))
place(sb, glass(note("A5"), 0.05), bt(44) + .03)
TL = bt(44)                                                                                                         # le logo se monte
place(sb, whoosh(.35, 800, 6000, .04, -.6, 0), TL); place(sb, whoosh(.35, 800, 6000, .035, -.6, 0), TL + .06)
place(sb, tick(1800, .06), TL + .14)
for i in range(5): place(sb, blip(1300 + 140 * i, .035), TL + .2 + i * .05, pan=.3)
for i in range(3): place(sb, thud(.1), TL + .25 + i * .12)
place(sb, blip(700, .08), bt(48)); place(sb, tick(2200, .07), bt(48))
for k in range(4): place(sb, glass(note("E6"), .012), bt(49) + k * 4 * B + 0.9)
sfx = reverb(sb, 1.0, 0.14)

fade = np.ones(N); fN = int(SR * 0.6); fade[-fN:] = np.linspace(1, 0, fN) ** 1.5
music = np.stack([hp(music[:, c], 28) for c in range(2)], 1) * fade[:, None]; sfx *= fade[:, None]
sfx *= 2.6
mix = music * 0.85 + sfx
gain = 0.89 / np.max(np.abs(mix))
def write(name, x):
    x = np.tanh(x / 0.89) * 0.89
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
os.makedirs(OUT, exist_ok=True)
write("prointer-viseur-mix.wav", mix * gain); write("prointer-viseur-music.wav", music * 0.85 * gain); write("prointer-viseur-sfx.wav", sfx * gain)
print("gain", round(float(gain), 3))
