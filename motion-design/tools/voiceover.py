"""Calage et mixage de la voix off (ElevenLabs) sur la pub.

1. découpe la voix aux silences entre les mots (points de coupe affinés sur le minimum d'énergie),
2. place chaque morceau sur l'image (instants cibles ci-dessous),
3. traite la voix (filtre passe-haut, présence, compression, de-esser),
4. baisse automatiquement musique et bruitages sous la voix (ducking),
5. normalise à -14 LUFS (standard TikTok) et assemble les vidéos 9:16 et 16:9.

Usage : python3 tools/voiceover.py [fichier_voix]
"""
import numpy as np, subprocess, sys, os, wave
from scipy.signal import butter, sosfilt

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "out")
SR = 48000
DUR = 30.0
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "voix", "elevenlabs-roger.mp3")

def load(path, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).copy()
    return a.reshape(-1, ch) if ch > 1 else a

def save(path, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())

voice = load(SRC)
# enveloppe d'énergie (fenêtres de 10 ms) pour affiner les points de coupe
hop = SR // 100
rms = np.sqrt(np.convolve(voice ** 2, np.ones(hop) / hop, mode="same"))
def cut_at(a, b):
    """point de coupe = minimum d'énergie entre a et b (secondes source)"""
    i0, i1 = int(a * SR), int(b * SR)
    return (i0 + int(np.argmin(rms[i0:i1]))) / SR

# Morceaux : (fin du mot précédent, début du mot, fin du mot, début du suivant) issus de la transcription,
# et instant cible (en s dans la vidéo) où la parole du morceau doit démarrer.
#            texte                                         zone de coupe avant   zone de coupe après   début parole  cible
PIECES = [
    ("Tu crées sur TikTok ?",                              (0.00, 0.00),         (1.03, 1.40),         0.00,         0.55),
    ("Passe au niveau supérieur.",                         (1.03, 1.40),         (2.56, 2.88),         1.40,         1.65),
    ("Téléphone ou webcam,",                               (2.56, 2.88),         (3.94, 4.46),         2.88,         4.30),
    ("micro,",                                             (3.94, 4.46),         (4.72, 5.08),         4.46,         5.78),
    ("carte son,",                                         (4.72, 5.08),         (5.64, 5.96),         5.08,         6.66),
    ("ring light,",                                        (5.64, 5.96),         (6.50, 6.92),         5.96,         7.62),
    ("on crée ton setup, clé en main.",                    (6.50, 6.92),         (8.74, 9.16),         6.92,         8.36),
    ("Coaching personnalisé,",                             (8.74, 9.16),         (10.26, 10.52),       9.16,         10.44),
    ("concept,",                                           (10.26, 10.52),       (10.80, 11.24),       10.52,        11.76),
    ("formation,",                                         (10.80, 11.24),       (11.56, 12.20),       11.24,        12.26),
    ("on t'emmène jusqu'à tes objectifs.",                 (11.56, 12.20),       (13.90, 14.26),       12.20,        12.80),
    ("Tu es gameur ? Notre section gaming est faite pour toi.", (13.90, 14.26),  (17.20, 17.58),       14.26,        14.74),
    ("Et chaque mois, un événement entre créateurs.",      (17.20, 17.58),       (19.76, 20.30),       17.58,        17.92),
    ("Empira Agency.",                                     (19.76, 20.30),       (21.00, 21.62),       20.30,        22.35),
    ("Développer, accompagner, influencer.",               (21.00, 21.62),       (23.90, 24.46),       21.62,        24.05),
    ("Retrouve-nous sur TikTok : arobase Empira Agency.",  (23.90, 24.46),       (27.50, 27.79),       24.46,        26.25),
]

