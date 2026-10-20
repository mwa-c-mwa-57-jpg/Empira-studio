"""Bande son « Jeux & interactions » — trap 120 BPM en Ré mineur, arpèges 8 bits, passage horreur, 100 % synthétisés.
Calée sur jeux.html. Sorties : out/jeux-music.wav, out/jeux-sfx.wav, out/jeux-mix.wav
"""
import numpy as np, os, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 44.0; N = int(SR * DUR)
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
BEAT = 0.5; BAR = 2.0

# ---------------------------- MUSIQUE ----------------------------
# accords (4 s) en Ré mineur ; la forêt (24-28 s) reste sur un bourdon sombre
CH = [(0, 4, ["D3", "A3", "F4"], "D1"), (4, 8, ["D3", "A3", "F4"], "D1"), (8, 12, ["Bb2", "F3", "D4"], "Bb0"),
      (12, 16, ["G2", "D3", "Bb3"], "G0"), (16, 20, ["A2", "E3", "C#4"], "A0"), (20, 24, ["D3", "A3", "F4"], "D1"),
      (24, 28.6, ["D2", "A2", "Eb3"], "D1"), (28.6, 32, ["G2", "D3", "Bb3"], "G0"), (32, 36, ["A2", "E3", "C#4"], "A0"),
      (36, 40, ["D3", "A3", "F4", "E5"], "D1"), (40, 44, ["Bb2", "F3", "D4", "A4"], "Bb0")]
pad = np.zeros((N, 2))
for a, b, notes, _ in CH:
    t = tt(b - a + 0.6); L = np.zeros_like(t); R = np.zeros_like(t)
    for nm in notes:
        f = note(nm)
        L += saw(f * 2 ** (-0.07 / 12), t, rng.random()) + saw(f, t, rng.random()) * .6
        R += saw(f * 2 ** (0.08 / 12), t, rng.random()) + saw(f, t, rng.random()) * .6
    cut = 700 if a < 4 else (420 if 24 <= a < 28.6 else (1500 if a < 36 else 1200))
    sig = np.stack([lp(L, cut, 4), lp(R, cut, 4)], 1) * env(len(t), 0.4 if a else 1.2, 0.6)[:, None]
    place(pad, sig * (0.045 if 24 <= a < 28.6 else (0.03 if 4 <= a < 36 else 0.04)), a)
music += reverb(pad, 2.6, 0.4)

def kick(g=1.0):
    t = tt(0.45); f = 42 + 130 * np.exp(-t * 32); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    return (s + hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 200) * 0.2) * g
def clap(g=1.0):
    t = tt(0.35); nz = bp(rng.standard_normal(len(t)), 900, 5000)
    e = sum(np.where(t > k * 0.011, np.exp(-(t - k * 0.011) * (90 if k < 3 else 22)), 0) for k in range(4))
    return nz * e * g
def hat(g=1.0, d=0.06):
    t = tt(d); return hp(rng.standard_normal(len(t)), 8000, 4) * np.exp(-t * (6 / d)) * g
def bass808(f, d, g=1.0, glide_from=None):
    t = tt(d); ff = np.full(len(t), f)
    if glide_from: ff = f + (glide_from - f) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(ff) / SR); s = np.tanh(s * 1.6) * env(len(t), 0.005, 0.12)
    return s * g


drums = np.zeros((N, 2)); bassbus = np.zeros((N, 2))
def groove(t0, t1, energy=1.0, hats=True):
    b = t0
    while b < t1 - 1e-6:
        place(drums, kick(0.42 * energy), b)
        place(drums, kick(0.30 * energy), b + 0.75)
        place(drums, clap(0.16 * energy), b + 1.0, pan=0.05)
        if int(round(b / BAR)) % 2 == 1: place(drums, kick(0.26 * energy), b + 1.625)
        if hats:
            for k in range(16):
                if b + k * 0.125 >= t1: break
                acc = 0.055 if k % 4 == 0 else (0.035 if k % 2 == 0 else 0.022)
                place(drums, hat(acc * energy), b + k * 0.125, pan=0.25 if k % 2 else -0.15)
            if int(round(b / BAR)) % 2 == 1:
                for k in range(6): place(drums, hat(0.03 * energy, 0.04), b + 1.5 + k * (0.5 / 6), pan=0.3)
        b += BAR
