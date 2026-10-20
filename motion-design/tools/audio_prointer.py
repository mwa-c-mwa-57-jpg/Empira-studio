"""Bande son PRO-INTER — pop acoustique joyeuse (marimba, glockenspiel) 120 BPM en Fa majeur + bruitages cartoon.
Calée sur prointer.html. Sorties : out/prointer-music.wav, out/prointer-sfx.wav, out/prointer-mix.wav
"""
import numpy as np, os, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 42.0; N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "out")
rng = np.random.default_rng(7)

def note(n):
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    return 440.0 * 2 ** ((names[n[:-1]] + (int(n[-1]) - 4) * 12) / 12)
def tt(d): return np.arange(int(SR * d)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def saw(f, t, ph=0.0): x = (f * t + ph) % 1.0; return 2 * x - 1
def sq(f, t): return np.sign(np.sin(2 * np.pi * f * t))
def env(n, a, r):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR)); e[:A] = np.linspace(0, 1, A) ** 1.5; e[-R:] *= np.linspace(1, 0, R) ** 2; return e
def place(buf, sig, start, gain=1.0, pan=0.0):
    i0 = int(round(start * SR))
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n > 0: buf[i0:i0 + n] += sig[:n] * gain
def reverb(x, decay=2.0, wet=0.3, tone=6000):
    n = int(SR * decay); t = np.arange(n) / SR; out = []
    for c in range(2):
        ir = lp(rng.standard_normal(n) * np.exp(-t * 6.9 / decay), tone); ir[:int(0.015 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        out.append(fftconvolve(x[:, c], ir)[:len(x)])
    return x * (1 - wet) + np.stack(out, 1) * wet * 1.4
def delay(x, time=0.375, fb=0.35, mix=0.25):
    y = x.copy(); d = int(time * SR); g = mix
    for k in range(1, 6):
        sh = np.zeros_like(x); sh[d * k:] = x[:len(x) - d * k] * g
        if k % 2: sh = sh[:, ::-1]
        y += sh; g *= fb
    return y

def tick(f=2600, g=0.12):
    t = tt(0.12); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 60) + hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 300) * 0.4) * g
def ping(f, d=1.4, g=0.2):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.01 * f * t) * np.exp(-t * 6)
    return s * np.exp(-t * 4.2) * np.minimum(1, t / 0.003) * g
def shimmer(d=1.6, base=1200, g=0.08, n=9):
    t = tt(d); s = np.zeros(len(t))
    for k in range(n):
        f = base * 2 ** (rng.integers(0, 24) / 12); st = rng.random() * 0.25
        s += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.where(t > st, np.exp(-(t - st) * 3.5) * np.minimum(1, (t - st) / 0.01), 0)
    return s / n * g * 2.5
def whoosh(d, lo=300, hi=3500, g=0.25, pf=-0.6, pt=0.6):
    t = tt(d); u = t / d; nz = rng.standard_normal(len(t)); out = np.zeros(len(t))
    for k in range(24):
        s0, s1 = k * len(t) // 24, (k + 1) * len(t) // 24; fc = lo * (hi / lo) ** np.sin(np.pi * (k + .5) / 24); out[s0:s1] = bp(nz, fc * .6, min(fc * 1.6, 20000))[s0:s1]
    s = out * np.sin(np.pi * u) ** 2.2 * g; pans = pf + (pt - pf) * u
    return np.stack([s * np.cos((pans + 1) * np.pi / 4), s * np.sin((pans + 1) * np.pi / 4)], 1) * np.sqrt(2)
def swell(d, g=0.2, lo=300, hi=9000):
    t = tt(d); nz = rng.standard_normal(len(t)); out = np.zeros(len(t))
    for k in range(24):
        s0, s1 = k * len(t) // 24, (k + 1) * len(t) // 24; fc = lo * (hi / lo) ** (k / 23); out[s0:s1] = bp(nz, fc * .6, min(fc * 1.5, 20000))[s0:s1]
    return out * (t / d) ** 2.5 * g
def soft_hit(g=0.3):
    t = tt(2.0); return np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 7)) / SR) * np.exp(-t * 2.4) * g + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 5) * g * .5
def blip(f=1800, g=0.05):
    t = tt(0.18); return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 28) * np.minimum(1, t / 0.002) * g
