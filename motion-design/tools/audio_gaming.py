"""Bande son Empira Gaming — trap/hybride 120 BPM en Ré mineur + sound design, 100 % synthétisés.
Calée sur gaming.html. Sorties : out/gaming-music.wav, out/gaming-sfx.wav, out/gaming-mix.wav
"""
import numpy as np, os, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 30.0; N = int(SR * DUR)
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

music = np.zeros((N, 2)); sb = np.zeros((N, 2))
BEAT = 0.5; BAR = 2.0

# ---------------------------- MUSIQUE ----------------------------
# accords (4 s) : Dm, Bb, Gm, A … puis Dm / Bb après l'impact
CH = [(0, 4, ["D3", "A3", "F4"], "D1"), (4, 8, ["D3", "A3", "F4"], "D1"), (8, 12, ["Bb2", "F3", "D4"], "Bb0"),
      (12, 16, ["G2", "D3", "Bb3"], "G0"), (16, 20, ["A2", "E3", "C#4"], "A0"), (20, 22, ["D3", "A3", "F4"], "D1"),
      (22, 26, ["D3", "A3", "F4", "D5"], "D1"), (26, 30, ["Bb2", "F3", "D4", "A4"], "Bb0")]
pad = np.zeros((N, 2))
for a, b, notes, _ in CH:
    t = tt(b - a + 0.6); L = np.zeros_like(t); R = np.zeros_like(t)
    for nm in notes:
        f = note(nm)
        L += saw(f * 2 ** (-0.07 / 12), t, rng.random()) + saw(f, t, rng.random()) * .6
        R += saw(f * 2 ** (0.08 / 12), t, rng.random()) + saw(f, t, rng.random()) * .6
    cut = 700 if a < 4 else (1500 if a < 20 else (500 if a < 22 else 1300))
    sig = np.stack([lp(L, cut, 4), lp(R, cut, 4)], 1) * env(len(t), 0.4 if a else 1.2, 0.6)[:, None]
    place(pad, sig * (0.03 if 4 <= a < 20 else 0.04), a)
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
        place(drums, kick(0.42 * energy), b)                    # 1
        place(drums, kick(0.30 * energy), b + 0.75)             # « et » du 2
        place(drums, clap(0.16 * energy), b + 1.0, pan=0.05)    # 3 (demi-tempo)
        if int(round(b / BAR)) % 2 == 1: place(drums, kick(0.26 * energy), b + 1.625)
        if hats:
            for k in range(16):
                acc = 0.055 if k % 4 == 0 else (0.035 if k % 2 == 0 else 0.022)
                place(drums, hat(acc * energy), b + k * 0.125, pan=0.25 if k % 2 else -0.15)
            if int(round(b / BAR)) % 2 == 1:                     # roulement de charleys en triolets
                for k in range(6): place(drums, hat(0.03 * energy, 0.04), b + 1.5 + k * (0.5 / 6), pan=0.3)
        b += BAR
groove(4.0, 19.5, 1.0)
groove(22.0, 28.0, 0.8)
# basse 808 qui suit les accords (avec glissés)
for a, bb, notes, root in CH:
    if a < 4 or (20 <= a < 22): continue
    f = note(root) * 2
    for k in range(int((bb - a) / BAR)):
        t0 = a + k * BAR
        if t0 >= 28: break
        place(bassbus, bass808(f, 0.7, 0.28), t0)
        place(bassbus, bass808(f, 0.45, 0.22, glide_from=f * 1.5 if k % 2 else None), t0 + 0.75)
        place(bassbus, bass808(f * (1.189 if k % 2 else 1), 0.6, 0.2), t0 + 1.25)
