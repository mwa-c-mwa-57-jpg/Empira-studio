"""Pub « Jeux & interactions » : étalonnage des photos Pexels et découpe des visuels du guide de jeux.

Photos : assets/photos-src/jeux/<id>.jpg → assets/photos/jeux/s_*.jpg (noir & or, plus ou moins de couleur gardée)
Guide  : assets/jeux-src/up/p<page>-y<y0>.png (agrandi ×4 par tools/upscale_guide.py) → assets/photos/jeux/<carte>.jpg
"""
import numpy as np, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets", "photos-src", "jeux")
UP = os.path.join(ROOT, "assets", "jeux-src", "up")
DST = os.path.join(ROOT, "assets", "photos", "jeux")
os.makedirs(DST, exist_ok=True)

GOLD = np.array([[0.00, .010, .008, .006], [0.18, .070, .045, .022], [0.42, .330, .200, .075],
                 [0.65, .760, .520, .220], [0.85, .960, .800, .470], [1.00, 1.00, .960, .880]])
BLOOD = np.array([[0.00, .008, .004, .004], [0.25, .090, .018, .014], [0.50, .330, .060, .040],
                  [0.75, .720, .260, .150], [1.00, .980, .820, .700]])
def gmap(y, stops): return np.stack([np.interp(y, stops[:, 0], stops[:, c + 1]) for c in range(3)], -1)
def smoothstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def soften_box(x0, y0, x1, y1, thr=0.45, blur=40):
    """écran d'ordinateur : le contenu devient une lueur (aucun texte ni image lisible)"""
    def f(im):
        import cv2
        a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
        m = np.zeros((H, W), np.float32); X0, Y0, X1, Y1 = int(W * x0), int(H * y0), int(W * x1), int(H * y1)
        box = a[Y0:Y1, X0:X1].mean(2) / 255 > thr
        box = cv2.morphologyEx(box.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((81, 81), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(box); big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        m[Y0:Y1, X0:X1] = (lab == big); m = cv2.GaussianBlur(m, (0, 0), 14)[..., None]
        bl = cv2.GaussianBlur(a, (0, 0), blur) * np.array([0.62, 0.5, 0.36])   # lueur dorée, moins éblouissante
        return Image.fromarray(np.clip(a * (1 - m) + bl * m, 0, 255).astype(np.uint8))
    return f

def grade(name, out, amount=0.6, black=0.03, gamma=1.0, sat=0.6, warm=0.08, exposure=1.0, stops=GOLD, maxw=3200, pre=None, crop=None):
    im = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
    if pre: im = pre(im)
    if crop: W, H = im.size; im = im.crop((int(W * crop[0]), int(H * crop[1]), int(W * crop[2]), int(H * crop[3])))
    if max(im.size) > maxw: im.thumbnail((maxw, maxw), Image.LANCZOS)
    a = np.clip(np.asarray(im).astype(np.float32) / 255.0 * exposure, 0, 1)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    y = np.clip((y - black) / (1 - black), 0, 1) ** gamma
    nat = y[..., None] + (a - y[..., None]) * sat
    nat[..., 0] *= 1 + warm; nat[..., 2] *= 1 - warm * 1.5
    o = np.clip(nat * (1 - amount) + gmap(y, stops) * amount, 0, 1)
    o = o + 0.2 * (smoothstep(0, 1, o) - o)
    Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8)).save(os.path.join(DST, out + ".jpg"), quality=92)
    print(out, im.size)