def bubble(g=0.06):                       # « pop » de message du chat
    t = tt(0.16); f = 520 + 900 * (t / 0.16) ** 0.6
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * np.minimum(1, t / 0.003) * g
def powerup(base="D5", g=0.025, step=0.045):   # arpège 8-bit
    out = np.zeros(int(SR * (step * 6 + 0.2))); t = tt(0.12)
    for k, iv in enumerate([0, 3, 7, 12, 15, 19]):
        f = note(base) * 2 ** (iv / 12); s = sq(f, t) * np.exp(-t * 20); i0 = int(k * step * SR); out[i0:i0 + len(s)] += s
    return lp(out, 6000) * g
def click(g=0.3):                         # clic de bouton de manette
    t = tt(0.09); c = bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 160)
    c += np.sin(2 * np.pi * 2100 * t) * np.exp(-t * 90) * 0.4
    t2 = tt(0.3); thump = np.sin(2 * np.pi * np.cumsum(80 + 80 * np.exp(-t2 * 40)) / SR) * np.exp(-t2 * 16) * 0.6
    out = np.zeros(len(t2)); out[:len(c)] += c; out += thump
    return out * g


music = np.zeros((N, 2)); sb = np.zeros((N, 2))
BAR = 2.0

# ---------------------------- MUSIQUE : pop acoustique joyeuse, 120 BPM, Fa majeur ----------------------------
def marimba(f, d=0.5, g=0.1):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 30)) * np.exp(-t * 9) * np.minimum(1, t / 0.002) * g
def glock(f, d=1.2, g=0.06):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 8)) * np.exp(-t * 3.5) * np.minimum(1, t / 0.001) * g
def kick(g=1.0):
    t = tt(0.35); f = 50 + 110 * np.exp(-t * 35); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * g
def clap(g=1.0):
    t = tt(0.25); nz = bp(rng.standard_normal(len(t)), 1000, 6000)
    e = sum(np.where(t > k * 0.01, np.exp(-(t - k * 0.01) * (110 if k < 3 else 30)), 0) for k in range(4)); return nz * e * g
def shaker(g=1.0):
    t = tt(0.07); return hp(rng.standard_normal(len(t)), 6000, 4) * np.sin(np.pi * t / 0.07) ** 2 * g
PROG = [("F", ["F3", "A3", "C4"], ["F4", "A4", "C5", "A4"]), ("C", ["C3", "E3", "G3"], ["E4", "G4", "C5", "G4"]),
        ("Dm", ["D3", "F3", "A3"], ["D4", "F4", "A4", "F4"]), ("Bb", ["Bb2", "D3", "F3"], ["D4", "F4", "Bb4", "F4"])]
