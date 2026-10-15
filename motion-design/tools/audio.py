"""Bande son Empira — musique + sound design 100 % synthétisés (aucun droit à gérer).
Tempo 120 BPM (1 temps = 0.5 s), tonalité Ré mineur, calée sur les animations de index.html.
Sorties : out/empira-music.wav, out/empira-sfx.wav, out/empira-mix.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave, os

SR = 48000
DUR = 30.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "out")
rng = np.random.default_rng(42)

def note(n):  # "D3" -> Hz
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    pitch, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[pitch] + (octv - 4) * 12) / 12)

def tt(d): return np.arange(int(SR * d)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def env_adsr(n, a, r, sustain_len=None):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR))
    e[:A] = np.linspace(0, 1, A) ** 1.5
    e[-R:] *= np.linspace(1, 0, R) ** 2
    return e
def saw(f, t, ph=0.0):
    x = (f * t + ph) % 1.0
    return 2 * x - 1

def place(buf, sig, start, gain=1.0, pan=0.0):
    """sig mono ou stéréo (n,2) ; pan -1..1 (loi à puissance constante)."""
    i0 = int(round(start * SR))
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n > 0: buf[i0:i0 + n] += sig[:n] * gain

def reverb(x, decay=2.4, wet=0.3, pre=0.02, tone=6000):
    n = int(SR * decay)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
        ir = lp(ir, tone)
        ir[: int(pre * SR)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    y = np.stack([fftconvolve(x[:, c], irs[c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 1.4

def delay(x, time=0.375, fb=0.35, mix=0.25):
    y = x.copy(); d = int(time * SR); g = mix
    for k in range(1, 6):
        sh = np.zeros_like(x); sh[d * k:] = x[: len(x) - d * k] * g
        if k % 2: sh = sh[:, ::-1]  # ping-pong
        y += sh; g *= fb
    return y

music = np.zeros((N, 2)); sfx = np.zeros((N, 2))

# ============================ MUSIQUE ============================
CHORDS = [  # (début, fin, notes du pad, basse)
    (0, 4, ["D3", "A3", "F4", "A4"], "D2"),
    (4, 8, ["Bb2", "F3", "D4", "F4"], "Bb1"),
    (8, 12, ["F3", "C4", "A4", "C5"], "F2"),
    (12, 16, ["C3", "G3", "E4", "G4"], "C2"),
    (16, 20, ["D3", "A3", "F4", "A4"], "D2"),
    (20, 22, ["A2", "E3", "C#4", "E4"], "A1"),
    (22, 26, ["D3", "A3", "F4", "A4", "D5"], "D2"),
    (26, 30, ["Bb2", "F3", "D4", "A4", "C5"], "Bb1"),
]
pad = np.zeros((N, 2))
for (a, b, notes, bass) in CHORDS:
    d = b - a + 0.8
    t = tt(d)
    sigL = np.zeros_like(t); sigR = np.zeros_like(t)
    for k, nm in enumerate(notes):
        f = note(nm)
        for det, side in ((-0.06, 0), (0.0, 2), (0.07, 1)):
            v = saw(f * 2 ** (det / 12), t, rng.random())
            if side in (0, 2): sigL += v
            if side in (1, 2): sigR += v
    sig = np.stack([sigL, sigR], 1)
    cutoff = 900 if a < 10 else 1400 if a < 20 else 1100
    if a == 22: cutoff = 1800
    sig = np.stack([lp(sig[:, c], cutoff, 4) for c in range(2)], 1)
    e = env_adsr(len(t), 0.5 if a else 1.5, 0.9)
    # légère respiration du pad sur la noire pointée
    e *= 0.85 + 0.15 * np.sin(2 * np.pi * t / 1.5)
    place(pad, sig * e[:, None] * 0.045, a)
pad = reverb(pad, 3.0, 0.45)
music += pad

# basse (sinus + léger harmonique), notes longues avec pompe sur les temps
bassbus = np.zeros((N, 2))
for (a, b, notes, bass) in CHORDS:
    if a < 4: continue
    t = tt(b - a + 0.2); f = note(bass)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    pump = 1 - 0.55 * np.exp(-((t % 0.5) / 0.09))  # sidechain sur les temps
    e = env_adsr(len(t), 0.05, 0.25)
    place(bassbus, s * e * pump * (0.16 if a < 22 else 0.12), a)
music += bassbus

def kick(g=1.0):
    t = tt(0.55)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s += hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 180) * 0.15
    return s * g
def hat(g=1.0):
    t = tt(0.09)
    return hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t * 55) * g

drums = np.zeros((N, 2))
for i in range(int(4 / 0.5), int(20 / 0.5)):
    tb = i * 0.5
    if tb < 10 and (i % 2): continue      # 4-10s : temps 1 et 3
    place(drums, kick(0.38 if tb < 10 else 0.42), tb)
for i in range(int(10 / 0.25), int(20 / 0.25)):
    tb = i * 0.25
    if i % 2: place(drums, hat(0.05), tb, pan=0.25)
    elif tb >= 14: place(drums, hat(0.025), tb, pan=-0.25)
# impact final + battements lents
for tb in (24.0, 26.0, 28.0):
    place(drums, kick(0.22), tb)
music += reverb(drums, 1.2, 0.12)

# arpège "pluck" (10 → 20 s), croches, notes des accords
arp = np.zeros((N, 2))
ARP = {8: ["F4", "A4", "C5", "A4"], 10: ["F4", "A4", "C5", "E5"], 12: ["C5", "E5", "G5", "E5"], 14: ["G4", "C5", "E5", "G5"], 16: ["D5", "F5", "A5", "F5"], 18: ["A4", "D5", "F5", "A5"]}
for i in range(int(10 / 0.25), int(20 / 0.25)):
    tb = i * 0.25
    seq = ARP[int(tb // 2) * 2]
    f = note(seq[i % 4])
    t = tt(0.4)
    s = (2 * np.abs(2 * ((f * t) % 1) - 1) - 1) * np.exp(-t * 14)  # triangle
    s += 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 20)
    place(arp, s * 0.035 * (0.7 + 0.3 * ((tb - 10) / 10)), tb, pan=0.35 if i % 2 else -0.35)
music += reverb(delay(arp, 0.375, 0.35, 0.3), 2.0, 0.35)

# montée 20 → 22 s (riser) + reverse cymbale
t = tt(2.0)
nz = rng.standard_normal(len(t))
riser = np.zeros(len(t))
for k in range(20):  # balayage passe-bande par blocs
    s0, s1 = k * len(t) // 20, (k + 1) * len(t) // 20
    fc = 400 * (12 ** (k / 19))
    riser[s0:s1] = bp(nz, fc * 0.7, min(fc * 1.4, 20000))[s0:s1]
riser *= (t / 2.0) ** 2.2 * 0.5
tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (t * 1.5)) / SR) * (t / 2.0) ** 2 * 0.09
place(music, riser + tone, 20.0)
cym = hp(rng.standard_normal(int(SR * 1.5)), 5000) * np.linspace(0, 1, int(SR * 1.5)) ** 3 * 0.12
place(music, cym, 20.5, pan=0.1)

# ============================ SOUND DESIGN ============================
def whoosh(d, lo=300, hi=3500, g=0.25, pan_from=-0.6, pan_to=0.6):
    t = tt(d); u = t / d
    nz = rng.standard_normal(len(t))
    out = np.zeros(len(t)); blocks = 24
    for k in range(blocks):
        s0, s1 = k * len(t) // blocks, (k + 1) * len(t) // blocks
        uk = (k + .5) / blocks
        fc = lo * (hi / lo) ** np.sin(np.pi * uk)  # monte puis redescend
        out[s0:s1] = bp(nz, fc * 0.6, min(fc * 1.6, 20000))[s0:s1]
    e = np.sin(np.pi * u) ** 2.2
    s = out * e * g
    pans = pan_from + (pan_to - pan_from) * u
    l, r = np.cos((pans + 1) * np.pi / 4), np.sin((pans + 1) * np.pi / 4)
    return np.stack([s * l, s * r], 1) * np.sqrt(2)

def ping(f, d=1.4, g=0.2):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.01 * f * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 9)
    return s * np.exp(-t * 4.2) * np.minimum(1, t / 0.003) * g

def tick(f=2600, g=0.12):
    t = tt(0.12)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 60) + hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 300) * 0.4) * g

def shimmer(d=1.6, base=1200, g=0.08, n=9):
    t = tt(d); s = np.zeros(len(t))
    for k in range(n):
        f = base * 2 ** (rng.integers(0, 24) / 12)
        st = rng.random() * 0.25
        e = np.where(t > st, np.exp(-(t - st) * 3.5) * np.minimum(1, (t - st) / 0.01), 0)
        s += np.sin(2 * np.pi * f * t + rng.random() * 6) * e
    return s / n * g * 2.5

def shutter(g=0.4):
    out = np.zeros(int(SR * 0.25))
    for st, f in ((0.0, 1800), (0.055, 1300)):
        t = tt(0.08); nz = bp(rng.standard_normal(len(t)), f * .6, f * 2.2)
        c = nz * np.exp(-t * 90) + np.sin(2 * np.pi * f * .5 * t) * np.exp(-t * 120) * .5
        i0 = int(st * SR); out[i0:i0 + len(c)] += c
    return out * g

sb = np.zeros((N, 2))
def swell(d, g=0.2, lo=300, hi=9000):
    """montée de souffle (aspiration) qui culmine à la fin"""
    t = tt(d); nz = rng.standard_normal(len(t)); out = np.zeros(len(t)); blocks = 24
    for k in range(blocks):
        s0, s1 = k * len(t) // blocks, (k + 1) * len(t) // blocks
        fc = lo * (hi / lo) ** (k / (blocks - 1))
        out[s0:s1] = bp(nz, fc * 0.6, min(fc * 1.5, 20000))[s0:s1]
    return out * (t / d) ** 2.5 * g
def soft_hit(g=0.3):
    t = tt(2.0)
    s = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 7)) / SR) * np.exp(-t * 2.4) * g
    return s + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 5) * g * 0.5
def blip(f=1800, g=0.05):
    t = tt(0.18)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 28) * np.minimum(1, t / 0.002) * g

# A — naissance de l'étincelle, accroche, plongée dans l'objectif
place(sb, shimmer(2.0, 1400, 0.09), 0.38)
t = tt(1.2); place(sb, np.sin(2 * np.pi * (60 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 3) * 0.22, 0.38)
t = tt(1.9); place(sb, bp(rng.standard_normal(len(t)), 4000, 11000) * np.sin(np.pi * t / 1.9) ** 2 * 0.018, 0.4)  # trait qui se dessine
for tm, f in ((0.6, 2200), (1.7, 2900), (4.45, 2600), (10.35, 2600), (16.25, 2600)):
    place(sb, tick(f, 0.07), tm)
place(sb, swell(1.25, 0.32, 200, 7000), 2.9)                 # aspiration vers l'objectif
place(sb, shimmer(1.4, 1800, 0.09, 12), 3.4, pan=0.1)        # reflet dans la lentille
place(sb, soft_hit(0.42), 4.12)                              # traversée
place(sb, whoosh(0.9, 2000, 9000, 0.07, 0.4, -0.4), 4.0)
# B — matériel
place(sb, shutter(0.4), 5.13, pan=-0.25)                     # déclencheur caméra
for tm, f in ((5.3, 1700), (7.05, 1900), (8.55, 2100)):     # légendes
    place(sb, blip(f, 0.045), tm, pan=0.3)
place(sb, whoosh(0.9, 300, 3500, 0.15, -0.5, 0.6), 5.9)     # vers le micro
t = tt(0.5); place(sb, np.sin(2 * np.pi * 85 * t) * np.exp(-t * 14) * 0.22, 6.68)   # micro : « pop » grave
place(sb, whoosh(1.1, 2500, 9000, 0.03, -0.3, 0.3), 6.6)     # reflet sur la grille
place(sb, whoosh(0.75, 300, 3500, 0.15, -0.5, 0.6), 7.38)   # vers la ring light
# allumage ring light : grésillement + clics puis bourdonnement
t = tt(0.42); flick = (np.sin(2 * np.pi * 15 * t) > 0.2).astype(float)
buzz = (saw(100, t) * 0.5 + hp(rng.standard_normal(len(t)), 3000) * 0.3) * flick * 0.08
place(sb, buzz, 8.05, pan=0.2)
for k in range(6): place(sb, tick(3200 + 300 * k, 0.05), 8.05 + k * 0.067, pan=0.2)
t = tt(1.6); place(sb, (np.sin(2 * np.pi * 100 * t) + .4 * np.sin(2 * np.pi * 200 * t)) * np.minimum(1, t / .2) * np.exp(-t * 1.2) * .05, 8.45, pan=0.2)
place(sb, shimmer(1.8, 1800, 0.08), 8.45, pan=0.2)
# traversée de la lumière → coucher de soleil
place(sb, swell(1.0, 0.3, 300, 9000), 9.0)
place(sb, shimmer(2.4, 1600, 0.1, 16), 9.7)
place(sb, soft_hit(0.3), 10.0)
# C — étapes de l'accompagnement : pings ascendants
for i, nm in enumerate(["D5", "F5", "G5", "A5", "D6"]):
    place(sb, ping(note(nm), 1.6, 0.11 if i < 4 else 0.14), 11 + i, pan=-0.4 + i * 0.2)
place(sb, shimmer(1.8, 1500, 0.07), 15.0, pan=0.4)
place(sb, whoosh(1.2, 300, 3000, 0.13, -0.6, 0.6), 15.3)   # vers la foule
# D — calendrier : 12 ticks (croches)
for i, nm in enumerate(["D6", "E6", "F6", "A6", "D6", "E6", "F6", "A6", "C7", "A6", "F6", "D7"]):
    place(sb, tick(note(nm), 0.055), 16.75 + 0.25 * i, pan=-0.5 + i / 11)
    place(sb, ping(note(nm), 0.5, 0.025), 16.75 + 0.25 * i, pan=-0.5 + i / 11)
place(sb, swell(1.1, 0.28, 300, 9000), 19.15)                # la lumière de scène nous avale
place(sb, shimmer(1.6, 1300, 0.08, 14), 20.2)                # bokeh
# E — la crête du Cervin se trace, puis se transforme en A
t = tt(1.3); sp = np.zeros(len(t))
for k in range(26):
    st = k * 0.05; f = 2400 * 2 ** (k / 26)
    e = np.where(t > st, np.exp(-(t - st) * 18), 0); sp += np.sin(2 * np.pi * f * t) * e
place(sb, sp * 0.03, 20.45, pan=0.0)
place(sb, whoosh(0.4, 800, 9000, 0.12, -0.2, 0.2), 21.65)
# IMPACT logo (22.0 s)
t = tt(3.0)
boom = np.sin(2 * np.pi * np.cumsum(30 + 50 * np.exp(-t * 5)) / SR) * np.exp(-t * 1.6) * 0.55
boom += lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 6) * 0.35
place(sb, boom, 22.0)
crash = hp(rng.standard_normal(int(SR * 3.5)), 3500) * np.exp(-tt(3.5) * 1.6) * 0.06
place(sb, crash, 22.0, pan=0.15)
stab = np.zeros(int(SR * 3))
for nm in ["D4", "A4", "D5", "F5", "A5"]:
    stab += ping(note(nm), 3.0, 0.05)
place(sb, stab, 22.0)
place(sb, shimmer(2.2, 2000, 0.1, 14), 22.5, pan=0.2)
place(sb, whoosh(1.0, 1500, 8000, 0.05, -0.6, 0.6), 22.45)
place(sb, whoosh(0.9, 1500, 8000, 0.04, 0.0, 0.0), 23.25)
for k, nm in enumerate(["A5", "D6", "F6"]):
    place(sb, ping(note(nm), 1.2, 0.05), 24.1 + k * 0.42, pan=-0.5 + k * 0.5)
place(sb, ping(note("D6"), 2.0, 0.06), 27.0)
sfx = reverb(sb, 2.2, 0.28)

# ============================ MIX & EXPORT ============================
fade = np.ones(N); fN = int(SR * 0.9); fade[-fN:] = np.linspace(1, 0, fN) ** 1.5
music *= fade[:, None]; sfx *= fade[:, None]
music = np.stack([hp(music[:, c], 28) for c in range(2)], 1)
mix = music * 0.9 + sfx

def soft_limit(x, ceil=0.89):
    return np.tanh(x / ceil) * ceil

peak = np.max(np.abs(mix)); gain = 0.85 / peak
def write(name, x):
    x = soft_limit(x)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
os.makedirs(OUT, exist_ok=True)
write("empira-mix.wav", mix * gain)
write("empira-music.wav", music * 0.9 * gain)
write("empira-sfx.wav", sfx * gain)
print("peak avant normalisation", round(float(peak), 3), "gain", round(float(gain), 3))
