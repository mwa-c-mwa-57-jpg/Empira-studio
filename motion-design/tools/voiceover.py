"""Calage et mixage de la voix off (ElevenLabs) sur la pub.

1. découpe la voix aux silences entre les mots (points de coupe affinés sur le minimum d'énergie),
2. place chaque morceau sur l'image (instants cibles ci-dessous),
3. traite la voix (filtre passe-haut, présence, compression, de-esser),
4. baisse automatiquement musique et bruitages sous la voix (ducking),
5. normalise à -14 LUFS (standard TikTok) et assemble les vidéos 9:16 et 16:9.

Usage : python3 tools/voiceover.py [pub|gaming] [fichier_voix] [--dry] [--sans-musique]
        --dry : affiche le calage, sans mixer ; --sans-musique : voix off + bruitages seulement (fichiers suffixés -sans-musique)
"""
import numpy as np, subprocess, sys, os, wave
from scipy.signal import butter, sosfilt

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "out")
SR = 48000
DUR = 30.0
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PROJ = ARGS[0] if ARGS else "pub"
NO_MUSIC = "--sans-musique" in sys.argv
TAG = "-sans-musique" if NO_MUSIC else ""

def load(path, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).copy()
    return a.reshape(-1, ch) if ch > 1 else a

def save(path, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())

# Morceaux : zones de coupe (silence avant / après le morceau, en s dans le fichier source), début de la parole
# (None = détecté sur l'énergie), instant cible (en s dans la vidéo) où la parole doit démarrer, et en option
# un facteur de vitesse (atempo, sans changer la hauteur). Zone après = None : jusqu'à la fin du fichier.
#            texte                                         zone de coupe avant   zone de coupe après   début parole  cible
PUB = [
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
    ("Retrouve-nous sur TikTok : arobase Empira Agency.",  (23.90, 24.46),       None,                 24.46,        26.25),
]


GAMING = [
    ("Tu fais du gaming sur TikTok ?",                     (0.00, 0.00),         (1.39, 1.78),         None,         0.40),
    ("Passe en mode Empira Gaming.",                       (1.39, 1.78),         (3.27, 3.66),         None,         2.05),
    ("Des lives interactifs :",                            (3.27, 3.66),         (4.80, 5.15),         None,         4.40),
    ("un like, un commentaire…",                           (4.80, 5.15),         (6.45, 6.81),         None,         5.90),
    ("et ta communauté joue avec toi, en direct.",         (6.45, 6.81),         (8.99, 9.29),         None,         7.40),
    ("Casques,",                                           (8.99, 9.29),         (9.70, 9.79),         None,         10.55),
    ("micros,",                                            (9.70, 9.79),         (10.31, 10.40),       None,         11.95),
    ("claviers, caméras :",                                (10.31, 10.40),       (11.42, 11.76),       None,         13.00),
    ("on monte ton setup gaming avec toi.",                (11.42, 11.76),       (13.40, 13.77),       None,         14.15),
    ("Concept,",                                           (13.40, 13.77),       (14.27, 14.38),       None,         16.00),
    ("stratégie,",                                         (14.27, 14.38),       (15.04, 15.09),       None,         16.62),
    ("formation :",                                        (15.04, 15.09),       (15.69, 16.05),       None,         17.40),
    ("on t'aide à faire level up ta chaîne.",              (15.69, 16.05),       (17.60, 18.02),       None,         18.20),
    ("Prêt ?",                                             (17.60, 18.02),       (18.24, 18.67),       None,         20.35),
    ("Appuie sur A.",                                      (18.24, 18.67),       (19.37, 19.80),       None,         20.80),
    ("Empira Gaming.",                                     (19.37, 19.80),       (20.63, 20.98),       None,         22.30),
    ("Développer, accompagner, influencer.",               (20.63, 20.98),       (23.28, 23.69),       None,         23.42),
    ("Retrouve-nous sur TikTok : arobase clarkydog_23.",   (23.28, 23.69),       None,                 None,         25.90, 1.08),
]

PROJECTS = {
    "pub":    dict(voice="elevenlabs-roger.mp3", stems="empira", master="v3-{ar}-silent.mp4", pieces=PUB,
                   videos={"9x16": "empira-tiktok-9x16-voix.mp4", "16x9": "empira-16x9-voix.mp4"}),
    "gaming": dict(voice="gaming-benjamin.mp3", stems="gaming", master="gaming-{ar}-silent.mp4", pieces=GAMING,
                   videos={"9x16": "gaming-tiktok-9x16-voix.mp4", "16x9": "gaming-16x9-voix.mp4"}),
}
P = PROJECTS[PROJ]
SRC = ARGS[1] if len(ARGS) > 1 else os.path.join(ROOT, "assets", "voix", P["voice"])