ROOT = {"F": "F2", "C": "C2", "Dm": "D2", "Bb": "Bb1"}
pad = np.zeros((N, 2)); mar = np.zeros((N, 2)); bass = np.zeros((N, 2)); drums = np.zeros((N, 2))
for k in range(int(DUR / BAR)):
    t0 = k * BAR; name, chord, arp = PROG[k % 4]
    if t0 >= 40: name, chord, arp = PROG[0]
    tp = tt(BAR + 0.4); L = sum(saw(note(n) * 1.003, tp, rng.random()) for n in chord); R = sum(saw(note(n) * 0.997, tp, rng.random()) for n in chord)
    place(pad, np.stack([lp(L, 900, 4), lp(R, 900, 4)], 1) * env(len(tp), 0.3, 0.4)[:, None] * 0.018, t0)
    for i in range(16 if t0 < 40 else 4):
        tb = t0 + i * 0.125
        if i % 2 == 0 or t0 >= 5.0: place(mar, marimba(note(arp[(i // 2) % 4]) * (2 if i % 2 else 1), 0.45, 0.07 if i % 2 == 0 else 0.035), tb, pan=-0.25 if (i // 2) % 2 else 0.25)
    if t0 >= 4.0 and t0 < 41.0:
        f = note(ROOT[name])
        for q, d in ((0, 0.45), (0.75, 0.2), (1.0, 0.45), (1.5, 0.4)):
            tq = tt(d); place(bass, (np.sin(2 * np.pi * f * 2 * tq) * 0.8 + np.sin(2 * np.pi * f * 4 * tq) * 0.15) * env(len(tq), 0.005, 0.08) * 0.22, t0 + q)
    if 5.0 <= t0 < 41.0:
        place(drums, kick(0.42), t0); place(drums, kick(0.32), t0 + 1.0)
        place(drums, clap(0.13), t0 + 0.5, pan=0.05); place(drums, clap(0.13), t0 + 1.5, pan=0.05)
        for i in range(16): place(drums, shaker(0.05 if i % 2 else 0.028), t0 + i * 0.125, pan=0.3)
music += reverb(pad, 2.4, 0.4) + reverb(mar, 1.4, 0.22) + bass + reverb(drums, 0.8, 0.08)
# motif de glockenspiel sur le logo (début et fin)
for k, nm in enumerate(["C5", "F5", "A5", "C6"]): place(music, glock(note(nm), 1.4, 0.05), 1.05 + k * 0.12)
for k, nm in enumerate(["C5", "F5", "A5", "C6", "F6"]): place(music, glock(note(nm), 1.6, 0.05), 37.9 + k * 0.1)
t = tt(2.0); place(music, np.sin(2 * np.pi * np.cumsum(40 + 40 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2) * 0.25, 41.0)

# ---------------------------- BRUITAGES ----------------------------
def boing(f0=180, f1=520, d=0.4, g=0.08):
    t = tt(d); f = f0 + (f1 - f0) * (t / d) ** 0.7; vib = 1 + 0.08 * np.sin(2 * np.pi * 18 * t) * np.exp(-t * 4)
    return np.sin(2 * np.pi * np.cumsum(f * vib) / SR) * np.exp(-t * 4) * np.minimum(1, t / 0.005) * g
def thud(g=0.2):
    t = tt(0.3); return np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t * 40)) / SR) * np.exp(-t * 18) * g
def step(g=0.04):
    t = tt(0.08); return (lp(rng.standard_normal(len(t)), 1200) * np.exp(-t * 60) + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 50) * .5) * g
def pop(f=900, g=0.06):
    a, b = bubble(g) * 0.7, blip(f, g * 0.6); out = np.zeros(max(len(a), len(b))); out[:len(a)] += a; out[:len(b)] += b; return out
def chime(base="C6", g=0.04):
    out = np.zeros(int(SR * 1.4))
    for k, iv in enumerate([0, 4, 7, 12]): s = glock(note(base) * 2 ** (iv / 12), 1.0, g); i0 = int(k * 0.07 * SR); out[i0:i0 + len(s)] += s[:len(out) - i0]
    return out
def clack(g=0.04):
    t = tt(0.06); return bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 90) * g
def tok(g=0.07):
    t = tt(0.12); return (np.sin(2 * np.pi * 900 * t) * np.exp(-t * 60) + bp(rng.standard_normal(len(t)), 800, 3000) * np.exp(-t * 80)) * g
def scanner(d=1.5, g=0.03):
    t = tt(d); return np.sin(2 * np.pi * (1400 + 300 * np.sin(2 * np.pi * 0.9 * t)) * t) * np.sin(np.pi * t / d) ** 2 * g
def fall(d=0.4, g=0.04):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(2200 - 1600 * (t / d)) / SR) * np.sin(np.pi * t / d) * g
def steps(t0, t1, dt=0.19, g=0.04):
    k = 0
    while t0 + k * dt < t1: place(sb, step(g), t0 + k * dt, pan=0.15 if k % 2 else -0.15); k += 1