groove(4.0, 8.0, 0.65, hats=True)
groove(8.0, 16.5, 1.0)
groove(17.0, 23.5, 1.0)
groove(28.6, 35.5, 1.0)
groove(38.0, 42.0, 0.5)
# basse 808 qui suit les accords
for a, bb, notes, root in CH:
    if a < 8 or 24 <= a < 28.6 or a >= 36: continue
    f = note(root) * 2
    for k in range(int(round((bb - a) / BAR))):
        t0 = a + k * BAR
        if t0 >= 35.5 or 16.4 <= t0 < 17.0: continue
        place(bassbus, bass808(f, 0.7, 0.28), t0)
        place(bassbus, bass808(f, 0.45, 0.22, glide_from=f * 1.5 if k % 2 else None), t0 + 0.75)
        place(bassbus, bass808(f * (1.189 if k % 2 else 1), 0.6, 0.2), t0 + 1.25)
music += bassbus
# arpèges « 8 bits » (Minecraft, Roblox, jeux interactifs)
arp = np.zeros((N, 2))
SCALES = {14: ["G4", "Bb4", "D5", "G5"], 16: ["A4", "C#5", "E5", "A5"], 18: ["A4", "E5", "G5", "C#6"], 20: ["D5", "F5", "A5", "C6"], 22: ["D5", "F5", "Bb5", "D6"],
          28: ["G4", "Bb4", "D5", "G5"], 30: ["G4", "D5", "F5", "A5"], 32: ["A4", "C#5", "E5", "A5"], 34: ["A4", "E5", "G5", "C#6"]}
for i in list(range(int(14.5 / 0.125), int(23.5 / 0.125))) + list(range(int(29.0 / 0.125), int(35.5 / 0.125))):
    tb = i * 0.125
    if 16.45 <= tb < 17.0: continue
    seq = SCALES[max(k for k in SCALES if k <= tb)]; f = note(seq[(i * 3) % 4] if i % 2 else seq[i % 4])
    t = tt(0.2); s = (sq(f, t) * 0.35 + saw(f, t) * 0.35) * np.exp(-t * 24)
    place(arp, lp(s, 4200) * 0.026, tb, pan=0.4 if i % 2 else -0.4)
music += reverb(delay(arp, 0.375, 0.3, 0.22), 1.6, 0.28)
music += reverb(drums, 1.0, 0.1)
# horreur : battements de cœur, cordes graves dissonantes
for tm in np.arange(24.2, 28.4, 0.8):
    for dt, g in ((0, 0.34), (0.24, 0.24)):
        t = tt(0.5); place(music, np.sin(2 * np.pi * np.cumsum(38 + 55 * np.exp(-t * 25)) / SR) * np.exp(-t * 10) * g, tm + dt)
t = tt(4.6); dr = (saw(note("D2"), t) + saw(note("Eb2") * 1.003, t) * 0.7) * env(len(t), 1.0, 1.0)
place(music, lp(dr, 600, 4) * 0.05, 24.0)
# montées vers chaque monde
for tm, d in ((3.0, 1.05), (7.6, 0.95), (13.5, 0.85), (18.2, 0.75), (27.8, 0.8), (31.4, 0.8), (34.6, 1.4)):
    place(music, swell(d, 0.26 if tm < 34 else 0.36, 250, 9000), tm)
# silence avant l'impact
t = tt(0.4); place(music, hp(rng.standard_normal(len(t)), 3000) * (t / 0.4) ** 3 * 0.12, 35.6)

# ---------------------------- SOUND DESIGN ----------------------------
def boom(d=2.2, g=0.5, f0=32, f1=60):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(f0 + f1 * np.exp(-t * 5)) / SR) * np.exp(-t * 1.8) * g + lp(rng.standard_normal(len(t)), 400) * np.exp(-t * 5) * g * .7
def crackle(d=1.2, g=0.08):
    t = tt(d); s = np.zeros(len(t))
    for k in range(70):
        i0 = int(rng.random() ** 1.6 * (len(t) - 2000)); n = 300 + int(rng.random() * 900); s[i0:i0 + n] += hp(rng.standard_normal(n), 2000) * np.exp(-np.arange(n) / 120) * (1 - i0 / len(t))
    return s * g
def fuse(d=0.25, g=0.05):
    t = tt(d); return hp(rng.standard_normal(len(t)), 5000) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t)) * g
def warp_s(d=0.8, g=0.08):
    t = tt(d); f = 300 * 6 ** (t / d); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * g + shimmer(d, 1800, g * 0.8, 8)
def buzz(d=1.2, g=0.05):
    t = tt(d); s = sq(120, t) * 0.5 + bp(rng.standard_normal(len(t)), 100, 900) * 0.8
    return lp(s, 2500) * (0.5 + 0.5 * (np.sin(2 * np.pi * 9 * t) > 0.2)) * g