voice = load(SRC)
# enveloppe d'énergie (fenêtres de 10 ms) pour affiner les points de coupe
hop = SR // 100
rms = np.sqrt(np.convolve(voice ** 2, np.ones(hop) / hop, mode="same"))
def cut_at(a, b):
    """point de coupe = minimum d'énergie entre a et b (secondes source)"""
    i0, i1 = int(a * SR), int(b * SR)
    return (i0 + int(np.argmin(rms[i0:i1]))) / SR
THR = rms.max() * 10 ** (-32 / 20)                 # seuil de parole : -32 dB sous le pic
def speech(s0, s1):
    """début et fin de la parole entre s0 et s1 (secondes source)"""
    idx = np.flatnonzero(rms[int(s0 * SR):int(s1 * SR)] > THR)
    return s0 + idx[0] / SR, s0 + idx[-1] / SR

def stretch(seg, tempo):
    """accélère un morceau sans changer la hauteur de la voix (ffmpeg atempo)"""
    tmp = os.path.join(OUT, ".seg.wav"); save(tmp, seg)
    out = load_filtered(tmp, f"atempo={tempo}"); os.remove(tmp)
    return out

def load_filtered(path, af):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-af", af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


N = int(SR * DUR)
track = np.zeros(N)
FADE = int(0.012 * SR)
print(f"{'morceau':52s} source         → parole dans la vidéo")
spans = []
for text, before, after, onset, target, *opt in P["pieces"]:
    tempo = opt[0] if opt else 1.0
    s0 = 0.0 if before[1] == 0 else cut_at(*before)
    s1 = len(voice) / SR if after is None else cut_at(*after)
    on, off = speech(s0, s1)
    if onset is None: onset = on
    seg = voice[int(s0 * SR):int(s1 * SR)].copy()
    if tempo != 1.0: seg = stretch(seg, tempo)
    seg[:FADE] *= np.linspace(0, 1, FADE); seg[-FADE:] *= np.linspace(1, 0, FADE)
    d0 = target - (onset - s0) / tempo            # la parole démarre pile à la cible
    i0 = int(round(d0 * SR)); n = min(len(seg), N - i0)
    track[i0:i0 + n] += seg[:n]
    spans.append((target, d0 + (off - s0) / tempo))
    print(f"{text[:50]:52s} {s0:5.2f}–{s1:5.2f}  →  {spans[-1][0]:5.2f}–{spans[-1][1]:5.2f}" + (f"  (×{tempo})" if tempo != 1.0 else ""))
gaps = [b[0] - a[1] for a, b in zip(spans, spans[1:])]
print(f"plus petit blanc entre deux morceaux : {min(gaps):.2f} s ; fin de la voix : {spans[-1][1]:.2f} s")
if min(gaps) < 0.08: print("attention : deux morceaux se touchent")
if "--dry" in sys.argv: sys.exit()

# vérifie qu'aucun morceau ne se chevauche
assert np.max(np.abs(track)) < 1.5
save(os.path.join(OUT, ".voix-brute.wav"), track)

# traitement de la voix (ffmpeg) : passe-haut, présence, compression, de-esser
proc = os.path.join(OUT, f"{P['stems']}-voix.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, ".voix-brute.wav"), "-af",
                "highpass=f=75,equalizer=f=250:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.2,equalizer=f=9000:t=h:w=0.7:g=1.5,"
                "acompressor=threshold=-22dB:ratio=3:attack=6:release=90:makeup=3,deesser=i=0.35,alimiter=limit=0.89",
                "-ar", str(SR), proc], check=True)
v = load(proc, 2)

music, sfx = load(os.path.join(OUT, f"{P['stems']}-music.wav"), 2), load(os.path.join(OUT, f"{P['stems']}-sfx.wav"), 2)
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
mix = music * gm[:, None] * (0 if NO_MUSIC else 1) + sfx * gs[:, None] + v * VOICE_GAIN
save(os.path.join(OUT, ".mix-pre.wav"), mix / max(1.0, np.max(np.abs(mix)) / 0.95))

# normalisation -14 LUFS / -1 dBTP (deux passes loudnorm)
import json
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(OUT, ".mix-pre.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
final = os.path.join(OUT, f"{P['stems']}-mix-voix{TAG}.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, ".mix-pre.wav"), "-af",
                f"loudnorm=I=-14:TP=-1:LRA=9:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
                "-ar", str(SR), final], check=True)
for f in (".voix-brute.wav", ".mix-pre.wav"): os.remove(os.path.join(OUT, f))
print("mix →", final)

# vidéos finales
for ar, name in P["videos"].items():
    name = name.replace(".mp4", f"{TAG}.mp4")
    src = os.path.join(OUT, P["master"].format(ar=ar))
    if not os.path.exists(src): print("absent :", src); continue
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", final, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", os.path.join(OUT, name)], check=True)
    print("vidéo →", name)