# logo
place(sb, whoosh(0.5, 600, 5000, 0.06, -0.6, 0.0), 0.2); place(sb, whoosh(0.5, 600, 5000, 0.05, -0.6, 0.0), 0.32)
place(sb, whoosh(0.55, 2000, 9000, 0.04, 0.0, 0.3), 0.95)
for i in range(4): place(sb, tick(2600 + 300 * i, 0.05), 1.25 + i * 0.05)
place(sb, tick(1800, 0.05), 0.85)
for i in range(5): place(sb, pop(1000 + 120 * i, 0.05), 1.05 + i * 0.08, pan=0.3)
place(sb, shimmer(1.2, 2000, 0.05, 10), 1.55, pan=0.4)
# la cible prend vie
place(sb, boing(260, 340, 0.3, 0.05), 2.25); place(sb, boing(200, 640, 0.55, 0.08), 2.55)
place(sb, whoosh(0.7, 800, 6000, 0.06, -0.2, 0.2), 2.7); place(sb, thud(0.22), 3.48); place(sb, pop(700, 0.06), 3.5)
for i in range(3): place(sb, blip(1600 + 200 * i, 0.03), 3.95 + i * 0.12, pan=0.3)
place(sb, pop(1200, 0.06), 4.0)
# la rue
place(sb, whoosh(1.4, 300, 3000, 0.06, -0.5, 0.5), 5.25); steps(5.25, 6.8, 0.17)
place(sb, pop(800, 0.06), 5.9)
for i in range(5): place(sb, pop(1100 + 100 * i, 0.04), 6.2 + i * 0.12, pan=0.35)
place(sb, whoosh(0.3, 2000, 6000, 0.03), 7.9); place(sb, pop(1300, 0.05), 8.05)
# l'agence
place(sb, whoosh(1.5, 300, 3000, 0.06, -0.5, 0.5), 10.25); steps(10.25, 11.95, 0.2)
for i in range(3): place(sb, pop(900 + 150 * i, 0.06), 12.4 + i * 0.55, pan=-0.35)
place(sb, whoosh(0.3, 3000, 9000, 0.03), 13.8); place(sb, scanner(1.6, 0.025), 14.0)
# le viseur
place(sb, whoosh(1.2, 300, 3000, 0.06, -0.5, 0.5), 16.0)
for i in range(6): place(sb, pop(1000 + 90 * i, 0.04), 16.9 + i * 0.07, pan=-0.3 + 0.12 * i)
for i in range(4): place(sb, whoosh(0.5, 1500, 7000, 0.025, -0.3, 0.3), 17.45 + i * 0.55)
place(sb, tick(3200, 0.07), 19.62); place(sb, chime("C6", 0.04), 19.8)
for i, tm in enumerate((19.75, 20.55, 21.3)): place(sb, pop(900 + 200 * i, 0.05), tm, pan=-0.3 + 0.3 * i)
# le chantier
place(sb, whoosh(1.2, 300, 3000, 0.06, -0.5, 0.5), 21.45)
for i in range(36): place(sb, clack(0.025), 22.7 + i * 0.1, pan=0.35)
for k in range(9): place(sb, tok(0.05), 22.6 + (np.pi / 2 + 2 * np.pi * k) / 9 - 0.0, pan=0.1)
for i, tm in enumerate((22.95, 23.75, 24.5, 25.4)): place(sb, pop(800 + 150 * i, 0.06), tm, pan=0.0)
steps(26.8, 27.8, 0.18); place(sb, pop(900, 0.06), 28.0); place(sb, pop(1300, 0.05), 28.3)
for i in range(3): place(sb, tick(2400 + 300 * i, 0.06), 28.6 + i * 0.6); place(sb, glock(note(["C6", "E6", "G6"][i]), 0.8, 0.035), 28.62 + i * 0.6)
# la carte
place(sb, whoosh(1.2, 300, 3000, 0.06, -0.5, 0.5), 31.3); place(sb, pop(600, 0.06), 32.2)
for i in range(3): place(sb, fall(0.35, 0.03), 32.9 + i * 0.35 - 0.05); place(sb, boing(300, 420, 0.25, 0.05), 33.15 + i * 0.35)
place(sb, pop(700, 0.07), 34.3); place(sb, shimmer(1.0, 1800, 0.04, 8), 34.35)
# retour dans le logo
place(sb, whoosh(1.2, 300, 3000, 0.06, -0.5, 0.5), 35.9); steps(36.3, 36.95, 0.16)
place(sb, boing(220, 700, 0.6, 0.08), 37.15); place(sb, whoosh(0.6, 1000, 8000, 0.05, -0.2, 0.2), 37.3)
place(sb, tick(3000, 0.08), 37.9); place(sb, shimmer(1.6, 2000, 0.06, 12), 37.92)
for i, tm in enumerate((38.3, 38.7, 39.0)): place(sb, pop(1000 + 150 * i, 0.05), tm)
sfx = reverb(sb, 1.2, 0.15)

fade = np.ones(N); fN = int(SR * 0.8); fade[-fN:] = np.linspace(1, 0, fN) ** 1.5
music *= fade[:, None]; sfx *= fade[:, None]
music = np.stack([hp(music[:, c], 30) for c in range(2)], 1)
mix = music * 0.9 + sfx
gain = 0.85 / np.max(np.abs(mix))
def write(name, x):
    x = np.tanh(x / 0.89) * 0.89
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
os.makedirs(OUT, exist_ok=True)
write("prointer-mix.wav", mix * gain); write("prointer-music.wav", music * 0.9 * gain); write("prointer-sfx.wav", sfx * gain)
print("gain", round(float(gain), 3))