def stinger(g=0.16):
    t = tt(1.6); s = np.zeros(len(t))
    for f in (note("D5"), note("Eb5"), note("A5"), note("Bb5")): s += saw(f, t, rng.random())
    return (lp(s, 3500) * 0.25 + hp(rng.standard_normal(len(t)), 1500) * 0.6) * np.exp(-t * 3.2) * np.minimum(1, t / 0.004) * g
def pop(f=900, g=0.06):
    a, b = bubble(g) * 0.7, blip(f, g * 0.6); out = np.zeros(max(len(a), len(b))); out[:len(a)] += a; out[:len(b)] += b; return out

# 0 — accroche : cœurs et cadeaux, plongée dans l'écran
place(sb, shimmer(2.0, 1400, 0.08), 0.4)
for i in range(12): place(sb, ping(note(["D6", "F6", "A6", "C7"][i % 4]), 0.25, 0.010), 1.65 + i * 0.16, pan=0.35)
for tm in (2.3, 2.75, 3.2): place(sb, pop(1300, 0.05), tm, pan=0.4)
place(sb, soft_hit(0.42), 4.07); place(sb, whoosh(0.9, 2000, 9000, 0.07, 0.4, -0.4), 3.95)
# 1 — le principe : interaction → action
place(sb, tick(2600, 0.07), 4.45)
for r, t0 in enumerate((5.0, 5.75, 6.5)):
    place(sb, pop(1100 + 200 * r, 0.07), t0, pan=-0.3)
    place(sb, whoosh(0.3, 1500, 7000, 0.05, -0.3, 0.3), t0 + 0.18)
    if r == 0:
        for i in range(6): place(sb, ping(note(["A5", "D6", "F6"][i % 3]), 0.22, 0.012), t0 + i * 0.07, pan=-0.3)
        place(sb, powerup("D5", 0.024), t0 + 0.36, pan=0.3)
    if r == 1: place(sb, boom(1.0, 0.22, 45, 80), t0 + 0.38, pan=0.3); place(sb, crackle(0.6, 0.05), t0 + 0.38, pan=0.3)
    if r == 2: place(sb, warp_s(0.7, 0.07), t0 + 0.3, pan=0.3)
# transitions (lumière)
for tm in (8.55, 14.35, 18.95, 28.6, 32.2):
    place(sb, soft_hit(0.32), tm); place(sb, shimmer(1.6, 1600, 0.07, 12), tm + 0.05); place(sb, whoosh(0.8, 1500, 9000, 0.06, -0.4, 0.4), tm - 0.35)