music += bassbus
# arpège « pluck » 16ths à partir de 10 s
arp = np.zeros((N, 2))
SCALES = {8: ["D5", "F5", "A5", "C6"], 10: ["D5", "F5", "Bb5", "D6"], 12: ["G4", "Bb4", "D5", "G5"], 14: ["G4", "D5", "F5", "A5"], 16: ["A4", "C#5", "E5", "A5"], 18: ["A4", "E5", "G5", "C#6"]}
for i in range(int(10 / 0.125), int(19.5 / 0.125)):
    tb = i * 0.125; seq = SCALES[int(tb // 2) * 2]; f = note(seq[(i * 3) % 4] if i % 2 else seq[i % 4])
    t = tt(0.22); s = (saw(f, t) * 0.5 + sq(f / 2, t) * 0.25) * np.exp(-t * 22)
    place(arp, lp(s, 3500) * 0.03, tb, pan=0.4 if i % 2 else -0.4)
music += reverb(delay(arp, 0.375, 0.3, 0.25), 1.8, 0.3)
music += reverb(drums, 1.0, 0.1)

# roulement de caisse claire + montée vers la lumière de l'arène
for k in range(16):
    tm = 19.25 - (0.5 * (1 - (k / 16) ** 0.6)) * 2 + 0.25
    place(music, clap(0.05 + 0.08 * k / 16), 18.75 + k * (1.0 / 16) ** 1 * (1 - 0.3 * k / 16))
t = tt(1.4); nz = rng.standard_normal(len(t)); ris = np.zeros(len(t))
for k in range(20):
    s0, s1 = k * len(t) // 20, (k + 1) * len(t) // 20; fc = 400 * (14 ** (k / 19)); ris[s0:s1] = bp(nz, fc * .7, min(fc * 1.4, 20000))[s0:s1]
place(music, ris * (t / 1.4) ** 2.2 * 0.4, 18.6)
# respiration « Prêt ? » : battements de cœur graves
for tm in (20.5, 21.0):
    t = tt(0.5); place(music, np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 10) * 0.35, tm)
# montée inversée vers l'impact
t = tt(0.35); place(music, hp(rng.standard_normal(len(t)), 3000) * (t / 0.35) ** 3 * 0.12, 21.65)

# ---------------------------- SOUND DESIGN ----------------------------
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

# A — accroche et plongée dans le téléphone
place(sb, shimmer(2.0, 1400, 0.09), 0.38)
t = tt(1.2); place(sb, np.sin(2 * np.pi * (60 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 3) * 0.22, 0.38)
for tm, f in ((0.6, 2200), (1.6, 2900), (4.35, 2600), (10.3, 2600), (15.5, 2600)): place(sb, tick(f, 0.07), tm)
place(sb, swell(1.25, 0.32, 200, 7000), 2.9); place(sb, shimmer(1.4, 1800, 0.09, 12), 3.4, pan=0.1)
place(sb, soft_hit(0.42), 4.12); place(sb, whoosh(0.9, 2000, 9000, 0.07, 0.4, -0.4), 4.0)
# B — le live
place(sb, blip(2400, 0.05), 4.5, pan=0.1)                                   # LIVE
for tm in (4.75, 5.75, 6.75, 7.75, 8.25): place(sb, bubble(0.07), tm, pan=-0.35)   # messages
for k, h in enumerate((5.25, 6.25, 7.25, 8.25)):
    for i in range(8): place(sb, ping(note(["D6", "F6", "A6", "C7"][i % 4]), 0.25, 0.012), h - 0.55 + i * 0.06, pan=0.35)   # cœurs
    place(sb, powerup(["D5", "F5", "G5", "A5"][k], 0.022), h + 0.33, pan=0.0)                                              # le jeu réagit
    t = tt(0.4); place(sb, np.sin(2 * np.pi * np.cumsum(55 + 70 * np.exp(-t * 30)) / SR) * np.exp(-t * 12) * 0.18, h + 0.35)
place(sb, swell(1.0, 0.3, 300, 9000), 9.0); place(sb, shimmer(2.0, 1600, 0.08, 14), 9.7); place(sb, soft_hit(0.3), 10.0)
# C — setup
for tm, f in ((11.15, 1700), (12.7, 1900), (14.2, 2100)): place(sb, blip(f, 0.045), tm, pan=0.3)
place(sb, shimmer(1.4, 1700, 0.06), 10.8, pan=-0.2)
place(sb, whoosh(0.8, 300, 3500, 0.14, -0.5, 0.6), 11.45); place(sb, whoosh(0.8, 300, 3500, 0.14, 0.6, -0.5), 12.85)
for k in range(7): place(sb, tick(3800 + 120 * (k % 3), 0.035), 13.85 + k * 0.07, pan=-0.2)   # clavier
for tm in (14.35, 14.48): place(sb, tick(3000, 0.06), tm, pan=0.2)                         # souris
# D — coaching : barre d'XP
place(sb, whoosh(1.2, 300, 4000, 0.15, -0.4, 0.4), 14.5)
for k, (lt, nm) in enumerate(zip((16.0, 16.75, 17.5, 18.25), ["D5", "F5", "A5", "D6"])):
    t = tt(0.45); fill = bp(rng.standard_normal(len(t)), 1500 + 1500 * k, 12000) * (t / 0.45) ** 1.5 * 0.03
    place(sb, fill, lt); place(sb, ping(note(nm), 1.2, 0.12), lt + 0.45, pan=-0.3 + k * 0.2)
for k, nm in enumerate(["D6", "F6", "A6", "D7"]): place(sb, ping(note(nm), 1.6, 0.09), 18.8 + k * 0.07)   # LEVEL UP
place(sb, shimmer(2.0, 2000, 0.1, 16), 18.8); place(sb, powerup("D6", 0.03, 0.035), 18.8)
place(sb, swell(1.0, 0.28, 300, 9000), 19.0); place(sb, shimmer(1.4, 1300, 0.08, 14), 20.0)
# E — « Prêt ? Appuie sur A. »
place(sb, tick(2400, 0.06), 20.3); place(sb, tick(2900, 0.06), 20.7)
place(sb, click(0.45), 21.45, pan=0.15); place(sb, ping(note("A6"), 0.9, 0.06), 21.47, pan=0.15)
place(sb, whoosh(0.4, 800, 9000, 0.12, -0.2, 0.2), 21.62)
# IMPACT (22.0 s)
t = tt(3.0); boom = np.sin(2 * np.pi * np.cumsum(30 + 50 * np.exp(-t * 5)) / SR) * np.exp(-t * 1.6) * 0.55 + lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 6) * 0.35
place(sb, boom, 22.0); place(sb, hp(rng.standard_normal(int(SR * 3.5)), 3500) * np.exp(-tt(3.5) * 1.6) * 0.06, 22.0, pan=0.15)
stab = np.zeros(int(SR * 3))
for nm in ["D4", "A4", "D5", "F5", "A5"]: stab += ping(note(nm), 3.0, 0.05)
place(sb, stab, 22.0); place(sb, shimmer(2.2, 2000, 0.1, 14), 22.5, pan=0.2)
place(sb, whoosh(1.0, 1500, 8000, 0.05, -0.6, 0.6), 22.45); place(sb, whoosh(0.9, 1500, 8000, 0.04, 0.0, 0.0), 23.25)
for k, tm in enumerate((24.05, 24.8, 25.55)): place(sb, ping(note(["A5", "D6", "F6"][k]), 1.2, 0.045), tm, pan=-0.4 + 0.4 * k)
place(sb, powerup("D6", 0.018, 0.04), 25.55)                                       # EMPIRA GAMING
place(sb, ping(note("D6"), 1.6, 0.045), 26.12)                                      # CTA
t = tt(2.0); place(music, np.sin(2 * np.pi * np.cumsum(35 + 40 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2) * 0.3, 28.0)   # coup final
sfx = reverb(sb, 2.0, 0.25)

# ---------------------------- MIX ----------------------------
fade = np.ones(N); fN = int(SR * 0.9); fade[-fN:] = np.linspace(1, 0, fN) ** 1.5
music *= fade[:, None]; sfx *= fade[:, None]
music = np.stack([hp(music[:, c], 28) for c in range(2)], 1)
mix = music * 0.9 + sfx
gain = 0.85 / np.max(np.abs(mix))
def write(name, x):
    x = np.tanh(x / 0.89) * 0.89
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
os.makedirs(OUT, exist_ok=True)
write("gaming-mix.wav", mix * gain); write("gaming-music.wav", music * 0.9 * gain); write("gaming-sfx.wav", sfx * gain)
print("gain", round(float(gain), 3))
