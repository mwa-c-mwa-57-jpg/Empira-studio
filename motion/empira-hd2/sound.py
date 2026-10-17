"""Bande son : extrait du morceau Mixkit n°235 (136,02 BPM) calé pour que le drop tombe au 8e temps,
plus des bruitages synchronisés (impact du drop, whip pan, explosion finale).
Usage : python3 -I sound.py assets/music.mp3 out/audio.wav"""
import subprocess, sys, wave
import numpy as np
SR, BEAT = 48000, 60 / 136.02
DUR = 56 * BEAT
START = 14.114 - 8 * BEAT                       # drop du morceau à 14,114 s → 8e temps de la vidéo
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{START:.4f}', '-t', f'{DUR:.4f}', '-i', sys.argv[1], '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
mus = np.frombuffer(raw, '<i2').reshape(-1, 2).astype(float) / 32768
n = len(mus); t = np.arange(n) / SR
mus *= np.clip(t / 0.15, 0, 1)[:, None] * np.clip((DUR - t) / 1.4, 0, 1)[:, None]
rng = np.random.default_rng(3); sfx = np.zeros(n)
def lp(x, a):  # passe-bas une pôle
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc = a * acc + (1 - a) * v; y[i] = acc
    return y
def boom(tc, g):
    m = t >= tc; tt = t[m] - tc
    sfx[m] += g * np.sin(2 * np.pi * (38 + 70 * np.exp(-tt * 9)) * tt) * np.exp(-tt * 2.2)
def whoosh(tc, L, g):
    m = (t > tc - L) & (t < tc + L * 0.5); tt = t[m] - (tc - L)
    e = np.where(t[m] < tc, (tt / L) ** 2, np.clip(1 - (t[m] - tc) / (L * 0.5), 0, 1))
    sfx[m] += g * lp(rng.standard_normal(m.sum()), 0.82) * e
boom(8 * BEAT, 0.5); whoosh(24 * BEAT, 0.7, 0.35); boom(24 * BEAT, 0.25); boom(40 * BEAT, 0.55); whoosh(40 * BEAT, 0.9, 0.3)
mix = mus + sfx[:, None] * 0.8
mix *= 0.93 / np.max(np.abs(mix))
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print(f'son : {DUR:.2f} s, début du morceau à {START:.3f} s')