N = int(SR * DUR)
track = np.zeros(N)
FADE = int(0.012 * SR)
print(f"{'morceau':58s} source            → vidéo")
for text, before, after, onset, target in PIECES:
    s0 = 0.0 if before[1] == 0 else cut_at(*before)
    s1 = min(len(voice) / SR, cut_at(*after)) if after[1] < 27.7 else len(voice) / SR
    seg = voice[int(s0 * SR):int(s1 * SR)].copy()
    seg[:FADE] *= np.linspace(0, 1, FADE); seg[-FADE:] *= np.linspace(1, 0, FADE)
    d0 = target - (onset - s0)                    # la parole démarre pile à la cible
    i0 = int(round(d0 * SR)); n = min(len(seg), N - i0)
    track[i0:i0 + n] += seg[:n]
    print(f"{text[:56]:58s} {s0:5.2f}–{s1:5.2f}  →  {d0:5.2f}–{d0 + (s1 - s0):5.2f}")

# vérifie qu'aucun morceau ne se chevauche
assert np.max(np.abs(track)) < 1.5
save(os.path.join(OUT, ".voix-brute.wav"), track)

# traitement de la voix (ffmpeg) : passe-haut, présence, compression, de-esser
proc = os.path.join(OUT, "empira-voix.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, ".voix-brute.wav"), "-af",
                "highpass=f=75,equalizer=f=250:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.2,equalizer=f=9000:t=h:w=0.7:g=1.5,"
                "acompressor=threshold=-22dB:ratio=3:attack=6:release=90:makeup=3,deesser=i=0.35,alimiter=limit=0.89",
                "-ar", str(SR), proc], check=True)
v = load(proc, 2)

music, sfx = load(os.path.join(OUT, "empira-music.wav"), 2), load(os.path.join(OUT, "empira-sfx.wav"), 2)
L = min(len(v), len(music), len(sfx), N); v, music, sfx = v[:L], music[:L], sfx[:L]

# ducking : enveloppe de la voix → gain musique (-8 dB) et bruitages (-4 dB), attaque 60 ms / relâche 350 ms
env = np.sqrt(np.convolve(v.mean(1) ** 2, np.ones(SR // 50) / (SR // 50), mode="same"))
active = (env > 0.02).astype(float)
def smooth(x, att, rel):
    y = np.zeros_like(x); a_up, a_dn = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); acc = 0.0
    # (lissage asymétrique, vectorisé par blocs de 1 ms pour rester rapide)
    blk = SR // 1000; xb = x[: len(x) // blk * blk].reshape(-1, blk).max(1); yb = np.zeros_like(xb)
    au, ad = a_up ** blk, a_dn ** blk
    for i, val in enumerate(xb):
        acc = au * acc + (1 - au) * val if val > acc else ad * acc + (1 - ad) * val
        yb[i] = acc
    y[: len(yb) * blk] = np.repeat(yb, blk); y[len(yb) * blk:] = yb[-1]
    return y
duck = smooth(active, 0.06, 0.35)
gm = 10 ** (-8 * duck / 20); gs = 10 ** (-4 * duck / 20)
VOICE_GAIN = 10 ** (2.5 / 20)
mix = music * gm[:, None] + sfx * gs[:, None] + v * VOICE_GAIN
save(os.path.join(OUT, ".mix-pre.wav"), mix / max(1.0, np.max(np.abs(mix)) / 0.95))

# normalisation -14 LUFS / -1 dBTP (deux passes loudnorm)
import json
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(OUT, ".mix-pre.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
final = os.path.join(OUT, "empira-mix-voix.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, ".mix-pre.wav"), "-af",
                f"loudnorm=I=-14:TP=-1:LRA=9:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
                "-ar", str(SR), final], check=True)
for f in (".voix-brute.wav", ".mix-pre.wav"): os.remove(os.path.join(OUT, f))
print("mix →", final)

# vidéos finales
for ar, name in (("9x16", "empira-tiktok-9x16-voix.mp4"), ("16x9", "empira-16x9-voix.mp4")):
    src = os.path.join(OUT, f"v3-{ar}-silent.mp4")
    if not os.path.exists(src): print("absent :", src); continue
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", final, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", os.path.join(OUT, name)], check=True)
    print("vidéo →", name)