# Cartes du guide (pixels de la page source 1024 px de large ; bande agrandie qui les contient)
BANDS = {1: 245, 2: 216, 3: 240, 4: 240, 5: 274, 6: 571}
s = 1024 / 1067                           # mesures relevées sur un rendu de 1067 px de large
def R(x0, y0, x1, y1, inset=0): return tuple(int(round(v * s)) + d for v, d in zip((x0, y0, x1, y1), (inset, inset, -inset, -inset)))
CARDS = {
    1: {"chiliad": R(445, 312, 1050, 518), **{k: R(x, 795, x + d, 955, 5) for k, x, d in
        [("c_vehicule", 28, 165), ("c_destruction", 200, 165), ("c_teleport", 372, 163), ("c_opposee", 541, 159), ("c_spawn", 707, 163), ("c_obstacles", 877, 165)]}},
    2: {"tnt": R(452, 232, 1052, 515), **{k: R(32 + i * 145, 772, 170 + i * 145, 908, 5) for i, k in
        enumerate(["m_cubes", "m_tnt", "m_boost", "m_protect", "m_teleport", "m_obstacles", "m_autres"])}},
    3: {"obby": R(590, 262, 1045, 525), **{k: R(x, 596, x + d, 838, 5) for k, x, d in
        [("r_koth", 40, 148), ("r_highway", 196, 161), ("r_skyrush", 366, 162), ("r_ball", 537, 161), ("r_parkour", 708, 162), ("r_rail", 879, 161)]}},
    4: {**{k: R(32 + (i % 5) * 202, 678 + (i // 5) * 148, 226 + (i % 5) * 202, 810 + (i // 5) * 148, 5) for i, k in
        enumerate(["h_screamer", "h_bruit", "h_spawn", "h_objet", "h_teleport", "h_meteo", "h_lumieres", "h_vitesse", "h_effet", "h_chaos"])}},
    5: {f"g{i + 1:02d}": R(15 + (i % 2) * 530, 292 + (i // 2) * 195, 532 + (i % 2) * 522, 476 + (i // 2) * 195, 4) for i in range(10)},
    6: {f"d{i + 1:02d}": R(12 + (i % 4) * 267, 600 + (i // 4) * 242, 268 + (i % 4) * 263, 835 + (i // 4) * 244, 5) for i in range(12)},
}

def cards():
    for p, d in CARDS.items():
        band = os.path.join(UP, f"p{p}-y{BANDS[p]}.png")
        if not os.path.exists(band): print("absent :", band); continue
        im = Image.open(band).convert("RGB")
        for k, (x0, y0, x1, y1) in d.items():
            c = im.crop((x0 * 4, (y0 - BANDS[p]) * 4, x1 * 4, (y1 - BANDS[p]) * 4))
            if c.width > 1800: c = c.resize((1800, round(c.height * 1800 / c.width)), Image.LANCZOS)
            c.save(os.path.join(DST, k + ".jpg"), quality=90); print(k, c.size)

def blurred(src, out, width=900, radius=14, dim=0.45):
    """arrière-plan flou et assombri (remplit le cadre 9:16 derrière une carte)"""
    from PIL import ImageFilter, ImageEnhance
    im = Image.open(os.path.join(DST, src + ".jpg")).convert("RGB"); im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(radius))).enhance(dim); im.save(os.path.join(DST, out + ".jpg"), quality=88); print(out, im.size)

if "--cartes" not in sys.argv:
    grade("38498457", "s_setup", amount=0.5, black=0.02, sat=0.75, warm=0.04, exposure=1.05, pre=soften_box(0.25, 0.45, 0.66, 0.66))
    grade("30197525", "s_la", amount=0.35, black=0.02, sat=0.8, warm=0.05, maxw=4000, crop=(0.22, 0, 0.78, 1))
    grade("29547573", "s_forest", amount=0.85, black=0.02, sat=0.3, gamma=0.95, exposure=1.25, warm=0.0, stops=BLOOD)
    grade("30351933", "s_arcade", amount=0.35, black=0.02, sat=0.8, warm=0.03)
cards()
for src, out, r, dm in (("tnt", "tnt_bg", 12, 0.42), ("obby", "obby_bg", 12, 0.45), ("s_arcade", "arcade_bg", 10, 0.5)):
    if os.path.exists(os.path.join(DST, src + ".jpg")): blurred(src, out, radius=r, dim=dm)
# tailles réelles des images, lues par jeux.html
import json, glob
sizes = {os.path.basename(f)[:-4]: Image.open(f).size for f in sorted(glob.glob(os.path.join(DST, "*.jpg")))}
open(os.path.join(DST, "sizes.js"), "w").write("window.SIZES = " + json.dumps(sizes, separators=(",", ":")) + ";\n")