place(sb, boom(2.4, 0.4, 28, 40), 23.6); place(sb, whoosh(0.9, 200, 2500, 0.1, 0.4, -0.4), 23.25)
# 2 — GTA V
place(sb, tick(2400, 0.07), 8.95); place(sb, ping(note("D6"), 1.0, 0.05), 9.15, pan=-0.4)
for i in range(16): place(sb, tick(3200 + 60 * (i % 4), 0.018), 9.3 + i * 0.24, pan=-0.4 + i * 0.05)   # le trajet se trace
for tm in (10.75, 11.75): place(sb, tick(2000, 0.06), tm)
for i, tm in enumerate((10.9, 11.3, 11.9, 12.3, 12.7)): place(sb, pop(900 + 150 * i, 0.07), tm, pan=-0.4 + 0.2 * i)
place(sb, warp_s(0.8, 0.07), 11.3, pan=-0.3)
place(sb, boom(2.0, 0.42, 34, 70), 12.0); place(sb, crackle(1.2, 0.07), 12.02, pan=-0.1)
place(sb, ping(note("A6"), 1.4, 0.06), 12.95, pan=0.1); place(sb, shimmer(1.4, 2000, 0.07, 12), 13.0)
# 3 — Minecraft : mode TNT
place(sb, tick(2400, 0.07), 14.75)
for tm in (15.7, 16.65): place(sb, tick(2000, 0.06), tm)
for i, tm in enumerate((15.85, 16.25, 16.8, 17.25)): place(sb, pop(1000 + 150 * i, 0.07), tm, pan=-0.3 + 0.2 * i)
place(sb, fuse(0.18, 0.06), 16.78)
place(sb, boom(2.6, 0.62, 30, 60), 16.95); place(sb, crackle(1.5, 0.11), 16.97); place(sb, hp(rng.standard_normal(int(SR * 2)), 2500) * np.exp(-tt(2) * 2.2) * 0.05, 16.95)
# 4 — Roblox : les six modes
for i in range(6): place(sb, pop(1000 + 120 * i, 0.06), 19.0 + i * 0.32, pan=-0.6 + 0.24 * i); place(sb, ping(note(["D6", "F6", "A6", "D7", "F7", "A7"][i]), 0.5, 0.025), 19.05 + i * 0.32, pan=-0.6 + 0.24 * i)
place(sb, whoosh(3.4, 300, 3000, 0.07, -0.7, 0.7), 19.7)
# 5 — Horreur
place(sb, tick(1800, 0.06), 23.95); place(sb, buzz(1.3, 0.05), 24.8, pan=0.2)
place(sb, tick(1500, 0.06), 25.0)
for i, tm in enumerate((25.15, 25.55, 25.95)): place(sb, pop(600 + 80 * i, 0.06), tm, pan=-0.3 + 0.2 * i)
t = tt(0.5); place(sb, np.sin(2 * np.pi * np.cumsum(90 + 200 * np.exp(-t * 30)) / SR) * np.exp(-t * 14) * 0.25, 26.0)   # coupure de courant
place(sb, pop(560, 0.06), 26.65); place(sb, stinger(0.15), 26.78); place(sb, boom(1.8, 0.3, 30, 50), 26.8)
# 6 — jeux interactifs : défilement
for i in range(10): place(sb, tick(2600 + 90 * (i % 3), 0.04), 29.45 + i * 0.255, pan=0.3 if i % 2 else -0.3)
place(sb, whoosh(2.6, 400, 4000, 0.06, -0.3, 0.3), 29.3)
# 7 — sur demande : le mur s'allume
for i in range(12): place(sb, ping(note(["D6", "F6", "A6", "C7"][i % 4]), 0.35, 0.02), 32.35 + (i % 4) * 0.09 + (i // 4) * 0.16, pan=-0.45 + 0.3 * (i % 4))
place(sb, tick(2400, 0.07), 32.55)
# IMPACT (36.0 s) et logo
IMP = 36.0
place(sb, boom(3.0, 0.55, 30, 50), IMP); place(sb, hp(rng.standard_normal(int(SR * 3.5)), 3500) * np.exp(-tt(3.5) * 1.6) * 0.06, IMP, pan=0.15)
stab = np.zeros(int(SR * 3))
for nm in ["D4", "A4", "D5", "F5", "A5"]: stab += ping(note(nm), 3.0, 0.05)
place(sb, stab, IMP); place(sb, shimmer(2.2, 2000, 0.1, 14), IMP + 0.5, pan=0.2)
place(sb, whoosh(1.0, 1500, 8000, 0.05, -0.6, 0.6), IMP + 0.35); place(sb, whoosh(0.9, 1500, 8000, 0.04, 0.0, 0.0), IMP + 0.8)
place(sb, powerup("D6", 0.018, 0.04), 36.55)                      # EMPIRA GAMING
place(sb, ping(note("A5"), 1.2, 0.04), 37.6)                       # ensemble, on va plus loin
for k, tm in enumerate((39.3, 39.6, 39.9)): place(sb, ping(note(["D6", "F6", "A6"][k]), 1.4, 0.04), tm, pan=-0.3 + 0.3 * k)
t = tt(2.0); place(music, np.sin(2 * np.pi * np.cumsum(35 + 40 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2) * 0.3, 42.0)
sfx = reverb(sb, 2.0, 0.25)

# ---------------------------- MIX ----------------------------
fade = np.ones(N); fN = int(SR * 0.9); fade[-fN:] = np.linspace(1, 0, fN) ** 1.5
music *= fade[:, None]; sfx *= fade[:, None]
# coupure de courant : tout se tait 0.35 s
cut = np.ones(N); a0, a1 = int(26.05 * SR), int(26.5 * SR); cut[a0:a1] = 0.15; cut = np.convolve(cut, np.ones(480) / 480, mode="same")
music *= cut[:, None]
music = np.stack([hp(music[:, c], 28) for c in range(2)], 1)
mix = music * 0.9 + sfx
gain = 0.85 / np.max(np.abs(mix))
def write(name, x):
    x = np.tanh(x / 0.89) * 0.89
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
os.makedirs(OUT, exist_ok=True)
write("jeux-mix.wav", mix * gain); write("jeux-music.wav", music * 0.9 * gain); write("jeux-sfx.wav", sfx * gain)
print("gain", round(float(gain), 3))
