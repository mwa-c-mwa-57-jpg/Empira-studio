"""Bande son du plan-séquence, générée et calée sur les temps de passage de la caméra (128 BPM).
Usage : python3 -I sound.py out/audio.wav"""
import sys, wave
import numpy as np
SR, DUR, BEAT = 48000, 20.5, 60 / 128
T_RING, T_MIC, T_FACADE, T_IMPACT, T_SIGN = 8 * BEAT, 16 * BEAT, 26 * BEAT, 32 * BEAT, 36 * BEAT
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(7)
def env(a, b, c, d):  # trapèze : montée a→b, tenue, descente c→d
    return np.clip(np.minimum((t - a) / max(b - a, 1e-3), (d - t) / max(d - c, 1e-3)), 0, 1)
def lowpass(x, fc):  # passe-bas à une pôle, fréquence de coupure variable dans le temps
    y = np.empty_like(x); a = np.exp(-2 * np.pi * np.broadcast_to(fc, x.shape) / SR); acc = 0.0
    for i in range(len(x)): acc = a[i] * acc + (1 - a[i]) * x[i]; y[i] = acc
    return y
def add(sig, pan=0.0, gain=1.0):
    global L, R
    L += sig * gain * np.sqrt(0.5 * (1 - pan)); R += sig * gain * np.sqrt(0.5 * (1 + pan))

# nappe : la mineur, monte doucement, coupée avant l'impact puis plus lumineuse
pad_env = np.clip(t / 9, 0, 1) ** 1.5 * 0.55 + 0.12
pad_env *= 1 - 0.95 * env(T_IMPACT - 0.45, T_IMPACT - 0.3, T_IMPACT - 0.02, T_IMPACT)
pad_env *= np.clip((DUR - t) / 2.5, 0, 1)
for f, g in [(55, 1), (82.41, .7), (110, .6), (130.81, .35), (164.81, .3)]:
    add(np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.11 * t)) * g * pad_env, pan=-0.2, gain=0.05)
    add(np.sin(2 * np.pi * f * 1.003 * t) * g * pad_env, pan=0.2, gain=0.05)
bright = env(T_IMPACT, T_IMPACT + 0.4, DUR - 2.5, DUR)
for f, g in [(220, .5), (329.63, .4), (440, .25), (659.26, .15)]:
    add(np.sin(2 * np.pi * f * t) * g * bright, gain=0.035)

# pulsation grave sur la grille, qui se resserre avant la sortie du studio
for k in range(64):
    tb = k * BEAT
    if tb < T_RING or tb > T_IMPACT - 0.5: continue
    if tb < T_FACADE and k % 2: continue
    m = (t >= tb) & (t < tb + 0.35); tt = t[m] - tb
    s = np.zeros_like(t); s[m] = np.sin(2 * np.pi * (48 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9)
    add(s, gain=0.16 if tb < T_FACADE else 0.22)

def whoosh(tc, length, f0, f1, gain, pan=0.0, pan_move=0.0):
    a, b = tc - length, tc + length * 0.6
    e = np.clip((t - a) / (tc - a), 0, 1) ** 2 * (t < tc) + np.clip(1 - (t - tc) / (b - tc), 0, 1) ** 1.5 * (t >= tc)
    m = (t > a) & (t < b); n = np.zeros_like(t); n[m] = rng.standard_normal(m.sum())
    fc = f0 + (f1 - f0) * np.clip((t - a) / (tc - a), 0, 1)
    sig = np.zeros_like(t); sig[m] = lowpass(n[m], fc[m]) - lowpass(n[m], fc[m] * 0.25)
    for p in (pan - pan_move, pan + pan_move): add(sig * e, pan=p, gain=gain * 0.5)
whoosh(T_RING, 1.2, 300, 5000, 1.4)
whoosh(T_MIC + 0.6, 0.55, 200, 1800, 1.1, pan=-0.6)        # le micro passe à gauche
whoosh(T_FACADE, 1.8, 250, 6500, 1.6)
# résonance de l'anneau, scintillement du verre
m = t >= T_RING; tt = t[m] - T_RING
s = np.zeros_like(t); s[m] = sum(np.sin(2 * np.pi * f * tt) * a for f, a in [(880, 1), (1318.5, .6), (1760, .35)]) * np.exp(-tt * 1.6)
add(s, gain=0.05)
m = t >= T_FACADE; tt = t[m] - T_FACADE
s = np.zeros_like(t); s[m] = sum(np.sin(2 * np.pi * f * tt + k) * np.exp(-tt * (2 + k)) for k, f in enumerate([2637, 3520, 4186, 5274]))
add(s, gain=0.03)
# petit « tic » métallique sur la macro du début
m = t < 0.25; s = np.zeros_like(t); s[m] = np.sin(2 * np.pi * 3200 * t[m]) * np.exp(-t[m] * 40); add(s, gain=0.05)
# impact de la révélation du A monumental
m = t >= T_IMPACT; tt = t[m] - T_IMPACT
s = np.zeros_like(t); s[m] = np.sin(2 * np.pi * (34 + 60 * np.exp(-tt * 6)) * tt) * np.exp(-tt * 1.4)
n = np.zeros_like(t); n[m] = lowpass(rng.standard_normal(m.sum()), np.full(m.sum(), 900.0)) * np.exp(-tt * 5)
add(s, gain=0.55); add(n, gain=0.6)
# accord final quand l'enseigne est lisible
m = t >= T_SIGN; tt = t[m] - T_SIGN
s = np.zeros_like(t); s[m] = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 0.9) for f in [440, 554.37, 659.26, 880]) * np.clip(tt / 0.05, 0, 1)
add(s, gain=0.04)

mix = np.stack([L, R], 1); mix *= 0.89 / np.max(np.abs(mix))
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('son :', sys.argv[1], f'{DUR}s', 'crête', round(float(np.max(np.abs(mix))), 3))
